"""할 일 23: 검토 화면 정적 파일(review.html, review.css, review.js)이 제공되고 블라인드 규칙을 지킨다."""
import re
from pathlib import Path

from fastapi.testclient import TestClient

from app.lab import review
from app.main import app
from test_review_api import LEAKS

STATIC_FILES = ["review.html", "review.css", "review.js"]
PRETENDARD = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"


def test_review_page_and_assets_are_served(fake_env):
    client = TestClient(app)
    page = client.get("/lab/review")
    assert page.status_code == 200 and page.headers["content-type"].startswith("text/html")
    assert client.get("/lab/static/review.css").headers["content-type"].startswith("text/css")
    assert client.get("/lab/static/review.js").status_code == 200
    assert 'href="/lab/static/review.css"' in page.text
    assert re.findall(r'<script[^>]*\ssrc="([^"]+)"', page.text) == ["/lab/static/review.js"]
    urls = re.findall(r'(?:src|href)="([^"]+)"', page.text)
    assert [u for u in urls if u.startswith(("http:", "https:", "//"))] == [PRETENDARD]


def test_static_files_do_not_leak_arm_round_or_paths():
    for name in STATIC_FILES:
        text = (Path(review.__file__).parent / "static" / name).read_text(encoding="utf-8")
        for word in LEAKS:
            assert word not in text, f"{word!r} in {name}"
