"""C-3 생성 엔드포인트. 모두 무상태다: 이전 글과 삽화 주소는 요청에 들어온다.

캐시, 재생, 기록은 어댑터(app/gen)가 한다. 실패는 C-2 본문과 상태 코드로 돌려준다.
"""
import asyncio
import json
import uuid
from functools import wraps
from pathlib import Path
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.gen import comfy, fake, image, store, text
from app.store import files

router = APIRouter()

BASELINE_PORTRAIT = "portrait of the character, waist-up, facing the viewer, gentle smile, plain light background"

# C-2: errorClass -> (HTTP, retryable, 화면 문구)
FAILURES = {
    "declined": (422, False, "이 사진으로는 그림을 만들 수 없어요. 다른 사진으로 다시 해 볼까요?"),
    "limit": (503, False, "오늘은 도깨비가 그림을 다 그렸어요. 저장된 동화는 책장에서 볼 수 있어요."),
    "timeout": (504, True, "그림이 늦어지고 있어요. 다시 시도해 볼까요?"),
    "no_image": (504, True, "그림이 늦어지고 있어요. 다시 시도해 볼까요?"),
    "replay_miss": (409, False, "지금은 저장된 동화만 볼 수 있어요."),
    "error": (500, True, "문제가 생겼어요. 다시 시도해 주세요."),
}

# 실제 모드의 한도 보호(이야기 상태가 아니다). 서버가 시작할 때 app/main.py의 lifespan이 init_limit_guard()를
# 불러 그때의 used_percent를 시작값으로 만든다(C-8). 시작할 때 한도 값을 읽을 수 없었으면
# 처음 읽을 수 있는 생성 요청 때 만든다(_check_limit).
_guard = None


def init_limit_guard() -> None:
    global _guard
    _guard = None
    if settings.GEN_FAKE:
        return
    latest = store.latest_limit()
    if latest is not None:
        _guard = store.LimitGuard(latest["used_percent"], settings.DEMO_CAP_POINTS)


class Failure(Exception):
    def __init__(self, error_class: str, resets_at=None, status_code: int | None = None, message: str = ""):
        code, retryable, default = FAILURES[error_class]
        self.response = JSONResponse(status_code=status_code or code, content={
            "errorClass": error_class, "message": message or default,
            "retryable": retryable and status_code is None, "resetsAt": resets_at,
        })


def _path(url: str) -> Path:
    """FILE_BASE_URL 아래의 실제 파일만 받는다. 아니면 400."""
    try:
        path = files.path_for(url)
    except ValueError:
        path = None
    if path is None or not path.is_file():
        raise Failure("error", status_code=400, message="이미지 주소가 올바르지 않아요.")
    return path


def _check_limit() -> None:
    if settings.GEN_FAKE:
        return
    if _guard is None:
        init_limit_guard()
        if _guard is None:
            return
    stop = _guard.check()
    if stop:
        raise Failure("limit", stop["resets_at"])


def _ok(result: dict) -> dict:
    """성공한 결과를 그대로 돌려주고, 아니면 C-2 실패를 던진다."""
    status = result["status"]
    if status in ("ok", "modified"):
        return result
    resets_at = None
    if status == "limit":
        # 실제 codex의 limit 결과에는 resets_at이 없다
        resets_at = result["limit"]["resets_at"] or (store.latest_limit() or {}).get("resets_at")
    raise Failure(status if status in FAILURES else "error", resets_at)


async def _picture(folder: str, make) -> str:
    """make(out_path)로 그림 한 장을 data/files/<folder>/에 만들고 그 주소를 돌려준다.

    캐시 적중이면 결과의 image_path는 처음 저장된 파일이다: 주소도 그 파일의 것이다(재생해도 주소가 같다).
    """
    files_root = settings.DATA_DIR / "files"
    _check_limit()
    result = _ok(await make(files_root / f"{folder}/{uuid.uuid4()}.png"))
    return files.url_for(Path(result["image_path"]).resolve().relative_to(files_root.resolve()).as_posix())


