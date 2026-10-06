"""할 일 16: 실행 기록, 캐시, 재생 모드(DEMO_REPLAY), 한도 보호, 대역 연결."""
import asyncio
import json
import shutil
from pathlib import Path

import pytest

from app.gen import codex_runner, store

C1_KEYS = {
    "status", "kind", "method", "image_path", "text", "thread_id", "seed", "latency_ms", "attempts", "reason",
    "limit", "prompt_sha256", "reference_sha256", "request_key", "cached", "created_at",
}
KEY = "k" * 64


class Stub:
    """호출마다 내용이 다른 그림과 글을 돌려주는 생성 함수."""

    def __init__(self, data_dir, status="ok", used_after=None):
        self.data_dir, self.status, self.used_after, self.calls = data_dir, status, used_after, 0

    async def __call__(self):
        self.calls += 1
        image = None
        if self.status in ("ok", "modified"):
            image = self.data_dir / "lab" / f"gen-{self.calls}.png"
            image.parent.mkdir(parents=True, exist_ok=True)
            image.write_bytes(f"png-{self.calls}".encode())
        return result(self.status, image, n=self.calls, used_after=self.used_after)


def result(status="ok", image=None, n=1, used_after=None, resets_at=None):
    return {
        "status": status, "kind": "image", "method": "gpt_char", "image_path": str(image) if image else None,
        "text": {"n": n}, "thread_id": f"t-{n}", "seed": None, "latency_ms": 5, "attempts": 1, "reason": "",
        "limit": {"used_percent_before": None, "used_percent_after": used_after, "resets_at": resets_at},
        "prompt_sha256": "p", "reference_sha256": [], "request_key": "", "cached": False,
        "created_at": "2026-10-02T00:00:00+00:00",
    }


def run(key, fn):
    return asyncio.run(store.get_or_generate(key, fn))


def log_lines(fake_env):
    path = fake_env.data_dir / "lab" / "gen-log.jsonl"
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()] if path.is_file() else []


def cache_files(fake_env):
    cache = fake_env.data_dir / "cache"
    return sorted(str(p.relative_to(cache)) for p in cache.rglob("*") if p.is_file()) if cache.is_dir() else []


def test_request_key_depends_on_method_prompt_reference_content_and_schema(fake_env, tmp_path):
    same = tmp_path / "same-content.jpg"
    shutil.copy(fake_env.photo, same)
    other = tmp_path / "other.png"
    other.write_bytes(b"other")
    key = store.request_key("gpt_char", "prompt", [fake_env.photo], "intro")
    assert len(key) == 64
    assert key == store.request_key("gpt_char", "prompt", [same], "intro")
    assert key != store.request_key("gpt_photo", "prompt", [fake_env.photo], "intro")
    assert key != store.request_key("gpt_char", "prompt!", [fake_env.photo], "intro")
    assert key != store.request_key("gpt_char", "prompt", [other], "intro")
    assert key != store.request_key("gpt_char", "prompt", [fake_env.photo], "content")
    assert key != store.request_key("gpt_char", "prompt", [fake_env.photo], None)


def test_replay_0_always_generates_and_keeps_the_newest(fake_env):
    stub = Stub(fake_env.data_dir)
    first, second = run(KEY, stub), run(KEY, stub)
    assert stub.calls == 2
    assert (first["cached"], second["cached"]) == (False, False)
    assert (first["text"], second["text"]) == ({"n": 1}, {"n": 2})
    assert first["request_key"] == second["request_key"] == KEY
    saved = json.loads((fake_env.data_dir / "cache" / f"{KEY}.json").read_text(encoding="utf-8"))
    assert saved["text"] == {"n": 2}
    assert Path(saved["image_path"]).read_bytes() == b"png-2"
    assert cache_files(fake_env) == [f"{KEY}.json", f"{KEY}.png"]
    assert Path(second["image_path"]).read_bytes() == b"png-2"  # 원본은 그대로 호출자에게 남는다


