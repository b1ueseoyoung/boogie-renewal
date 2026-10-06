"""실험 매니페스트(DATA_DIR/lab/manifest.jsonl)와 조건표(C-6).

시도마다 한 줄을 추가한다: C-1 결과에 photo_id, photo_path, arm, condition, round를 더한 객체.
작업 키는 (photo_id, arm, condition, round)이고 키의 마지막 줄이 그 키의 상태다.
"""
import hashlib
import json
import os
import signal
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings

PROTOCOL = json.loads((Path(__file__).parent / "protocol.json").read_text(encoding="utf-8"))
ARMS = {arm["id"]: arm for arm in PROTOCOL["arms"]}
CONDITIONS = [c["id"] for c in PROTOCOL["conditions"]]
BASE_KEY = ("BASE", "base", 1)
SUCCESS = ("ok", "modified")
FINISHED = (*SUCCESS, "declined", "skipped_baseline_unavailable")
RETRY = ("timeout", "no_image", "error", "limit")
KILL_HOOK = "LAB_TEST_KILL_AFTER_LINES"

_appended = 0


def path() -> Path:
    return settings.DATA_DIR / "lab" / "manifest.jsonl"


def base_path(photo_id: str) -> Path:
    return settings.DATA_DIR / "lab" / "base" / photo_id / "candidate-1.png"


def photo_id(photo) -> str:
    return hashlib.sha256(Path(photo).read_bytes()).hexdigest()[:12]


def uses_character(arm_id) -> bool:
    return "character" in ARMS.get(arm_id, {}).get("references", [])


def build_jobs(rounds: int) -> list[tuple]:
    """rounds회차까지의 (arm, condition, round) 목록. 순서는 protocol.json의 order를 따른다."""
    jobs = []
    for round_ in range(1, rounds + 1):
        for entry in PROTOCOL["order"]["round_1" if round_ == 1 else "round_n"]:
            if entry == "base_character":
                jobs.append(BASE_KEY)
            else:
                jobs += [(entry, condition, round_) for condition in CONDITIONS]
    return jobs


def pilot_keys() -> list[tuple]:
    pilot = PROTOCOL["order"]["pilot"]
    return [BASE_KEY] + [(pilot["arm"], condition, pilot["round"]) for condition in CONDITIONS]


def read() -> list[dict]:
    """읽을 수 있는 줄만 돌려준다. 죽은 프로세스가 남긴 잘린 줄은 건너뛴다."""
    try:
        raw = path().read_text(encoding="utf-8")
    except OSError:
        return []
    lines = []
    for text in raw.splitlines():
        try:
            line = json.loads(text)
        except ValueError:
            continue
        if isinstance(line, dict):
            lines.append(line)
    return lines


def last_by_key(lines, photo_id_: str) -> dict:
    last = {}
    for line in lines:
        if line.get("photo_id") == photo_id_:
            last[(line.get("arm"), line.get("condition"), line.get("round"))] = line
    return last


def append(line: dict) -> None:
    global _appended
    file = path()
    file.parent.mkdir(parents=True, exist_ok=True)
    with file.open("a+b") as f:
        # 잘린 마지막 줄 뒤에 붙으면 새 줄까지 깨진다
        if f.tell() > 0:
            f.seek(-1, os.SEEK_END)
            if f.read(1) != b"\n":
                f.write(b"\n")
        f.write((json.dumps(line, ensure_ascii=False) + "\n").encode())
        f.flush()
        os.fsync(f.fileno())
    _appended += 1
    # 테스트용: 이 프로세스가 N줄을 쓴 직후 죽는다(중단과 재개를 시간에 기대지 않고 재현한다)
    if os.environ.get(KILL_HOOK) == str(_appended):
        os.kill(os.getpid(), signal.SIGKILL)


def blank_result(status: str, reason: str, method: str) -> dict:
    """생성을 부르지 않고 끝내는 키의 C-1 결과."""
    return {
        "status": status, "kind": "image", "method": method, "image_path": None, "text": {}, "thread_id": None,
        "seed": None, "latency_ms": 0, "attempts": 0, "reason": reason,
        "limit": {"used_percent_before": None, "used_percent_after": None, "resets_at": None},
        "prompt_sha256": "", "reference_sha256": [], "request_key": "", "cached": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def verify(lines=None) -> list[str]:
    """성공한 GPT 줄이 실제로 새로 만든 서로 다른 그림인지 확인하고 어긋난 사유를 돌려준다(없으면 빈 목록)."""
    lines = read() if lines is None else lines
    problems, threads, pictures, base_hashes, last_used = [], {}, {}, {}, {}
    for line in lines:
        if line.get("status") not in SUCCESS or not str(line.get("method", "")).startswith("gpt_"):
            continue
        name = f"{line.get('arm')} {line.get('condition')} r{line.get('round')}"
        if line.get("cached") is not False:
            problems.append(f"{name}: cached가 false가 아니다")
        thread_id = line.get("thread_id")
        if thread_id in threads:
            problems.append(f"{name}: thread_id가 {threads[thread_id]}와 같다")
        threads.setdefault(thread_id, name)
        try:
            digest = hashlib.sha256(Path(line["image_path"]).read_bytes()).hexdigest()
        except (OSError, KeyError, TypeError):
            problems.append(f"{name}: 그림 파일을 읽을 수 없다")
        else:
            if digest in pictures:
                problems.append(f"{name}: 그림 파일 해시가 {pictures[digest]}와 같다")
            pictures.setdefault(digest, name)
        if uses_character(line.get("arm")):
            pid = str(line.get("photo_id"))
            if pid not in base_hashes:
                try:
                    base_hashes[pid] = hashlib.sha256(base_path(pid).read_bytes()).hexdigest()
                except OSError:
                    base_hashes[pid] = None
            if base_hashes[pid] is None or base_hashes[pid] not in (line.get("reference_sha256") or []):
                problems.append(f"{name}: reference_sha256에 기준 캐릭터 파일의 해시가 없다")
        limit = line.get("limit") or {}
        used, window = limit.get("used_percent_after"), limit.get("resets_at")
        if used is not None:
            if window in last_used and used < last_used[window]:
                problems.append(f"{name}: 같은 한도 창에서 used_percent_after가 {last_used[window]}에서 {used}로 줄었다")
            last_used[window] = used
    return problems
