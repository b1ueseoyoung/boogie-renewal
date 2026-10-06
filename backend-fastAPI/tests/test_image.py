"""app/gen/image.py: 스텁(tests/fixtures/fake_codex.py)으로만 검증한다. 실제 codex는 부르지 않는다."""
import inspect
import json
from pathlib import Path

import pytest
from PIL import Image

from app.gen import codex_runner, image

CHAR_ROLE = "approved storybook character (identity and style source)"
PHOTO_ROLE = "photo of the real person (identity source)"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
SCENE = "The character walks along a riverside path."
LOOK = "A young person with short black hair. Wearing a sky-blue T-shirt."
C1_KEYS = {
    "status", "kind", "method", "image_path", "text", "thread_id", "seed", "latency_ms", "attempts",
    "reason", "limit", "prompt_sha256", "reference_sha256", "request_key", "cached", "created_at",
}


@pytest.fixture
def character(fake_env):
    path = fake_env.data_dir / "files" / "character" / "approved.png"
    path.parent.mkdir(parents=True)
    Image.new("RGB", (768, 1024), (200, 220, 250)).save(path, "PNG")
    return path


def calls(env):
    path = env.codex_home / "calls.jsonl"
    return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []


def refs(argv):
    return [argv[i + 1] for i, arg in enumerate(argv[:-1]) if arg == "-i"]


async def scene(env, method, character_path, out, **over):
    args = dict(scene=SCENE, char_look=LOOK, method=method, photo_path=env.photo,
                character_path=character_path, outfit_rule=None, out_path=out)
    return await image.gen_scene(**{**args, **over})


async def test_gpt_char_passes_only_the_character(fake_env, character, tmp_path):
    out = tmp_path / "out" / "scene.png"
    result = await scene(fake_env, "gpt_char", character, out)
    (call,) = calls(fake_env)
    prompt = call["argv"][-1]
    assert refs(call["argv"]) == [str(character)]
    assert f"{character} - {CHAR_ROLE}" in prompt
    assert str(fake_env.photo) not in prompt and PHOTO_ROLE not in prompt
    assert f"Scene: {SCENE}" in prompt and LOOK in prompt
    assert "Outfit: the same outfit as the reference character" in prompt
    assert "{" not in prompt
    assert (result["status"], result["method"], result["image_path"]) == ("ok", "gpt_char", str(out))
    assert out.read_bytes()[:8] == PNG_SIGNATURE


async def test_gpt_char_photo_passes_character_then_photo(fake_env, character, tmp_path):
    result = await scene(fake_env, "gpt_char_photo", character, tmp_path / "s.png")
    (call,) = calls(fake_env)
    prompt = call["argv"][-1]
    assert refs(call["argv"]) == [str(character), str(fake_env.photo)]
    assert prompt.index(f"{character} - {CHAR_ROLE}") < prompt.index(f"{fake_env.photo} - {PHOTO_ROLE}")
    assert (result["status"], result["method"]) == ("ok", "gpt_char_photo")
    assert len(result["reference_sha256"]) == 2


async def test_gpt_photo_passes_only_the_photo(fake_env, character, tmp_path):
    result = await scene(fake_env, "gpt_photo", character, tmp_path / "s.png")
    (call,) = calls(fake_env)
    prompt = call["argv"][-1]
    assert refs(call["argv"]) == [str(fake_env.photo)]
    assert f"{fake_env.photo} - {PHOTO_ROLE}" in prompt and str(character) not in prompt
    assert "Outfit: the outfit given in the character identity line" in prompt
    assert (result["status"], result["method"]) == ("ok", "gpt_photo")


async def test_outfit_rule_key_from_the_protocol_is_used(fake_env, character, tmp_path):
    await scene(fake_env, "gpt_char", character, tmp_path / "s.png", outfit_rule="scene_specified")
    assert "Outfit: as described in the scene" in calls(fake_env)[0]["argv"][-1]


async def test_base_character_uses_the_photo_and_writes_a_png(fake_env, tmp_path):
    out = tmp_path / "character" / "candidate.png"
    result = await image.gen_base_character(fake_env.photo, out)
    (call,) = calls(fake_env)
    prompt = call["argv"][-1]
    assert refs(call["argv"]) == [str(fake_env.photo)]
    assert prompt.startswith("Create exactly one storybook-style character portrait")
    assert f"{fake_env.photo} - {PHOTO_ROLE}" in prompt and "{" not in prompt
    assert (result["status"], result["kind"], result["image_path"]) == ("ok", "image", str(out))
    with Image.open(out) as img:
        assert img.format == "PNG" and min(img.size) >= 256


async def test_generated_png_is_moved_out_of_codex_home(fake_env, character, tmp_path):
    out = tmp_path / "s.png"
    result = await scene(fake_env, "gpt_char", character, out)
    assert out.is_file()
    assert list((fake_env.codex_home / "generated_images").rglob("*.png")) == []
    assert not (fake_env.codex_home / "generated_images" / result["thread_id"]).exists()


