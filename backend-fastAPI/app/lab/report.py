"""실험 집계, 통과 판정, 리포트(C-6, C-7).

입력: DATA_DIR/lab/manifest.jsonl, reviews.jsonl. 출력: DATA_DIR/lab/report/summary.json, index.html.
사용: uv run python -m app.lab.report [--markdown -]
수치는 summary.json에 소수 둘째 자리로 저장하고, HTML과 마크다운은 그 값을 fmt()로만 찍는다.
"""
import argparse
import json
import math
import statistics
import sys
from collections import Counter
from datetime import datetime, timezone
from html import escape
from pathlib import Path

from app.core.config import settings
from app.lab.review import BASE_ARM, PROTOCOL, _lab_dir, _manifest_lines, build_tasks
from app.lab.runner import Lab, kst

ARMS = [a["id"] for a in PROTOCOL["arms"]]
CONDITIONS = [c["id"] for c in PROTOCOL["conditions"]]
PASS = PROTOCOL["pass"]
REVIEWERS_NEEDED = 3
BASE_WARN_BELOW = 4.0
FAILED = ("declined", "timeout", "no_image", "error")
ARM_COLUMNS = [
    ("ok", "성공 장수"), ("declined", "declined"), ("timeout", "timeout"), ("no_image", "no_image"),
    ("error", "error"), ("skipped", "skipped"), ("attempts_mean", "평균 시도"),
    ("latency_median_s", "지연 중앙값(초)"), ("latency_p95_s", "지연 p95(초)"),
    ("limit_per_image", "장당 한도 소진(%p)"), ("resemblance_mean", "닮음 평균"),
    ("resemblance_low_pct", "닮음 2점 이하(%)"), ("consistency_mean", "일관성 평균"),
    ("consistency_low_pct", "일관성 2점 이하(%)"), ("usable_pct", "사용 가능(%)"), ("tag_count", "태그 수"),
    ("passed", "통과"),
]


def fmt(value) -> str:
    if value is None:
        return "-"
    if isinstance(value, bool):
        return "통과" if value else "탈락"
    if isinstance(value, int):
        return str(value)
    return f"{value:.2f}"