async def _scene(illustration: str, req) -> str:
    """장면 그림. 장면 결과물은 참조로 쓰지 않는다: 참조는 요청의 사진과 승인 캐릭터뿐이다."""
    photo, character = _path(req.imgUrl), _path(req.charImgUrl)
    method = settings.GEN_METHOD
    if method == "baseline_repaired":
        return await _picture("scene", lambda out: comfy.gen_baseline_stored(
            "repaired", f"{illustration} {req.charLook}", photo, out))
    return await _picture("scene", lambda out: image.gen_scene(
        illustration, req.charLook, method, photo, character, "", out))


async def _text(generate, *args) -> dict:
    _check_limit()
    return _ok(await generate(*args))["text"]


async def _content(req, story: list[str], question: str, choice: str, page: int) -> dict:
    """중간 장면 하나(글, 그림). Spring은 page로 지금까지의 장면 수(len(story))를 보낸다. 4면 결말 직전 질문이다."""
    scene = await _text(text.gen_content, story, question, choice, req.charName, page == 4)
    url = await _scene(scene["illustration"], req)
    return {"story": scene["story"], "question": scene["question"], "choices": scene["options"],
            "s3_url": url, "illustPrompt": scene["illustration"]}


async def _ending(req, story: list[str], question: str, choice: str) -> dict:
    ending = await _text(text.gen_ending, story, question, choice, req.charName)
    url = await _scene(ending["illustration"], req)
    return {"story": ending["story"], "s3_url": url, "illustPrompt": ending["illustration"]}


# 미리 생성(원래 꿈도깨비의 비동기 생성): 장면을 돌려준 뒤 선택지마다 Spring이 보낼 다음 요청을 그대로 만들어 둔다.
# 키는 그 요청의 내용이라, 실제 요청이 오면 같은 키의 작업을 기다려 받는다.
# ponytail: 서버 메모리에만 둔다. 다시 켜면 사라지고(그때는 요청 때 만든다), 새 묶음을 띄울 때 이전 묶음을 버린다(사용자 한 명 기준)
_ahead: dict[str, asyncio.Task] = {}
_running: set[asyncio.Task] = set()  # 버린 작업도 끝까지 돈다(이미 한도를 쓴 생성이다). 참조를 잡아 둔다


def _ahead_key(kind: str, req, story: list[str], question: str, choice: str) -> str:
    return json.dumps([kind, req.charName, req.charLook, req.imgUrl, req.charImgUrl, story, question, choice],
                      ensure_ascii=False)


def _finished(task: asyncio.Task) -> None:
    _running.discard(task)
    if not task.cancelled():
        task.exception()  # 아무도 받지 않은 실패도 읽어 둔다(경고 로그 방지). 받을 때 다시 던진다


def _prefetch(req, story: list[str], question: str, options: list[str]) -> None:
    """story가 5장이면 결말을, 아니면 다음 중간 장면을 선택지마다 띄운다."""
    if not settings.GEN_PREFETCH:
        return
    _ahead.clear()
    ending = len(story) == 5
    kind = "ending" if ending else "content"
    for choice in options:
        work = _ending(req, story, question, choice) if ending else _content(req, story, question, choice, len(story))
        task = asyncio.create_task(work)
        _running.add(task)
        task.add_done_callback(_finished)
        _ahead[_ahead_key(kind, req, story, question, choice)] = task


def _take(kind: str, req, story: list[str], question: str, choice: str):
    return _ahead.pop(_ahead_key(kind, req, story, question, choice), None)


class CharacterRequest(BaseModel):
    imgUrl: str


class FeatureCardRequest(BaseModel):
    imgUrl: str
    charImgUrl: str


class SceneRequest(BaseModel):
    charName: str
    charLook: str
    imgUrl: str
    charImgUrl: str


class IntroRequest(SceneRequest):
    genre: str
    place: str


class ContentRequest(SceneRequest):
    question: str = ""
    choice: str
    page: int = Field(ge=1, le=4)
    story: list[str]


