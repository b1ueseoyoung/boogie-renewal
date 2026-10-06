"""검토 API와 블라인드 과제(C-3, C-7).

과제 ID는 sha256(blind_secret + 키)의 앞 12자리다. 비교군, 회차, 파일 경로는 build_tasks()의 반환값에만 있고
HTTP 응답에는 과제 ID, 유형, /lab/api/image/{taskId}/{n} 주소, 장면 설명만 나간다.
"""
import hashlib
import json
import os
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.core.config import settings

router = APIRouter()

STATIC_DIR = Path(__file__).parent / "static"
PROTOCOL = json.loads((Path(__file__).parent / "protocol.json").read_text(encoding="utf-8"))
CAPTIONS = {c["id"]: c["caption_ko"] for c in PROTOCOL["conditions"]}
BASE_ARM = "BASE"
BASE_CAPTION = "기준 캐릭터"
Tag = Literal[
    "different_person", "age_drift", "hair_drift", "outfit_drift", "style_break", "artifact", "wrong_scene", "other"
]
REVIEWER = {"min_length": 1, "max_length": 100, "pattern": r"\S"}


def _lab_dir(data_dir=None) -> Path:
    return Path(data_dir or settings.DATA_DIR) / "lab"


def _secret(lab: Path) -> bytes:
    path = lab / "blind_secret"
    if not path.is_file():
        lab.mkdir(parents=True, exist_ok=True)
        # 같은 폴더의 임시 파일에 32바이트를 다 쓴 뒤 link로 공개한다: 다른 요청은 파일이 없거나 32바이트 전부를 본다.
        # link는 경로가 이미 있으면 실패하므로 먼저 공개된 값이 남는다(덮어쓰지 않아 과제 ID가 재시작 뒤에도 같다).
        tmp = path.with_name(f"{path.name}.{os.urandom(8).hex()}.tmp")
        try:
            with open(tmp, "xb") as f:
                f.write(os.urandom(32))
            os.link(tmp, path)
        except FileExistsError:
            pass
        finally:
            tmp.unlink(missing_ok=True)
    return path.read_bytes()


def _manifest_lines(lab: Path) -> list[dict]:
    path = lab / "manifest.jsonl"
    if not path.is_file():
        return []
    lines = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        try:
            line = json.loads(raw)
        except ValueError:
            continue  # 실행기가 쓰는 도중의 줄
        if isinstance(line, dict):
            lines.append(line)
    return lines


def build_tasks(data_dir=None) -> list[dict]:
    """매니페스트의 성공한 그림으로 과제 목록을 만든다(매니페스트 순서, 섞지 않음).

    각 항목: taskId, type, key, photo_id, arm, condition, round, photo_path, image_paths, captions.
    기준 캐릭터 과제는 arm이 "BASE"인 resemblance다. 이 반환값은 서버 안에서만 쓴다(블라인드).
    """
    # ponytail: 요청마다 매니페스트 전체를 다시 읽는다(수십~수백 줄). 느려지면 mtime 캐시를 둔다.
    lab = _lab_dir(data_dir)
    secret = _secret(lab)
    pictures: dict[tuple, dict] = {}
    for line in _manifest_lines(lab):
        if line.get("status") in ("ok", "modified") and line.get("image_path") and line.get("photo_path"):
            arm = str(line.get("arm"))
            cell = (str(line.get("photo_id")), arm) if arm == BASE_ARM else (
                str(line.get("photo_id")), arm, str(line.get("condition")), line.get("round"))
            pictures[cell] = line  # 같은 키가 다시 나오면 마지막 줄

    def task(type_, key, photo_id, arm, condition, round_, lines, captions):
        return {
            "taskId": hashlib.sha256(secret + key.encode("utf-8")).hexdigest()[:12],
            "type": type_, "key": key, "photo_id": photo_id, "arm": arm, "condition": condition, "round": round_,
            "photo_path": lines[0]["photo_path"],
            "image_paths": [x["image_path"] for x in lines],
            "captions": captions,
        }

    tasks = []
    groups: dict[tuple, dict] = {}
    for cell, line in pictures.items():
        if cell[1] == BASE_ARM:
            tasks.append(task("resemblance", f"resemblance|{cell[0]}|{BASE_ARM}", cell[0], BASE_ARM, None, None,
                              [line], [BASE_CAPTION]))
            continue
        photo_id, arm, condition, round_ = cell
        tasks.append(task("resemblance", f"resemblance|{photo_id}|{arm}|{condition}|{round_}", photo_id, arm,
                          condition, round_, [line], [CAPTIONS.get(condition, "")]))
        groups.setdefault((photo_id, arm, round_), {})[condition] = line
    for (photo_id, arm, round_), by_condition in groups.items():
        if all(c in by_condition for c in CAPTIONS):
            tasks.append(task("consistency", f"consistency|{photo_id}|{arm}|{round_}", photo_id, arm, None, round_,
                              [by_condition[c] for c in CAPTIONS], list(CAPTIONS.values())))
    return tasks


