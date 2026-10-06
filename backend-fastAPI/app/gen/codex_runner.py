"""codex exec 실행기: 호출, 결과 분류, 한도 읽기, 종류별 동시 실행 수 제한(GEN_CONCURRENCY). 결과는 C-1 형식이다.

로그에는 종류, 상태, 소요 시간, 시도 횟수, thread_id만 남긴다(프롬프트와 사진 경로는 쓰지 않는다).
`method`는 러너가 알 수 없어 빈 문자열로 두고 어댑터가 채운다.
"""
import asyncio
import hashlib
import json
import logging
import os
import signal
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.gen.fake import fake_run_image, fake_run_text

log = logging.getLogger(__name__)

LIMIT_WORDS = ("usage limit", "rate limit", "limit reached", "quota")
RETRYABLE = ("timeout", "no_image")
IMAGE_SCHEMA = {
    "type": "object",
    "properties": {
        "status": {"type": "string", "enum": ["generated", "modified", "declined", "failed"]},
        "note": {"type": "string"},
    },
    "required": ["status", "note"],
    "additionalProperties": False,
}
REASONS = {
    "timeout": "timeout",
    "limit": "usage limit reached",
    "no_image": "no image in the thread directory",
}

_locks: dict = {}
_last_used_percent = None


def parse_final(message: str):
    """엄격한 JSON 파싱 뒤 실패하면 첫 `{...}` 블록을 읽는다. 객체가 아니면 None."""
    try:
        value = json.loads(message)
    except ValueError:
        start = message.find("{")
        if start == -1:
            return None
        try:
            value, _ = json.JSONDecoder().raw_decode(message, start)
        except ValueError:
            return None
    return value if isinstance(value, dict) else None


