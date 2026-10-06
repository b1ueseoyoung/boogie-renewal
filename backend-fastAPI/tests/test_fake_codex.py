"""tests/fixtures/fake_codex.py 스텁이 모드별로 JSONL과 파일을 만드는지 확인한다."""
import json
import os
import signal
import subprocess

import pytest
from PIL import Image


def codex_args(env, out, extra=()):
    return [
        str(env.fake_codex), "exec", "--json", "--skip-git-repo-check", "-s", "read-only",
        "-C", str(out.parent), "-i", str(env.photo), *extra, "-o", str(out), "그림을 그려 줘",
    ]


def run_stub(env, mode, extra=(), **popen):
    out = env.codex_home.parent / "last-message.txt"
    popen.setdefault("stdin", subprocess.DEVNULL)
    proc = subprocess.run(
        codex_args(env, out, extra), env={**os.environ, "FAKE_CODEX_MODE": mode},
        capture_output=True, text=True, timeout=30, **popen,
    )
    events = [json.loads(line) for line in proc.stdout.splitlines()]
    return proc, events, out


def jsonl(path):
    return [json.loads(line) for line in path.read_text().splitlines()]


def test_stub_is_executable(fake_env):
    assert os.access(fake_env.fake_codex, os.X_OK)


@pytest.mark.parametrize("mode,final_status", [("ok", "generated"), ("modified", "modified")])
def test_success_modes_write_events_message_png_and_rollout(fake_env, mode, final_status):
    proc, events, out = run_stub(fake_env, mode)
    assert proc.returncode == 0
    assert [e["type"] for e in events] == ["thread.started", "turn.started", "item.completed", "turn.completed"]
    thread_id = events[0]["thread_id"]
    assert events[2]["item"]["type"] == "agent_message"
    assert events[2]["item"]["text"] == out.read_text()
    assert json.loads(out.read_text())["status"] == final_status
    assert events[3]["usage"]["output_tokens"] > 0

    pngs = list((fake_env.codex_home / "generated_images" / thread_id).glob("exec-*.png"))
    assert len(pngs) == 1
    with Image.open(pngs[0]) as img:
        img.load()
        assert img.format == "PNG"
        assert min(img.size) >= 256

    rollout = fake_env.codex_home / "sessions" / "2026" / "10" / "02" / f"rollout-x-{thread_id}.jsonl"
    lines = jsonl(rollout)
    limit_lines = [l for l in lines if "used_percent" in json.dumps(l)]
    assert len(limit_lines) == 1
    assert limit_lines[0]["type"] == "event_msg"
    assert limit_lines[0]["payload"]["type"] == "token_count"
    primary = limit_lines[0]["payload"]["rate_limits"]["primary"]
    assert isinstance(primary["used_percent"], float)
    assert primary["window_minutes"] == 10080
    assert isinstance(primary["resets_at"], int)
    assert "T" in limit_lines[0]["timestamp"]
    # 실제 파일처럼 한도 기록이 마지막 줄이 아니다.
    assert "used_percent" not in json.dumps(lines[-1])


def test_two_calls_get_different_threads_and_images(fake_env):
    _, first, _ = run_stub(fake_env, "ok")
    _, second, _ = run_stub(fake_env, "ok")
    assert first[0]["thread_id"] != second[0]["thread_id"]
    pngs = sorted((fake_env.codex_home / "generated_images").glob("*/exec-*.png"))
    assert len(pngs) == 2
    assert pngs[0].read_bytes() != pngs[1].read_bytes()


@pytest.mark.parametrize("mode,final_status", [("declined", "declined"), ("no_image", "generated")])
def test_modes_without_image(fake_env, mode, final_status):
    proc, events, out = run_stub(fake_env, mode)
    assert proc.returncode == 0
    assert events[-1]["type"] == "turn.completed"
    assert json.loads(out.read_text())["status"] == final_status
    assert not list(fake_env.codex_home.glob("generated_images/*/*.png"))


def test_bad_json_mode_writes_non_json_final_message(fake_env):
    proc, events, out = run_stub(fake_env, "bad_json")
    assert proc.returncode == 0
    with pytest.raises(json.JSONDecodeError):
        json.loads(out.read_text())
    assert events[2]["item"]["text"] == out.read_text()
    assert not list(fake_env.codex_home.glob("generated_images/*/*.png"))