def _reviews(lab: Path) -> list[dict]:
    path = lab / "reviews.jsonl"
    if not path.is_file():
        return []
    records = []
    for raw in path.read_text(encoding="utf-8").split("\n"):
        try:
            record = json.loads(raw)
        except ValueError:
            continue
        if isinstance(record, dict):
            records.append(record)
    return records


def _file(path: Path, **kwargs) -> FileResponse:
    if not path.is_file():
        raise HTTPException(status_code=404)
    return FileResponse(path, **kwargs)


@router.get("/lab/review")
def review_page():
    return _file(STATIC_DIR / "review.html")


@router.get("/lab/static/{name}")
def review_static(name: str):
    if Path(name).name != name:
        raise HTTPException(status_code=404)
    return _file(STATIC_DIR / name)


@router.get("/lab/report")
def report_page():
    return _file(_lab_dir() / "report" / "index.html")


@router.get("/lab/api/tasks")
def list_tasks(reviewer: str = Query(**REVIEWER)):
    tasks = build_tasks()
    random.Random(reviewer).shuffle(tasks)
    return [
        {
            "taskId": t["taskId"],
            "type": t["type"],
            "photoUrl": f"/lab/api/image/{t['taskId']}/0" if t["type"] == "resemblance" else None,
            "imageUrls": [f"/lab/api/image/{t['taskId']}/{n}" for n in range(1, len(t["image_paths"]) + 1)],
            "captions": t["captions"],
        }
        for t in tasks
    ]


@router.get("/lab/api/progress")
def progress(reviewer: str = Query(**REVIEWER)):
    ids = {t["taskId"] for t in build_tasks()}
    done = {r.get("taskId") for r in _reviews(_lab_dir()) if r.get("reviewer") == reviewer}
    return {"done": len(ids & done), "total": len(ids)}


@router.get("/lab/api/image/{task_id}/{n}")
def task_image(task_id: str, n: int):
    task = next((t for t in build_tasks() if t["taskId"] == task_id), None)
    if task is None or not 0 <= n <= len(task["image_paths"]):
        raise HTTPException(status_code=404)
    if n == 0:
        return _file(Path(task["photo_path"]))
    return _file(Path(task["image_paths"][n - 1]), media_type="image/png")


class ReviewIn(BaseModel):
    reviewer: str = Field(**REVIEWER)
    taskId: str
    score: int = Field(ge=1, le=5)
    usable: bool | None = None
    tags: list[Tag] = []


@router.post("/lab/api/reviews")
def add_review(body: ReviewIn):
    task = next((t for t in build_tasks() if t["taskId"] == body.taskId), None)
    if task is None:
        raise HTTPException(status_code=404)
    record = {
        "reviewer": body.reviewer,
        "taskId": task["taskId"],
        "key": task["key"],
        "type": task["type"],
        "score": body.score,
        "usable": body.usable,
        "tags": body.tags,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    # ensure_ascii 기본값: 줄바꿈과 U+2028까지 이스케이프되어 기록 하나가 정확히 한 줄이 된다
    with open(_lab_dir() / "reviews.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")
    return {"ok": True}
