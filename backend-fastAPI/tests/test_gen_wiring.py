"""할 일 35: 어댑터(text, image, comfy)가 저장소(캐시, 재생, 기록)를 거친다. 스텁 호출 수와 gen-log 줄 수로 검증한다."""
import json

import pytest
from PIL import Image

from app.gen import codex_runner, comfy, image, text

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
INTRO = ("서영", "life", "home")
BAD_INTRO = {"intro": "글", "question": "질문", "options": ["하나", "둘"], "illustration": "x"}


@pytest.fixture
def character(fake_env):
    path = fake_env.data_dir / "files" / "character" / "approved.png"
    path.parent.mkdir(parents=True)
    Image.new("RGB", (768, 1024), (200, 220, 250)).save(path, "PNG")
    return path


def calls(env):
    path = env.codex_home / "calls.jsonl"
    return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []


def log_lines(env):
    path = env.data_dir / "lab" / "gen-log.jsonl"
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()] if path.is_file() else []


def cache_files(env):
    cache = env.data_dir / "cache"
    return sorted(str(p.relative_to(cache)) for p in cache.rglob("*") if p.is_file()) if cache.is_dir() else []


async def scene(env, character_path, out, **over):
    args = dict(scene="The character walks along a riverside path.", char_look="A young person.", method="gpt_char",
                photo_path=env.photo, character_path=character_path, outfit_rule=None, out_path=out)
    return await image.gen_scene(**{**args, **over})


async def test_replay_0_generates_twice_and_records_both(fake_env):
    first, second = await text.gen_intro(*INTRO), await text.gen_intro(*INTRO)
    assert len(calls(fake_env)) == 2
    lines = log_lines(fake_env)
    assert len(lines) == 2
    assert lines[0]["request_key"] == lines[1]["request_key"] and len(lines[0]["request_key"]) == 64
    assert [line["method"] for line in lines] == ["gpt_char", "gpt_char"]
    assert (first["status"], first["method"], first["cached"]) == ("ok", "gpt_char", False)
    assert (second["cached"], second["request_key"]) == (False, lines[0]["request_key"])


async def test_prefer_replays_the_second_call_without_the_stub(fake_env):
    fake_env.set(DEMO_REPLAY="prefer")
    first, second = await text.gen_intro(*INTRO), await text.gen_intro(*INTRO)
    assert len(calls(fake_env)) == 1
    assert (first["cached"], second["cached"]) == (False, True)
    assert second["text"] == first["text"] and second["method"] == "gpt_char"
    assert [line["cached"] for line in log_lines(fake_env)] == [False, True]


async def test_replay_1_without_a_saved_result_is_replay_miss(fake_env):
    fake_env.set(DEMO_REPLAY="1")
    result = await text.gen_intro(*INTRO)
    assert (result["status"], result["kind"], result["method"]) == ("replay_miss", "text", "gpt_char")
    assert calls(fake_env) == [] and cache_files(fake_env) == []
    assert [line["status"] for line in log_lines(fake_env)] == ["replay_miss"]


async def test_fresh_generates_even_in_replay_1_and_saves(fake_env):
    fake_env.set(DEMO_REPLAY="1")
    fresh = await text.gen_intro(*INTRO, fresh=True)
    assert fresh["status"] == "ok" and len(calls(fake_env)) == 1
    replayed = await text.gen_intro(*INTRO)  # fresh 결과도 저장된다
    assert replayed["cached"] is True and len(calls(fake_env)) == 1
    again = await text.gen_intro(*INTRO, fresh=True)  # 저장본이 있어도 읽지 않는다
    assert again["cached"] is False and len(calls(fake_env)) == 2
    assert len(log_lines(fake_env)) == 3


async def test_method_defaults_to_gen_method_and_is_part_of_the_key(fake_env):
    fake_env.set(GEN_METHOD="gpt_char_photo")
    default = await text.gen_intro(*INTRO)
    other = await text.gen_intro(*INTRO, method="gpt_photo")
    assert (default["method"], other["method"]) == ("gpt_char_photo", "gpt_photo")
    assert default["request_key"] != other["request_key"]


async def test_every_text_function_goes_through_the_store(fake_env):
    story = ["첫 장면 글이에요.", "둘째 장면 글이에요."]
    results = [
        await text.gen_intro(*INTRO),
        await text.gen_content(story, "질문?", "선택", "서영", False),
        await text.gen_ending(story, "질문?", "선택", "서영"),
        await text.refine_story(["하나예요.", "둘이에요.", "셋이에요."], method="gpt_photo", fresh=True),
        await text.feature_card(fake_env.photo),
    ]
    assert [r["status"] for r in results] == ["ok"] * 5
    lines = log_lines(fake_env)
    assert [line["request_key"] for line in lines] == [r["request_key"] for r in results]
    assert len({line["request_key"] for line in lines}) == 5
    assert [line["method"] for line in lines] == ["gpt_char", "gpt_char", "gpt_char", "gpt_photo", "gpt_char"]
    assert cache_files(fake_env) == sorted(f"{r['request_key']}.json" for r in results)


