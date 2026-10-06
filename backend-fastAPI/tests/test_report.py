"""할 일 24: 집계, 통과 판정, 리포트. C-6, C-7 참조."""
import json
import re
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.lab import report, review, runner
from app.main import app

sys.path.insert(0, str(Path(__file__).parent / "fixtures"))
import make_lab_fixture  # noqa: E402

ARMS = ["B0", "B1", "G1", "G2", "G3"]
CONDITIONS = ["front", "side", "expression", "full_body", "outfit"]


def _arm(res=4.2, con=4.1, low=0.05, con_low=0.05, limit=0.5, latency=30.0):
    return {"resemblance_mean": res, "consistency_mean": con, "resemblance_low_rate": low,
            "consistency_low_rate": con_low, "limit_per_image": limit, "latency_median_s": latency}


def _write_reviews(data_dir, reviewers, score, mode="w"):
    """score(reviewer, task) -> 점수 또는 None(건너뜀)."""
    with (data_dir / "lab" / "reviews.jsonl").open(mode, encoding="utf-8") as f:
        for reviewer in reviewers:
            for task in review.build_tasks(data_dir):
                s = score(reviewer, task)
                if s is None:
                    continue
                picture = task["type"] == "resemblance"
                f.write(json.dumps({
                    "reviewer": reviewer, "taskId": task["taskId"], "key": task["key"], "type": task["type"],
                    "score": s, "usable": s >= 4 if picture else None, "tags": [], "at": "2026-10-02T10:00:00+00:00",
                }) + "\n")


def _summary(data_dir):
    return json.loads((data_dir / "lab" / "report" / "summary.json").read_text(encoding="utf-8"))


# --- 통과 규칙과 선정 규칙(C-7) ---

def test_pass_rule_boundaries():
    assert report.arm_passed(_arm(res=4.2, con=4.1, low=0.05)) is True
    assert report.arm_passed(_arm(con=3.9)) is False
    assert report.arm_passed(_arm(low=0.12)) is False
    assert report.arm_passed(_arm(con_low=0.12)) is False
    assert report.arm_passed(_arm(res=3.99)) is False
    assert report.arm_passed(_arm(res=4.0, con=4.0, low=0.10, con_low=0.10)) is True
    assert report.arm_passed(_arm(res=None)) is False


def test_selection_prefers_resemblance_when_gap_is_at_least_point_one():
    d = report.decide({"G1": _arm(res=4.2, con=4.9), "G2": _arm(res=4.5, con=4.0)})
    assert d["winner"] == "G2"


def test_selection_ties_go_to_consistency_then_limit_then_latency():
    d = report.decide({"G1": _arm(res=4.45, con=4.6), "G2": _arm(res=4.5, con=4.2)})
    assert d["winner"] == "G1"  # 닮음 차이 0.05 < 0.1: 일관성으로
    d = report.decide({"G1": _arm(res=4.45, con=4.3, limit=0.4), "G2": _arm(res=4.5, con=4.3, limit=0.9)})
    assert d["winner"] == "G1"  # 일관성도 같으면 한도 소진량이 적은 쪽
    d = report.decide({"G1": _arm(res=4.45, con=4.3, latency=20.0), "G2": _arm(res=4.5, con=4.3, latency=40.0)})
    assert d["winner"] == "G1"  # 그다음 지연 중앙값
    # 탈락한 비교군은 닮음이 높아도 후보가 아니다
    d = report.decide({"G1": _arm(res=4.9, con=3.0), "G2": _arm(res=4.1)})
    assert d["winner"] == "G2"


def test_no_arm_passed_reports_the_best_arm():
    d = report.decide({"B1": _arm(res=3.1, con=3.0), "G1": _arm(res=3.8, con=4.5), "G2": _arm(res=None, con=None)})
    assert d["winner"] is None and d["best"] == "G1"
    assert "통과한 방식 없음" in d["text"] and "G1" in d["text"]


# --- 검토 진행 상태 ---

def test_no_reviews_means_pending_without_decision(fake_env):
    make_lab_fixture.make(fake_env.data_dir)
    s = report.build(fake_env.data_dir)
    assert s["status"] == "검토 대기 (완료 0/3)"
    assert s["decision"] is None
    assert s["arms"]["G2"]["ok"] == 10 and s["arms"]["G2"]["resemblance_mean"] is None
    html = (fake_env.data_dir / "lab" / "report" / "index.html").read_text(encoding="utf-8")
    assert "검토 대기 (완료 0/3)" in html and "선정:" not in html and "통과한 방식 없음" not in html