def _round(obj):
    if isinstance(obj, float):
        return round(obj, 2)
    if isinstance(obj, dict):
        return {k: _round(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_round(v) for v in obj]
    return obj


def _mean(values):
    return statistics.fmean(values) if values else None


def _low_rate(scores):
    return sum(s <= PASS["low_score_max"] for s in scores) / len(scores) if scores else None


def _pct(rate):
    return None if rate is None else rate * 100


def arm_passed(arm: dict) -> bool:
    """C-7 통과 규칙. 반올림하지 않은 값으로 판정한다."""
    values = [arm.get(k) for k in ("resemblance_mean", "consistency_mean", "resemblance_low_rate", "consistency_low_rate")]
    if any(v is None for v in values):
        return False
    res, con, res_low, con_low = values
    return (res >= PASS["mean_min"] and con >= PASS["mean_min"]
            and res_low <= PASS["low_rate_max"] and con_low <= PASS["low_rate_max"])


def decide(arms: dict) -> dict:
    """C-7 선정 규칙: 통과한 비교군 중 닮음 최고, 차이 0.1 미만이면 일관성, 한도 소진량, 지연 중앙값 순."""
    passed = [a for a, s in arms.items() if arm_passed(s)]
    if not passed:
        scored = [a for a, s in arms.items() if s.get("resemblance_mean") is not None]
        best = max(scored, key=lambda a: arms[a]["resemblance_mean"]) if scored else None
        text = PROTOCOL["selection"]["none_passed"]
        if best:
            text += f". 닮음 평균 최고: {best} ({fmt(float(arms[best]['resemblance_mean']))})"
        return {"winner": None, "best": best, "text": text}
    top = max(arms[a]["resemblance_mean"] for a in passed)
    tie = PROTOCOL["selection"]["tie_threshold"]
    close = [a for a in passed if round(top - arms[a]["resemblance_mean"], 6) < tie]

    def rank(a):
        s = arms[a]
        return (-s["consistency_mean"],
                math.inf if s.get("limit_per_image") is None else s["limit_per_image"],
                math.inf if s.get("latency_median_s") is None else s["latency_median_s"])

    winner = min(close, key=rank)
    s = arms[winner]
    text = (f"선정: {winner} - 닮음 평균 {fmt(float(s['resemblance_mean']))}, "
            f"일관성 평균 {fmt(float(s['consistency_mean']))}")
    return {"winner": winner, "best": winner, "text": text}


def _read_reviews(lab: Path):
    """(검토자, 과제)별 마지막 기록과 깨진 줄 수."""
    path = lab / "reviews.jsonl"
    latest, skipped = {}, 0
    if not path.is_file():
        return latest, skipped
    for raw in path.read_text(encoding="utf-8", errors="replace").split("\n"):
        if not raw.strip():
            continue
        try:
            r = json.loads(raw)
            score = r["score"]
            if not (isinstance(r["reviewer"], str) and isinstance(r["taskId"], str)
                    and type(score) is int and 1 <= score <= 5):
                raise ValueError
        except (ValueError, KeyError, TypeError):
            skipped += 1
            continue
        latest[(r["reviewer"], r["taskId"])] = r
    return latest, skipped


def _picture_url(task: dict, data_dir: Path) -> str:
    try:
        return "/files/" + Path(task["image_paths"][0]).relative_to(data_dir / "files").as_posix()
    except ValueError:
        return f"/lab/api/image/{task['taskId']}/1"


def _arm_stats(arm: dict, lines: list[dict], res: list[dict], con_scores: list[int]) -> dict:
    ok = [x for x in lines if x.get("status") in ("ok", "modified")]
    counts = Counter("skipped" if str(x.get("status")).startswith("skipped") else x.get("status") for x in lines)
    latency = sorted(x["latency_ms"] / 1000 for x in ok if isinstance(x.get("latency_ms"), (int, float)))
    attempts = [x["attempts"] for x in lines if isinstance(x.get("attempts"), (int, float)) and x["attempts"] > 0]
    if arm["method"].startswith("baseline"):
        limit = 0.0
    else:
        # 실패한 시도가 쓴 한도도 성공한 그림 값에 얹는다(결과물당 비용). 창이 바뀌어 줄어든 값은 0으로 본다.
        spent = [max(x["limit"]["used_percent_after"] - x["limit"]["used_percent_before"], 0) for x in lines
                 if isinstance(x.get("limit"), dict) and x["limit"].get("used_percent_after") is not None
                 and x["limit"].get("used_percent_before") is not None]
        limit = sum(spent) / len(ok) if ok and spent else None
    scores = [r["score"] for r in res]
    usable = [r["usable"] for r in res if isinstance(r.get("usable"), bool)]
    tags = Counter(t for r in res for t in (r.get("tags") or []) if isinstance(t, str))
    stats = {
        "name": f"{arm['label']} / 참조: {arm['reference']}",
        "ok": len(ok), **{k: counts.get(k, 0) for k in FAILED + ("skipped",)},
        "attempts_mean": _mean(attempts),
        "latency_median_s": statistics.median(latency) if latency else None,
        "latency_p95_s": latency[math.ceil(0.95 * len(latency)) - 1] if latency else None,
        "limit_per_image": limit,
        "resemblance_mean": _mean(scores), "resemblance_low_rate": _low_rate(scores),
        "consistency_mean": _mean(con_scores), "consistency_low_rate": _low_rate(con_scores),
        "usable_pct": _pct(sum(usable) / len(usable)) if usable else None,
        "tag_count": sum(tags.values()), "tags": dict(sorted(tags.items())),
    }
    stats["resemblance_low_pct"] = _pct(stats["resemblance_low_rate"])
    stats["consistency_low_pct"] = _pct(stats["consistency_low_rate"])
    stats["passed"] = arm_passed(stats) if scores or con_scores else None
    return stats


def summarize(data_dir=None) -> dict:
    data_dir = Path(data_dir or settings.DATA_DIR)
    lab = _lab_dir(data_dir)
    tasks = build_tasks(data_dir)
    by_id = {t["taskId"]: t for t in tasks}
    latest, skipped_lines = _read_reviews(lab)
    reviews: dict[str, list[dict]] = {}
    done_by_reviewer: dict[str, set] = {}
    for (reviewer, task_id), r in latest.items():
        if task_id in by_id:
            reviews.setdefault(task_id, []).append(r)
            done_by_reviewer.setdefault(reviewer, set()).add(task_id)
    done = sum(len(ids) == len(by_id) for ids in done_by_reviewer.values()) if by_id else 0

    final: dict[tuple, dict] = {}
    for line in _manifest_lines(lab):
        arm = str(line.get("arm"))
        key = (line.get("photo_id"), arm) if arm == BASE_ARM else (
            line.get("photo_id"), arm, line.get("condition"), line.get("round"))
        final[key] = line
    lines = list(final.values())

    raw = {}
    for arm in PROTOCOL["arms"]:
        mine = [t for t in tasks if t["arm"] == arm["id"]]
        res = [r for t in mine if t["type"] == "resemblance" for r in reviews.get(t["taskId"], [])]
        con = [r["score"] for t in mine if t["type"] == "consistency" for r in reviews.get(t["taskId"], [])]
        raw[arm["id"]] = _arm_stats(arm, [x for x in lines if x.get("arm") == arm["id"]], res, con)

    conditions = {
        c: {a: _mean([r["score"] for t in tasks if t["type"] == "resemblance" and (t["arm"], t["condition"]) == (a, c)
                      for r in reviews.get(t["taskId"], [])]) for a in ARMS}
        for c in CONDITIONS
    }

    regenerate, gallery = [], {c: {a: [] for a in ARMS} for c in CONDITIONS}
    for t in tasks:
        if t["type"] != "resemblance" or t["arm"] not in ARMS or t["condition"] not in CONDITIONS:
            continue
        url = _picture_url(t, data_dir)
        gallery[t["condition"]][t["arm"]].append({"round": t["round"], "url": url})
        rs = reviews.get(t["taskId"], [])
        low = sum(r["score"] <= PASS["low_score_max"] for r in rs)
        votes = [r["usable"] for r in rs if isinstance(r.get("usable"), bool)]
        unusable = votes.count(False)
        if low or unusable * 2 > len(votes):
            regenerate.append({"arm": t["arm"], "condition": t["condition"], "round": t["round"], "url": url,
                               "low_scores": low, "unusable": unusable, "reviews": len(rs)})

    base_tasks = [t for t in tasks if t["arm"] == BASE_ARM]
    any_res = next((t for t in tasks if t["type"] == "resemblance"), None)
    source = base_tasks[0] if base_tasks else any_res
    base = {
        "resemblance_mean": _mean([r["score"] for t in base_tasks for r in reviews.get(t["taskId"], [])]),
        "photo_url": f"/lab/api/image/{source['taskId']}/0" if source else None,
        "image_url": f"/lab/api/image/{base_tasks[0]['taskId']}/1" if base_tasks else None,
    }

    statuses = Counter(str(x.get("status")) for x in lines)
    warnings = ["B0는 결정적이라 1회만 실행했다(반복 결과 비교 대상이 아니다)."]
    if any(str(x.get("status")).startswith("skipped") for x in lines if x.get("arm") in ("B0", "B1")):
        warnings.append("기준선 재현 불가: 이 환경에서 기준선(B0, B1)을 실행하지 못해 건너뛰었다.")
    # 한도 규칙으로 멈춘 실험은 limit 줄을 남기지 않는다: 실행기의 상태를 따른다.
    # ponytail: 마지막 줄의 사진 하나만 본다(실행기가 settings.DATA_DIR을 읽는다). 사진이 여럿이면 사진별로 묻는다
    photo = next((x["photo_path"] for x in reversed(lines) if x.get("photo_path")), None)
    try:
        state = Lab(photo).status() if photo else {}
    except OSError:  # 사진 파일이 없다
        state = {}
    if state.get("paused") == "limit":
        warnings.append(f"실험이 한도로 중단됨: 초기화 시각 {kst(state['resets_at'])} 이후에 "
                        "uv run python -m app.lab run --rounds auto 로 이어서 실행한다.")
    if statuses["declined"]:
        where = "기준 캐릭터 포함, " if any(x.get("arm") == BASE_ARM and x.get("status") == "declined" for x in lines) else ""
        warnings.append(f"실제 사진 거절: {where}declined {statuses['declined']}건.")
    if base["resemblance_mean"] is not None and base["resemblance_mean"] < BASE_WARN_BELOW:
        warnings.append(f"기준 캐릭터가 닮지 않아 G2와 G3가 낮게 나올 수 있다(기준 캐릭터 닮음 평균 "
                        f"{fmt(float(base['resemblance_mean']))}, 사람이 승인한 캐릭터가 아니다).")

    decision = None
    if done >= REVIEWERS_NEEDED:
        decision = decide(raw)
        if decision["winner"] is None:
            decision["failing_conditions"] = [
                {"arm": a, "condition": c, "resemblance_mean": conditions[c][a]}
                for a in ARMS for c in CONDITIONS
                if conditions[c][a] is not None and conditions[c][a] < PASS["mean_min"]]
    for stats in raw.values():
        del stats["resemblance_low_rate"], stats["consistency_low_rate"]
    return _round({
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "status": f"검토 {'완료' if done >= REVIEWERS_NEEDED else '대기'} (완료 {done}/{REVIEWERS_NEEDED})",
        "reviewers_done": done,
        "total_tasks": len(by_id),
        "decision": decision,
        "warnings": warnings,
        "skipped_lines": skipped_lines,
        "base": base,
        "arms": raw,
        "conditions": conditions,
        "regenerate": regenerate,
        "gallery": gallery,
    })


def _table(head: list[str], rows: list[list[str]]) -> str:
    out = ["| " + " | ".join(head) + " |", "|" + " --- |" * len(head)]
    out += ["| " + " | ".join(r) + " |" for r in rows]
    return "\n".join(out)


def render_markdown(s: dict) -> str:
    parts = ["# 꿈도깨비 비교 실험 리포트", f"상태: {s['status']}"]
    parts.append(f"결론: {s['decision']['text']}" if s["decision"] else "결론: 없음(검토 대기, 아래 수치는 중간 집계)")
    parts.append("## 경고\n" + "\n".join(f"- {w}" for w in s["warnings"]))
    parts.append("## 비교군별 집계\n" + _table(
        ["비교군", "방식"] + [label for _, label in ARM_COLUMNS],
        [[a, s["arms"][a]["name"]] + [fmt(s["arms"][a][k]) for k, _ in ARM_COLUMNS] for a in ARMS]))
    parts.append("## 기준 캐릭터\n" + _table(["대상", "닮음 평균"], [["기준 캐릭터", fmt(s["base"]["resemblance_mean"])]]))
    parts.append("## 조건별 닮음 평균\n" + _table(
        ["조건"] + ARMS, [[c] + [fmt(s["conditions"][c][a]) for a in ARMS] for c in CONDITIONS]))
    parts.append("## 재생성 필요 목록\n" + (_table(
        ["그림", "2점 이하", "사용 불가", "검토 수"],
        [[f"{x['arm']}/{x['condition']}/r{x['round']}", fmt(x["low_scores"]), fmt(x["unusable"]), fmt(x["reviews"])]
         for x in s["regenerate"]]) if s["regenerate"] else "없음"))
    parts.append(f"깨진 검토 줄: {s['skipped_lines']}")
    return "\n\n".join(parts) + "\n"


CSS = """
:root{--accent:#2f5bff;--soft:#e3e9ff;--on-accent:#fff;--bg:#fff;--fg:#14161f;--muted:#5b6172;--line:#dfe3ee;--warn:#8a4b00;--warn-bg:#fff4e0}
@media (prefers-color-scheme:dark){:root{--accent:#7d9bff;--soft:#1e2a4d;--on-accent:#0b0f1a;--bg:#0b0f1a;--fg:#e9ecf5;--muted:#9aa3ba;--line:#283046;--warn:#ffc978;--warn-bg:#33270f}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI",sans-serif;line-height:1.5;word-break:keep-all;overflow-wrap:break-word}
main{max-width:1200px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:28px;margin:0 0 12px}
h2{font-size:18px;margin:40px 0 12px;color:var(--accent)}
.badge{display:inline-block;background:var(--accent);color:var(--on-accent);border-radius:999px;padding:4px 14px;font-weight:700}
.decision{background:var(--soft);border-left:4px solid var(--accent);padding:14px 18px;border-radius:8px;margin:16px 0;font-size:18px;font-weight:600}
.muted{color:var(--muted);font-size:14px}
.warnings{background:var(--warn-bg);color:var(--warn);border-radius:8px;padding:12px 18px 12px 34px;margin:0}
.scroll{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:14px;font-variant-numeric:tabular-nums}
th,td{border-bottom:1px solid var(--line);padding:8px 7px;text-align:right;white-space:nowrap}
th{text-align:left;font-weight:600}
thead th{background:var(--soft);text-align:right;white-space:normal;word-break:keep-all;vertical-align:bottom}
thead th:first-child,thead th.name{text-align:left}
td.name{text-align:left;white-space:normal;min-width:170px;color:var(--muted)}
tr.win th:first-child{color:var(--accent)}
.sources{display:flex;gap:20px;flex-wrap:wrap}
figure{margin:0}
figcaption{font-size:13px;color:var(--muted);margin-top:4px}
img.source{height:260px;border-radius:10px;border:1px solid var(--line)}
.gallery td{text-align:center;vertical-align:top;white-space:normal}
.gallery img,.regen img{width:96px;border-radius:6px;border:1px solid var(--line);margin:2px}
.gallery th small{display:block;font-weight:400;color:var(--muted);white-space:normal;max-width:180px}
.regen{display:flex;flex-wrap:wrap;gap:12px;padding:0;list-style:none}
.regen li{font-size:13px;width:110px}
"""


def render_html(s: dict) -> str:
    e = escape
    caption = {c["id"]: c["caption_ko"] for c in PROTOCOL["conditions"]}
    winner = s["decision"]["winner"] if s["decision"] else None

    arm_rows = "".join(
        f'<tr{" class=\"win\"" if a == winner else ""}><th>{a}</th><td class="name">{e(s["arms"][a]["name"])}</td>'
        + "".join(f"<td>{fmt(s['arms'][a][k])}</td>" for k, _ in ARM_COLUMNS) + "</tr>" for a in ARMS)
    cond_rows = "".join(
        f'<tr><th>{c}<br><span class="muted">{e(caption[c])}</span></th>'
        + "".join(f"<td>{fmt(s['conditions'][c][a])}</td>" for a in ARMS) + "</tr>" for c in CONDITIONS)
    gallery_rows = "".join(
        f"<tr><th>{c}<small>{e(caption[c])}</small></th>" + "".join(
            '<td class="cell">' + "".join(
                f'<img src="{e(p["url"])}" alt="{a} {c} {p["round"]}회차" title="{a} {c} {p["round"]}회차">'
                for p in s["gallery"][c][a]) + "</td>" for a in ARMS) + "</tr>" for c in CONDITIONS)

    base = s["base"]
    if base["photo_url"]:
        sources = f'<figure><img class="source" src="{e(base["photo_url"])}" alt="원본 사진"><figcaption>원본 사진</figcaption></figure>'
        if base["image_url"]:
            sources += (f'<figure><img class="source" src="{e(base["image_url"])}" alt="기준 캐릭터">'
                        f'<figcaption>기준 캐릭터 (G2, G3의 참조) - 닮음 평균 {fmt(base["resemblance_mean"])}</figcaption></figure>')
    else:
        sources = '<p class="muted">표시할 그림이 없습니다</p>'

    if s["decision"]:
        decision = f'<p class="decision">{e(s["decision"]["text"])}</p>'
        failing = s["decision"].get("failing_conditions")
        if failing:
            decision += '<p class="muted">조건별 미달: ' + ", ".join(
                f'{x["arm"]}/{x["condition"]} {fmt(x["resemblance_mean"])}' for x in failing) + "</p>"
    else:
        decision = '<p class="muted">검토자 3명이 모든 과제를 끝내기 전이라 결론이 없습니다. 아래 수치는 참고용 중간 집계입니다.</p>'

    regen = "".join(
        f'<li><img src="{e(x["url"])}" alt="{x["arm"]} {x["condition"]} {x["round"]}회차"><br>'
        f'{x["arm"]} / {x["condition"]} / {x["round"]}회차<br><span class="muted">2점 이하 {fmt(x["low_scores"])}, '
        f'사용 불가 {fmt(x["unusable"])} / 검토 {fmt(x["reviews"])}</span></li>' for x in s["regenerate"])
    tags = "".join(
        f'<tr><th>{a}</th><td class="name">'
        + e(", ".join(f"{k} {v}" for k, v in s["arms"][a]["tags"].items()) or "-") + "</td></tr>" for a in ARMS)

    return f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>꿈도깨비 비교 실험 리포트</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
<style>{CSS}</style>
</head>
<body>
<main>
<h1>꿈도깨비 비교 실험 리포트</h1>
<span class="badge">{e(s["status"])}</span>
<span class="muted">과제 {fmt(s["total_tasks"])}개 · 깨진 검토 줄 {fmt(s["skipped_lines"])} · 생성 {e(s["generated_at"])}</span>
{decision}
<h2>경고</h2>
<ul class="warnings">{"".join(f"<li>{e(w)}</li>" for w in s["warnings"])}</ul>
<h2>원본 사진과 기준 캐릭터</h2>
<div class="sources">{sources}</div>
<h2>비교군별 집계</h2>
<div class="scroll"><table>
<thead><tr><th>비교군</th><th class="name">방식</th>{"".join(f"<th>{e(label)}</th>" for _, label in ARM_COLUMNS)}</tr></thead>
<tbody>{arm_rows}</tbody>
</table></div>
<p class="muted">통과 기준: 닮음 평균과 일관성 평균이 각각 4.00 이상, 2점 이하 비율이 각각 10.00% 이하. 기준 캐릭터 닮음 평균: {fmt(base["resemblance_mean"])}</p>
<h2>조건별 닮음 평균 (얼굴이 달라지는 조건)</h2>
<div class="scroll"><table>
<thead><tr><th>조건</th>{"".join(f"<th>{a}</th>" for a in ARMS)}</tr></thead>
<tbody>{cond_rows}</tbody>
</table></div>
<h2>갤러리: 조건(행) x 비교군(열)</h2>
<div class="scroll"><table class="gallery">
<thead><tr><th>조건</th>{"".join(f'<th>{a}<small>{e(s["arms"][a]["name"])}</small></th>' for a in ARMS)}</tr></thead>
<tbody>{gallery_rows}</tbody>
</table></div>
<h2>재생성 필요 목록 ({fmt(len(s["regenerate"]))}장)</h2>
<p class="muted">2점 이하가 한 번이라도 있거나 사용 불가가 과반인 그림.</p>
{f'<ul class="regen">{regen}</ul>' if regen else '<p class="muted">없음</p>'}
<h2>실패 유형 태그</h2>
<div class="scroll"><table><tbody>{tags}</tbody></table></div>
</main>
</body>
</html>
"""


def build(data_dir=None) -> dict:
    """집계하고 summary.json과 index.html을 덮어쓴다."""
    data_dir = Path(data_dir or settings.DATA_DIR)
    summary = summarize(data_dir)
    out = _lab_dir(data_dir) / "report"
    out.mkdir(parents=True, exist_ok=True)
    (out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "index.html").write_text(render_html(summary), encoding="utf-8")
    return summary


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="실험 리포트를 만든다.")
    parser.add_argument("--markdown", metavar="경로", help="같은 수치를 마크다운 표로 쓴다. '-'는 표준 출력")
    args = parser.parse_args(argv)
    summary = build()
    out = _lab_dir() / "report"
    print(f"{summary['status']}: {out / 'summary.json'}, {out / 'index.html'}", file=sys.stderr)
    if args.markdown == "-":
        sys.stdout.write(render_markdown(summary))
    elif args.markdown:
        Path(args.markdown).write_text(render_markdown(summary), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
