"""비교 실험 그림의 얼굴 유사도(ArcFace) 측정 -> data/lab/report/face-sim.json

실행: .local/ComfyUI/.venv/bin/python scripts/face-sim.py  (insightface가 설치된 기준선 환경, CPU)
개선 실험 폴더: 같은 명령에 --dir data/lab/tuning/<버전> -> 그 폴더의 face-sim.json
대조군(다른 사람): 같은 명령에 --control -> data/lab/report/face-control.json
"""
import argparse
import itertools
import json
from pathlib import Path

import cv2
import numpy as np
from insightface.app import FaceAnalysis

REPO = Path(__file__).resolve().parents[1]
MANIFEST = REPO / "data/lab/manifest.jsonl"
OUT = REPO / "data/lab/report/face-sim.json"
ARMS = ["B0", "B1", "G1", "G2", "G3"]
CONDS = ["front", "side", "expression", "full_body", "outfit"]

app = FaceAnalysis(name="buffalo_l", root=str(REPO / ".local/ComfyUI/models/insightface"),
                   providers=["CPUExecutionProvider"], allowed_modules=["detection", "recognition"])
app.prepare(ctx_id=-1, det_size=(640, 640))
rng = np.random.default_rng(0)


def face(path):
    img = cv2.imread(str(path))
    faces = app.get(img)
    if not faces:
        return None
    f = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    h, w = img.shape[:2]
    return {"emb": f.normed_embedding, "det": float(f.det_score), "faces": len(faces),
            "area": float((f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]) / (w * h))}


def cos(a, b):
    return float(np.dot(a, b))


def ci95(x):
    x = np.asarray(x, dtype=float)
    means = rng.choice(x, (10000, len(x)), replace=True).mean(1)
    return [float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))]


rows = [json.loads(line) for line in MANIFEST.open()]
photo = face(rows[0]["photo_path"])
base = face(next(r for r in rows if r["arm"] == "BASE")["image_path"])
if photo is None or base is None:
    raise SystemExit("사진 또는 기준 캐릭터에서 얼굴을 찾지 못함")


def measure(path, **item):
    f = face(path)
    item.update(found=f is not None)
    if f:
        item.update(det=f["det"], faces=f["faces"], area=f["area"], emb=f["emb"],
                    sim_photo=cos(photo["emb"], f["emb"]), sim_base=cos(base["emb"], f["emb"]))
    return item


def write(out, data):
    for i in data["items"]:
        i.pop("emb", None)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1))


def measure_manifest():
    items = [measure(r["image_path"], arm=r["arm"], condition=r["condition"], round=r["round"],
                     file=str(Path(r["image_path"]).relative_to(REPO)), latency_s=r["latency_ms"] / 1000)
             for r in rows if r["arm"] != "BASE" and r["status"] == "ok"]
    arms = {}
    for a in ARMS:
        found = [i for i in items if i["arm"] == a and i["found"]]
        sims = [i["sim_photo"] for i in found]
        pairs = [cos(x["emb"], y["emb"]) for x, y in itertools.combinations(found, 2)]
        by_cond = {c: [i["sim_photo"] for i in found if i["condition"] == c] for c in CONDS}
        arms[a] = {"n": sum(i["arm"] == a for i in items), "found": len(found),
                   "sim_photo_mean": float(np.mean(sims)), "sim_photo_ci95": ci95(sims),
                   "sim_base_mean": float(np.mean([i["sim_base"] for i in found])),
                   "consistency_mean": float(np.mean(pairs)), "consistency_pairs": len(pairs),
                   "by_condition": {c: float(np.mean(v)) for c, v in by_cond.items()},
                   "round_sd_by_condition": {c: float(np.std(v, ddof=1)) if len(v) > 1 else None for c, v in by_cond.items()},
                   "face_area_by_condition": {c: float(np.mean([i["area"] for i in found if i["condition"] == c])) for c in CONDS}}
    cell = {(i["arm"], i["condition"], i["round"]): i["sim_photo"] for i in items if i["found"]}
    paired = {}
    for a, b in itertools.combinations(["B1", "G1", "G2", "G3"], 2):
        d = [cell[(a, c, r)] - cell[(b, c, r)] for c in CONDS for r in (1, 2, 3) if (a, c, r) in cell and (b, c, r) in cell]
        paired[f"{a}-{b}"] = {"n": len(d), "mean_diff": float(np.mean(d)), "ci95": ci95(d), "a_higher": int(sum(x > 0 for x in d))}
    write(OUT, {"model": "insightface buffalo_l (det_10g + w600k_r50 ArcFace), CPU, det_size 640",
                "base_character_sim_photo": cos(photo["emb"], base["emb"]), "arms": arms, "paired": paired, "items": items})
    print(f"{OUT.relative_to(REPO)}: {len(items)}장, 얼굴 검출 {sum(i['found'] for i in items)}장")


