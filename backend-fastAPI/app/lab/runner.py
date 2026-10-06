"""실험 실행기: 기준 캐릭터, 파일럿, 회차 실행, 한도 규칙(C-6), plan.json.

항상 새로 생성한다(fresh=True: DEMO_REPLAY를 보지 않는다). 재개는 매니페스트가 맡는다.
"""
import json
import os
import time
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core.config import settings
from app.gen import comfy, image, store, text
from app.lab import manifest
from app.lab.manifest import ARMS, BASE_KEY, CONDITIONS, FINISHED, PROTOCOL, RETRY, SUCCESS

RULE = PROTOCOL["repeat_rule"]
SCENES = {c["id"]: c["scene"] for c in PROTOCOL["conditions"]}
EXIT_LIMIT = RULE["stop_exit_code"]
EXIT_VERIFY = 21
DECLINE_STREAK = 3
KST = timezone(timedelta(hours=9))


class Stop(Exception):
    def __init__(self, code: int, message: str):
        super().__init__(message)
        self.code, self.message = code, message


def plan_path() -> Path:
    return settings.DATA_DIR / "lab" / "plan.json"


def load_plan() -> dict:
    try:
        return json.loads(plan_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"start_used_percent": None, "per_image": None, "R": None, "decided_at": None, "windows": []}


