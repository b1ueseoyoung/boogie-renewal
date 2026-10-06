from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.api import generate
from app.core.config import settings
from app.lab import review
from app.store import files as files_store

@asynccontextmanager
async def lifespan(app: FastAPI):
    generate.init_limit_guard()  # C-8: 한도 보호는 서버가 시작할 때의 used_percent부터 센다
    yield


app = FastAPI(title="꿈도깨비 생성 서버", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3100"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "ok": True,
        "mode": "fake" if settings.GEN_FAKE else "real",
        "method": settings.GEN_METHOD,
        "replay": settings.DEMO_REPLAY,
    }


@app.post("/files/upload")
async def upload_file(file: UploadFile):
    data = await file.read()
    try:
        url = files_store.save_upload(data)
    except files_store.UploadTooLarge:
        return JSONResponse(
            status_code=413,
            content={
                "errorClass": "error",
                "message": "사진이 너무 커요. 10MB 이하로 올려 주세요.",
                "retryable": True,
                "resetsAt": None,
            },
        )
    except files_store.UploadNotAnImage:
        return JSONResponse(
            status_code=415,
            content={
                "errorClass": "error",
                "message": "이미지 파일만 올릴 수 있어요.",
                "retryable": True,
                "resetsAt": None,
            },
        )
    return {"url": url}


@app.get("/files/{path:path}")
def serve_file(path: str):
    try:
        target = files_store.path_for(files_store.url_for(path))
    except ValueError:
        return JSONResponse(status_code=404, content={"detail": "not found"})
    if not target.is_file():
        return JSONResponse(status_code=404, content={"detail": "not found"})
    return FileResponse(target)


app.include_router(generate.router)
app.include_router(review.router)