async def test_oversized_reference_is_passed_as_a_2048px_copy(fake_env, tmp_path):
    big = tmp_path / "big.jpg"
    Image.new("RGB", (3000, 1500), (120, 160, 200)).save(big, "JPEG")
    result = await scene(fake_env, "gpt_photo", None, tmp_path / "s.png", photo_path=big)
    (call,) = calls(fake_env)
    (passed,) = refs(call["argv"])
    assert passed != str(big) and passed.startswith(str(fake_env.data_dir))
    with Image.open(passed) as img:
        assert img.size == (2048, 1024)
    assert f"{passed} - {PHOTO_ROLE}" in call["argv"][-1] and str(big) not in call["argv"][-1]
    assert result["status"] == "ok"
    with Image.open(big) as img:
        assert img.size == (3000, 1500)


async def test_reference_over_10mb_is_passed_as_a_smaller_copy(fake_env, tmp_path, monkeypatch):
    monkeypatch.setattr(image, "MAX_REFERENCE_BYTES", 1000)
    await image.gen_base_character(fake_env.photo, tmp_path / "c.png")
    (passed,) = refs(calls(fake_env)[0]["argv"])
    assert passed != str(fake_env.photo) and Path(passed).is_file()


def test_no_parameter_takes_a_scene_result():
    for fn, positional in (
        (image.gen_base_character, ["photo_path", "out_path"]),
        (image.gen_scene, ["scene", "char_look", "method", "photo_path", "character_path", "outfit_rule", "out_path"]),
    ):
        params = list(inspect.signature(fn).parameters.values())
        assert [p.name for p in params if p.kind is p.POSITIONAL_OR_KEYWORD] == positional
        assert [(p.name, p.kind) for p in params[len(positional):]] == [("fresh", inspect.Parameter.KEYWORD_ONLY)]


async def test_missing_reference_is_an_error_without_calling_codex(fake_env, character, tmp_path):
    await scene(fake_env, "gpt_char", character, tmp_path / "first.png")
    before = len(calls(fake_env))
    out = tmp_path / "s.png"
    missing = await scene(fake_env, "gpt_char", tmp_path / "nope.png", out)
    none = await scene(fake_env, "gpt_char", None, out)
    base = await image.gen_base_character(tmp_path / "nope.jpg", out)
    for result in (missing, none, base):
        assert set(result) == C1_KEYS and result["kind"] == "image" and result["thread_id"] is None
        assert (result["status"], result["reason"], result["image_path"]) == ("error", "reference missing", None)
    assert len(calls(fake_env)) == before == 1 and not out.exists()


async def test_non_image_reference_is_an_error_without_calling_codex(fake_env, tmp_path):
    text = tmp_path / "notes.png"
    text.write_text("not an image")
    result = await scene(fake_env, "gpt_char", text, tmp_path / "s.png")
    assert (result["status"], result["reason"]) == ("error", "reference is not an image")
    assert calls(fake_env) == []


async def test_unknown_method_is_an_error_without_calling_codex(fake_env, character, tmp_path):
    result = await scene(fake_env, "baseline_repaired", character, tmp_path / "s.png")
    assert result["status"] == "error" and "method" in result["reason"]
    assert calls(fake_env) == []


@pytest.mark.parametrize("content", ["small_png", "not_png"])
async def test_bad_output_is_not_accepted_as_ok(fake_env, character, tmp_path, monkeypatch, content):
    thread_dir = fake_env.codex_home / "generated_images" / "t-bad"
    thread_dir.mkdir(parents=True)
    produced = thread_dir / "exec-x.png"
    if content == "small_png":
        Image.new("RGB", (255, 400), (1, 2, 3)).save(produced, "PNG")
    else:
        Image.new("RGB", (768, 1024), (1, 2, 3)).save(produced, "JPEG")

    async def fake_run_image(prompt, images, schema_path=None):
        return {"status": "ok", "kind": "image", "method": "", "image_path": str(produced), "thread_id": "t-bad",
                "reason": ""}

    monkeypatch.setattr(codex_runner, "run_image", fake_run_image)
    out = tmp_path / "s.png"
    result = await scene(fake_env, "gpt_char", character, out)
    assert result["status"] == "no_image" and result["image_path"] is None and result["reason"]
    assert not out.exists() and not produced.exists()


async def test_declined_result_is_passed_through_without_a_file(fake_env, character, tmp_path):
    fake_env.set(FAKE_CODEX_MODE="declined")
    out = tmp_path / "s.png"
    result = await scene(fake_env, "gpt_char", character, out)
    assert (result["status"], result["method"], result["image_path"]) == ("declined", "gpt_char", None)
    assert not out.exists()


async def test_fake_mode_also_lands_on_out_path(fake_env, character, tmp_path):
    fake_env.set(GEN_FAKE="1", CODEX_BIN="/nonexistent/codex")
    out = tmp_path / "s.png"
    result = await scene(fake_env, "gpt_char", character, out)
    assert (result["status"], result["image_path"]) == ("ok", str(out)) and out.is_file()
    assert calls(fake_env) == []
    logged = json.loads((fake_env.data_dir / "lab" / "fake-calls.jsonl").read_text().splitlines()[-1])
    assert logged["images"] == [str(character)] and LOOK in logged["prompt"]


async def test_prompt_never_contains_a_name(fake_env, character, tmp_path):
    await scene(fake_env, "gpt_char_photo", character, tmp_path / "s.png")
    assert "charName" not in calls(fake_env)[0]["argv"][-1]
    assert "char_name" not in inspect.signature(image.gen_scene).parameters
