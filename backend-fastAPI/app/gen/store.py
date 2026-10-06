"""실행 기록(gen-log.jsonl), 결과 캐시, 재생 모드(DEMO_REPLAY), 한도 보호.

캐시는 DATA_DIR/cache/<key>.json과 그림 사본 <key>.png다. 상태가 ok나 modified인 결과만 저장한다.
out_path로 만든 그림은 그 경로를 저장본에 stored_path로 남긴다. 그 뒤 캐시 적중은 그 파일을 그대로 돌려준다:
같은 요청을 재생하면 그림 주소가 처음과 같다.
out_path 없이 부르면 사본의 사본(cache/out/)을 돌려준다: 호출자가 그림을 옮겨 가도 저장본이 남는다.
"""
import hashlib
import json
import os
import shutil
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.gen.codex_runner import read_rate_limit

CACHEABLE = ("ok", "modified")

_log_lock = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _log_path() -> Path:
    return settings.DATA_DIR / "lab" / "gen-log.jsonl"


def request_key(method: str, prompt: str, images, schema_name) -> str:
    """sha256(method + prompt + 참조 파일 sha256 목록 + 스키마 이름). 참조는 경로가 아니라 내용으로 구분한다."""
    refs = [hashlib.sha256(Path(image).read_bytes()).hexdigest() for image in images or []]
    parts = [method, prompt, *refs, schema_name or ""]
    return hashlib.sha256("\n".join(parts).encode()).hexdigest()


def record(result: dict) -> None:
    path = _log_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with _log_lock, path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(result, ensure_ascii=False) + "\n")


def _logged_path(key: str):
    """옛 저장본(stored_path 없음)의 처음 경로: 이 키를 생성한 마지막 기록(cached 아님)의 image_path. 없으면 None.

    캐시 PNG는 그 생성의 사본이다(_save가 생성할 때마다 덮어쓴다).
    """
    try:
        # ponytail: 로그 전체를 읽는다. 옛 저장본은 처음 적중 때 stored_path를 얻으므로 키마다 한 번뿐이다
        lines = _log_path().read_text(encoding="utf-8").splitlines()
    except OSError:
        return None
    for line in reversed(lines):
        try:
            row = json.loads(line)
            if row["request_key"] == key and not row["cached"] and row["status"] in CACHEABLE:
                return row["image_path"]
        except (ValueError, KeyError, TypeError):
            continue
    return None


def _load(key: str, out_path=None):
    """저장본을 읽는다. 파일이 없거나 깨졌거나 그림 사본이 없으면 None.

    out_path가 있고 저장본의 stored_path 파일이 남아 있으면 그 경로를 그대로 돌려준다(복사하지 않는다).
    stored_path가 없는 옛 저장본(할 일 40 이전)은 _logged_path의 경로를 stored_path로 적어 두고 쓴다.
    그것도 없거나 그 파일이 지워졌으면 out_path로 복사하고 그 경로를 stored_path로 적어 둔다.
    out_path가 없으면 cache/out/ 아래 사본을 돌려준다.
    """
    cache = settings.DATA_DIR / "cache"
    try:
        entry = json.loads((cache / f"{key}.json").read_text(encoding="utf-8"))
        if entry["status"] not in CACHEABLE:
            return None
        saved = dict(entry)
        stored = saved.pop("stored_path", None)
        if saved["image_path"] is not None:
            if out_path and not stored:
                stored = _logged_path(key)
                if stored and Path(stored).is_file():
                    _write(key, {**entry, "stored_path": stored})
            if out_path and stored and Path(stored).is_file():
                saved["image_path"] = stored
            else:
                out = Path(out_path) if out_path else cache / "out" / f"{key[:16]}-{uuid.uuid4().hex[:8]}.png"
                out.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(cache / f"{key}.png", out)
                saved["image_path"] = str(out)
                if out_path:
                    _write(key, {**entry, "stored_path": str(out)})
    except (OSError, ValueError, KeyError, TypeError):
        return None
    return saved