async def test_schema_violation_is_recorded_as_error_and_never_cached(fake_env):
    fake_env.set(DEMO_REPLAY="prefer", FAKE_CODEX_MESSAGE=json.dumps(BAD_INTRO, ensure_ascii=False))
    result = await text.gen_intro(*INTRO)
    assert result["status"] == "error" and result["text"] == {}
    assert cache_files(fake_env) == []
    assert [(line["status"], line["method"]) for line in log_lines(fake_env)] == [("error", "gpt_char")]
    await text.gen_intro(*INTRO)
    assert len(calls(fake_env)) == 2  # 저장본이 없으니 다시 생성한다


async def test_cached_scene_returns_the_first_stored_path(fake_env, character, tmp_path):
    fake_env.set(DEMO_REPLAY="prefer")
    first_out, second_out = tmp_path / "a" / "scene.png", tmp_path / "b" / "scene.png"
    first = await scene(fake_env, character, first_out)
    second = await scene(fake_env, character, second_out)
    assert len(calls(fake_env)) == 1
    assert (first["cached"], first["image_path"]) == (False, str(first_out))
    # 할 일 40: 적중은 처음 저장된 경로를 그대로 돌려주고 새 out_path로 복사하지 않는다
    assert (second["status"], second["cached"], second["image_path"]) == ("ok", True, str(first_out))
    assert first_out.read_bytes()[:8] == PNG_SIGNATURE and not second_out.exists()
    key = second["request_key"]
    assert cache_files(fake_env) == [f"{key}.json", f"{key}.png"]  # cache/out에 사본을 만들지 않았다
    assert [(line["request_key"], line["cached"]) for line in log_lines(fake_env)] == [(key, False), (key, True)]


async def test_cached_scene_log_line_points_at_stored_path_and_leaves_no_cache_out(fake_env, character, tmp_path):
    fake_env.set(DEMO_REPLAY="prefer")
    stored = tmp_path / "a.png"
    await scene(fake_env, character, stored)
    out = tmp_path / "b" / "scene.png"
    hit = await scene(fake_env, character, out)
    last = log_lines(fake_env)[-1]
    assert (last["cached"], last["image_path"], hit["image_path"]) == (True, str(stored), str(stored))
    assert stored.read_bytes()[:8] == PNG_SIGNATURE and not out.exists()
    assert not [name for name in cache_files(fake_env) if name.startswith("out")]


async def test_legacy_cache_entry_recovers_the_logged_path(fake_env, character, tmp_path):
    fake_env.set(DEMO_REPLAY="prefer")
    first_out = tmp_path / "a" / "scene.png"
    key = (await scene(fake_env, character, first_out))["request_key"]
    entry_path = fake_env.data_dir / "cache" / f"{key}.json"
    legacy = json.loads(entry_path.read_text(encoding="utf-8"))
    assert legacy.pop("stored_path") == str(first_out)
    entry_path.write_text(json.dumps(legacy), encoding="utf-8")  # 할 일 40 이전 저장본: stored_path 없음
    second_out = tmp_path / "b" / "scene.png"
    hit = await scene(fake_env, character, second_out)
    # _logged_path: gen-log의 처음 생성 행(cached 아님)에서 원래 경로를 찾아 복사 없이 돌려주고 저장본에 적는다
    assert (hit["cached"], hit["image_path"]) == (True, str(first_out))
    assert not second_out.exists() and len(calls(fake_env)) == 1
    assert json.loads(entry_path.read_text(encoding="utf-8"))["stored_path"] == str(first_out)


async def test_placeholders_inside_substituted_text_stay_literal(fake_env, character, tmp_path):
    text_with_marks = "A cat reads {char_look} and {reference_lines} on a sign."
    look = "A person holding {photo_path} and {outfit_rule}."
    await scene(fake_env, character, tmp_path / "s.png", scene=text_with_marks, char_look=look)
    prompt = calls(fake_env)[0]["argv"][-1]
    assert f"Scene: {text_with_marks}\n" in prompt and look in prompt
    assert prompt.count(str(character)) == 1  # 참조 줄은 틀의 자리에만 한 번 들어간다