def test_two_reviewers_done_is_still_pending_but_has_interim_numbers(fake_env):
    make_lab_fixture.make(fake_env.data_dir, reviews=2)
    # 세 번째 검토자는 과제 하나를 남겼다
    left = review.build_tasks(fake_env.data_dir)[5]["taskId"]
    _write_reviews(fake_env.data_dir, ["reviewer3"], lambda r, t: None if t["taskId"] == left else 4, mode="a")
    s = report.build(fake_env.data_dir)
    assert s["status"] == "검토 대기 (완료 2/3)"
    assert s["decision"] is None
    assert all(s["arms"][a]["resemblance_mean"] is not None for a in ARMS)
    assert all(s["arms"][a]["consistency_mean"] is not None for a in ARMS)


def test_three_reviewers_done_gives_a_decision(fake_env):
    make_lab_fixture.make(fake_env.data_dir, reviews=3)
    s = report.build(fake_env.data_dir)
    assert s["status"] == "검토 완료 (완료 3/3)"
    assert s["decision"]["winner"] == "G2"  # 픽스처의 점수 중심값이 5인 비교군
    assert s["decision"]["text"].startswith("선정: G2")
    assert s["arms"]["G2"]["passed"] is True and s["arms"]["B0"]["passed"] is False
    assert s["regenerate"] and all(x["arm"] != "G2" for x in s["regenerate"])
    assert s == _summary(fake_env.data_dir)


def test_last_review_of_same_reviewer_and_task_wins(fake_env):
    make_lab_fixture.make(fake_env.data_dir)
    _write_reviews(fake_env.data_dir, ["a", "b", "c"], lambda r, t: 1)
    _write_reviews(fake_env.data_dir, ["a", "b", "c"], lambda r, t: 5, mode="a")
    s = report.build(fake_env.data_dir)
    assert s["arms"]["G1"]["resemblance_mean"] == 5.0 and s["arms"]["G1"]["resemblance_low_pct"] == 0.0
    assert s["regenerate"] == []


# --- 경고 ---

def test_base_character_mean_below_four_warns(fake_env):
    make_lab_fixture.make(fake_env.data_dir)
    _write_reviews(fake_env.data_dir, ["a", "b"], lambda r, t: (3 if r == "a" else 4) if t["arm"] == "BASE" else 5)
    s = report.build(fake_env.data_dir)
    assert s["base"]["resemblance_mean"] == 3.5
    assert any("기준 캐릭터가 닮지 않아 G2와 G3가 낮게 나올 수 있다" in w for w in s["warnings"])

    _write_reviews(fake_env.data_dir, ["a", "b"], lambda r, t: 4)
    s = report.build(fake_env.data_dir)
    assert s["base"]["resemblance_mean"] == 4.0
    assert not any("기준 캐릭터가 닮지 않아" in w for w in s["warnings"])


def test_warnings_for_baseline_skip_limit_stop_and_declined_photo(fake_env):
    manifest = make_lab_fixture.make(fake_env.data_dir)
    s = report.build(fake_env.data_dir)
    assert any("B0" in w and "1회" in w for w in s["warnings"])
    assert not any("재현 불가" in w or "한도" in w or "거절" in w for w in s["warnings"])

    lines = [json.loads(x) for x in manifest.read_text(encoding="utf-8").splitlines()]
    for x in lines:
        if x["arm"] in ("B0", "B1"):
            x.update(status="skipped_baseline_unavailable", image_path=None)
        elif x["arm"] == "BASE":
            x.update(status="declined", image_path=None)
        elif (x["arm"], x["round"]) == ("G3", 2):
            x.update(status="limit", image_path=None)
        elif (x["arm"], x["round"], x["condition"]) == ("G1", 2, "side"):
            x.update(status="timeout", image_path=None)
    manifest.write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in lines), encoding="utf-8")
    s = report.build(fake_env.data_dir)
    text = "\n".join(s["warnings"])
    assert "기준선 재현 불가" in text and "한도로 중단" in text and "실제 사진 거절" in text
    assert s["arms"]["B1"]["skipped"] == 10 and s["arms"]["B1"]["ok"] == 0
    assert s["arms"]["G1"]["timeout"] == 1 and s["arms"]["G1"]["ok"] == 9
    # 기준 캐릭터가 거절됐으면 다른 닮음 과제의 사진만 보여 준다
    assert s["base"]["photo_url"].startswith("/lab/api/image/") and s["base"]["photo_url"].endswith("/0")
    assert s["base"]["image_url"] is None


