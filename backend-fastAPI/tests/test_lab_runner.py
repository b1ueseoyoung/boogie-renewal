"""실험 실행기(app.lab): 조건표, 반복 횟수, 한도 규칙, 재개, verify.

대부분 스텁(fake_codex.py)으로 돈다: 호출마다 thread_id와 그림이 다르고 used_percent를 정할 수 있다.
"""
import json
import os
import shutil
import signal
import subprocess
import sys
from collections import Counter
from pathlib import Path

import pytest

from app.lab import manifest, review, runner
from app.lab.__main__ import main

BACKEND = Path(__file__).resolve().parents[1]
FAR_RESET = 4102444800  # 2100년: 시계와 무관하게 "아직 초기화 전"인 창
KILL_HOOK = "LAB_TEST_KILL_AFTER_LINES"


def keys_of(lines):
    return [(x["arm"], x["condition"], x["round"]) for x in lines]


def stub_calls(fake_env):
    path = fake_env.codex_home / "calls.jsonl"
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines()] if path.is_file() else []


def status_json(capsys):
    capsys.readouterr()
    assert main(["status", "--json"]) == 0
    return json.loads(capsys.readouterr().out)


def switch_mode_for(monkeypatch, fake_env, method, mode):
    """gen_scene이 method로 불릴 때만 스텁을 mode로 돌린다(그 밖에는 ok). 어댑터 자체는 그대로 돈다."""
    real = runner.image.gen_scene

    async def gen_scene(scene, char_look, used_method, *args, **kwargs):
        fake_env.set(FAKE_CODEX_MODE=mode if used_method == method else "ok")
        return await real(scene, char_look, used_method, *args, **kwargs)

    monkeypatch.setattr(runner.image, "gen_scene", gen_scene)


def test_three_rounds_make_66_jobs_in_protocol_order():
    jobs = manifest.build_jobs(3)
    assert len(jobs) == len(set(jobs)) == 66
    assert Counter(arm for arm, _, _ in jobs) == {"BASE": 1, "B0": 5, "B1": 15, "G1": 15, "G2": 15, "G3": 15}
    assert jobs[:6] == [("BASE", "base", 1)] + [
        ("G2", c, 1) for c in ("front", "side", "expression", "full_body", "outfit")]
    assert [arm for arm, c, r in jobs if r == 1 and c == "front"] == ["G2", "G1", "G3", "B1", "B0"]
    assert [arm for arm, c, r in jobs if r == 2 and c == "front"] == ["G2", "G1", "G3", "B1"]


@pytest.mark.parametrize("per_image,rounds", [(0.2, 3), (1.0, 2), (1.5, 1), (3.0, 1)])
def test_rounds_from_per_image(per_image, rounds):
    assert runner.decide_rounds(per_image) == rounds


def test_window_change_keeps_the_cumulative_count():
    windows = []
    for used, resets_at in [(20.0, 111), (62.0, 111), (3.0, 222), (10.0, 222)]:
        runner.note_usage(windows, used, resets_at)
    assert windows == [{"resets_at": 111, "start": 20.0, "last": 62.0}, {"resets_at": 222, "start": 3.0, "last": 10.0}]
    assert runner.cumulative(windows) == 49.0


def test_run_continues_in_a_new_window_and_keeps_the_old_one(fake_env):
    old = {"resets_at": FAR_RESET - 1, "start": 30.0, "last": 62.0}
    plan = {"start_used_percent": 30.0, "per_image": 0.2, "R": 1, "decided_at": "2026-10-02T00:00:00+00:00",
            "windows": [old]}
    runner.save_plan(plan)
    fake_env.set(FAKE_CODEX_USED_PERCENT="3", FAKE_CODEX_RESETS_AT=FAR_RESET)

    assert main(["run", "--rounds", "1"]) == 0

    windows = runner.load_plan()["windows"]
    assert windows == [old, {"resets_at": FAR_RESET, "start": 3.0, "last": 3.0}]
    assert runner.cumulative(windows) == 32.0


def test_fake_run_completes_and_ignores_demo_replay(fake_env, capsys):
    fake_env.set(GEN_FAKE="1", CODEX_BIN="/nonexistent/codex", DEMO_REPLAY="1")

    assert main(["run", "--rounds", "1"]) == 0

    status = status_json(capsys)
    assert status["complete"] is True and status["paused"] is None
    assert status["counts"]["ok"] == 26
    assert status["expected_review_tasks"] == len(review.build_tasks(fake_env.data_dir)) == 31
    lines = manifest.read()
    assert keys_of(lines) == manifest.build_jobs(1)
    pid = lines[0]["photo_id"]
    assert len(pid) == 12 and lines[0]["photo_path"] == str(fake_env.photo)
    assert lines[0]["image_path"] == str(fake_env.data_dir / "lab" / "base" / pid / "candidate-1.png")
    assert lines[1]["image_path"] == str(fake_env.data_dir / "files" / "lab" / pid / "G2" / "front-r1.png")
    assert all(Path(x["image_path"]).is_file() and x["cached"] is False for x in lines)
    feature = json.loads((fake_env.data_dir / "lab" / "base" / pid / "feature.json").read_text(encoding="utf-8"))
    assert feature["charLook"]
    plan = runner.load_plan()
    assert plan["R"] == 1 and plan["per_image"] == 0.2 and plan["decided_at"]

    before = (fake_env.data_dir / "lab" / "gen-log.jsonl").read_text(encoding="utf-8")
    assert main(["run", "--rounds", "1"]) == 0  # 끝난 키는 다시 만들지 않는다
    assert (fake_env.data_dir / "lab" / "gen-log.jsonl").read_text(encoding="utf-8") == before