def test_limit_mode_exits_1_with_usage_limit_on_stderr(fake_env):
    proc, _, out = run_stub(fake_env, "limit")
    assert proc.returncode == 1
    assert "usage limit reached" in proc.stderr
    assert not out.exists()


def test_failed_mode_exits_nonzero_without_limit_words(fake_env):
    proc, _, out = run_stub(fake_env, "failed")
    assert proc.returncode == 1
    assert proc.stderr.strip()
    assert not any(word in proc.stderr.lower() for word in ("usage limit", "rate limit", "limit reached", "quota"))
    assert not out.exists()
    assert not list(fake_env.codex_home.glob("generated_images/*/*.png"))


def test_unknown_mode_is_rejected(fake_env):
    proc, _, _ = run_stub(fake_env, "nope")
    assert proc.returncode == 2
    assert "FAKE_CODEX_MODE" in proc.stderr


def test_calls_log_records_args_and_closed_stdin(fake_env):
    run_stub(fake_env, "ok")
    run_stub(fake_env, "limit")
    calls = jsonl(fake_env.codex_home / "calls.jsonl")
    assert [c["mode"] for c in calls] == ["ok", "limit"]
    argv = calls[0]["argv"]
    assert argv[:6] == ["exec", "--json", "--skip-git-repo-check", "-s", "read-only", "-C"]
    assert argv[argv.index("-i") + 1] == str(fake_env.photo)
    assert argv[-1] == "그림을 그려 줘"
    assert calls[0]["stdin_closed"] is True


def test_calls_log_records_open_stdin(fake_env):
    read_end, write_end = os.pipe()
    try:
        run_stub(fake_env, "ok", stdin=read_end)
    finally:
        os.close(read_end)
        os.close(write_end)
    assert jsonl(fake_env.codex_home / "calls.jsonl")[0]["stdin_closed"] is False


def test_output_schema_shapes_the_text_message(fake_env, tmp_path):
    schema = tmp_path / "intro.json"
    schema.write_text(json.dumps({
        "type": "object",
        "properties": {
            "intro": {"type": "string"},
            "question": {"type": "string"},
            "options": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 3},
        },
        "required": ["intro", "question", "options"],
        "additionalProperties": False,
    }))
    proc, _, out = run_stub(fake_env, "ok", extra=("--output-schema", str(schema)))
    assert proc.returncode == 0
    message = json.loads(out.read_text())
    assert set(message) == {"intro", "question", "options"}
    assert len(set(message["options"])) == 3
    # 글 작업은 그림을 만들지 않는다.
    assert not list(fake_env.codex_home.glob("generated_images/*/*.png"))


def test_message_override(fake_env):
    override = json.dumps({"paragraphs": ["하나", "둘"], "title": "제목", "summary": "요약"}, ensure_ascii=False)
    out = fake_env.codex_home.parent / "last-message.txt"
    subprocess.run(
        codex_args(fake_env, out), env={**os.environ, "FAKE_CODEX_MESSAGE": override},
        stdin=subprocess.DEVNULL, capture_output=True, timeout=30, check=True,
    )
    assert out.read_text() == override


def test_timeout_mode_hangs_until_killed_and_leaves_no_process(fake_env):
    out = fake_env.codex_home.parent / "last-message.txt"
    proc = subprocess.Popen(
        codex_args(fake_env, out), env={**os.environ, "FAKE_CODEX_MODE": "timeout"},
        stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        text=True, start_new_session=True,
    )
    try:
        # 고정 대기 없이 이벤트를 기다린다: 스텁은 turn.started를 쓴 뒤에 멈춘다.
        assert json.loads(proc.stdout.readline())["type"] == "thread.started"
        assert json.loads(proc.stdout.readline())["type"] == "turn.started"
        assert proc.poll() is None
    finally:
        os.killpg(proc.pid, signal.SIGKILL)
        returncode = proc.wait(timeout=10)
        proc.stdout.close()
    assert returncode == -signal.SIGKILL
    assert not out.exists()
    assert jsonl(fake_env.codex_home / "calls.jsonl")[0]["mode"] == "timeout"
