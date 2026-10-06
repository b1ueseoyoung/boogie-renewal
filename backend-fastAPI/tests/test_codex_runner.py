"""app/gen/codex_runner.py: 스텁(tests/fixtures/fake_codex.py)과 대역(GEN_FAKE=1)으로만 검증한다."""
import asyncio
import json
import logging
import os
import threading
import time

import pytest

from app.gen import codex_runner, fake

C1_KEYS = {
    "status", "kind", "method", "image_path", "text", "thread_id", "seed", "latency_ms", "attempts",
    "reason", "limit", "prompt_sha256", "reference_sha256", "request_key", "cached", "created_at",
}


@pytest.fixture(autouse=True)
def _fresh_limit(monkeypatch):
    monkeypatch.setattr(codex_runner, "_last_used_percent", None)


def calls(env):
    path = env.codex_home / "calls.jsonl"
    return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []


@pytest.mark.parametrize(
    "mode,status,attempts",
    [
        ("ok", "ok", 1),
        ("modified", "modified", 1),
        ("declined", "declined", 1),
        ("no_image", "no_image", 2),
        ("limit", "limit", 1),
        ("failed", "error", 1),
        ("bad_json", "error", 1),
    ],
)
async def test_image_modes_are_classified(fake_env, mode, status, attempts):
    fake_env.set(FAKE_CODEX_MODE=mode)
    result = await codex_runner.run_image("그림 프롬프트", [fake_env.photo])
    assert set(result) == C1_KEYS
    assert (result["status"], result["kind"], result["attempts"]) == (status, "image", attempts)
    assert len(calls(fake_env)) == attempts
    assert (result["image_path"] is not None) == (status in ("ok", "modified"))
    assert len(result["reference_sha256"]) == 1 and len(result["prompt_sha256"]) == 64


async def test_argv_order_and_closed_stdin(fake_env):
    fake_env.set(CODEX_MODEL="m1", CODEX_IGNORE_USER_CONFIG="1")
    await codex_runner.run_image("PROMPT", [fake_env.photo])
    (call,) = calls(fake_env)
    argv = call["argv"]
    assert call["stdin_closed"] is True
    assert argv[:6] == ["exec", "--json", "--skip-git-repo-check", "-s", "read-only", "-C"]
    job = argv[6]
    assert job.startswith(str(fake_env.data_dir / "lab" / "jobs")) and os.path.isfile(f"{job}/events.jsonl")
    assert os.path.isfile(f"{job}/stderr.log")
    assert argv[7:10] == ["-m", "m1", "--ignore-user-config"]
    assert argv[10:12] == ["-i", str(fake_env.photo)]
    assert argv[12] == "--output-schema"
    assert argv[14:] == ["-o", f"{job}/last.json", "PROMPT"]
    assert argv.index("--json") < argv.index("-s") < argv.index("-i") < argv.index("-o")


async def test_text_job_returns_schema_shaped_json(fake_env, tmp_path):
    schema = tmp_path / "feature_card.json"
    schema.write_text(json.dumps({"type": "object", "properties": {"charLook": {"type": "string"}}}))
    result = await codex_runner.run_text("글 프롬프트", [], schema)
    assert (result["status"], result["kind"], result["attempts"]) == ("ok", "text", 1)
    assert result["text"] == {"charLook": "가짜 charLook"} and result["image_path"] is None
    argv = calls(fake_env)[0]["argv"]
    assert argv[argv.index("--output-schema") + 1] == str(schema)


async def test_schema_goes_into_the_prompt_when_output_schema_is_off(fake_env, tmp_path):
    fake_env.set(CODEX_USE_OUTPUT_SCHEMA="0")
    schema = tmp_path / "s.json"
    schema.write_text('{"type": "object", "properties": {"charLook": {"type": "string"}}}')
    await codex_runner.run_text("글 프롬프트", [], schema)
    argv = calls(fake_env)[0]["argv"]
    assert "--output-schema" not in argv
    assert argv[-1].startswith("글 프롬프트") and schema.read_text() in argv[-1] and "JSON" in argv[-1]


async def test_timeout_retries_once_and_kills_the_process_group(fake_env, monkeypatch):
    fake_env.set(FAKE_CODEX_MODE="timeout", IMAGE_TIMEOUT_S="1")
    real, pids = codex_runner.run_codex, []

    def spy(*args):
        run = real(*args)
        pids.append(run["pid"])
        return run

    monkeypatch.setattr(codex_runner, "run_codex", spy)
    result = await codex_runner.run_image("p", [])
    assert (result["status"], result["attempts"]) == ("timeout", 2)
    assert len(calls(fake_env)) == 2 and len(pids) == 2
    for pid in pids:
        with pytest.raises(ProcessLookupError):
            os.killpg(pid, 0)


async def test_generated_png_is_found_in_its_thread_dir_only(fake_env):
    result = await codex_runner.run_image("p", [])
    thread_dir = fake_env.codex_home / "generated_images" / result["thread_id"]
    assert result["image_path"].startswith(str(thread_dir)) and result["image_path"].endswith(".png")
    other = fake_env.codex_home / "generated_images" / "other-thread"
    other.mkdir()
    (other / "exec-stale.png").write_bytes(b"x")
    older, newer = thread_dir / "exec-a-older.png", thread_dir / "exec-0-newer.png"
    for path, mtime in ((older, 1), (newer, time.time() + 60)):
        path.write_bytes(b"x")
        os.utime(path, (mtime, mtime))
    found = codex_runner.find_generated_images(result["thread_id"])
    assert [p.name for p in found] == [older.name, os.path.basename(result["image_path"]), newer.name]
    assert codex_runner.find_generated_images("other-thread") == [other / "exec-stale.png"]
    assert codex_runner.find_generated_images("missing") == codex_runner.find_generated_images(None) == []


