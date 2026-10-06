#!/usr/bin/env python3
"""tokens.css의 색 변수로 글자와 바탕의 대비 값(WCAG 2.1 상대 휘도 비)을 계산한다.

사용: python3 docs/design/contrast.py
기준: 본문 4.5:1 이상, 큰 글자와 버튼 3:1 이상.
"""
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent

PAIRS = {
    "a": [
        ("본문 글자 / 바탕", "--c-ink", "--c-bg", 4.5),
        ("본문 글자 / 종이면", "--c-ink", "--c-surface", 4.5),
        ("보조 글자 / 종이면", "--c-ink-soft", "--c-surface", 4.5),
        ("강조 글자·링크 / 종이면", "--c-accent", "--c-surface", 4.5),
        ("주요 버튼 글자 / 버튼 바탕", "--c-accent-ink", "--c-accent", 3.0),
        ("선택 상태 글자 / 옅은 강조 배경", "--c-ink", "--c-accent-pale", 4.5),
        ("오류 테두리 / 종이면", "--c-warn", "--c-surface", 3.0),
    ],
    "b": [
        ("본문 글자 / 바탕", "--c-ink", "--c-bg", 4.5),
        ("본문 글자 / 무대면", "--c-ink", "--c-surface", 4.5),
        ("보조 글자 / 무대면", "--c-ink-soft", "--c-surface", 4.5),
        ("강조 글자·링크 / 무대면", "--c-accent", "--c-surface", 4.5),
        ("주요 버튼 글자 / 버튼 바탕", "--c-accent-ink", "--c-accent", 3.0),
        ("선택 상태 글자 / 옅은 강조 배경", "--c-ink", "--c-accent-pale", 4.5),
        ("오류 글자 / 오류 바탕", "--c-ink", "--c-warn-wash", 4.5),
    ],
    "c": [
        ("본문 글자 / 바탕", "--c-ink", "--c-bg", 4.5),
        ("본문 글자 / 흰 칸", "--c-ink", "--c-surface", 4.5),
        ("보조 글자 / 흰 칸", "--c-ink-soft", "--c-surface", 4.5),
        ("강조 글자·링크 / 흰 칸", "--c-accent", "--c-surface", 4.5),
        ("주요 버튼 글자 / 버튼 바탕", "--c-accent-ink", "--c-accent", 3.0),
        ("선택 상태 글자 / 옅은 강조 배경", "--c-ink", "--c-accent-pale", 4.5),
        ("빨간펜 글자 / 보조면", "--c-redpen", "--c-surface-2", 4.5),
    ],
}


def read_vars(path):
    text = path.read_text(encoding="utf-8")
    found = {}
    for name, value in re.findall(r"(--c-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;", text):
        found[name] = value.lower()
    return found


def channel(value):
    v = value / 255.0
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def luminance(hex_color):
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def ratio(fg, bg):
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def main():
    failures = 0
    for direction in ("a", "b", "c"):
        path = BASE / "mockups" / direction / "tokens.css"
        variables = read_vars(path)
        print("## 방향 " + direction + " (" + str(path.relative_to(BASE.parent.parent)) + ")")
        for label, fg_var, bg_var, floor in PAIRS[direction]:
            fg, bg = variables[fg_var], variables[bg_var]
            value = ratio(fg, bg)
            ok = value >= floor
            if not ok:
                failures += 1
            print("%-34s %s on %s = %5.2f:1  기준 %.1f  %s"
                  % (label, fg, bg, value, floor, "OK" if ok else "FAIL"))
        print("")
    if failures:
        print("기준 미달 " + str(failures) + "건")
        return 1
    print("모두 기준 이상")
    return 0


if __name__ == "__main__":
    sys.exit(main())
