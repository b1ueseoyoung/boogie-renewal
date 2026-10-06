"""ComfyUI 기준선 어댑터. illust.json을 변형해 로컬 ComfyUI로 한 장을 만들고 C-1 형식의 dict를 돌려준다.

as_shipped는 기존 코드의 결함(부정 프롬프트 덮어쓰기, 고정 시드)을 그대로 재현하고, repaired는 그 둘만 고친다.
동기 함수다: 이벤트 루프에서는 asyncio.to_thread로 부른다.
"""
import argparse
import asyncio
import hashlib
import json
import re
import secrets
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

from app.core.config import BACKEND_DIR, REPO_ROOT, settings
from app.gen import store
from app.gen.fake import fake_run_image

WORKFLOW_PATH = BACKEND_DIR / "illust.json"
BASELINE_DOC = REPO_ROOT / "docs" / "baseline-env.md"
VARIANTS = ("as_shipped", "repaired")
POLL_INTERVAL_S = 1
POLL_LIMIT_S = 180


def build_workflow(variant: str, prompt: str, image_name: str, seed: int | None = None) -> tuple[dict, int]:
    """변형한 워크플로와 그 워크플로가 쓰는 시드를 돌려준다. 프롬프트, 시드, 입력 이미지 외의 값은 건드리지 않는다."""
    if variant not in VARIANTS:
        raise ValueError(f"unknown variant: {variant!r}")
    workflow = json.loads(WORKFLOW_PATH.read_text(encoding="utf-8"))
    sampler = next(node for node in workflow.values() if node.get("class_type") == "KSampler")
    for node in workflow.values():
        if node.get("class_type") == "LoadImage":
            node["inputs"]["image"] = image_name
        elif node.get("class_type") == "CLIPTextEncode" and variant == "as_shipped":
            node["inputs"]["text"] = prompt
    if variant == "repaired":
        workflow[sampler["inputs"]["positive"][0]]["inputs"]["text"] = prompt
        sampler["inputs"]["seed"] = secrets.randbits(63) if seed is None else seed
    return workflow, sampler["inputs"]["seed"]


def _baseline_documented() -> bool:
    if not BASELINE_DOC.is_file():
        return False
    return re.search(r"^status:\s*AVAILABLE\s*$", BASELINE_DOC.read_text(encoding="utf-8"), re.MULTILINE) is not None


def gen_baseline(variant, prompt, photo_path, out_path, seed=None, *, transport=None,
                 sleep=time.sleep, clock=time.monotonic) -> dict:
    started = time.monotonic()
    photo_path, out_path = Path(photo_path), Path(out_path)
    photo = photo_path.read_bytes()
    photo_sha = hashlib.sha256(photo).hexdigest()
    image_name = f"{photo_sha[:16]}{photo_path.suffix.lower()}"
    workflow, used_seed = build_workflow(variant, prompt, image_name, seed)

    def result(status: str, reason: str = "", image_path: str | None = None) -> dict:
        return {
            "status": status, "kind": "image", "method": f"baseline_{variant}", "image_path": image_path,
            "text": {}, "thread_id": None, "seed": used_seed,
            "latency_ms": int((time.monotonic() - started) * 1000), "attempts": 1, "reason": reason,
            "limit": {"used_percent_before": None, "used_percent_after": None, "resets_at": None},
            "prompt_sha256": hashlib.sha256(prompt.encode()).hexdigest(), "reference_sha256": [photo_sha],
            "request_key": "", "cached": False, "created_at": datetime.now(timezone.utc).isoformat(),
        }

    if settings.GEN_FAKE:
        fake = {**fake_run_image(prompt, [photo_path]), "method": f"baseline_{variant}", "seed": used_seed}
        if fake["status"] == "ok":
            out_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(fake["image_path"], out_path)
            fake["image_path"] = str(out_path)
        return fake

    if not _baseline_documented():
        return result("error", "baseline_unavailable")
    with httpx.Client(base_url=settings.COMFY_URL, transport=transport, timeout=30) as client:
        try:
            client.get("/system_stats", timeout=5).raise_for_status()
        except httpx.HTTPError:
            return result("error", "baseline_unavailable")
        try:
            try:
                uploaded = client.post("/upload/image", files={"image": (image_name, photo)},
                                       data={"type": "input", "overwrite": "true"})
                uploaded.raise_for_status()
            except httpx.HTTPError as e:
                return result("error", f"upload_failed: {e}")
            queued = client.post("/prompt", json={"prompt": workflow})
            queued.raise_for_status()
            prompt_id = queued.json()["prompt_id"]

            entry = None
            deadline = clock() + POLL_LIMIT_S
            while clock() < deadline:
                history = client.get(f"/history/{prompt_id}")
                history.raise_for_status()
                entry = history.json().get(prompt_id)
                if entry:
                    break
                sleep(POLL_INTERVAL_S)
            if not entry:
                return result("timeout", f"no history after {POLL_LIMIT_S}s")
            if entry.get("status", {}).get("status_str") == "error":
                return result("error", "comfy execution error")
            images = [img for out in entry.get("outputs", {}).values() for img in out.get("images", [])]
            if not images:
                return result("no_image", "history entry has no output image")
            view = client.get("/view", params={"filename": images[0]["filename"],
                                               "subfolder": images[0].get("subfolder", ""), "type": "output"})
            view.raise_for_status()
        except (httpx.HTTPError, KeyError, ValueError) as e:
            return result("error", f"{type(e).__name__}: {e}")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(view.content)
    return result("ok", image_path=str(out_path))


async def gen_baseline_stored(variant, prompt, photo_path, out_path, seed=None, fresh=False) -> dict:
    """gen_baseline을 스레드에서 돌리고 저장소(캐시, 재생, 기록)를 거친다. 캐시 적중이면 저장본이 out_path로 복사된다."""
    method = f"baseline_{variant}"

    async def generate() -> dict:
        return await asyncio.to_thread(gen_baseline, variant, prompt, photo_path, out_path, seed)

    key = store.request_key(method, prompt, [photo_path], "baseline")
    return await store.get_or_generate(key, generate, kind="image", method=method, fresh=fresh, out_path=out_path)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.gen.comfy")
    parser.add_argument("--variant", required=True, choices=VARIANTS)
    parser.add_argument("--photo", required=True)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--seed", type=int)
    args = parser.parse_args(argv)
    out = Path(args.out).resolve()
    res = gen_baseline(args.variant, args.prompt, Path(args.photo).resolve(), out, args.seed)
    print(json.dumps(res, ensure_ascii=False))
    return 0 if res["status"] == "ok" else 1


if __name__ == "__main__":
    sys.exit(main())
