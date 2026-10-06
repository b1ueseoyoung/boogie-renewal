"""할 일 19: 검토 API와 블라인드 과제. C-3, C-7 참조."""
import json
import re
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.lab import review
from app.main import app

sys.path.insert(0, str(Path(__file__).parent / "fixtures"))
import make_lab_fixture  # noqa: E402

LEAKS = ["B0", "B1", "G1", "G2", "G3", "BASE", "baseline", "gpt", "-r1", "-r2", "-r3", "files/lab", "photo_path",
         "image_path", "candidate-1", "synthetic", ".png", ".jpg"]
IMAGE_URL = re.compile(r"^/lab/api/image/[0-9a-f]{12}/\d+$")


@pytest.fixture
def lab(fake_env):
    make_lab_fixture.make(fake_env.data_dir)
    return fake_env


def _tasks(client, reviewer="서영"):
    r = client.get("/lab/api/tasks", params={"reviewer": reviewer})
    assert r.status_code == 200
    return r.json()


def _assert_blind(response, data_dir):
    text = response.text if "image" not in response.headers.get("content-type", "") else ""
    haystack = text + "\n" + "\n".join(f"{k}: {v}" for k, v in response.headers.items())
    for word in LEAKS + [str(data_dir)]:
        assert word not in haystack, f"{word!r} leaked in {response.request.method} {response.request.url}"
    assert str(data_dir).encode() not in response.content


def _review(client, **over):
    body = {"reviewer": "서영", "score": 4, "usable": True, "tags": []} | over
    return client.post("/lab/api/reviews", json=body)


def test_task_counts_and_shape(lab):
    tasks = _tasks(TestClient(app))
    # 그림 50 + 기준 캐릭터 1 = resemblance 51, (비교군 5 x 회차 2) = consistency 10
    assert sorted(t["type"] for t in tasks).count("resemblance") == 51
    assert sum(t["type"] == "consistency" for t in tasks) == 10
    for t in tasks:
        assert set(t) == {"taskId", "type", "photoUrl", "imageUrls", "captions"}
        assert re.fullmatch(r"[0-9a-f]{12}", t["taskId"])
        assert len(t["imageUrls"]) == len(t["captions"]) == (5 if t["type"] == "consistency" else 1)
        for url in t["imageUrls"]:
            assert IMAGE_URL.match(url) and url.startswith(f"/lab/api/image/{t['taskId']}/")
        if t["type"] == "resemblance":
            assert t["photoUrl"] == f"/lab/api/image/{t['taskId']}/0"
    assert len({t["taskId"] for t in tasks}) == 61


def test_tasks_response_hides_arm_round_and_paths_but_shows_korean_captions(lab):
    r = TestClient(app).get("/lab/api/tasks", params={"reviewer": "서영"})
    for word in ["B0", "B1", "G1", "G2", "G3", "baseline", "gpt", "-r1", "-r2", "-r3"]:
        assert word not in r.text
    _assert_blind(r, lab.data_dir)
    captions = {c for t in r.json() for c in t["captions"]}
    assert "강가 길을 걷는 옆모습" in captions
    assert "큰 우산 아래 노란 비옷과 초록 장화 차림(평소 옷과 다름)" in captions
    assert "기준 캐릭터" in captions
    assert len(captions) == 6


def test_consistency_captions_follow_condition_order(lab):
    task = next(t for t in _tasks(TestClient(app)) if t["type"] == "consistency")
    assert task["captions"] == [c["caption_ko"] for c in make_lab_fixture.PROTOCOL["conditions"]]


def test_same_name_same_order_other_name_other_order(lab):
    client = TestClient(app)
    a1 = [t["taskId"] for t in _tasks(client, "서영")]
    a2 = [t["taskId"] for t in _tasks(client, "서영")]
    b = [t["taskId"] for t in _tasks(client, "동료")]
    assert len(a1) >= 10
    assert a1 == a2
    assert a1 != b and sorted(a1) == sorted(b)