class StoryRequest(SceneRequest):
    storyId: str = Field(pattern=r"^[A-Za-z0-9_-]+$")  # 폴더 이름이 된다
    question: str = ""
    choice: str
    story: list[str] = Field(min_length=5, max_length=5)
    illustUrls: list[str] = Field(min_length=5, max_length=5)


class FakeErrorRequest(BaseModel):
    error: Literal["declined", "limit", "timeout", "no_image", "none"]
    times: int = Field(ge=0)


def _failures(endpoint):
    """Failure를 C-2 응답으로 바꾼다(app/main.py에 예외 처리기를 달 수 없어 여기서 감싼다)."""
    @wraps(endpoint)
    async def wrapped(req):
        try:
            return await endpoint(req)
        except Failure as failure:
            return failure.response

    return wrapped


@router.post("/generate/character/")
@_failures
async def generate_character(req: CharacterRequest):
    photo = _path(req.imgUrl)
    if settings.GEN_METHOD == "baseline_repaired":
        url = await _picture("character", lambda out: comfy.gen_baseline_stored(
            "repaired", BASELINE_PORTRAIT, photo, out))
    else:
        url = await _picture("character", lambda out: image.gen_base_character(photo, out))
    return {"s3_url": url}


@router.post("/generate/feature-card/")
@_failures
async def generate_feature_card(req: FeatureCardRequest):
    photo, character = _path(req.imgUrl), _path(req.charImgUrl)
    return {"charLook": (await _text(text.feature_card, photo, character))["charLook"]}


@router.post("/generate/intro/")
@_failures
async def generate_intro(req: IntroRequest):
    _path(req.imgUrl), _path(req.charImgUrl)
    intro = await _text(text.gen_intro, req.charName, req.genre, req.place)
    url = await _scene(intro["illustration"], req)
    _prefetch(req, [intro["intro"]], intro["question"], intro["options"])
    return {"intro": intro["intro"], "question": intro["question"], "options": intro["options"],
            "s3_url": url, "illustPrompt": intro["illustration"]}


@router.post("/generate/content/")
@_failures
async def generate_content(req: ContentRequest):
    _path(req.imgUrl), _path(req.charImgUrl)
    ahead = _take("content", req, req.story, req.question, req.choice) if len(req.story) == req.page else None
    scene = await (ahead or _content(req, req.story, req.question, req.choice, req.page))
    _prefetch(req, [*req.story, scene["story"]], scene["question"], scene["choices"])
    return scene


@router.post("/generate/story/")
@_failures
async def generate_story(req: StoryRequest):
    _path(req.imgUrl), _path(req.charImgUrl)
    for url in req.illustUrls:
        _path(url)
    ahead = _take("ending", req, req.story, req.question, req.choice)
    if ahead:
        ending = await ahead
        refined = await _text(text.refine_story, [*req.story, ending["story"]])
    else:
        text_ending = await _text(text.gen_ending, req.story, req.question, req.choice, req.charName)
        refined = await _text(text.refine_story, [*req.story, text_ending["story"]])
        # 미리 만든 결말이 없으면 그림은 글 작업 두 건이 끝난 뒤 마지막에 만든다: 다듬기가 실패해도 그림 한 장을 버리지 않는다
        ending = {"story": text_ending["story"], "s3_url": await _scene(text_ending["illustration"], req),
                  "illustPrompt": text_ending["illustration"]}
    ending_url = ending["s3_url"]

    # 삽화는 다시 만들지 않는다: 만드는 동안 본 주소를 그대로 쓴다
    pages = [{"story": story, "illustUrl": url}
             for story, url in zip(refined["paragraphs"], [*req.illustUrls, ending_url])]
    name = f"storybook/{req.storyId}/content.json"
    target = settings.DATA_DIR / "files" / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")
    return {"contentUrl": files.url_for(name), "title": refined["title"], "summary": refined["summary"],
            "coverImg": req.illustUrls[0],
            "ending": ending}


@router.post("/debug/fake-error")
async def debug_fake_error(req: FakeErrorRequest):
    if not settings.GEN_FAKE:
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    fake.set_fake_error(req.error, req.times)
    return {"ok": True}