def measure_dir(folder):
    items = [measure(p, condition=p.stem.rsplit("-r", 1)[0], round=int(p.stem.rsplit("-r", 1)[1]), file=p.name)
             for p in sorted(folder.glob("*-r*.png"))]
    found = [i for i in items if i["found"]]
    by_cond = {c: [i for i in found if i["condition"] == c] for c in CONDS}
    pairs = [cos(x["emb"], y["emb"]) for x, y in itertools.combinations(found, 2)]
    summary = {"n": len(items), "found": len(found), "consistency_mean": float(np.mean(pairs)),
               "sim_photo_mean": float(np.mean([i["sim_photo"] for i in found])),
               "sim_base_mean": float(np.mean([i["sim_base"] for i in found])),
               "photo_ge030": sum(i["sim_photo"] >= 0.30 for i in found), "photo_ge045": sum(i["sim_photo"] >= 0.45 for i in found),
               "base_ge045": sum(i["sim_base"] >= 0.45 for i in found),
               "by_condition": {c: {"n": len(v), "photo": float(np.mean([i["sim_photo"] for i in v])),
                                    "base": float(np.mean([i["sim_base"] for i in v]))} for c, v in by_cond.items() if v}}
    write(folder / "face-sim.json", {"summary": summary, "items": items})
    print(f"{folder.relative_to(REPO)}: {len(items)}장, 얼굴 검출 {len(found)}장, 사진 유사도 평균 {summary['sim_photo_mean']:.3f}, "
          f"0.45 이상 {summary['photo_ge045']}장, 승인 캐릭터 유사도 평균 {summary['sim_base_mean']:.3f}, 그림끼리 {summary['consistency_mean']:.3f}")
    for c, v in summary["by_condition"].items():
        print(f"  {c}: 사진 {v['photo']:.3f}, 캐릭터 {v['base']:.3f} (n={v['n']})")


def measure_control():
    from insightface.data import get_image
    others = [f.normed_embedding for f in app.get(get_image("t1"))]
    scenes = [f["emb"] for r in rows if r["arm"] != "BASE" and r["status"] == "ok" and (f := face(r["image_path"]))]
    data = {"source": "insightface sample image t1", "faces": len(others)}
    for name, embs in {"photo": [photo["emb"]], "base_character": [base["emb"]], "scenes": scenes}.items():
        sims = [cos(o, e) for o in others for e in embs]
        data[name] = {"pairs": len(sims), "mean": float(np.mean(sims)), "max": float(np.max(sims))}
    out = OUT.with_name("face-control.json")
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(f"{out.relative_to(REPO)}: 다른 사람 {len(others)}명, " + ", ".join(
        f"{k} 평균 {data[k]['mean']:.3f} 최대 {data[k]['max']:.3f}" for k in ("photo", "base_character", "scenes")))


parser = argparse.ArgumentParser(description="얼굴 유사도 측정")
parser.add_argument("--dir", type=Path)
parser.add_argument("--control", action="store_true")
args = parser.parse_args()
if args.control:
    measure_control()
elif args.dir:
    measure_dir((REPO / args.dir).resolve())
else:
    measure_manifest()
