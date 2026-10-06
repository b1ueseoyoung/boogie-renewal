"""codex 글 어댑터. 각 함수는 C-1 결과를 돌려주고, 답이 스키마나 개수 규칙을 어기면 status를 error로 바꾼다."""
import json
from pathlib import Path

from app.core.config import settings
from app.gen import prompts, store
from app.gen.codex_runner import run_text

SCHEMAS = Path(__file__).parent / "schemas"


def _violation(value: dict, schema: dict) -> str:
    """스키마 파일이 쓰는 범위(문자열, 문자열 배열, 모든 필드 필수, 추가 필드 금지)만 검사한다."""
    properties = schema["properties"]
    for name in properties:
        if name not in value:
            return f"missing field {name}"
    for name in value:
        if name not in properties:
            return f"unexpected field {name}"
    for name, rule in properties.items():
        item = value[name]
        if rule["type"] == "string" and not isinstance(item, str):
            return f"{name} is not a string"
        if rule["type"] == "array" and not (isinstance(item, list) and all(isinstance(x, str) for x in item)):
            return f"{name} is not a list of strings"
    return ""


def _count(name: str, expected: int):
    def check(value: dict) -> str:
        found = len(value[name])
        return "" if found == expected else f"{name} has {found} items, expected {expected}"

    return check


async def _generate(name: str, prompt: str, images=(), check=None, *, method=None, fresh=False) -> dict:
    """저장소(캐시, 재생, 기록)를 거친다. method가 None이면 settings.GEN_METHOD다."""
    method = method or settings.GEN_METHOD
    images = list(images)
    schema_path = SCHEMAS / f"{name}.json"

    async def generate() -> dict:
        result = await run_text(prompt, images, schema_path)
        result["method"] = method
        if result["status"] == "ok":
            schema = json.loads(schema_path.read_text(encoding="utf-8"))
            problem = _violation(result["text"], schema) or (check(result["text"]) if check else "")
            if problem:
                result.update(status="error", text={},
                              reason=f"answer does not match the schema {name}.json: {problem}")
        return result

    key = store.request_key(method, prompt, images, name)
    return await store.get_or_generate(key, generate, kind="text", method=method, fresh=fresh)


async def gen_intro(charName, genre, place, *, method=None, fresh=False) -> dict:
    prompt = prompts.intro(charName, genre, place)
    return await _generate("intro", prompt, check=_count("options", 3), method=method, fresh=fresh)


async def gen_content(story_so_far, last_question, choice, charName, final_question, *, method=None,
                      fresh=False) -> dict:
    prompt = prompts.content(story_so_far, last_question, choice, charName, final_question)
    return await _generate("content", prompt, check=_count("options", 3), method=method, fresh=fresh)


async def gen_ending(story_so_far, last_question, choice, charName, *, method=None, fresh=False) -> dict:
    prompt = prompts.ending(story_so_far, last_question, choice, charName)
    return await _generate("ending", prompt, method=method, fresh=fresh)


async def refine_story(paragraphs, *, method=None, fresh=False) -> dict:
    paragraphs = list(paragraphs)
    check = _count("paragraphs", len(paragraphs))
    return await _generate("refine", prompts.refine(paragraphs), check=check, method=method, fresh=fresh)


async def feature_card(photo_path, character_path=None, *, method=None, fresh=False) -> dict:
    images = [path for path in (photo_path, character_path) if path]
    prompt = prompts.feature_card(character_path is not None)
    return await _generate("feature_card", prompt, images, method=method, fresh=fresh)
