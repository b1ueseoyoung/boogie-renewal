"""python -m app.lab base-character | pilot | run --rounds auto|N | status [--json] | verify

종료 코드: 0 정상, 1 verify 실패나 기준 캐릭터 생성 실패, 20 한도 규칙, 21 회차 끝 확인 실패.
"""
import argparse
import asyncio
import json
import sys

from app.core.config import settings
from app.lab import manifest
from app.lab.runner import Lab, Stop

PHOTO_SUFFIXES = (".jpg", ".jpeg", ".png")


def _rounds(value: str):
    if value == "auto":
        return value
    if not value.isdigit() or int(value) < 1:
        raise argparse.ArgumentTypeError("auto 또는 1 이상의 정수")
    return int(value)


def _photo(given):
    if given:
        return given
    photos = sorted((p for p in (settings.DATA_DIR / "photos").glob("*") if p.suffix.lower() in PHOTO_SUFFIXES),
                    key=lambda p: p.name)
    if not photos:
        raise Stop(2, f"사진이 없다: {settings.DATA_DIR / 'photos'}에 jpg, jpeg, png를 넣거나 --photo를 준다.")
    return photos[0]


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.lab")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("base-character", "pilot", "run", "status"):
        commands.add_parser(name).add_argument("--photo", help="기본: DATA_DIR/photos의 첫 파일(이름순)")
    commands.choices["run"].add_argument("--rounds", type=_rounds, default="auto")
    commands.choices["status"].add_argument("--json", action="store_true")
    commands.add_parser("verify")
    args = parser.parse_args(argv)

    if args.command == "verify":
        problems = manifest.verify()
        print("\n".join(problems) if problems else "verify: ok")
        return 1 if problems else 0
    try:
        lab = Lab(_photo(args.photo))
        if args.command == "status":
            status = lab.status()
            if args.json:
                print(json.dumps(status, ensure_ascii=False))
            else:
                for name, value in status.items():
                    print(f"{name}: {value}")
        elif args.command == "base-character":
            asyncio.run(lab.base())
        elif args.command == "pilot":
            asyncio.run(lab.pilot())
        else:
            asyncio.run(lab.run(args.rounds))
    except Stop as stop:
        print(stop.message, flush=True)
        return stop.code
    return 0


if __name__ == "__main__":
    sys.exit(main())
