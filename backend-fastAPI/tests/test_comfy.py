"""ComfyUI 기준선 어댑터(app/gen/comfy.py). ComfyUI는 httpx.MockTransport로 대신하고 시계와 sleep을 주입한다."""
import json
import subprocess
import sys
from pathlib import Path

import httpx
import pytest

from app.gen import comfy

SHIPPED_SEED = 608548260914332
NEGATIVE = "disfigured, deformed, ugly"
PNG = b"\x89PNG\r\n\x1a\nfake-comfy-output"


class Comfy:
    """요청을 기록하는 가짜 ComfyUI. history는 polls_until_done번째 조회부터 결과를 준다(None이면 끝나지 않는다)."""

    def __init__(self, polls_until_done=2, upload_status=200, history_entry=None, stats_error=False):
        self.requests = []
        self.sent = None
        self.polls = 0
        self.polls_until_done = polls_until_done
        self.upload_status = upload_status
        self.history_entry = history_entry
        self.stats_error = stats_error

    def __call__(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        self.requests.append((request.method, path))
        if path == "/system_stats":
            if self.stats_error:
                raise httpx.ConnectError("refused", request=request)
            return httpx.Response(200, json={"system": {}})
        if path == "/upload/image":
            self.upload_body = request.content
            if self.upload_status != 200:
                return httpx.Response(self.upload_status, text="upload broke")
            return httpx.Response(200, json={"name": self.upload_name(), "subfolder": "", "type": "input"})
        if path == "/prompt":
            self.sent = json.loads(request.content)["prompt"]
            return httpx.Response(200, json={"prompt_id": "pid-1"})
        if path == "/history/pid-1":
            self.polls += 1
            if self.polls_until_done is None or self.polls < self.polls_until_done:
                return httpx.Response(200, json={})
            entry = self.history_entry or {
                "outputs": {"9": {"images": [{"filename": "IPAdapter_00001_.png", "subfolder": "", "type": "output"}]}},
                "status": {"status_str": "success", "completed": True},
            }
            return httpx.Response(200, json={"pid-1": entry})
        if path == "/view":
            self.view_params = dict(request.url.params)
            return httpx.Response(200, content=PNG)
        return httpx.Response(404)

    def upload_name(self):
        return self.upload_body.split(b'filename="')[1].split(b'"')[0].decode()


@pytest.fixture
def env(fake_env, tmp_path, monkeypatch):
    doc = tmp_path / "baseline-env.md"
    doc.write_text("# 기준선 환경\n\nstatus: AVAILABLE\n", encoding="utf-8")
    monkeypatch.setattr(comfy, "BASELINE_DOC", doc)
    fake_env.doc = doc
    fake_env.out = tmp_path / "out" / "b.png"
    return fake_env


def run(env, server, variant, **kwargs):
    clock = [0.0]

    def sleep(seconds):
        clock[0] += seconds

    result = comfy.gen_baseline(variant, "a test scene", env.photo, env.out, transport=httpx.MockTransport(server),
                                sleep=sleep, clock=lambda: clock[0], **kwargs)
    return result, clock[0]


def test_as_shipped_overwrites_both_prompts_and_keeps_seed(env):
    server = Comfy()
    result, _ = run(env, server, "as_shipped", seed=123)

    assert result["status"] == "ok", result
    assert server.sent["6"]["inputs"]["text"] == "a test scene"
    assert server.sent["7"]["inputs"]["text"] == "a test scene"
    assert server.sent["3"]["inputs"]["seed"] == SHIPPED_SEED
    assert result["seed"] == SHIPPED_SEED
    assert result["method"] == "baseline_as_shipped"
    assert result["kind"] == "image" and result["attempts"] == 1
    assert result["image_path"] == str(env.out)
    assert env.out.read_bytes() == PNG
    assert server.view_params == {"filename": "IPAdapter_00001_.png", "subfolder": "", "type": "output"}


def test_repaired_keeps_negative_and_records_random_seed(env):
    server = Comfy()
    result, _ = run(env, server, "repaired")

    assert result["status"] == "ok", result
    assert server.sent["6"]["inputs"]["text"] == "a test scene"
    assert server.sent["7"]["inputs"]["text"] == NEGATIVE
    seed = server.sent["3"]["inputs"]["seed"]
    assert seed != SHIPPED_SEED and 0 <= seed < 2**63
    assert result["seed"] == seed
    assert result["method"] == "baseline_repaired"


def test_repaired_uses_given_seed(env):
    server = Comfy()
    result, _ = run(env, server, "repaired", seed=42)
    assert server.sent["3"]["inputs"]["seed"] == 42 and result["seed"] == 42


@pytest.mark.parametrize("variant", ["as_shipped", "repaired"])
def test_upload_form_and_load_image_name(env, variant):
    server = Comfy()
    result, _ = run(env, server, variant)

    name = server.upload_name()
    assert name == f"{result['reference_sha256'][0][:16]}.jpg"
    assert b'name="image"' in server.upload_body
    assert b'name="type"\r\n\r\ninput' in server.upload_body
    assert b'name="overwrite"\r\n\r\ntrue' in server.upload_body
    assert server.sent["12"]["inputs"]["image"] == name


@pytest.mark.parametrize("variant", ["as_shipped", "repaired"])
def test_other_workflow_values_are_untouched(env, variant):
    server = Comfy()
    run(env, server, variant)
    original = json.loads((Path(comfy.__file__).parents[2] / "illust.json").read_text(encoding="utf-8"))
    for workflow in (original, server.sent):
        workflow["3"]["inputs"].pop("seed")
        workflow["6"]["inputs"].pop("text")
        workflow["7"]["inputs"].pop("text")
        workflow["12"]["inputs"].pop("image")
    assert server.sent == original


def test_polling_that_never_finishes_is_timeout(env):
    server = Comfy(polls_until_done=None)
    result, elapsed = run(env, server, "repaired")

    assert result["status"] == "timeout"
    assert result["image_path"] is None and not env.out.exists()
    assert elapsed == 180
    assert server.polls == 180


def test_upload_failure_is_error(env):
    server = Comfy(upload_status=500)
    result, _ = run(env, server, "repaired")

    assert result["status"] == "error"
    assert result["reason"].startswith("upload_failed")
    assert ("POST", "/prompt") not in server.requests
    assert not env.out.exists()


def test_history_entry_without_outputs_is_not_ok(env):
    server = Comfy(history_entry={"outputs": {}, "status": {"status_str": "success", "completed": True}})
    result, _ = run(env, server, "repaired")
    assert result["status"] == "no_image"
    assert not env.out.exists()


def test_history_execution_error_is_error(env):
    server = Comfy(history_entry={"outputs": {}, "status": {"status_str": "error", "completed": False}})
    result, _ = run(env, server, "repaired")
    assert result["status"] == "error"
    assert not env.out.exists()


def test_unreachable_comfy_is_baseline_unavailable(env):
    server = Comfy(stats_error=True)
    result, _ = run(env, server, "repaired")

    assert (result["status"], result["reason"]) == ("error", "baseline_unavailable")
    assert server.requests == [("GET", "/system_stats")]
    assert not env.out.exists()


def test_doc_status_unavailable_is_baseline_unavailable(env):
    env.doc.write_text("status: UNAVAILABLE\n", encoding="utf-8")
    server = Comfy()
    result, _ = run(env, server, "repaired")

    assert (result["status"], result["reason"]) == ("error", "baseline_unavailable")
    assert server.requests == []
    assert not env.out.exists()


def test_unknown_variant_is_rejected(env):
    with pytest.raises(ValueError):
        run(env, Comfy(), "illust_1024")


def test_gen_fake_builds_workflow_without_calling_comfy(env):
    env.set(GEN_FAKE="1")
    server = Comfy()
    result, _ = run(env, server, "repaired", seed=7)

    assert server.requests == []
    assert result["status"] == "ok", result
    assert result["method"] == "baseline_repaired" and result["seed"] == 7
    assert result["image_path"] == str(env.out)
    assert env.out.read_bytes()[:8] == PNG[:8]
    calls = (env.data_dir / "lab" / "fake-calls.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(calls) == 1 and json.loads(calls[0])["images"] == [str(env.photo)]


def test_build_workflow_does_not_mutate_between_calls(env):
    first, _ = comfy.build_workflow("as_shipped", "one", "a.jpg")
    second, seed = comfy.build_workflow("repaired", "two", "b.jpg", seed=5)
    assert first["7"]["inputs"]["text"] == "one"
    assert second["7"]["inputs"]["text"] == NEGATIVE and seed == 5


def test_cli_prints_baseline_unavailable_and_writes_nothing(env, tmp_path):
    out = tmp_path / "none.png"
    proc = subprocess.run(
        [sys.executable, "-m", "app.gen.comfy", "--variant", "repaired", "--photo", str(env.photo),
         "--prompt", "x", "--out", str(out)],
        cwd=Path(comfy.__file__).parents[2], capture_output=True, text=True, timeout=60,
    )
    assert "baseline_unavailable" in proc.stdout
    assert proc.returncode == 1
    assert not out.exists()
