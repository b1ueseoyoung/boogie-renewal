"""C-8 환경 변수를 읽는 설정 객체. 잘못된 값이면 import 시점에 pydantic 검증 오류로 멈춘다.

값의 우선순위는 실제 환경 변수, 그다음 env 파일이다. env 파일은 ENV_FILE이 가리키고 기본은 backend-fastAPI/.env다.
ENV_FILE을 빈 문자열로 두면 파일을 읽지 않는다(테스트가 이렇게 쓴다). 빈 값은 정하지 않은 것으로 본다.
CODEX_BIN이 실제로 있는지는 검사하지 않는다(대역 모드는 없는 경로로 띄운다).
"""
import os
from collections.abc import Mapping
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent


class Settings(BaseModel):
    model_config = ConfigDict(validate_default=True)

    DATA_DIR: Path = REPO_ROOT / "data"
    FILE_BASE_URL: str = "http://localhost:8000/files"
    CODEX_BIN: str = "codex"
    CODEX_HOME_DIR: Path = Path("~/.codex")
    CODEX_MODEL: str = ""
    CODEX_IGNORE_USER_CONFIG: bool = False
    CODEX_USE_OUTPUT_SCHEMA: bool = True
    COMFY_URL: str = "http://127.0.0.1:8188"
    GEN_METHOD: Literal["gpt_char", "gpt_char_photo", "gpt_photo", "baseline_repaired"] = "gpt_char"
    GEN_FAKE: bool = False
    GEN_FAKE_ERROR: Literal["none", "declined", "limit", "timeout", "no_image"] = "none"
    GEN_FAKE_DELAY_MS: int = Field(0, ge=0)
    DEMO_REPLAY: Literal["0", "prefer", "1"] = "0"
    TEXT_TIMEOUT_S: float = Field(120, gt=0)
    IMAGE_TIMEOUT_S: float = Field(300, gt=0)
    LAB_CAP_POINTS: float = Field(40, gt=0)
    DEMO_CAP_POINTS: float = Field(10, gt=0)
    GEN_CONCURRENCY: int = Field(3, ge=1)  # 종류(글, 그림)마다 동시에 돌리는 codex 수. 선택지 3개를 함께 만든다
    GEN_PREFETCH: bool = True  # 장면을 돌려준 뒤 선택지마다 다음 장면을 미리 만든다

    @field_validator("DATA_DIR", "CODEX_HOME_DIR")
    @classmethod
    def _absolute(cls, value: Path) -> Path:
        return value.expanduser().resolve()


def _read_env_file(path: str) -> dict[str, str]:
    file = Path(path)
    if not file.is_file():
        return {}
    pairs = {}
    for line in file.read_text(encoding="utf-8").splitlines():
        name, sep, value = line.strip().partition("=")
        if sep and not name.startswith("#"):
            pairs[name.strip()] = value.strip().strip("'\"")
    return pairs


def load_settings(env: Mapping[str, str] | None = None) -> Settings:
    env = os.environ if env is None else env
    env_file = env.get("ENV_FILE", str(BACKEND_DIR / ".env"))
    merged = {**(_read_env_file(env_file) if env_file else {}), **env}
    return Settings.model_validate(
        {name: merged[name] for name in Settings.model_fields if merged.get(name, "") != ""}
    )


settings = load_settings()


def reload() -> Settings:
    """환경을 다시 읽어 같은 settings 객체를 갱신한다(import로 잡아 둔 settings 참조가 유지된다)."""
    settings.__dict__.update(load_settings().__dict__)
    return settings