def test_score_6_is_422_and_other_malformed_input(lab):
    client = TestClient(app)
    task_id = _tasks(client)[0]["taskId"]
    assert _review(client, taskId=task_id, score=6).status_code == 422
    assert _review(client, taskId=task_id, score=0).status_code == 422
    assert _review(client, taskId=task_id, tags=["made_up_tag"]).status_code == 422
    assert _review(client, taskId=task_id, reviewer="").status_code == 422
    assert _review(client, taskId=task_id, reviewer="  \n").status_code == 422
    assert _review(client, taskId="zzzzzzzzzzzz").status_code == 404
    assert client.get("/lab/api/tasks").status_code == 422
    assert client.get("/lab/api/tasks", params={"reviewer": ""}).status_code == 422
    assert not (lab.data_dir / "lab" / "reviews.jsonl").exists()


def test_review_is_appended_in_c7_format_and_last_one_wins(lab):
    client = TestClient(app)
    tasks = _tasks(client)
    first = next(t for t in tasks if t["type"] == "resemblance")
    internal = {t["taskId"]: t for t in review.build_tasks()}
    assert client.get("/lab/api/progress", params={"reviewer": "서영"}).json() == {"done": 0, "total": 61}

    assert _review(client, taskId=first["taskId"], score=2, usable=False, tags=["hair_drift", "other"]).status_code == 200
    assert _review(client, taskId=first["taskId"], score=5, usable=True, tags=[]).status_code == 200
    assert _review(client, taskId=tasks[1]["taskId"], reviewer="동료", score=3).status_code == 200

    lines = [json.loads(x) for x in (lab.data_dir / "lab" / "reviews.jsonl").read_text(encoding="utf-8").splitlines()]
    assert len(lines) == 3
    assert list(lines[0]) == ["reviewer", "taskId", "key", "type", "score", "usable", "tags", "at"]
    assert lines[0] | {"at": ""} == {
        "reviewer": "서영", "taskId": first["taskId"], "key": internal[first["taskId"]]["key"],
        "type": "resemblance", "score": 2, "usable": False, "tags": ["hair_drift", "other"], "at": "",
    }
    # 같은 검토자와 과제의 마지막 기록이 유효하다: 두 번 평가해도 완료는 1이고 마지막 점수는 5다
    assert client.get("/lab/api/progress", params={"reviewer": "서영"}).json() == {"done": 1, "total": 61}
    assert client.get("/lab/api/progress", params={"reviewer": "동료"}).json() == {"done": 1, "total": 61}
    mine = [x for x in lines if x["reviewer"] == "서영" and x["taskId"] == first["taskId"]]
    assert mine[-1]["score"] == 5 and mine[-1]["usable"] is True


def test_image_urls_serve_png_and_unknown_ids_are_404(lab):
    client = TestClient(app)
    tasks = _tasks(client)
    for task in (tasks[0], next(t for t in tasks if t["type"] == "consistency")):
        for url in task["imageUrls"]:
            r = client.get(url)
            assert r.status_code == 200
            assert r.headers["content-type"] == "image/png"
            assert r.content.startswith(b"\x89PNG\r\n\x1a\n")
    photo = client.get(next(t for t in tasks if t["photoUrl"])["photoUrl"])
    assert photo.status_code == 200 and photo.content == lab.photo.read_bytes()
    task_id = tasks[0]["taskId"]
    assert client.get("/lab/api/image/zzzzzzzzzzzz/1").status_code == 404
    assert client.get(f"/lab/api/image/{task_id}/9").status_code == 404
    assert client.get(f"/lab/api/image/{task_id}/-1").status_code in (404, 422)


def test_no_consistency_task_when_a_group_has_only_four_conditions(lab):
    manifest = lab.data_dir / "lab" / "manifest.jsonl"
    lines = [json.loads(x) for x in manifest.read_text(encoding="utf-8").splitlines()]
    kept = []
    for x in lines:
        if (x["arm"], x["round"], x["condition"]) == ("G2", 2, "side"):
            continue  # 줄이 없는 경우
        if (x["arm"], x["round"], x["condition"]) == ("B1", 1, "outfit"):
            x = x | {"status": "declined", "image_path": None}  # 줄은 있지만 성공이 아닌 경우
        kept.append(x)
    manifest.write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in kept), encoding="utf-8")

    tasks = review.build_tasks()
    groups = {(t["arm"], t["round"]) for t in tasks if t["type"] == "consistency"}
    assert len(groups) == 8
    assert ("G2", 2) not in groups and ("B1", 1) not in groups
    assert sum(t["type"] == "resemblance" for t in tasks) == 49


