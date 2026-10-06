"""검토 API(할 일 19), 검토 화면(23), 리포트(24)가 쓰는 합성 실험 데이터.

사용: uv run python tests/fixtures/make_lab_fixture.py <DATA_DIR> [--reviews N]
비교군 5개 x 조건 5개 x 2회차의 매니페스트 줄과 대역 그림, 기준 캐릭터(arm=BASE), 합성 사진을 만든다.
줄 형식은 할 일 18의 매니페스트와 같다: C-1 필드 + photo_id, photo_path, arm, condition, round.
"""
import argparse
import hashlib
import json
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROTOCOL = json.loads((BACKEND_DIR / "app" / "lab" / "protocol.json").read_text(encoding="utf-8"))
ROUNDS = (1, 2)
# 합성 검토 점수의 비교군별 중심값(리포트의 통과/탈락이 갈리도록 다르게 둔다)
SCORE_CENTER = {"B0": 2, "B1": 3, "G1": 4, "G2": 5, "G3": 4, "BASE": 4}


def _png(path: Path, color, label: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (192, 256), color)
    draw = ImageDraw.Draw(img)
    draw.ellipse((56, 56, 136, 160), fill=(250, 224, 200), outline=(60, 40, 30), width=3)
    draw.text((8, 8), label, fill=(0, 0, 0))
    img.save(path, "PNG")


def _line(photo_id, photo, arm, condition, round_, method, image, n, used) -> dict:
    is_gpt = method.startswith("gpt")
    return {
        "status": "modified" if n % 10 == 7 else "ok",
        "kind": "image",
        "method": method,
        "image_path": str(image),
        "text": {},
        "thread_id": f"fixture-thread-{n:03d}" if is_gpt else None,
        "seed": None if is_gpt else 1000 + n,
        "latency_ms": 20000 + 1500 * n,
        "attempts": 2 if n % 9 == 4 else 1,
        "reason": "",
        "limit": {
            "used_percent_before": used if is_gpt else None,
            "used_percent_after": round(used + 0.5, 1) if is_gpt else None,
            "resets_at": "2026-10-06T02:50:00+00:00" if is_gpt else None,
        },
        "prompt_sha256": hashlib.sha256(f"prompt-{n}".encode()).hexdigest(),
        "reference_sha256": [hashlib.sha256(photo.read_bytes()).hexdigest()],
        "request_key": hashlib.sha256(f"request-{n}".encode()).hexdigest(),
        "cached": False,
        "created_at": f"2026-10-02T09:{n // 60:02d}:{n % 60:02d}+00:00",
        "photo_id": photo_id,
        "photo_path": str(photo),
        "arm": arm,
        "condition": condition,
        "round": round_,
    }


def make(data_dir, reviews: int = 0) -> Path:
    """data_dir에 픽스처를 만들고 매니페스트 경로를 돌려준다."""
    data_dir = Path(data_dir).resolve()
    photo = data_dir / "photos" / "synthetic.jpg"
    photo.parent.mkdir(parents=True, exist_ok=True)
    face = Image.new("RGB", (300, 400), (236, 214, 190))
    ImageDraw.Draw(face).ellipse((75, 75, 225, 275), fill=(250, 224, 200), outline=(90, 60, 40), width=4)
    face.save(photo, "JPEG")
    photo_id = hashlib.sha256(photo.read_bytes()).hexdigest()[:12]

    lines = []
    base = data_dir / "lab" / "base" / photo_id / "candidate-1.png"
    _png(base, (227, 233, 255), "base")
    used = 22.0
    lines.append(_line(photo_id, photo, "BASE", "base", 1, "gpt_char", base, 0, used))
    n = 1
    for round_ in ROUNDS:
        for a, arm in enumerate(PROTOCOL["arms"]):
            for c, cond in enumerate(PROTOCOL["conditions"]):
                image = data_dir / "files" / "lab" / photo_id / f"{arm['id']}-{cond['id']}-r{round_}.png"
                _png(image, (60 + 40 * a, 80 + 30 * c, 120 + 50 * round_), f"{n}")
                if arm["method"].startswith("gpt"):
                    used = round(used + 0.5, 1)
                lines.append(_line(photo_id, photo, arm["id"], cond["id"], round_, arm["method"], image, n, used))
                n += 1

    manifest = data_dir / "lab" / "manifest.jsonl"
    manifest.write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in lines), encoding="utf-8")

    if reviews:
        sys.path.insert(0, str(BACKEND_DIR))
        from app.lab.review import build_tasks

        at = datetime(2026, 10, 2, 10, 0, tzinfo=timezone.utc).isoformat()
        with (data_dir / "lab" / "reviews.jsonl").open("w", encoding="utf-8") as f:
            for r in range(1, reviews + 1):
                reviewer = f"reviewer{r}"
                for task in build_tasks(data_dir):
                    rng = random.Random(f"{reviewer}|{task['key']}")
                    score = min(5, max(1, SCORE_CENTER[task["arm"]] + rng.choice((-1, 0, 0, 0))))
                    picture = task["type"] == "resemblance"
                    record = {
                        "reviewer": reviewer,
                        "taskId": task["taskId"],
                        "key": task["key"],
                        "type": task["type"],
                        "score": score,
                        "usable": score >= 4 if picture else None,
                        "tags": ["different_person"] if picture and score <= 2 else [],
                        "at": at,
                    }
                    f.write(json.dumps(record) + "\n")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data_dir")
    parser.add_argument("--reviews", type=int, default=0)
    args = parser.parse_args()
    print(make(args.data_dir, args.reviews))