def test_everything_declined_is_complete_with_no_ok(fake_env, capsys):
    fake_env.set(GEN_FAKE="1", CODEX_BIN="/nonexistent/codex", GEN_FAKE_ERROR="declined")

    assert main(["run", "--rounds", "1"]) == 0

    status = status_json(capsys)
    assert status["complete"] is True and status["counts"]["ok"] == 0 and status["expected_review_tasks"] == 0
    by_arm = {}
    for line in manifest.read():
        assert line["status"] == "declined"
        by_arm.setdefault(line["arm"], []).append(line["reason"])
    assert set(by_arm["G2"]) == set(by_arm["G3"]) == {"base_character_declined"}
    assert by_arm["G1"][3:] == ["consecutive_declines"] * 2
    pid = manifest.read()[0]["photo_id"]
    feature = json.loads((fake_env.data_dir / "lab" / "base" / pid / "feature.json").read_text(encoding="utf-8"))
    assert feature["charLook"] == "" and feature["reason"]


def test_kill_twice_then_resume_without_duplicates(fake_env):
    def run(**extra):
        return subprocess.run([sys.executable, "-m", "app.lab", "run", "--rounds", "1"], cwd=BACKEND,
                              env={**os.environ, **extra}, capture_output=True, text=True, timeout=120)

    assert run(**{KILL_HOOK: "4"}).returncode == -signal.SIGKILL
    assert len(manifest.read()) == 4
    assert run(**{KILL_HOOK: "3"}).returncode == -signal.SIGKILL
    assert len(manifest.read()) == 7
    done = run()
    assert done.returncode == 0, done.stdout + done.stderr

    lines = manifest.read()
    finished = [k for k, x in zip(keys_of(lines), lines) if x["status"] in manifest.FINISHED]
    assert len(finished) == len(set(finished)) == 26
    assert keys_of(lines) == manifest.build_jobs(1)  # 다시 한 키가 없다
    assert Counter(x["status"] for x in lines) == {"ok": 16, "skipped_baseline_unavailable": 10}
    assert len(stub_calls(fake_env)) == 17  # 그림 16 + 특징 문장 1
    check = subprocess.run([sys.executable, "-m", "app.lab", "status", "--json"], cwd=BACKEND, env=os.environ,
                           capture_output=True, text=True, timeout=60)
    assert json.loads(check.stdout)["complete"] is True


def test_truncated_last_line_is_skipped(fake_env):
    path = manifest.path()
    path.parent.mkdir(parents=True)
    path.write_text('{"status": "ok", "arm": "G2", "condi', encoding="utf-8")

    assert main(["run", "--rounds", "1"]) == 0

    raw = path.read_text(encoding="utf-8").splitlines()
    assert raw[0] == '{"status": "ok", "arm": "G2", "condi' and len(raw) == 27
    assert keys_of(manifest.read()) == manifest.build_jobs(1)


def test_last_line_per_key_wins_and_failed_keys_are_retried(fake_env, monkeypatch, capsys):
    switch_mode_for(monkeypatch, fake_env, "gpt_char_photo", "failed")
    assert main(["run", "--rounds", "1"]) == 0
    status = status_json(capsys)
    assert status["complete"] is False and status["counts"]["error"] == 5 and status["counts"]["ok"] == 11
    calls = len(stub_calls(fake_env))

    monkeypatch.undo()
    fake_env.set(FAKE_CODEX_MODE="ok")
    assert main(["run", "--rounds", "1"]) == 0

    status = status_json(capsys)
    assert status["complete"] is True and status["counts"]["error"] == 0 and status["counts"]["ok"] == 16
    per_key = Counter(keys_of(manifest.read()))
    assert {k for k, n in per_key.items() if n == 2} == {k for k in per_key if k[0] == "G3"}
    assert len(stub_calls(fake_env)) == calls + 5  # G3 다섯 키만 다시 불렀다


def test_limit_rule_stops_with_exit_20(fake_env, capsys):
    fake_env.set(FAKE_CODEX_USED_PERCENT="96", FAKE_CODEX_RESETS_AT=FAR_RESET)

    assert main(["run", "--rounds", "1"]) == 20
    assert "KST" in capsys.readouterr().out
    assert len(stub_calls(fake_env)) == 1  # 기준 캐릭터 뒤 96%를 읽고 멈췄다
    assert main(["run", "--rounds", "1"]) == 20
    assert len(stub_calls(fake_env)) == 1

    status = status_json(capsys)
    assert status["complete"] is False and status["paused"] == "limit" and status["resets_at"] == FAR_RESET


def test_three_declines_in_a_row_skip_the_rest_of_g1(fake_env, monkeypatch):
    switch_mode_for(monkeypatch, fake_env, "gpt_photo", "declined")

    assert main(["run", "--rounds", "2"]) == 0

    g1 = [x for x in manifest.read() if x["arm"] == "G1"]
    assert [x["status"] for x in g1] == ["declined"] * 10
    assert [x["reason"] == "consecutive_declines" for x in g1] == [False] * 3 + [True] * 7
    assert sum(call["mode"] == "declined" for call in stub_calls(fake_env)) == 3


def test_verify_fails_on_a_duplicated_image_hash(fake_env, capsys):
    assert main(["verify"]) == 0  # 성공한 줄이 없으면 통과
    assert main(["run", "--rounds", "1"]) == 0
    assert main(["verify"]) == 0
    lines = manifest.read()
    capsys.readouterr()

    shutil.copyfile(lines[1]["image_path"], lines[2]["image_path"])

    assert main(["verify"]) == 1
    assert "G2 side r1" in capsys.readouterr().out
    assert main(["run", "--rounds", "1"]) == 21  # 회차 끝 확인도 같은 사유로 멈춘다
