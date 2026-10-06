"""공용 픽스처. 이후 할 일은 이 파일을 고치지 않고 자기 테스트 파일만 추가한다.

테스트는 backend-fastAPI/.env를 읽지 않는다: app을 import하기 전에 ENV_FILE을 비운다.
"""
import os

os.environ["ENV_FILE"] = ""

from pathlib import Path  # noqa: E402
from types import SimpleNamespace  # noqa: E402

import pytest  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from app.core import config  # noqa: E402
from app.gen import fake  # noqa: E402

FAKE_CODEX = Path(__file__).parent / "fixtures" / "fake_codex.py"


@pytest.fixture
def fake_env(tmp_path):
    """임시 DATA_DIR, 임시 FAKE_CODEX_HOME, 합성 사진을 주고 C-8의 모든 변수를 정한다.

    기본은 GEN_FAKE=0에 CODEX_BIN이 스텁(fake_codex.py)이다. 실제 codex는 어떤 경우에도 불리지 않는다.
    값을 바꾸려면 fake_env.set(GEN_FAKE="1", FAKE_CODEX_MODE="declined")처럼 쓴다(설정도 다시 읽는다).
    """
    data_dir = tmp_path / "data"
    codex_home = tmp_path / "codex-home"
    photo = data_dir / "photos" / "synthetic.jpg"
    photo.parent.mkdir(parents=True)
    codex_home.mkdir()

    img = Image.new("RGB", (600, 800), (236, 214, 190))
    draw = ImageDraw.Draw(img)
    draw.ellipse((150, 150, 450, 550), fill=(250, 224, 200), outline=(90, 60, 40), width=6)
    draw.ellipse((230, 300, 260, 330), fill=(40, 30, 30))
    draw.ellipse((340, 300, 370, 330), fill=(40, 30, 30))
    draw.arc((250, 380, 350, 460), 0, 180, fill=(160, 60, 60), width=6)
    img.save(photo, "JPEG")

    with pytest.MonkeyPatch.context() as mp:

        def set_env(**values):
            for name, value in values.items():
                mp.setenv(name, str(value))
            config.reload()
            return config.settings

        set_env(
            ENV_FILE="",
            DATA_DIR=data_dir,
            FILE_BASE_URL="http://localhost:8000/files",
            CODEX_BIN=FAKE_CODEX,
            CODEX_HOME_DIR=codex_home,
            CODEX_MODEL="",
            CODEX_IGNORE_USER_CONFIG="0",
            CODEX_USE_OUTPUT_SCHEMA="1",
            COMFY_URL="http://127.0.0.1:9",
            GEN_METHOD="gpt_char",
            GEN_FAKE="0",
            GEN_FAKE_ERROR="none",
            GEN_FAKE_DELAY_MS="0",
            DEMO_REPLAY="0",
            TEXT_TIMEOUT_S="120",
            IMAGE_TIMEOUT_S="300",
            LAB_CAP_POINTS="40",
            DEMO_CAP_POINTS="10",
            GEN_CONCURRENCY="3",
            GEN_PREFETCH="0",  # 미리 생성은 켜는 테스트에서만 켠다(요청마다 생성 횟수를 센다)
            FAKE_CODEX_HOME=codex_home,
            FAKE_CODEX_MODE="ok",
        )
        fake.set_fake_error("none", 0)
        yield SimpleNamespace(
            data_dir=data_dir,
            codex_home=codex_home,
            photo=photo,
            fake_codex=FAKE_CODEX,
            settings=config.settings,
            set=set_env,
        )
        fake.set_fake_error("none", 0)
    config.reload()
