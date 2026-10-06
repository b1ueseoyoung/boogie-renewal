import os
import subprocess
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core import config
from app.core.config import Settings, load_settings

BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_defaults_match_c8():
    s = load_settings({"ENV_FILE": ""})
    assert s.DATA_DIR == (BACKEND_DIR.parent / "data").resolve()
    assert s.FILE_BASE_URL == "http://localhost:8000/files"
    assert s.CODEX_BIN == "codex"
    assert s.CODEX_HOME_DIR == (Path.home() / ".codex").resolve()
    assert s.CODEX_MODEL == ""
    assert s.CODEX_IGNORE_USER_CONFIG is False
    assert s.CODEX_USE_OUTPUT_SCHEMA is True
    assert s.COMFY_URL == "http://127.0.0.1:8188"
    assert s.GEN_METHOD == "gpt_char"
    assert s.GEN_FAKE is False
    assert s.GEN_FAKE_ERROR == "none"
    assert s.GEN_FAKE_DELAY_MS == 0
    assert s.DEMO_REPLAY == "0"
    assert s.TEXT_TIMEOUT_S == 120
    assert s.IMAGE_TIMEOUT_S == 300
    assert s.LAB_CAP_POINTS == 40
    assert s.DEMO_CAP_POINTS == 10


@pytest.mark.parametrize(
    "name,value",
    [
        ("GEN_FAKE_ERROR", "bogus"),
        ("DEMO_REPLAY", "2"),
        ("GEN_METHOD", "x"),
        ("GEN_METHOD", "baseline_as_shipped"),
        ("GEN_FAKE", "2"),
        ("GEN_FAKE_DELAY_MS", "-1"),
        ("GEN_FAKE_DELAY_MS", "soon"),
        ("TEXT_TIMEOUT_S", "abc"),
        ("IMAGE_TIMEOUT_S", "0"),
        ("CODEX_USE_OUTPUT_SCHEMA", "maybe"),
    ],
)
def test_invalid_value_rejected(name, value):
    with pytest.raises(ValidationError) as err:
        load_settings({"ENV_FILE": "", name: value})
    assert name in str(err.value)


@pytest.mark.parametrize(
    "name,value",
    [
        ("GEN_METHOD", "gpt_char_photo"),
        ("GEN_METHOD", "gpt_photo"),
        ("GEN_METHOD", "baseline_repaired"),
        ("DEMO_REPLAY", "prefer"),
        ("DEMO_REPLAY", "1"),
        ("GEN_FAKE_ERROR", "declined"),
        ("GEN_FAKE_ERROR", "limit"),
        ("GEN_FAKE_ERROR", "timeout"),
        ("GEN_FAKE_ERROR", "no_image"),
    ],
)
def test_valid_value_accepted(name, value):
    assert getattr(load_settings({"ENV_FILE": "", name: value}), name) == value


def test_codex_bin_existence_is_not_checked():
    s = load_settings({"ENV_FILE": "", "CODEX_BIN": "/nonexistent/codex", "GEN_FAKE": "1"})
    assert s.CODEX_BIN == "/nonexistent/codex"
    assert s.GEN_FAKE is True


def test_env_file_is_read_and_real_env_wins(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text('# 주석\nCODEX_MODEL="gpt-6-luna"\nGEN_METHOD=gpt_photo\n\nCODEX_USE_OUTPUT_SCHEMA=0\n')
    s = load_settings({"ENV_FILE": str(env_file), "GEN_METHOD": "gpt_char_photo"})
    assert s.CODEX_MODEL == "gpt-6-luna"
    assert s.CODEX_USE_OUTPUT_SCHEMA is False
    assert s.GEN_METHOD == "gpt_char_photo"


def test_empty_env_file_setting_reads_no_file(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("GEN_FAKE_ERROR=limit\n")
    assert load_settings({"ENV_FILE": str(env_file)}).GEN_FAKE_ERROR == "limit"
    assert load_settings({"ENV_FILE": ""}).GEN_FAKE_ERROR == "none"


def test_tests_never_read_backend_dotenv(fake_env):
    assert os.environ["ENV_FILE"] == ""
    assert config.settings.GEN_FAKE_ERROR == "none"


def test_fake_env_sets_every_c8_variable(fake_env):
    missing = [name for name in Settings.model_fields if name not in os.environ]
    assert missing == []
    assert fake_env.settings is config.settings
    assert config.settings.DATA_DIR == fake_env.data_dir.resolve()
    assert config.settings.CODEX_HOME_DIR == fake_env.codex_home.resolve()
    assert fake_env.photo.is_file()


def test_fake_env_set_reloads_the_shared_settings_object(fake_env):
    before = config.settings
    fake_env.set(GEN_FAKE="1", GEN_METHOD="gpt_photo")
    assert config.settings is before
    assert before.GEN_FAKE is True
    assert before.GEN_METHOD == "gpt_photo"


def test_import_fails_on_invalid_value():
    env = {**os.environ, "ENV_FILE": "", "GEN_FAKE_ERROR": "bogus"}
    proc = subprocess.run(
        [sys.executable, "-c", "from app.core.config import settings"],
        cwd=BACKEND_DIR, env=env, capture_output=True, text=True, timeout=60,
    )
    assert proc.returncode != 0
    assert "validation error" in proc.stderr
    assert "GEN_FAKE_ERROR" in proc.stderr