def test_build_tasks_exposes_ids_keys_and_paths_for_the_report(lab):
    tasks = review.build_tasks()
    base = [t for t in tasks if t["arm"] == "BASE"]
    assert len(base) == 1 and base[0]["type"] == "resemblance"
    assert base[0]["image_paths"][0].endswith("candidate-1.png")
    assert base[0]["photo_path"] == str(lab.photo)
    assert base[0]["captions"] == ["기준 캐릭터"]
    assert len({t["key"] for t in tasks}) == len(tasks) == 61
    served = {t["taskId"] for t in _tasks(TestClient(app))}
    assert {t["taskId"] for t in tasks} == served


def test_secret_is_created_once_and_ids_survive_restart_and_appends(lab):
    secret = lab.data_dir / "lab" / "blind_secret"
    assert not secret.exists()
    before = {t["key"]: t["taskId"] for t in review.build_tasks()}
    value = secret.read_bytes()
    assert len(value) == 32

    manifest = lab.data_dir / "lab" / "manifest.jsonl"
    extra = json.loads(manifest.read_text(encoding="utf-8").splitlines()[-1]) | {"round": 3}
    with manifest.open("a", encoding="utf-8") as f:
        f.write(json.dumps(extra) + "\n")
        f.write("{broken line\n")
    after = {t["key"]: t["taskId"] for t in review.build_tasks()}
    assert secret.read_bytes() == value
    assert len(after) == len(before) + 1
    assert all(after[k] == v for k, v in before.items())

    # 비밀값이 다르면 과제 ID도 달라진다(키만으로는 ID를 맞힐 수 없다)
    secret.write_bytes(bytes(32))
    assert not set(before.values()) & {t["taskId"] for t in review.build_tasks()}


def test_secret_appears_atomically_with_all_32_bytes_and_is_never_replaced(lab, monkeypatch):
    lab_dir = lab.data_dir / "lab"
    secret = lab_dir / "blind_secret"
    before = set(lab_dir.iterdir())
    real_urandom = review.os.urandom
    rival = bytes(range(32))
    race = {"on": False}

    def probe(n):
        # 비밀값을 만드는 동안 다른 요청이 보는 파일은 없거나 32바이트 전부여야 한다(빈 파일이나 일부는 안 된다)
        assert not secret.exists() or len(secret.read_bytes()) == 32
        if race["on"] and not secret.exists():
            secret.write_bytes(rival)  # 다른 요청이 먼저 공개한 비밀값
        return real_urandom(n)

    monkeypatch.setattr(review.os, "urandom", probe)
    value = review._secret(lab_dir)
    assert len(value) == 32 and secret.read_bytes() == value
    assert review._secret(lab_dir) == value
    assert set(lab_dir.iterdir()) == before | {secret}  # 임시 파일이 남지 않는다

    # 만드는 도중에 다른 요청이 먼저 공개했으면 그 값을 바이트 그대로 지킨다
    secret.unlink()
    race["on"] = True
    assert review._secret(lab_dir) == rival
    assert secret.read_bytes() == rival
    assert set(lab_dir.iterdir()) == before | {secret}


def test_reviewer_name_is_untrusted_text(lab):
    client = TestClient(app)
    evil = '서영"\n{"reviewer":"x","score":5}\r\n\u2028G2-r1'
    tasks = client.get("/lab/api/tasks", params={"reviewer": evil})
    assert tasks.status_code == 200
    assert "서영" not in tasks.text and "reviewer" not in tasks.text
    task_id = tasks.json()[0]["taskId"]
    assert _review(client, taskId=task_id, reviewer=evil).status_code == 200
    raw = (lab.data_dir / "lab" / "reviews.jsonl").read_text(encoding="utf-8")
    assert raw.endswith("\n") and len(raw.splitlines()) == 1
    assert json.loads(raw)["reviewer"] == evil
    assert client.get("/lab/api/progress", params={"reviewer": evil}).json()["done"] == 1