FAR_RESET = 4102444800  # 2100-01-01 UTC: 아직 초기화되지 않은 한도 창


def _build_with_cap_reached(fake_env, complete):
    """매니페스트에 limit 줄은 없고 plan.json의 누적 소진량(41)이 LAB_CAP_POINTS(40)를 넘은 실험."""
    manifest = make_lab_fixture.make(fake_env.data_dir)
    lines = [json.loads(x) for x in manifest.read_text(encoding="utf-8").splitlines()]
    if not complete:
        lines = [x for x in lines if (x["arm"], x["round"]) != ("G3", 2)]
    assert not any(x["status"] == "limit" for x in lines)
    manifest.write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in lines), encoding="utf-8")
    (fake_env.data_dir / "lab" / "plan.json").write_text(json.dumps({
        "start_used_percent": 20.0, "per_image": 0.5, "R": 2, "decided_at": "2026-10-02T09:00:00+00:00",
        "windows": [{"resets_at": FAR_RESET, "start": 20.0, "last": 61.0}]}), encoding="utf-8")
    return report.build(fake_env.data_dir)


def test_paused_by_limit_rule_without_limit_line_warns_with_reset_time(fake_env):
    s = _build_with_cap_reached(fake_env, complete=False)
    hits = [w for w in s["warnings"] if "실험이 한도로 중단됨" in w]
    assert len(hits) == 1
    assert runner.kst(FAR_RESET) in hits[0] and "KST" in hits[0]
    assert "uv run python -m app.lab run --rounds auto" in hits[0]
    html = (fake_env.data_dir / "lab" / "report" / "index.html").read_text(encoding="utf-8")
    assert "실험이 한도로 중단됨" in html and runner.kst(FAR_RESET) in html


def test_complete_experiment_has_no_limit_pause_warning(fake_env):
    s = _build_with_cap_reached(fake_env, complete=True)
    assert not any("한도로 중단" in w for w in s["warnings"])


def test_limit_check_is_skipped_when_the_photo_file_is_missing(fake_env):
    manifest = make_lab_fixture.make(fake_env.data_dir)
    line = json.loads(manifest.read_text(encoding="utf-8").splitlines()[0])
    Path(line["photo_path"]).unlink()
    s = report.build(fake_env.data_dir)
    assert not any("한도로 중단" in w for w in s["warnings"])


def test_no_tasks_at_all_shows_placeholder(fake_env):
    s = report.build(fake_env.data_dir)
    assert s["status"] == "검토 대기 (완료 0/3)" and s["decision"] is None
    assert s["base"]["photo_url"] is None
    assert set(s["arms"]) == set(ARMS)
    html = (fake_env.data_dir / "lab" / "report" / "index.html").read_text(encoding="utf-8")
    assert "표시할 그림이 없습니다" in html and "<img" not in html


# --- 출력물 ---

def test_summary_has_five_arms_five_conditions_and_cost_metrics(fake_env):
    make_lab_fixture.make(fake_env.data_dir, reviews=3)
    s = report.build(fake_env.data_dir)
    assert list(s["arms"]) == ARMS
    assert list(s["conditions"]) == CONDITIONS
    assert all(set(s["conditions"][c]) == set(ARMS) for c in CONDITIONS)
    for a in ARMS:
        arm = s["arms"][a]
        assert {key for key, _ in report.ARM_COLUMNS} | {"name", "tags"} <= set(arm)
        assert arm["ok"] == 10 and arm["latency_median_s"] > 0 and arm["latency_p95_s"] >= arm["latency_median_s"]
        assert 1 <= arm["attempts_mean"] <= 2
    assert s["arms"]["B0"]["limit_per_image"] == 0 and s["arms"]["B1"]["limit_per_image"] == 0
    assert s["arms"]["G1"]["limit_per_image"] == 0.5
    assert s["arms"]["B0"]["tags"] == {"different_person": s["arms"]["B0"]["tag_count"]}
    assert s["skipped_lines"] == 0


