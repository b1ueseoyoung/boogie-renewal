"""할 일 11: 로컬 파일 서버와 업로드. C-2, C-3, C-8 참조."""
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.store import files as files_store


def _png_bytes(size=(100, 120), color=(10, 20, 30)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    buf.seek(0)
    return buf.read()


def _jpeg_with_exif(size=(3000, 4000), color=(200, 50, 50)):
    buf = io.BytesIO()
    img = Image.new("RGB", size, color)
    exif = img.getexif()
    exif[0x0132] = "2026:01:01 00:00:00"  # DateTime 태그
    img.save(buf, "JPEG", exif=exif)
    buf.seek(0)
    return buf.read()


def test_upload_png_returns_200_and_url(fake_env):
    client = TestClient(app)
    r = client.post("/files/upload", files={"file": ("photo.png", _png_bytes(), "image/png")})
    assert r.status_code == 200
    url = r.json()["url"]
    assert url.startswith(fake_env.settings.FILE_BASE_URL)
    get = client.get(url.replace(fake_env.settings.FILE_BASE_URL, "/files"))
    assert get.status_code == 200


def test_uploaded_file_name_does_not_leak_client_filename(fake_env):
    client = TestClient(app)
    r = client.post(
        "/files/upload", files={"file": ("../../secret name with spaces.png", _png_bytes(), "image/png")}
    )
    assert r.status_code == 200
    url = r.json()["url"]
    assert "secret" not in url
    assert ".." not in url
    filename = url.rsplit("/", 1)[-1]
    assert filename.endswith(".png")
    # uuid.ext 형태: uuid 부분은 하이픈 포함 36자
    assert len(filename) == 36 + len(".png")


def test_path_for_rejects_non_base_url(fake_env):
    with pytest.raises(ValueError):
        files_store.path_for("http://evil.example.com/files/uploads/x.png")


def test_path_for_rejects_traversal_outside_data_files(fake_env):
    with pytest.raises(ValueError):
        files_store.path_for(fake_env.settings.FILE_BASE_URL + "/../../etc/passwd")
    with pytest.raises(ValueError):
        files_store.path_for(fake_env.settings.FILE_BASE_URL + "/uploads/../../../etc/passwd")


def test_upload_over_10mb_returns_413(fake_env):
    client = TestClient(app)
    big = _png_bytes(size=(10, 10))
    # 10MB 초과 바이트 생성 (유효한 PNG 디코딩 여부와 무관하게 크기 기준으로 먼저 걸려야 한다)
    payload = big + b"\x00" * (10 * 1024 * 1024 + 1)
    r = client.post("/files/upload", files={"file": ("big.png", payload, "image/png")})
    assert r.status_code == 413
    body = r.json()
    assert body["errorClass"] == "error"
    assert body["message"] == "사진이 너무 커요. 10MB 이하로 올려 주세요."
    assert body["retryable"] is True


def test_upload_text_file_returns_415(fake_env):
    client = TestClient(app)
    r = client.post("/files/upload", files={"file": ("x.png", b"hello", "image/png")})
    assert r.status_code == 415
    body = r.json()
    assert body["errorClass"] == "error"
    assert body["message"] == "이미지 파일만 올릴 수 있어요."
    assert body["retryable"] is True


def test_upload_truncated_jpeg_returns_415(fake_env):
    client = TestClient(app)
    full = _jpeg_with_exif()
    truncated = full[: len(full) // 2]
    r = client.post("/files/upload", files={"file": ("broken.jpg", truncated, "image/jpeg")})
    assert r.status_code == 415


def test_upload_strips_exif_and_resizes_long_side_to_2048(fake_env):
    client = TestClient(app)
    r = client.post("/files/upload", files={"file": ("photo.jpg", _jpeg_with_exif(), "image/jpeg")})
    assert r.status_code == 200
    url = r.json()["url"]
    get = client.get(url.replace(fake_env.settings.FILE_BASE_URL, "/files"))
    assert get.status_code == 200
    saved = Image.open(io.BytesIO(get.content))
    assert max(saved.size) == 2048
    assert saved.getexif() == {} or len(saved.getexif()) == 0


def test_cors_allows_only_3100(fake_env):
    client = TestClient(app)
    allowed = client.options(
        "/files/upload",
        headers={
            "Origin": "http://localhost:3100",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:3100"

    blocked = client.options(
        "/files/upload",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert blocked.headers.get("access-control-allow-origin") is None


def test_directory_listing_is_not_served(fake_env):
    client = TestClient(app)
    client.post("/files/upload", files={"file": ("photo.png", _png_bytes(), "image/png")})
    r = client.get("/files/uploads/")
    assert r.status_code in (404, 403)
