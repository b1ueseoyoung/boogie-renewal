"""codex 이미지 어댑터: 기준 캐릭터와 장면. 프롬프트 틀과 역할 문구는 app/lab/protocol.json(C-6)에서 읽는다.

참조는 방식이 정한 것만 넘긴다(gpt_photo 사진, gpt_char 승인 캐릭터, gpt_char_photo 승인 캐릭터 다음 사진).
장면 결과물을 참조로 받는 인자는 없다. 그림 프롬프트에는 이름을 넣지 않는다.
"""
import asyncio
import hashlib
import json
import os
import re
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps

from app.core.config import BACKEND_DIR, settings
from app.gen import codex_runner, store

PROTOCOL = json.loads((BACKEND_DIR / "app" / "lab" / "protocol.json").read_text(encoding="utf-8"))
TEMPLATES = PROTOCOL["templates"]
METHOD_REFERENCES = {arm["method"]: arm["references"] for arm in PROTOCOL["arms"] if arm["method"].startswith("gpt_")}
MAX_REFERENCE_BYTES = 10 * 1024 * 1024
MAX_REFERENCE_SIDE = 2048
MIN_OUTPUT_SIDE = 256
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _prepare_reference(path) -> Path:
    """참조 파일을 확인하고 codex에 넘길 경로를 돌려준다. 크면 작업 폴더에 줄인 사본을 만든다. 문제는 ValueError(사유)."""
    if path is None or not Path(path).is_file():
        raise ValueError("reference missing")
    path = Path(os.path.abspath(path))
    try:
        with Image.open(path) as img:
            side = max(img.size)
    except OSError:
        raise ValueError("reference is not an image") from None
    if side <= MAX_REFERENCE_SIDE and path.stat().st_size <= MAX_REFERENCE_BYTES:
        return path
    copy = settings.DATA_DIR / "lab" / "jobs" / "refs" / f"{hashlib.sha256(path.read_bytes()).hexdigest()[:16]}.jpg"
    if not copy.is_file():
        copy.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(path) as img:
            img = ImageOps.exif_transpose(img).convert("RGB")
            img.thumbnail((MAX_REFERENCE_SIDE, MAX_REFERENCE_SIDE))
            # ponytail: 2048px JPEG q90은 10MB를 넘지 않는다고 본다. 넘는 사진이 나오면 품질을 낮추며 다시 저장한다
            img.save(copy, "JPEG", quality=90)
    return copy


def _error(method: str, reason: str, started: float) -> dict:
    """codex를 부르지 않고 끝나는 오류. 기록만 하고 캐시하지 않는다."""
    result = {
        "status": "error", "kind": "image", "method": method, "image_path": None, "text": {}, "thread_id": None,
        "seed": None, "latency_ms": int((time.monotonic() - started) * 1000), "attempts": 0, "reason": reason,
        "limit": {"used_percent_before": None, "used_percent_after": None, "resets_at": None},
        "prompt_sha256": "", "reference_sha256": [], "request_key": "", "cached": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    store.record(result)
    return result


def _collect(result: dict, out_path) -> dict:
    """생성된 PNG를 out_path로 옮기고(복사가 아니다) 그 스레드 폴더를 비운다. PNG가 아니거나 256px 미만이면 no_image."""
    if result["status"] not in ("ok", "modified") or not result.get("image_path"):
        return {**result, "image_path": None}
    source, out_path = Path(result["image_path"]), Path(out_path)
    try:
        with source.open("rb") as f:
            valid = f.read(8) == PNG_SIGNATURE
        if valid:
            with Image.open(source) as img:
                valid = min(img.size) >= MIN_OUTPUT_SIDE
    except OSError:
        valid = False
    if valid:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(source, out_path)
        result = {**result, "image_path": str(out_path)}
    else:
        source.unlink(missing_ok=True)
        result = {**result, "status": "no_image", "image_path": None,
                  "reason": f"generated file is not a PNG of at least {MIN_OUTPUT_SIDE}px"}
    thread_dir = settings.CODEX_HOME_DIR / "generated_images" / str(result.get("thread_id"))
    if source.parent == thread_dir:
        for leftover in thread_dir.glob("*.png"):
            leftover.unlink()
        try:
            thread_dir.rmdir()
        except OSError:
            pass
    return result


async def _generate(method: str, template: str, fields: dict, references: list, out_path, fresh=False) -> dict:
    """references는 (역할 키, 경로) 목록이고 이 순서대로 -i와 프롬프트의 참조 줄이 된다. 저장소(캐시, 재생, 기록)를 거친다."""
    started = time.monotonic()
    try:
        paths = [await asyncio.to_thread(_prepare_reference, path) for _, path in references]
    except ValueError as e:
        return _error(method, str(e), started)
    lines = [f"{path} - {TEMPLATES['reference_roles'][role]}" for (role, _), path in zip(references, paths)]
    fields = {**fields, "reference_lines": "\n".join(lines), "photo_path": str(paths[0])}
    # 한 번에 치환한다: 넣은 글(모델이 쓴 장면 글, 특징 문장)에 자리 표시가 있어도 다시 보지 않는다
    prompt = re.sub(r"\{(\w+)\}", lambda m: fields.get(m.group(1), m.group(0)), template)

    async def generate() -> dict:
        result = await codex_runner.run_image(prompt, paths)
        return await asyncio.to_thread(_collect, {**result, "method": method}, out_path)

    key = store.request_key(method, prompt, paths, None)
    return await store.get_or_generate(key, generate, kind="image", method=method, fresh=fresh, out_path=out_path)


async def gen_base_character(photo_path, out_path, *, fresh=False) -> dict:
    return await _generate("gpt_photo", TEMPLATES["base_character"], {}, [("photo", photo_path)], out_path, fresh)


async def gen_scene(scene, char_look, method, photo_path, character_path, outfit_rule, out_path, *,
                    fresh=False) -> dict:
    """outfit_rule은 protocol.json outfit_rules의 키나 문장이다. 비우면 참조에 승인 캐릭터가 있는지로 정한다."""
    roles = METHOD_REFERENCES.get(method)
    if roles is None:
        return _error(str(method), f"unsupported method: {method}", time.monotonic())
    rules = TEMPLATES["outfit_rules"]
    if not outfit_rule:
        outfit_rule = "with_character" if "character" in roles else "photo_only"
    sources = {"character": character_path, "photo": photo_path}
    fields = {"scene": scene, "char_look": char_look, "outfit_rule": rules.get(outfit_rule, outfit_rule)}
    references = [(role, sources[role]) for role in roles]
    return await _generate(method, TEMPLATES["scene"], fields, references, out_path, fresh)