def test_html_names_arms_and_conditions_and_every_image_is_served(fake_env):
    make_lab_fixture.make(fake_env.data_dir, reviews=3)
    s = report.build(fake_env.data_dir)
    client = TestClient(app)
    r = client.get("/lab/report")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/html")
    html = r.text
    for a in ARMS:
        assert a in html and s["arms"][a]["name"].replace("&", "&amp;") in html
    for c in make_lab_fixture.PROTOCOL["conditions"]:
        assert c["id"] in html and c["caption_ko"] in html
    assert "#2f5bff" in html and "#7d9bff" in html and "Pretendard" in html

    srcs = re.findall(r'<img[^>]*\ssrc="([^"]+)"', html)
    top = re.findall(r'<img class="source"[^>]*\ssrc="([^"]+)"', html)
    assert top == [s["base"]["photo_url"], s["base"]["image_url"]]
    assert all(u.startswith("/lab/api/image/") for u in top) and top[0].endswith("/0") and top[1].endswith("/1")
    assert len([u for u in srcs if u.startswith("/files/lab/")]) >= 50
    for url in set(srcs):
        assert client.get(url).status_code == 200, url
    assert client.get(top[0]).content == fake_env.photo.read_bytes()


def test_markdown_and_html_show_the_same_numbers_as_summary(fake_env, capsys):
    make_lab_fixture.make(fake_env.data_dir, reviews=3)
    assert report.main(["--markdown", "-"]) == 0
    out = capsys.readouterr().out
    s = _summary(fake_env.data_dir)
    html = (fake_env.data_dir / "lab" / "report" / "index.html").read_text(encoding="utf-8")
    rows = {cells[0]: cells for cells in
            ([c.strip() for c in line.strip().strip("|").split("|")] for line in out.splitlines() if line.startswith("|"))}
    for a in ARMS:
        expected = [report.fmt(s["arms"][a][key]) for key, _ in report.ARM_COLUMNS]
        assert rows[a][2:] == expected
        assert "".join(f"<td>{x}</td>" for x in expected) in html
    for c in CONDITIONS:
        expected = [report.fmt(s["conditions"][c][a]) for a in ARMS]
        assert rows[c][1:] == expected
        assert "".join(f"<td>{x}</td>" for x in expected) in html
    assert s["status"] in out and s["decision"]["text"] in out
    assert report.fmt(s["base"]["resemblance_mean"]) in rows["기준 캐릭터"]
    # 반올림은 어디서나 소수 둘째 자리
    assert report.fmt(4.0) == "4.00" and report.fmt(3.14159) == "3.14" and report.fmt(None) == "-" and report.fmt(7) == "7"
    for a in ARMS:
        for value in s["arms"][a].values():
            if isinstance(value, float):
                assert round(value, 2) == value


def test_broken_review_line_is_skipped_and_counted(fake_env, capsys):
    make_lab_fixture.make(fake_env.data_dir, reviews=3)
    before = report.build(fake_env.data_dir)
    with (fake_env.data_dir / "lab" / "reviews.jsonl").open("a", encoding="utf-8") as f:
        f.write('{"reviewer": "reviewer1", "taskId": \n')
    assert report.main([]) == 0
    capsys.readouterr()
    s = _summary(fake_env.data_dir)
    assert s["skipped_lines"] == 1
    assert s["arms"] == before["arms"] and s["decision"] == before["decision"]


def test_rerun_overwrites_both_outputs(fake_env):
    make_lab_fixture.make(fake_env.data_dir)
    out = fake_env.data_dir / "lab" / "report"
    report.build(fake_env.data_dir)
    assert "검토 대기 (완료 0/3)" in (out / "index.html").read_text(encoding="utf-8")
    make_lab_fixture.make(fake_env.data_dir, reviews=3)
    report.build(fake_env.data_dir)
    assert sorted(p.name for p in out.iterdir()) == ["index.html", "summary.json"]
    assert "검토 대기" not in (out / "index.html").read_text(encoding="utf-8")
    assert _summary(fake_env.data_dir)["decision"] is not None
