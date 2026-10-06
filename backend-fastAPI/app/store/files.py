"""할 일 11: 로컬 파일 저장소. C-3 /files 계열이 이 모듈을 쓴다."""
import io
import uuid
from pathlib import Path

from PIL import Image, ImageOps

from app.core.config import settings

ALLOWED_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_SIDE = 2048


class UploadTooLarge(ValueError):
    pass


class UploadNotAnImage(ValueError):
    pass


def _uploads_dir() -> Path:
    directory = settings.DATA_DIR / "files" / "uploads"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def save_upload(data: bytes) -> str:
    if len(data) > MAX_UPLOAD_BYTES:
        raise UploadTooLarge()

    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception as exc:
        raise UploadNotAnImage() from exc

    fmt = image.format
    if fmt not in ALLOWED_FORMATS:
        raise UploadNotAnImage()

    image = ImageOps.exif_transpose(image)
    if image is None:
        raise UploadNotAnImage()
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")

    long_side = max(image.size)
    if long_side > MAX_SIDE:
        scale = MAX_SIDE / long_side
        new_size = (round(image.width * scale), round(image.height * scale))
        image = image.resize(new_size, Image.LANCZOS)

    ext = ALLOWED_FORMATS[fmt]
    name = f"{uuid.uuid4()}{ext}"
    target = _uploads_dir() / name
    image.save(target, fmt)

    return url_for(f"uploads/{name}")


def url_for(path: str) -> str:
    base = settings.FILE_BASE_URL.rstrip("/")
    return f"{base}/{path}"


def path_for(url: str) -> Path:
    base = settings.FILE_BASE_URL.rstrip("/")
    if not url.startswith(base + "/"):
        raise ValueError("url must start with FILE_BASE_URL")

    relative = url[len(base) + 1 :]
    files_root = (settings.DATA_DIR / "files").resolve()
    candidate = (files_root / relative).resolve()

    if candidate != files_root and files_root not in candidate.parents:
        raise ValueError("url resolves outside data/files")

    return candidate