def test_no_review_endpoint_leaks_arm_round_or_paths(lab):
    client = TestClient(app)
    tasks = _tasks(client)
    task = next(t for t in tasks if t["type"] == "consistency")
    responses = [
        client.get("/lab/api/tasks", params={"reviewer": "서영"}),
        client.get("/lab/api/tasks"),
        client.get("/lab/api/progress", params={"reviewer": "서영"}),
        client.get(task["photoUrl"] or f"/lab/api/image/{task['taskId']}/0"),
        *[client.get(u) for u in task["imageUrls"]],
        client.get("/lab/api/image/zzzzzzzzzzzz/1"),
        client.get(f"/lab/api/image/{task['taskId']}/9"),
        _review(client, taskId=task["taskId"]),
        _review(client, taskId=task["taskId"], score=6),
        _review(client, taskId=task["taskId"], tags=["nope"]),
        _review(client, taskId="zzzzzzzzzzzz"),
        client.get("/lab/review"),
        client.get("/lab/static/nope.js"),
        client.get("/lab/report"),
    ]
    for r in responses:
        _assert_blind(r, lab.data_dir)


def test_static_pages_are_served_or_404(lab, tmp_path, monkeypatch):
    client = TestClient(app)
    for path in ["/lab/review", "/lab/static/review.js", "/lab/static/review.html", "/lab/report"]:
        assert path.replace("review.js", "{name}").replace("review.html", "{name}") in app.openapi()["paths"]
    assert client.get("/lab/report").status_code == 404
    assert client.get("/lab/static/..").status_code == 404
    assert client.get("/lab/static/%2e%2e%2freview.py").status_code == 404

    report = lab.data_dir / "lab" / "report" / "index.html"
    report.parent.mkdir(parents=True)
    report.write_text("<h1>리포트</h1>", encoding="utf-8")
    r = client.get("/lab/report")
    assert r.status_code == 200 and "리포트" in r.text and r.headers["content-type"].startswith("text/html")

    static = tmp_path / "static"
    static.mkdir()
    (static / "review.html").write_text("<h1>검토</h1>", encoding="utf-8")
    (static / "review.js").write_text("// js", encoding="utf-8")
    monkeypatch.setattr(review, "STATIC_DIR", static)
    assert "검토" in client.get("/lab/review").text
    assert client.get("/lab/static/review.js").status_code == 200
    assert client.get("/lab/static/missing.css").status_code == 404
    static.joinpath("review.html").unlink()
    assert client.get("/lab/review").status_code == 404


def test_fixture_cli_writes_manifest_and_reviews(tmp_path):
    out = tmp_path / "cli-data"
    script = Path(make_lab_fixture.__file__)
    done = subprocess.run(
        [sys.executable, str(script), str(out), "--reviews", "3"],
        capture_output=True, text=True, cwd=script.parents[2], env={"ENV_FILE": "", "PATH": ""},
    )
    assert done.returncode == 0, done.stderr
    lines = [json.loads(x) for x in (out / "lab" / "manifest.jsonl").read_text(encoding="utf-8").splitlines()]
    assert len(lines) == 51
    assert {x["arm"] for x in lines} == {"BASE", "B0", "B1", "G1", "G2", "G3"}
    assert {x["round"] for x in lines if x["arm"] != "BASE"} == {1, 2}
    for x in lines:
        assert {"status", "kind", "method", "image_path", "attempts", "limit", "photo_id", "photo_path", "arm",
                "condition", "round"} <= set(x)
        assert Path(x["image_path"]).is_file() and Path(x["photo_path"]).is_file()
    reviews = [json.loads(x) for x in (out / "lab" / "reviews.jsonl").read_text(encoding="utf-8").splitlines()]
    assert len(reviews) == 3 * 61
    assert {x["reviewer"] for x in reviews} == {"reviewer1", "reviewer2", "reviewer3"}
    assert all(1 <= x["score"] <= 5 for x in reviews)
