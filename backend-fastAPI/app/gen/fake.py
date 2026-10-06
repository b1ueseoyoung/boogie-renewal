"""러너 층의 대역(GEN_FAKE=1). 어댑터는 그대로 돌고, 러너가 codex 대신 이 함수들을 부른다.

두 함수 모두 동기 함수이고 C-1 형식의 dict를 돌려준다. 대역이 돌려준 오류 상태는 그 생성의 최종 상태다:
호출자는 자동 재시도를 적용하지 않는다(attempts는 항상 1).
"""
import hashlib
import itertools
import json
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageColor, ImageDraw, ImageFont

from app.core.config import settings

FAKE_ERRORS = ("declined", "limit", "timeout", "no_image")
FAKE_RESETS_AT = 1791255029

FAKE_TEXTS = {
    "intro": {
        "intro": "어느 맑은 아침, 주인공은 반짝이는 숲길 앞에 섰어요. 나뭇잎 사이로 작은 도깨비불이 깜빡이며 손짓했지요.",
        "question": "주인공은 어디로 가 볼까요?",
        "options": ["도깨비불을 따라 숲속으로 들어간다", "시냇물 소리가 나는 쪽으로 간다", "커다란 나무 위로 올라가 본다"],
        "illustration": "a sunny forest path in the morning, small glowing lights between the leaves, standing at the entrance and looking ahead with curiosity",
    },
    "content": {
        "story": "주인공이 조심조심 걸어가자 작은 도깨비가 폴짝 나타났어요. 도깨비는 웃으며 반짝이는 열쇠를 내밀었지요.",
        "question": "주인공은 열쇠로 무엇을 할까요?",
        "options": ["오래된 나무 문을 열어 본다", "도깨비에게 열쇠를 돌려준다", "열쇠를 주머니에 넣고 길을 계속 간다"],
        "illustration": "a small friendly goblin holding out a shining key in a forest clearing, reaching out a hand toward the key with a surprised smile",
    },
    "ending": {
        "story": "문이 열리자 따뜻한 빛이 쏟아졌어요. 주인공과 도깨비는 손을 잡고 환하게 웃었고, 숲은 다시 조용하고 포근해졌답니다.",
        "illustration": "an open wooden door glowing with warm light in the forest, holding hands with a small goblin and smiling brightly",
    },
    "refine": {
        "paragraphs": [
            "어느 맑은 아침, 주인공은 반짝이는 숲길 앞에 섰어요.",
            "도깨비불을 따라가자 작은 도깨비가 폴짝 나타났어요.",
            "도깨비는 웃으며 반짝이는 열쇠를 내밀었지요.",
            "주인공은 열쇠를 들고 오래된 나무 문 앞으로 갔어요.",
            "열쇠를 돌리자 문이 천천히 열리기 시작했어요.",
            "따뜻한 빛 속에서 주인공과 도깨비는 환하게 웃었답니다.",
        ],
        "title": "숲속 열쇠",
        "summary": "주인공이 도깨비와 함께 숲속의 문을 여는 이야기예요.",
    },
    "feature_card": {
        "charLook": "A young person with short black hair, round dark eyes and a soft smile. Wearing a plain sky-blue T-shirt.",
    },
}

_lock = threading.Lock()
_serial = itertools.count(1)
_forced = {"error": "none", "times": 0}


def set_fake_error(error: str, times: int) -> None:
    """다음 times번의 생성(글과 그림 합산)을 error 상태로 끝낸다. error가 none이면 해제한다."""
    if error not in ("none", *FAKE_ERRORS) or times < 0:
        raise ValueError(f"invalid fake error: {error!r} x {times!r}")
    with _lock:
        _forced.update(error=error, times=0 if error == "none" else times)


def _begin(kind: str, prompt: str, images, schema_name) -> tuple[int, str, list[str]]:
    images = [str(image) for image in images or []]
    with _lock:
        serial = next(_serial)
        if _forced["times"] > 0:
            _forced["times"] -= 1
            status = _forced["error"]
        else:
            status = settings.GEN_FAKE_ERROR
        status = "ok" if status == "none" else status
        log = settings.DATA_DIR / "lab" / "fake-calls.jsonl"
        log.parent.mkdir(parents=True, exist_ok=True)
        with log.open("a", encoding="utf-8") as f:
            call = {"serial": serial, "kind": kind, "prompt": prompt, "images": images,
                    "schema_name": schema_name, "status": status, "at": _now()}
            f.write(json.dumps(call, ensure_ascii=False) + "\n")
    if settings.GEN_FAKE_DELAY_MS:
        time.sleep(settings.GEN_FAKE_DELAY_MS / 1000)
    return serial, status, images


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _result(kind, status, serial, prompt, images, started, *, text=None, image_path=None, reason=None) -> dict:
    limited = status == "limit"
    return {
        "status": status,
        "kind": kind,
        "method": "fake",
        "image_path": image_path,
        "text": text or {},
        "thread_id": f"fake-{serial}-{uuid.uuid4().hex[:8]}",
        "seed": None,
        "latency_ms": int((time.monotonic() - started) * 1000),
        "attempts": 1,
        "reason": reason if reason is not None else ("" if status == "ok" else f"fake {status}"),
        "limit": {
            "used_percent_before": None,
            "used_percent_after": 100.0 if limited else None,
            "resets_at": FAKE_RESETS_AT if limited else None,
        },
        "prompt_sha256": hashlib.sha256(prompt.encode()).hexdigest(),
        "reference_sha256": [hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in images if Path(p).is_file()],
        "request_key": "",
        "cached": False,
        "created_at": _now(),
    }


def fake_run_text(prompt: str, images, schema_name: str) -> dict:
    """스키마 이름(intro, content, ending, refine, feature_card. 파일 경로도 된다)에 맞는 정해진 JSON을 돌려준다."""
    started = time.monotonic()
    serial, status, images = _begin("text", prompt, images, schema_name)
    if status != "ok":
        return _result("text", status, serial, prompt, images, started)
    text = FAKE_TEXTS.get(Path(str(schema_name)).stem)
    if text is None:
        return _result("text", "error", serial, prompt, images, started, reason=f"unknown schema: {schema_name}")
    return _result("text", "ok", serial, prompt, images, started, text=json.loads(json.dumps(text)))


def fake_run_image(prompt: str, images) -> dict:
    """768x1024 PNG를 DATA_DIR/lab/fake-images/에 만들어 image_path로 돌려준다(호출마다 배경색과 일련번호가 다르다)."""
    started = time.monotonic()
    serial, status, images = _begin("image", prompt, images, None)
    if status != "ok":
        return _result("image", status, serial, prompt, images, started)
    img = Image.new("RGB", (768, 1024), ImageColor.getrgb(f"hsl({serial * 47 % 360}, 60%, 78%)"))
    ImageDraw.Draw(img).text((48, 48), f"FAKE #{serial}", fill=(20, 20, 20), font=ImageFont.load_default(size=72))
    out = settings.DATA_DIR / "lab" / "fake-images" / f"fake-{serial}-{uuid.uuid4().hex[:8]}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG")
    return _result("image", "ok", serial, prompt, images, started, image_path=str(out))