def test_prefer_replays_the_saved_result_without_calling_the_stub(fake_env):
    fake_env.set(DEMO_REPLAY="prefer")
    stub = Stub(fake_env.data_dir)
    first, second = run(KEY, stub), run(KEY, stub)
    assert stub.calls == 1
    assert (first["cached"], second["cached"]) == (False, True)
    assert second["text"] == {"n": 1}
    assert Path(second["image_path"]).read_bytes() == b"png-1"
    assert [line["cached"] for line in log_lines(fake_env)] == [False, True]
    # 호출자가 받은 그림을 옮겨 가도 저장본은 남는다
    Path(second["image_path"]).unlink()
    third = run(KEY, stub)
    assert stub.calls == 1 and third["cached"] is True
    assert Path(third["image_path"]).read_bytes() == b"png-1"


def test_replay_1_misses_without_a_saved_result_and_replays_a_saved_one(fake_env):
    fake_env.set(DEMO_REPLAY="1")
    stub = Stub(fake_env.data_dir)
    miss = run(KEY, stub)
    assert miss["status"] == "replay_miss" and stub.calls == 0
    assert cache_files(fake_env) == []

    fake_env.set(DEMO_REPLAY="0")
    run(KEY, stub)
    fake_env.set(DEMO_REPLAY="1")
    hit = run(KEY, stub)
    assert stub.calls == 1
    assert hit["status"] == "ok" and hit["cached"] is True and hit["text"] == {"n": 1}


@pytest.mark.parametrize("status", ["declined", "limit", "timeout", "no_image", "error"])
def test_failed_results_are_never_cached(fake_env, status):
    fake_env.set(DEMO_REPLAY="prefer")
    stub = Stub(fake_env.data_dir, status=status)
    assert run(KEY, stub)["status"] == status
    assert cache_files(fake_env) == []
    run(KEY, stub)
    assert stub.calls == 2


def test_modified_results_are_cached(fake_env):
    fake_env.set(DEMO_REPLAY="prefer")
    stub = Stub(fake_env.data_dir, status="modified")
    run(KEY, stub)
    again = run(KEY, stub)
    assert stub.calls == 1 and again["status"] == "modified" and again["cached"] is True


@pytest.mark.parametrize("garbage", ["{not json", "[1, 2]", '{"status": "limit"}', ""])
def test_corrupt_cache_file_leads_to_a_fresh_generation(fake_env, garbage):
    fake_env.set(DEMO_REPLAY="prefer")
    cache = fake_env.data_dir / "cache"
    cache.mkdir(parents=True)
    (cache / f"{KEY}.json").write_text(garbage, encoding="utf-8")
    stub = Stub(fake_env.data_dir)
    fresh = run(KEY, stub)
    assert stub.calls == 1 and fresh["status"] == "ok" and fresh["cached"] is False
    assert json.loads((cache / f"{KEY}.json").read_text(encoding="utf-8"))["text"] == {"n": 1}


def test_corrupt_cache_file_is_a_replay_miss_in_mode_1(fake_env):
    fake_env.set(DEMO_REPLAY="1")
    cache = fake_env.data_dir / "cache"
    cache.mkdir(parents=True)
    (cache / f"{KEY}.json").write_text("{not json", encoding="utf-8")
    stub = Stub(fake_env.data_dir)
    assert run(KEY, stub)["status"] == "replay_miss" and stub.calls == 0


def test_cached_image_entry_without_its_image_copy_is_a_miss(fake_env):
    fake_env.set(DEMO_REPLAY="prefer")
    stub = Stub(fake_env.data_dir)
    run(KEY, stub)
    (fake_env.data_dir / "cache" / f"{KEY}.png").unlink()
    fresh = run(KEY, stub)
    assert stub.calls == 2 and fresh["cached"] is False and fresh["text"] == {"n": 2}


def test_every_log_line_has_all_c1_keys(fake_env):
    fake_env.set(DEMO_REPLAY="prefer")
    run(KEY, Stub(fake_env.data_dir))
    run(KEY, Stub(fake_env.data_dir))
    run("f" * 64, Stub(fake_env.data_dir, status="timeout"))
    fake_env.set(DEMO_REPLAY="1")
    run("m" * 64, Stub(fake_env.data_dir))
    lines = log_lines(fake_env)
    assert [(line["status"], line["cached"]) for line in lines] == [
        ("ok", False), ("ok", True), ("timeout", False), ("replay_miss", False)]
    for line in lines:
        assert set(line) == C1_KEYS
        assert set(line["limit"]) == {"used_percent_before", "used_percent_after", "resets_at"}
    assert [line["request_key"] for line in lines] == [KEY, KEY, "f" * 64, "m" * 64]


