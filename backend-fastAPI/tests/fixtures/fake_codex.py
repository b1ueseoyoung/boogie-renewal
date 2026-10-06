#!/usr/bin/env python3
"""`codex exec` 스텁. 실제 codex를 부르지 않고 2026-10-02 시험 호출과 같은 모양의 출력을 만든다.

표준 라이브러리만 쓴다(시스템 python3로 실행된다). 환경 변수:
  FAKE_CODEX_HOME          필수. generated_images/, sessions/, calls.jsonl이 생기는 곳(CODEX_HOME_DIR과 같게 둔다)
  FAKE_CODEX_MODE          ok(기본), modified, declined, failed, timeout, no_image, limit, bad_json
  FAKE_CODEX_MESSAGE       있으면 최종 메시지를 이 문자열로 바꾼다
  FAKE_CODEX_USED_PERCENT  rollout에 쓰는 used_percent(기본 23.5)
  FAKE_CODEX_RESETS_AT     rollout에 쓰는 resets_at(기본 1791255029)
`--output-schema`가 status 필드가 없는 스키마(글 작업)면 그 스키마 모양의 JSON을 최종 메시지로 쓰고 그림은 만들지 않는다.
"""
import json
import os
import select
import stat
import struct
import sys
import time
import uuid
import zlib
from datetime import datetime, timezone
from pathlib import Path

MODES = ("ok", "modified", "declined", "failed", "timeout", "no_image", "limit", "bad_json")
FINAL_STATUS = {"ok": "generated", "modified": "modified", "declined": "declined", "no_image": "generated"}


def stdin_closed():
    try:
        st = os.fstat(0)
    except OSError:
        return True
    if stat.S_ISCHR(st.st_mode):
        return st.st_rdev == os.stat(os.devnull).st_rdev
    ready, _, _ = select.select([0], [], [], 0)
    return bool(ready) and os.read(0, 1) == b""


def png(width, height, rgb):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    rows = (b"\0" + bytes(rgb) * width) * height
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")


def sample(schema, key="value"):
    if "enum" in schema:
        return schema["enum"][0]
    kind = schema.get("type")
    if kind == "object":
        return {name: sample(sub, name) for name, sub in schema.get("properties", {}).items()}
    if kind == "array":
        item = schema.get("items", {})
        values = [sample(item, key) for _ in range(schema.get("minItems", 3))]
        return ["%s %d" % (v, i + 1) if isinstance(v, str) else v for i, v in enumerate(values)]
    if kind in ("integer", "number"):
        return 1
    if kind == "boolean":
        return True
    return "가짜 " + key


def emit(event):
    sys.stdout.write(json.dumps(event, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def option(argv, flag):
    return argv[argv.index(flag) + 1] if flag in argv[:-1] else None


def main(argv):
    mode = os.environ.get("FAKE_CODEX_MODE", "ok")
    home = os.environ.get("FAKE_CODEX_HOME")
    if not home or mode not in MODES or argv[:1] != ["exec"]:
        sys.stderr.write("fake_codex: need FAKE_CODEX_HOME, FAKE_CODEX_MODE in %s and the 'exec' subcommand\n" % (MODES,))
        return 2
    home = Path(home)
    home.mkdir(parents=True, exist_ok=True)
    thread_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with (home / "calls.jsonl").open("a", encoding="utf-8") as f:
        call = {"argv": argv, "stdin_closed": stdin_closed(), "mode": mode, "thread_id": thread_id, "at": now}
        f.write(json.dumps(call, ensure_ascii=False) + "\n")

    if mode == "limit":
        sys.stderr.write("ERROR: usage limit reached\n")
        return 1

    rollout = home / "sessions" / "2026" / "10" / "02" / ("rollout-x-%s.jsonl" % thread_id)
    rollout.parent.mkdir(parents=True, exist_ok=True)
    primary = {
        "used_percent": float(os.environ.get("FAKE_CODEX_USED_PERCENT", "23.5")),
        "window_minutes": 10080,
        "resets_at": int(os.environ.get("FAKE_CODEX_RESETS_AT", "1791255029")),
    }
    lines = [
        {"timestamp": now, "type": "session_meta", "payload": {"id": thread_id}},
        {"timestamp": now, "type": "event_msg", "payload": {"type": "token_count", "rate_limits": {"primary": primary}}},
        {"timestamp": now, "type": "response_item", "payload": {"type": "message"}},
    ]
    rollout.write_text("".join(json.dumps(line) + "\n" for line in lines), encoding="utf-8")

    emit({"type": "thread.started", "thread_id": thread_id})
    emit({"type": "turn.started"})
    if mode == "timeout":
        time.sleep(600)
        return 1
    if mode == "failed":
        sys.stderr.write("ERROR: stream disconnected before completion\n")
        return 1

    schema_path = option(argv, "--output-schema")
    schema = json.loads(Path(schema_path).read_text(encoding="utf-8")) if schema_path else None
    text_job = bool(schema) and "status" not in schema.get("properties", {})
    if mode == "bad_json":
        message = "죄송해요, JSON으로 답하지 못했어요 {status: generated"
    elif text_job:
        message = json.dumps(sample(schema), ensure_ascii=False)
    else:
        message = json.dumps({"status": FINAL_STATUS[mode], "note": "fake_codex %s" % mode})
    message = os.environ.get("FAKE_CODEX_MESSAGE", message)

    if mode in ("ok", "modified") and not text_job:
        image = home / "generated_images" / thread_id / ("exec-%s.png" % uuid.uuid4())
        image.parent.mkdir(parents=True, exist_ok=True)
        image.write_bytes(png(768, 1024, uuid.UUID(thread_id).bytes[:3]))

    out_path = option(argv, "-o")
    if out_path:
        Path(out_path).write_text(message, encoding="utf-8")
    emit({"type": "item.completed", "item": {"id": "item_0", "type": "agent_message", "text": message}})
    emit({"type": "turn.completed", "usage": {"input_tokens": 1200, "cached_input_tokens": 0, "output_tokens": 80}})
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