async def test_rate_limit_is_read_and_carried_to_the_next_job(fake_env):
    fake_env.set(FAKE_CODEX_USED_PERCENT="41.5", FAKE_CODEX_RESETS_AT="1800000000")
    first = await codex_runner.run_image("p", [])
    assert first["limit"] == {"used_percent_before": None, "used_percent_after": 41.5, "resets_at": 1800000000}
    fake_env.set(FAKE_CODEX_USED_PERCENT="43")
    second = await codex_runner.run_image("p", [])
    assert second["limit"] == {"used_percent_before": 41.5, "used_percent_after": 43.0, "resets_at": 1800000000}


def test_rate_limit_takes_the_latest_timestamp_and_primary_window(fake_env):
    def record(ts, used, resets):
        limits = {"primary": {"used_percent": used, "resets_at": resets}, "secondary": {"used_percent": 99.0, "resets_at": 9}}
        return json.dumps({"timestamp": ts, "type": "event_msg", "payload": {"type": "token_count", "rate_limits": limits}})

    old_dir = fake_env.codex_home / "sessions" / "2026" / "10" / "01"
    new_dir = fake_env.codex_home / "sessions" / "2026" / "10" / "02"
    old_dir.mkdir(parents=True)
    new_dir.mkdir(parents=True)
    latest = old_dir / "rollout-a-t1.jsonl"
    latest.write_text("\n".join([record("2026-10-02T09:00:00Z", 30.0, 111), "not json \"used_percent\"",
                                 record("2026-10-02T12:00:00Z", 35.0, 222), '{"timestamp": "2026-10-02T13:00:00Z"}']))
    (new_dir / "rollout-b-t1.jsonl").write_text(record("2026-10-02T10:00:00Z", 32.0, 111))
    (new_dir / "rollout-b-t2.jsonl").write_text(record("2026-10-02T23:00:00Z", 77.0, 333))
    os.utime(latest, (1, 1))
    assert codex_runner.read_rate_limit("t1") == {"used_percent": 35.0, "resets_at": 222}
    assert codex_runner.read_rate_limit("nope") is None


async def test_two_image_jobs_never_overlap(fake_env, monkeypatch):
    fake_env.set(GEN_CONCURRENCY="1")
    real, spans, state, guard = codex_runner.run_codex, [], {"active": 0, "peak": 0}, threading.Lock()

    def spy(*args):
        with guard:
            state["active"] += 1
            state["peak"] = max(state["peak"], state["active"])
        start = time.monotonic()
        try:
            return real(*args)
        finally:
            spans.append((start, time.monotonic()))
            with guard:
                state["active"] -= 1

    monkeypatch.setattr(codex_runner, "run_codex", spy)
    results = await asyncio.gather(codex_runner.run_image("a", []), codex_runner.run_image("b", []))
    assert [r["status"] for r in results] == ["ok", "ok"]
    (start1, end1), (start2, end2) = sorted(spans)
    assert end1 <= start2 and state["peak"] == 1


async def test_three_image_jobs_run_together_by_default(fake_env, monkeypatch):
    """선택지 셋을 함께 만든다(GEN_CONCURRENCY 기본 3). 셋이 동시에 안에 있어야 장벽을 넘는다."""
    real, barrier = codex_runner.run_codex, threading.Barrier(3, timeout=10)

    def spy(*args):
        barrier.wait()
        return real(*args)

    monkeypatch.setattr(codex_runner, "run_codex", spy)
    results = await asyncio.gather(*(codex_runner.run_image(p, []) for p in "abc"))
    assert [r["status"] for r in results] == ["ok"] * 3


async def test_prose_around_json_uses_the_first_block(fake_env):
    fake_env.set(FAKE_CODEX_MESSAGE='완료했어요: {"status": "modified", "note": "옷 색을 바꿈"} 끝.')
    result = await codex_runner.run_image("p", [])
    assert (result["status"], result["reason"]) == ("modified", "옷 색을 바꿈")
    assert codex_runner.parse_final('{"a": 1}') == {"a": 1}
    assert codex_runner.parse_final("죄송해요 {status: generated") is None
    assert codex_runner.parse_final("[1, 2]") is None and codex_runner.parse_final("") is None


async def test_fake_results_are_final_without_retry(fake_env):
    fake_env.set(GEN_FAKE="1", CODEX_BIN="/nonexistent/codex")
    fake.set_fake_error("timeout", 1)
    first = await codex_runner.run_image("p", [fake_env.photo])
    second = await codex_runner.run_image("p", [fake_env.photo])
    assert (first["status"], first["attempts"]) == ("timeout", 1)
    assert (second["status"], second["attempts"]) == ("ok", 1) and os.path.isfile(second["image_path"])
    text = await codex_runner.run_text("p", [], "/some/schemas/intro.json")
    assert text["status"] == "ok" and len(text["text"]["options"]) == 3
    assert calls(fake_env) == []


async def test_missing_binary_is_an_error(fake_env):
    fake_env.set(CODEX_BIN="/nonexistent/codex")
    result = await codex_runner.run_image("p", [])
    assert (result["status"], result["attempts"]) == ("error", 1)


async def test_log_has_no_prompt_or_photo_path(fake_env, caplog):
    with caplog.at_level(logging.INFO, logger="app.gen.codex_runner"):
        result = await codex_runner.run_image("SECRET-PROMPT", [fake_env.photo])
    assert f"status=ok" in caplog.text and result["thread_id"] in caplog.text
    assert "SECRET-PROMPT" not in caplog.text and str(fake_env.photo) not in caplog.text