@pytest.mark.parametrize(
    "start, cap, latest, limited",
    [
        (22.0, 40, 61.9, False),
        (22.0, 40, 62.0, True),
        (22.0, 40, 95.0, True),
        (90.0, 40, 94.9, False),
        (90.0, 40, 95.0, True),
        (22.3, 10, 32.3, True),  # 32.3 - 22.3은 부동소수점으로 9.999999999999996이다
    ],
)
def test_limit_guard_boundaries(fake_env, start, cap, latest, limited):
    store.record(result(used_after=latest, resets_at=1791255029))
    verdict = store.LimitGuard(start, cap).check()
    if limited:
        assert verdict["status"] == "limit" and verdict["resets_at"] == 1791255029
    else:
        assert verdict is None


def test_limit_guard_uses_the_last_record_not_an_older_one(fake_env):
    store.record(result(used_after=99.0))
    store.record(result(used_after=30.0))
    assert store.LimitGuard(22.0, 40).check() is None


def rollout(fake_env, name, mtime, lines):
    path = fake_env.codex_home / "sessions" / "2026" / "10" / "02" / f"rollout-{name}.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = [{"timestamp": ts, "type": "event_msg", "payload": {"type": "token_count", "rate_limits": {
        "primary": {"used_percent": used, "window_minutes": 10080, "resets_at": 1791255029}}}} for ts, used in lines]
    path.write_text('{"timestamp": "2026-10-02T09:00:00.000Z", "type": "session_meta"}\n'
                    + "".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")
    import os
    os.utime(path, (mtime, mtime))


def test_limit_guard_falls_back_to_the_latest_rollout_record_by_timestamp(fake_env):
    assert store.LimitGuard(22.0, 40).check() is None  # 기록이 전혀 없으면 통과
    # 수정 시각이 더 새로운 파일의 값(30.0)이 더 오래된 기록이다
    rollout(fake_env, "2026-10-02T10-00-00-aaa", 2000, [("2026-10-02T10:00:00.000Z", 30.0)])
    rollout(fake_env, "2026-10-02T11-00-00-bbb", 1000,
            [("2026-10-02T11:00:00.000Z", 50.0), ("2026-10-02T11:05:00.000Z", 96.0)])
    assert store.latest_limit() == {"used_percent": 96.0, "resets_at": 1791255029}
    assert store.LimitGuard(22.0, 80).check() == {"status": "limit", "used_percent": 96.0, "resets_at": 1791255029}
    # 마지막 생성 기록에 한도 값이 없어도(캐시 적중, 대역) rollout으로 내려간다
    store.record(result(used_after=None))
    assert store.latest_limit()["used_percent"] == 96.0


def scene(method="gpt_char"):
    prompt = "Scene: test"

    async def generate():
        return await codex_runner.run_image(prompt, [])

    return store.request_key(method, prompt, [], None), generate


def test_gen_fake_runs_no_process_and_still_records(fake_env):
    fake_env.set(GEN_FAKE="1", CODEX_BIN="/nonexistent/codex")
    key, generate = scene()
    done = run(key, generate)
    assert done["status"] == "ok" and done["request_key"] == key and done["method"] == "fake"
    assert not (fake_env.codex_home / "calls.jsonl").exists()
    assert not (fake_env.data_dir / "lab" / "jobs").exists()
    assert cache_files(fake_env) == [f"{key}.json", f"{key}.png"]
    assert [line["request_key"] for line in log_lines(fake_env)] == [key]


def test_gen_fake_limit_returns_limit_with_resets_at_and_caches_nothing(fake_env):
    fake_env.set(GEN_FAKE="1", GEN_FAKE_ERROR="limit", CODEX_BIN="/nonexistent/codex")
    key, generate = scene()
    done = run(key, generate)
    assert done["status"] == "limit"
    assert done["limit"]["resets_at"] is not None
    assert cache_files(fake_env) == []
    assert not (fake_env.codex_home / "calls.jsonl").exists()
    assert store.LimitGuard(0.0, 40).check()["resets_at"] == done["limit"]["resets_at"]