def _write(key: str, entry: dict) -> None:
    cache = settings.DATA_DIR / "cache"
    cache.mkdir(parents=True, exist_ok=True)
    tmp = cache / f"{key}.json.tmp"
    tmp.write_text(json.dumps(entry, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, cache / f"{key}.json")


def _save(key: str, result: dict, out_path=None) -> None:
    cache = settings.DATA_DIR / "cache"
    cache.mkdir(parents=True, exist_ok=True)
    saved = dict(result)
    if result.get("image_path"):
        shutil.copyfile(result["image_path"], cache / f"{key}.png")
        saved["image_path"] = str(cache / f"{key}.png")
        if out_path:
            saved["stored_path"] = result["image_path"]
    _write(key, saved)


async def get_or_generate(key: str, fn, *, kind: str = "image", method: str = "", fresh: bool = False,
                          out_path=None) -> dict:
    """DEMO_REPLAY에 따라 저장본을 돌려주거나 `await fn()`으로 생성하고, 어느 쪽이든 한 줄 기록한다.

    out_path가 있으면 생성한 그림의 경로를 저장본에 남기고, 캐시 적중 때 그 경로를 그대로 돌려준다(_load).
    그래서 적중 결과와 기록의 image_path는 이번 out_path가 아니라 처음 저장된 경로일 수 있다.
    없으면 cache/out/ 아래 사본을 돌려준다.
    kind와 method는 fn을 부르지 않는 replay_miss 결과에만 쓰인다.
    fresh=True면 DEMO_REPLAY와 무관하게 저장본을 읽지 않고 항상 생성한다(저장과 기록은 그대로다. 실험 실행기용).
    실제 limit 결과에는 resets_at이 없을 수 있다: 그때는 latest_limit()의 값을 쓴다.
    """
    started = time.monotonic()
    if not fresh and settings.DEMO_REPLAY != "0":
        result = _load(key, out_path)
        if result is not None:
            result.update(request_key=key, cached=True, created_at=_now(),
                          latency_ms=int((time.monotonic() - started) * 1000))
            record(result)
            return result
        if settings.DEMO_REPLAY == "1":
            result = {
                "status": "replay_miss", "kind": kind, "method": method, "image_path": None, "text": {},
                "thread_id": None, "seed": None, "latency_ms": 0, "attempts": 0, "reason": "no saved result",
                "limit": {"used_percent_before": None, "used_percent_after": None, "resets_at": None},
                "prompt_sha256": "", "reference_sha256": [], "request_key": key, "cached": False,
                "created_at": _now(),
            }
            record(result)
            return result
    result = await fn()
    result["request_key"] = key
    if result["status"] in CACHEABLE:
        _save(key, result, out_path)
    record(result)
    return result


def latest_limit():
    """가장 최근 한도 값 {"used_percent", "resets_at"}. 마지막 생성 기록에 없으면 codex rollout에서 읽고, 거기도 없으면 None."""
    try:
        # ponytail: 로그 전체를 읽는다. 수만 줄이 되면 파일 끝에서부터 읽는다
        lines = _log_path().read_text(encoding="utf-8").splitlines()
    except OSError:
        lines = []
    for line in reversed(lines):
        try:
            last = json.loads(line)
            if last["cached"]:
                continue
            limit = last["limit"]
            if limit["used_percent_after"] is not None:
                return {"used_percent": limit["used_percent_after"], "resets_at": limit["resets_at"]}
        except (ValueError, KeyError, TypeError):
            continue
        break
    return read_rate_limit("*")  # 스레드 ID 자리의 *가 모든 rollout 파일에 맞는다


class LimitGuard:
    def __init__(self, start_used_percent: float, cap_points: float):
        self.start, self.cap = start_used_percent, cap_points

    def check(self):
        """생성해도 되면 None, 아니면 {"status": "limit", "used_percent", "resets_at"}."""
        latest = latest_limit()
        if latest is None:
            return None
        used = latest["used_percent"]
        if round(used - self.start, 6) >= self.cap or used >= 95:
            return {"status": "limit", "used_percent": used, "resets_at": latest["resets_at"]}
        return None