def run_codex(prompt, images, schema_path, timeout_s) -> dict:
    job = settings.DATA_DIR / "lab" / "jobs" / str(uuid.uuid4())
    job.mkdir(parents=True)
    last, events_path, stderr_path = job / "last.json", job / "events.jsonl", job / "stderr.log"
    args = [settings.CODEX_BIN, "exec", "--json", "--skip-git-repo-check", "-s", "read-only", "-C", str(job)]
    if settings.CODEX_MODEL:
        args += ["-m", settings.CODEX_MODEL]
    if settings.CODEX_IGNORE_USER_CONFIG:
        args.append("--ignore-user-config")
    for image in images or []:
        args += ["-i", str(image)]
    if schema_path:
        if settings.CODEX_USE_OUTPUT_SCHEMA:
            args += ["--output-schema", str(schema_path)]
        else:
            schema = Path(schema_path).read_text(encoding="utf-8")
            prompt = f"{prompt}\n\nJSON Schema:\n{schema}\nOutput JSON only that matches this schema, with no other text."
    args += ["-o", str(last), prompt]

    pid, timed_out = None, False
    with events_path.open("wb") as out, stderr_path.open("wb") as err:
        try:
            proc = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=out, stderr=err, start_new_session=True)
        except OSError:
            exit_code = 127
        else:
            pid = proc.pid
            try:
                exit_code = proc.wait(timeout=timeout_s)
            except subprocess.TimeoutExpired:
                timed_out = True
                try:
                    os.killpg(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                exit_code = proc.wait()

    events_text = events_path.read_text(encoding="utf-8", errors="replace")
    thread_id, usage, message = None, None, None
    for line in events_text.splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if not isinstance(event, dict):
            continue
        if event.get("type") == "thread.started":
            thread_id = event.get("thread_id")
        elif event.get("type") == "turn.completed":
            usage = event.get("usage")
        elif event.get("type") == "item.completed" and (event.get("item") or {}).get("type") == "agent_message":
            message = event["item"].get("text")
    if last.is_file():
        message = last.read_text(encoding="utf-8", errors="replace")
    noise = (stderr_path.read_text(encoding="utf-8", errors="replace") + events_text).lower()
    return {
        "job_dir": job, "pid": pid, "exit_code": exit_code, "timed_out": timed_out, "thread_id": thread_id,
        "usage": usage, "message": message, "final": parse_final(message or ""),
        "limit_hit": any(word in noise for word in LIMIT_WORDS),
    }


def find_generated_images(thread_id) -> list[Path]:
    if not thread_id:
        return []
    images = (settings.CODEX_HOME_DIR / "generated_images" / str(thread_id)).glob("*.png")
    return sorted(images, key=lambda path: path.stat().st_mtime)


def read_rate_limit(thread_id):
    """그 스레드의 rollout에서 timestamp가 가장 늦은 한도 기록의 primary 값. 없으면 None."""
    if not thread_id:
        return None
    best = None
    for path in (settings.CODEX_HOME_DIR / "sessions").glob(f"*/*/*/rollout-*-{thread_id}.jsonl"):
        with path.open(encoding="utf-8", errors="replace") as f:
            for line in f:
                if '"used_percent"' not in line:
                    continue
                try:
                    record = json.loads(line)
                    primary = record["payload"]["rate_limits"]["primary"]
                    # ponytail: ISO 문자열을 그대로 비교한다(codex는 한 형식의 UTC만 쓴다). 형식이 섞이면 datetime으로 파싱한다
                    item = (str(record["timestamp"]), primary["used_percent"], primary.get("resets_at"))
                except (ValueError, KeyError, TypeError):
                    continue
                if best is None or item[0] >= best[0]:
                    best = item
    return {"used_percent": best[1], "resets_at": best[2]} if best else None


def classify(run: dict, kind: str) -> str:
    if run["timed_out"]:
        return "timeout"
    if run["exit_code"] != 0:
        return "limit" if run["limit_hit"] else "error"
    if run["final"] is None:
        return "error"
    if kind == "image":
        status = run["final"].get("status")
        if status == "declined":
            return "declined"
        if not find_generated_images(run["thread_id"]):
            return "no_image"
        if status == "modified":
            return "modified"
    return "ok"


def _reason(run: dict, status: str) -> str:
    if status in REASONS:
        return REASONS[status]
    if status == "error":
        return f"codex exit {run['exit_code']}" if run["exit_code"] != 0 else "final message is not JSON matching the schema"
    return str(run["final"].get("note", "")) if status in ("declined", "modified") else ""


def _lock(kind: str) -> asyncio.Semaphore:
    """종류마다 GEN_CONCURRENCY개까지 함께 돈다. 루프나 설정 값이 바뀌면 새로 만든다."""
    loop, size = asyncio.get_running_loop(), settings.GEN_CONCURRENCY
    if _locks.get(kind, (None, None, None))[::2] != (loop, size):
        _locks[kind] = (loop, asyncio.Semaphore(size), size)
    return _locks[kind][1]


async def _run(kind: str, prompt: str, images, schema_path) -> dict:
    global _last_used_percent
    images = [str(image) for image in images or []]
    async with _lock(kind):
        started = time.monotonic()
        if settings.GEN_FAKE:
            if kind == "text":
                result = await asyncio.to_thread(fake_run_text, prompt, images, str(schema_path))
            else:
                result = await asyncio.to_thread(fake_run_image, prompt, images)
        else:
            timeout_s = settings.TEXT_TIMEOUT_S if kind == "text" else settings.IMAGE_TIMEOUT_S
            if kind == "image" and schema_path is None:
                schema_path = settings.DATA_DIR / "lab" / "jobs" / "image-schema.json"
                schema_path.parent.mkdir(parents=True, exist_ok=True)
                schema_path.write_text(json.dumps(IMAGE_SCHEMA), encoding="utf-8")
            for attempts in (1, 2):
                run = await asyncio.to_thread(run_codex, prompt, images, schema_path, timeout_s)
                status = classify(run, kind)
                if status not in RETRYABLE:
                    break
            limit = read_rate_limit(run["thread_id"]) or {}
            found = find_generated_images(run["thread_id"]) if status in ("ok", "modified") and kind == "image" else []
            result = {
                "status": status,
                "kind": kind,
                "method": "",
                "image_path": str(found[-1]) if found else None,
                "text": run["final"] if kind == "text" and status == "ok" else {},
                "thread_id": run["thread_id"],
                "seed": None,
                "latency_ms": int((time.monotonic() - started) * 1000),
                "attempts": attempts,
                "reason": _reason(run, status),
                "limit": {
                    "used_percent_before": _last_used_percent,
                    "used_percent_after": limit.get("used_percent"),
                    "resets_at": limit.get("resets_at"),
                },
                "prompt_sha256": hashlib.sha256(prompt.encode()).hexdigest(),
                "reference_sha256": [hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in images if Path(p).is_file()],
                "request_key": "",
                "cached": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            if limit.get("used_percent") is not None:
                _last_used_percent = limit["used_percent"]
    log.info("kind=%s status=%s latency_ms=%d attempts=%d thread_id=%s",
             kind, result["status"], result["latency_ms"], result["attempts"], result["thread_id"])
    return result


async def run_text(prompt: str, images, schema_path) -> dict:
    return await _run("text", prompt, images, schema_path)


async def run_image(prompt: str, images, schema_path=None) -> dict:
    return await _run("image", prompt, images, schema_path)


if __name__ == "__main__":
    if "--self-check" not in sys.argv[1:]:
        sys.exit("usage: python -m app.gen.codex_runner --self-check")
    check = asyncio.run(run_image("Self-check. Answer with JSON only.", []))
    print(check["status"])
    sys.exit(0 if check["status"] == "ok" else 1)