async def test_scene_fresh_generates_in_replay_1(fake_env, character, tmp_path):
    fake_env.set(DEMO_REPLAY="1")
    miss = await scene(fake_env, character, tmp_path / "miss.png")
    assert miss["status"] == "replay_miss" and calls(fake_env) == []
    fresh = await scene(fake_env, character, tmp_path / "fresh.png", fresh=True)
    assert fresh["status"] == "ok" and len(calls(fake_env)) == 1 and (tmp_path / "fresh.png").is_file()


async def test_base_character_goes_through_the_store(fake_env, tmp_path):
    fake_env.set(DEMO_REPLAY="prefer")
    await image.gen_base_character(fake_env.photo, tmp_path / "c1.png")
    again = await image.gen_base_character(fake_env.photo, tmp_path / "c2.png")
    assert len(calls(fake_env)) == 1
    assert (again["cached"], again["image_path"]) == (True, str(tmp_path / "c1.png"))  # 할 일 40: 처음 저장된 경로
    assert not (tmp_path / "c2.png").exists()
    forced = await image.gen_base_character(fake_env.photo, tmp_path / "c3.png", fresh=True)
    assert forced["cached"] is False and len(calls(fake_env)) == 2


async def test_missing_reference_is_recorded_but_not_cached(fake_env, tmp_path):
    result = await scene(fake_env, tmp_path / "nope.png", tmp_path / "s.png")
    assert (result["status"], result["reason"]) == ("error", "reference missing")
    assert calls(fake_env) == [] and cache_files(fake_env) == []
    assert [(line["status"], line["method"]) for line in log_lines(fake_env)] == [("error", "gpt_char")]


async def test_picture_that_fails_the_png_check_is_recorded_but_not_cached(fake_env, character, tmp_path, monkeypatch):
    produced = fake_env.codex_home / "generated_images" / "t-bad" / "exec-x.png"
    produced.parent.mkdir(parents=True)
    Image.new("RGB", (768, 1024), (1, 2, 3)).save(produced, "JPEG")

    async def run_image(prompt, images, schema_path=None):
        return {"status": "ok", "kind": "image", "method": "", "image_path": str(produced), "thread_id": "t-bad",
                "reason": ""}

    monkeypatch.setattr(codex_runner, "run_image", run_image)
    fake_env.set(DEMO_REPLAY="prefer")
    result = await scene(fake_env, character, tmp_path / "s.png")
    assert result["status"] == "no_image" and result["image_path"] is None
    assert cache_files(fake_env) == []
    assert [line["status"] for line in log_lines(fake_env)] == ["no_image"]


@pytest.mark.parametrize("variant", ["repaired", "as_shipped"])
async def test_gen_baseline_stored_records_one_line_in_fake_mode(fake_env, tmp_path, variant):
    fake_env.set(GEN_FAKE="1", CODEX_BIN="/nonexistent/codex")
    out = tmp_path / "b.png"
    result = await comfy.gen_baseline_stored(variant, "a test scene", fake_env.photo, out, seed=7)
    assert (result["status"], result["method"], result["image_path"]) == ("ok", f"baseline_{variant}", str(out))
    assert out.read_bytes()[:8] == PNG_SIGNATURE
    (line,) = log_lines(fake_env)
    assert line["method"] == f"baseline_{variant}" and line["request_key"] == result["request_key"]
    assert len(line["request_key"]) == 64 and calls(fake_env) == []


async def test_gen_baseline_stored_replays_and_honors_fresh(fake_env, tmp_path):
    fake_env.set(GEN_FAKE="1", CODEX_BIN="/nonexistent/codex", DEMO_REPLAY="prefer")
    fake_calls = fake_env.data_dir / "lab" / "fake-calls.jsonl"
    await comfy.gen_baseline_stored("repaired", "a test scene", fake_env.photo, tmp_path / "1.png")
    again = await comfy.gen_baseline_stored("repaired", "a test scene", fake_env.photo, tmp_path / "2.png")
    assert (again["cached"], again["image_path"]) == (True, str(tmp_path / "1.png"))  # 할 일 40: 처음 저장된 경로
    assert (tmp_path / "1.png").read_bytes()[:8] == PNG_SIGNATURE and not (tmp_path / "2.png").exists()
    assert len(fake_calls.read_text(encoding="utf-8").splitlines()) == 1
    forced = await comfy.gen_baseline_stored("repaired", "a test scene", fake_env.photo, tmp_path / "3.png", fresh=True)
    assert forced["cached"] is False
    assert len(fake_calls.read_text(encoding="utf-8").splitlines()) == 2
    assert len(log_lines(fake_env)) == 3
