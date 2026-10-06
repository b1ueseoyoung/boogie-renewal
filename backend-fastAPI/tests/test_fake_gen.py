"""app/gen/fake.py: 러너 층 대역."""
import json
import re

import pytest
from PIL import Image

from app.gen import fake

C1_KEYS = {
    "status", "kind", "method", "image_path", "text", "thread_id", "seed", "latency_ms", "attempts",
    "reason", "limit", "prompt_sha256", "reference_sha256", "request_key", "cached", "created_at",
}
HANGUL = re.compile("[가-힣]")


def calls(env):
    path = env.data_dir / "lab" / "fake-calls.jsonl"
    return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []


@pytest.mark.parametrize(
    "schema_name,keys",
    [
        ("intro", {"intro", "question", "options", "illustration"}),
        ("content", {"story", "question", "options", "illustration"}),
        ("ending", {"story", "illustration"}),
        ("refine", {"paragraphs", "title", "summary"}),
        ("feature_card", {"charLook"}),
    ],
)
def test_text_returns_fixed_story_for_schema(fake_env, schema_name, keys):
    result = fake.fake_run_text("프롬프트", [], schema_name)
    assert set(result) == C1_KEYS
    assert (result["status"], result["kind"], result["method"], result["attempts"]) == ("ok", "text", "fake", 1)
    assert set(result["text"]) == keys
    assert result["image_path"] is None
    assert result == {**fake.fake_run_text("프롬프트", [], schema_name), **{k: result[k] for k in ("thread_id", "latency_ms", "created_at")}}


def test_text_content_shapes(fake_env):
    intro = fake.fake_run_text("p", [], "intro")["text"]
    assert len(intro["options"]) == 3 and HANGUL.search(intro["intro"])
    assert not HANGUL.search(intro["illustration"])
    content = fake.fake_run_text("p", [], "content")["text"]
    assert len(content["options"]) == 3 and HANGUL.search(content["story"])
    refine = fake.fake_run_text("p", [], "refine")["text"]
    assert len(refine["paragraphs"]) == 6 and len(refine["title"]) <= 10
    look = fake.fake_run_text("p", [str(fake_env.photo)], "feature_card")["text"]["charLook"]
    assert look.startswith("A ") and "Wearing" in look and len(look) <= 300


def test_schema_name_may_be_a_file_path(fake_env):
    by_name = fake.fake_run_text("p", [], "intro")["text"]
    assert fake.fake_run_text("p", [], "/some/dir/schemas/intro.json")["text"] == by_name


def test_unknown_schema_is_an_error(fake_env):
    result = fake.fake_run_text("p", [], "nope")
    assert result["status"] == "error"
    assert "nope" in result["reason"]


def test_image_is_768x1024_png_and_differs_per_call(fake_env):
    first = fake.fake_run_image("장면 하나", [str(fake_env.photo)])
    second = fake.fake_run_image("장면 둘", [str(fake_env.photo)])
    assert set(first) == C1_KEYS
    assert (first["status"], first["kind"], first["method"]) == ("ok", "image", "fake")
    assert first["image_path"] != second["image_path"]
    assert first["thread_id"] != second["thread_id"]
    colors = []
    for result in (first, second):
        assert result["image_path"].startswith(str(fake_env.data_dir.resolve()))
        with Image.open(result["image_path"]) as img:
            assert (img.format, img.size) == ("PNG", (768, 1024))
            colors.append(img.convert("RGB").getpixel((760, 1016)))
    assert colors[0] != colors[1]
    assert len(first["reference_sha256"]) == 1 and len(first["reference_sha256"][0]) == 64
    assert len(first["prompt_sha256"]) == 64


def test_calls_are_logged_with_inputs(fake_env):
    fake.fake_run_text("글 프롬프트", [str(fake_env.photo)], "intro")
    fake.fake_run_image("그림 프롬프트", [str(fake_env.photo), "/tmp/character.png"])
    text_call, image_call = calls(fake_env)
    assert (text_call["kind"], text_call["prompt"], text_call["schema_name"]) == ("text", "글 프롬프트", "intro")
    assert text_call["images"] == [str(fake_env.photo)]
    assert (image_call["kind"], image_call["prompt"], image_call["schema_name"]) == ("image", "그림 프롬프트", None)
    assert image_call["images"] == [str(fake_env.photo), "/tmp/character.png"]
    assert image_call["serial"] > text_call["serial"]


@pytest.mark.parametrize("error", ["declined", "limit", "timeout", "no_image"])
def test_gen_fake_error_env_ends_every_generation_in_that_state(fake_env, error):
    fake_env.set(GEN_FAKE_ERROR=error)
    for result in (fake.fake_run_image("p", []), fake.fake_run_text("p", [], "intro"), fake.fake_run_image("p", [])):
        assert (result["status"], result["attempts"]) == (error, 1)
        assert result["image_path"] is None and result["text"] == {}
        assert (result["limit"]["resets_at"] is not None) == (error == "limit")
    assert not list(fake_env.data_dir.rglob("*.png"))
    assert [c["status"] for c in calls(fake_env)] == [error] * 3


def test_set_fake_error_counts_generations(fake_env):
    fake.set_fake_error("timeout", 2)
    statuses = [
        fake.fake_run_image("p", [])["status"],
        fake.fake_run_text("p", [], "intro")["status"],
        fake.fake_run_image("p", [])["status"],
    ]
    assert statuses == ["timeout", "timeout", "ok"]


def test_set_fake_error_wins_over_env_and_none_clears(fake_env):
    fake_env.set(GEN_FAKE_ERROR="declined")
    fake.set_fake_error("limit", 1)
    assert fake.fake_run_image("p", [])["status"] == "limit"
    assert fake.fake_run_image("p", [])["status"] == "declined"
    fake_env.set(GEN_FAKE_ERROR="none")
    fake.set_fake_error("limit", 5)
    fake.set_fake_error("none", 1)
    assert fake.fake_run_image("p", [])["status"] == "ok"


@pytest.mark.parametrize("error,times", [("bogus", 1), ("limit", -1)])
def test_set_fake_error_rejects_bad_input(fake_env, error, times):
    with pytest.raises(ValueError):
        fake.set_fake_error(error, times)


def test_delay_is_applied(fake_env, monkeypatch):
    slept = []
    monkeypatch.setattr(fake.time, "sleep", slept.append)
    fake_env.set(GEN_FAKE_DELAY_MS="250")
    fake.fake_run_text("p", [], "intro")
    fake.fake_run_image("p", [])
    assert slept == [0.25, 0.25]


def test_no_delay_by_default(fake_env, monkeypatch):
    slept = []
    monkeypatch.setattr(fake.time, "sleep", slept.append)
    fake.fake_run_image("p", [])
    assert slept == []