def save_plan(plan: dict) -> None:
    if plan["windows"]:
        plan["start_used_percent"] = plan["windows"][0]["start"]
    path = plan_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(plan, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


def note_usage(windows: list, used, resets_at) -> None:
    """한도 창 기록을 갱신한다. resets_at이 바뀌거나 값이 줄면 새 창이고 처음 읽은 값이 그 창의 시작값이다."""
    if used is None:
        return
    if windows and windows[-1]["resets_at"] == resets_at and used >= windows[-1]["last"]:
        windows[-1]["last"] = used
    else:
        windows.append({"resets_at": resets_at, "start": used, "last": used})


def cumulative(windows: list) -> float:
    return round(sum(w["last"] - w["start"] for w in windows), 6)


def decide_rounds(per_image: float) -> int:
    gpt_images = sum(arm["method"].startswith("gpt_") for arm in ARMS.values()) * len(CONDITIONS)
    for rounds in RULE["r_candidates"]:
        if (gpt_images * rounds + 1) * per_image <= RULE["stop_cumulative_min"]:
            return rounds
    return RULE["r_default"]


def limit_hit(plan: dict):
    """한도 규칙에 걸리면 {"used_percent", "cumulative", "resets_at"}, 아니면 None. plan의 windows를 갱신한다."""
    latest = store.latest_limit()
    if latest is not None and isinstance(latest["resets_at"], (int, float)) and latest["resets_at"] <= time.time():
        latest = None  # 이미 초기화된 창의 마지막 기록이다
    if latest is not None:
        note_usage(plan["windows"], latest["used_percent"], latest["resets_at"])
    windows = plan["windows"]
    spent = cumulative(windows)
    if spent >= settings.LAB_CAP_POINTS or (latest and latest["used_percent"] >= RULE["stop_used_percent_min"]):
        resets_at = latest["resets_at"] if latest else (windows[-1]["resets_at"] if windows else None)
        return {"used_percent": latest["used_percent"] if latest else None, "cumulative": spent,
                "resets_at": resets_at}
    return None


def kst(resets_at) -> str:
    try:
        return datetime.fromtimestamp(float(resets_at), KST).strftime("%Y-%m-%d %H:%M KST")
    except (TypeError, ValueError, OverflowError, OSError):
        return "알 수 없음 (KST)"


class Lab:
    def __init__(self, photo):
        self.photo = Path(photo).resolve()
        self.pid = manifest.photo_id(self.photo)
        self.plan = load_plan()
        self.last = manifest.last_by_key(manifest.read(), self.pid)
        self.base_png = manifest.base_path(self.pid)
        self.feature_json = self.base_png.with_name("feature.json")
        self.baseline_down = False

    def done(self, key) -> bool:
        return self.last.get(key, {}).get("status") in FINISHED

    def record(self, key, result: dict) -> None:
        arm, condition, round_ = key
        line = {**result, "photo_id": self.pid, "photo_path": str(self.photo), "arm": arm, "condition": condition,
                "round": round_}
        manifest.append(line)
        self.last[key] = line
        print(f"{arm} {condition} r{round_}: {line['status']} {line['reason']}".rstrip(), flush=True)

    def guard(self) -> None:
        """GPT 작업 전에 부른다. 한도 규칙에 걸리면 종료 코드 20으로 멈춘다."""
        hit = limit_hit(self.plan)
        save_plan(self.plan)
        if hit:
            raise Stop(EXIT_LIMIT, f"한도 규칙으로 멈춤: 사용률 {hit['used_percent']}%, 실험 누적 {hit['cumulative']}. "
                                   f"초기화 시각 {kst(hit['resets_at'])} 이후에 같은 명령으로 이어서 실행한다.")

    def after(self, result: dict) -> None:
        """GPT 작업 뒤에 부른다. 한도 창 기록을 남기고, 결과가 limit이면 멈춘다."""
        if result["status"] == "limit":
            resets_at = result["limit"]["resets_at"] or (store.latest_limit() or {}).get("resets_at")
            raise Stop(EXIT_LIMIT, f"한도 소진: 초기화 시각 {kst(resets_at)} 이후에 같은 명령으로 이어서 실행한다.")
        note_usage(self.plan["windows"], result["limit"]["used_percent_after"], result["limit"]["resets_at"])
        save_plan(self.plan)

    async def base(self) -> None:
        """기준 캐릭터 1장과 특징 문장. 이미 있으면 건너뛴다."""
        if not self.done(BASE_KEY):
            self.guard()
            result = await image.gen_base_character(self.photo, self.base_png, fresh=True)
            self.record(BASE_KEY, result)
            self.after(result)
            if result["status"] not in FINISHED:
                raise Stop(1, f"기준 캐릭터 생성 실패({result['status']}). 같은 명령을 다시 실행하면 이어서 한다.")
        if not self.feature_json.is_file():
            approved = self.last[BASE_KEY]["status"] in SUCCESS
            self.guard()
            result = await text.feature_card(self.photo, self.base_png if approved else None, fresh=True)
            self.after(result)
            feature = {"charLook": result["text"].get("charLook", ""), "status": result["status"],
                       "reason": result["reason"], "with_character": approved}
            self.feature_json.parent.mkdir(parents=True, exist_ok=True)
            self.feature_json.write_text(json.dumps(feature, ensure_ascii=False), encoding="utf-8")
            print(f"feature: {result['status']} {result['reason']}".rstrip(), flush=True)

    def declined_in_a_row(self, arm_id) -> bool:
        tail = [x["status"] for k, x in self.last.items() if k[0] == arm_id and x["status"] in FINISHED]
        return tail[-DECLINE_STREAK:] == ["declined"] * DECLINE_STREAK

    async def scene(self, key) -> None:
        arm_id, condition, round_ = key
        arm = ARMS[arm_id]
        method = arm["method"]
        out = settings.DATA_DIR / "files" / "lab" / self.pid / arm_id / f"{condition}-r{round_}.png"
        char_look = json.loads(self.feature_json.read_text(encoding="utf-8"))["charLook"]
        if method.startswith("baseline_"):
            if self.baseline_down:
                return self.record(key, manifest.blank_result("skipped_baseline_unavailable", "baseline_unavailable",
                                                              method))
            prompt = PROTOCOL["baseline_prompt"].format(scene=SCENES[condition], char_look=char_look)
            result = await comfy.gen_baseline_stored(method.removeprefix("baseline_"), prompt, self.photo, out,
                                                     arm.get("seed"), fresh=True)
            if result["status"] == "error" and result["reason"] == "baseline_unavailable":
                self.baseline_down = True
                result = {**result, "status": "skipped_baseline_unavailable"}
            return self.record(key, result)
        if manifest.uses_character(arm_id):
            if self.last[BASE_KEY]["status"] not in SUCCESS:
                return self.record(key, manifest.blank_result("declined", "base_character_declined", method))
        elif self.declined_in_a_row(arm_id):
            return self.record(key, manifest.blank_result("declined", "consecutive_declines", method))
        self.guard()
        # 조건 outfit만 장면 글이 옷을 정한다(C-6). 그 밖에는 어댑터가 참조에 맞는 기본 규칙을 고른다
        outfit_rule = "scene_specified" if condition == "outfit" else ""
        result = await image.gen_scene(SCENES[condition], char_look, method, self.photo, self.base_png, outfit_rule,
                                       out, fresh=True)
        self.record(key, result)
        self.after(result)

    async def run_keys(self, keys) -> None:
        for key in keys:
            if key == BASE_KEY:
                await self.base()
            elif not self.done(key):
                await self.scene(key)

    async def pilot(self) -> None:
        """기준 캐릭터와 파일럿 비교군 1회차를 돌리고, 처음 한 번 per_image와 R을 정한다."""
        keys = manifest.pilot_keys()
        await self.run_keys(keys)
        if self.plan["decided_at"] is None:
            made = sum(self.last[key]["status"] in SUCCESS for key in keys if key in self.last)
            spent = cumulative(self.plan["windows"])
            per_image = max(spent / made if made else 0, RULE["per_image_min"])
            self.plan.update(per_image=per_image, R=decide_rounds(per_image),
                             decided_at=datetime.now(timezone.utc).isoformat())
            save_plan(self.plan)
            print(f"pilot: per_image {per_image}, R {self.plan['R']}", flush=True)

    async def run(self, rounds) -> None:
        await self.pilot()
        self.plan["R"] = decide_rounds(self.plan["per_image"]) if rounds == "auto" else rounds
        save_plan(self.plan)
        jobs = manifest.build_jobs(self.plan["R"])
        for round_ in range(1, self.plan["R"] + 1):
            await self.run_keys([key for key in jobs if key[2] == round_])
            problems = manifest.verify()
            if problems:
                raise Stop(EXIT_VERIFY, "\n".join([f"{round_}회차 확인 실패:", *problems]))
        left = [key for key in jobs if not self.done(key)]
        if left:
            print(f"다시 할 작업 {len(left)}건이 남았다. 같은 명령을 다시 실행하면 그 키만 다시 한다.", flush=True)

    def status(self) -> dict:
        lines = manifest.read()
        rounds = self.plan["R"]
        jobs = manifest.build_jobs(rounds) if rounds else []
        complete = bool(jobs) and all(self.done(key) for key in jobs)
        counts = {name: 0 for name in (*FINISHED, *RETRY)}
        counts.update(Counter(line["status"] for line in self.last.values()))
        counts["pending"] = sum(key not in self.last for key in jobs)
        hit = None if complete else limit_hit(self.plan)
        stopped = bool(lines) and lines[-1].get("status") == "limit"
        paused = "limit" if not complete and (hit or stopped) else None
        resets_at = None
        if paused:
            resets_at = hit["resets_at"] if hit else (store.latest_limit() or {}).get("resets_at")
        made = {}
        for line in lines:
            if line.get("status") in SUCCESS:
                made[(line.get("photo_id"), line.get("arm"), line.get("condition"), line.get("round"))] = True
        groups = Counter((pid, arm, round_) for pid, arm, condition, round_ in made if condition in CONDITIONS)
        return {"complete": complete, "paused": paused, "resets_at": resets_at, "counts": counts,
                "expected_review_tasks": len(made) + sum(n == len(CONDITIONS) for n in groups.values())}
