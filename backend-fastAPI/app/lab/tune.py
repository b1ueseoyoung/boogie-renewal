"""얼굴 유사도 개선 실험: tuning.json의 버전마다 비교 실험과 같은 장면 그림을 만든다 -> data/lab/tuning/<버전>/

실행: cd backend-fastAPI && uv run python -m app.lab.tune <버전> [--rounds 2] [--conds front,side]
측정: .local/ComfyUI/.venv/bin/python scripts/face-sim.py --dir data/lab/tuning/<버전>
"""
import argparse
import asyncio
import json
import re
from pathlib import Path

from app.core.config import BACKEND_DIR, settings
from app.gen import codex_runner
from app.gen.image import _collect, _prepare_reference

LAB = BACKEND_DIR / "app" / "lab"
PROTOCOL = json.loads((LAB / "protocol.json").read_text(encoding="utf-8"))
TUNING = json.loads((LAB / "tuning.json").read_text(encoding="utf-8"))
SCENES = {c["id"]: c["scene"] for c in PROTOCOL["conditions"]}
OUTFIT_RULES = PROTOCOL["templates"]["outfit_rules"]
OUT = settings.DATA_DIR / "lab" / "tuning"


def sources() -> dict:
    rows = [json.loads(line) for line in (settings.DATA_DIR / "lab" / "manifest.jsonl").open(encoding="utf-8")]
    base = next(r for r in rows if r["arm"] == "BASE")
    return {"photo": rows[0]["photo_path"], "character": base["image_path"]}


async def face_desc(photo) -> str:
    path = OUT / "refs" / "face-desc.json"
    if path.is_file():
        return json.loads(path.read_text(encoding="utf-8"))["faceDesc"]
    schema = OUT / "refs" / "face-desc.schema.json"
    schema.parent.mkdir(parents=True, exist_ok=True)
    schema.write_text(json.dumps({"type": "object", "properties": {"faceDesc": {"type": "string"}},
                                  "required": ["faceDesc"], "additionalProperties": False}), encoding="utf-8")
    result = await codex_runner.run_text(TUNING["face_desc_prompt"], [_prepare_reference(photo)], schema)
    if result["status"] != "ok":
        raise SystemExit(f"얼굴 묘사문 생성 실패: {result['status']} {result['reason']}")
    path.write_text(json.dumps(result["text"], ensure_ascii=False), encoding="utf-8")
    return result["text"]["faceDesc"]


def template(version: str) -> dict:
    """template_from이 있으면 그 버전의 틀에 replace(원문 -> 새 문장)를 적용한다. 원문이 없으면 멈춘다."""
    spec = dict(TUNING["versions"][version])
    if "template_from" in spec:
        spec["template"] = template(spec["template_from"])["template"]
        for old, new in spec.get("replace", {}).items():
            if old not in spec["template"]:
                raise SystemExit(f"{version}: 바꿀 문장이 틀에 없음: {old}")
            spec["template"] = spec["template"].replace(old, new)
    return spec


async def main(version: str, rounds: int, conds: list[str], first: int = 1) -> None:
    spec = template(version)
    src = sources()
    char_look = json.loads(Path(src["character"]).with_name("feature.json").read_text(encoding="utf-8"))["charLook"]
    fields = {"char_look": char_look, "face_desc": await face_desc(src["photo"]) if "{face_desc}" in spec["template"] else ""}
    fixed = {role: _prepare_reference(src[role]) for role in spec["references"] if role != "scene"}
    folder = OUT / version
    (folder / "prompts").mkdir(parents=True, exist_ok=True)

    async def one(cond: str, round_: int) -> None:
        out = folder / f"{cond}-r{round_}.png"
        if out.is_file():
            return
        scene_img = OUT / spec.get("from_images", "") / f"{cond}-r{round_}.png"
        if "scene" in spec["references"] and not scene_img.is_file():
            return print(f"{version} {cond} r{round_}: 원본 장면 없음 {scene_img}", flush=True)
        paths = [_prepare_reference(scene_img) if role == "scene" else fixed[role] for role in spec["references"]]
        lines = "\n".join(f"{p} - {TUNING['reference_roles'][role]}" for role, p in zip(spec["references"], paths))
        outfit = "scene_specified" if cond == "outfit" else ("with_character" if "character" in spec["references"] else "photo_only")
        values = {**fields, "scene": SCENES[cond], "outfit_rule": OUTFIT_RULES[outfit], "reference_lines": lines}
        prompt = re.sub(r"\{(\w+)\}", lambda m: values.get(m.group(1), m.group(0)), spec["template"])
        (folder / "prompts" / f"{cond}-r{round_}.txt").write_text(prompt, encoding="utf-8")
        result = await asyncio.to_thread(_collect, {**await codex_runner.run_image(prompt, paths), "method": f"tune_{version}"}, out)
        line = {k: result[k] for k in ("status", "reason", "latency_ms", "attempts", "thread_id", "image_path", "limit")}
        with (folder / "log.jsonl").open("a", encoding="utf-8") as f:
            f.write(json.dumps({"condition": cond, "round": round_, **line}, ensure_ascii=False) + "\n")
        print(f"{version} {cond} r{round_}: {result['status']} {result['latency_ms'] / 1000:.1f}s", flush=True)

    await asyncio.gather(*(one(c, r) for r in range(first, rounds + 1) for c in conds))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="얼굴 유사도 개선 실험 그림 생성")
    parser.add_argument("version")
    parser.add_argument("--rounds", type=int, default=2)
    parser.add_argument("--first", type=int, default=1, help="시작 회차(--rounds는 마지막 회차)")
    parser.add_argument("--conds", default=",".join(SCENES))
    args = parser.parse_args()
    asyncio.run(main(args.version, args.rounds, args.conds.split(","), args.first))
