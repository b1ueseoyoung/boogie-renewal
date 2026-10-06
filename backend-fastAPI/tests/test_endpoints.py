"""할 일 20: C-3 생성 엔드포인트. 대역(GEN_FAKE=1)과 codex 스텁만 쓴다."""
import asyncio
import io
import json

import pytest
from types import SimpleNamespace

from fastapi.testclient import TestClient
from PIL import Image

from app.api import generate
from app.gen import codex_runner
from app.gen.fake import fake_run_text
from app.main import app

BASE = "http://localhost:8000/files"
ENDING_QUESTION = "Ask one question to make the ending of the story."


@pytest.fixture
def client(fake_env):
    # 미리 생성은 끈다: 요청마다 생성 횟수를 정확히 센다. 미리 생성은 prefetch_client로 따로 검증한다
    fake_env.set(GEN_FAKE="1", CODEX_BIN="/nonexistent/codex", GEN_PREFETCH="0")
    generate._guard = None
    yield TestClient(app)
    generate._guard = None


@pytest.fixture
def prefetch_client(fake_env):
    """미리 생성을 켠다. with로 열어 요청 사이에도 이벤트 루프가 살아 있어야 미리 만든 작업이 돈다."""
    fake_env.set(GEN_FAKE="1", CODEX_BIN="/nonexistent/codex", GEN_PREFETCH="1")
    generate._guard = None
    generate._ahead.clear()
    with TestClient(app) as c:
        yield c
        c.portal.call(settle)
    generate._ahead.clear()
    generate._guard = None


async def settle():
    """띄운 미리 생성 작업이 모두 끝날 때까지 기다린다(버린 작업 포함)."""
    while generate._running:
        await asyncio.gather(*generate._running, return_exceptions=True)


def counting(monkeypatch, name):
    """generate.<name>(_content, _ending)을 부를 때마다 선택지를 적는다. 코루틴을 만드는 순간 세므로 순서가 정해진다."""
    real, seen = getattr(generate, name), []

    def spy(req, story, question, choice, *rest):
        seen.append(choice)
        return real(req, story, question, choice, *rest)

    monkeypatch.setattr(generate, name, spy)
    return seen


def lines(env, name):
    path = env.data_dir / "lab" / name
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()] if path.exists() else []


def upload(client):
    buf = io.BytesIO()
    Image.new("RGB", (300, 400), (200, 180, 160)).save(buf, "PNG")
    r = client.post("/files/upload", files={"file": ("p.png", buf.getvalue(), "image/png")})
    assert r.status_code == 200
    return r.json()["url"]


def prepare(client):
    """업로드, 캐릭터, 특징 문장까지. 이후 요청에 공통으로 들어가는 필드를 돌려준다."""
    photo = upload(client)
    r = client.post("/generate/character/", json={"imgUrl": photo})
    assert r.status_code == 200, r.text
    char = r.json()["s3_url"]
    r = client.post("/generate/feature-card/", json={"imgUrl": photo, "charImgUrl": char})
    assert r.status_code == 200, r.text
    return {"charName": "미나", "charLook": r.json()["charLook"], "imgUrl": photo, "charImgUrl": char}


def intro_body(common):
    return {**common, "genre": "magic", "place": "sea"}


def run_flow(client, common, story_id):
    """intro, content 4회, story. 응답 목록(intro, content 1~4, story)을 돌려준다."""
    r = client.post("/generate/intro/", json=intro_body(common))
    assert r.status_code == 200, r.text
    intro = r.json()
    stories, urls, question, options = [intro["intro"]], [intro["s3_url"]], intro["question"], intro["options"]
    responses = [intro]
    for page in (1, 2, 3, 4):
        r = client.post("/generate/content/", json={**common, "question": question, "choice": options[0],
                                                    "page": page, "story": stories})
        assert r.status_code == 200, r.text
        body = r.json()
        stories.append(body["story"])
        urls.append(body["s3_url"])
        question, options = body["question"], body["choices"]
        responses.append(body)
    r = client.post("/generate/story/", json={**common, "storyId": story_id, "question": question,
                                              "choice": options[0], "story": stories, "illustUrls": urls})
    assert r.status_code == 200, r.text
    responses.append(r.json())
    return responses


def test_full_flow_keeps_the_illustrations_made_on_the_way(client, fake_env):
    common = prepare(client)
    *scenes, done = run_flow(client, common, "story-1")
    intro = scenes[0]

    assert set(intro) == {"intro", "question", "options", "s3_url", "illustPrompt"}
    assert len(intro["options"]) == 3
    for body in scenes[1:]:
        assert set(body) == {"story", "question", "choices", "s3_url", "illustPrompt"}
        assert len(body["choices"]) == 3
    assert set(done) == {"contentUrl", "title", "summary", "coverImg", "ending"}
    assert set(done["ending"]) == {"story", "s3_url", "illustPrompt"}
    assert done["coverImg"] == intro["s3_url"]
    assert done["contentUrl"] == f"{BASE}/storybook/story-1/content.json"

    expected = [body["s3_url"] for body in scenes] + [done["ending"]["s3_url"]]
    assert len(set(expected)) == 6
    content = json.loads((fake_env.data_dir / "files" / "storybook" / "story-1" / "content.json").read_text("utf-8"))
    assert [set(item) for item in content] == [{"story", "illustUrl"}] * 6
    assert [item["illustUrl"] for item in content] == expected
    assert client.get(done["contentUrl"].replace(BASE, "/files")).json() == content
    for url in expected:
        got = client.get(url.replace(BASE, "/files"))
        assert got.status_code == 200 and got.content[:8] == b"\x89PNG\r\n\x1a\n"

    calls = lines(fake_env, "fake-calls.jsonl")
    pictures = [c for c in calls if c["kind"] == "image"]
    assert len(pictures) == 7  # 캐릭터 1 + 장면 6: 미리 생성을 끄면 완성 시 재생성도 없다
    character_path = str((fake_env.data_dir / "files").resolve()) + common["charImgUrl"][len(BASE):]
    for call in pictures[1:]:
        assert character_path in call["images"]
        assert common["charLook"] in call["prompt"]

    content_prompts = [c["prompt"] for c in calls if c["kind"] == "text" and c["schema_name"].endswith("content.json")]
    assert [ENDING_QUESTION in prompt for prompt in content_prompts] == [False, False, False, True]
    # 캐릭터 1 + 특징 문장 1 + 도입부 2 + 중간부 4x2 + 결말 글, 그림, 다듬기 3
    assert len(lines(fake_env, "gen-log.jsonl")) == 15


def test_replay_returns_the_first_story_picture_urls(client, fake_env, monkeypatch):
    """할 일 40: 캐시 적중은 처음 저장된 그림 주소를 그대로 돌려준다(새 이름으로 복사하지 않는다)."""
    # 대역은 중간부 네 쪽의 그림 글이 같아 장면 캐시 키가 하나로 겹친다. 실제 창작(261005EFNC)처럼 쪽마다 다르게 한다
    pages = iter(range(1, 5))

    def varied(prompt, images, schema_name):
        result = fake_run_text(prompt, images, schema_name)
        if schema_name.endswith("content.json"):
            result["text"]["illustration"] += f", page {next(pages)}"
        return result

    monkeypatch.setattr(codex_runner, "fake_run_text", varied)
    common = prepare(client)
    run_flow(client, common, "first")
    mark = len(lines(fake_env, "gen-log.jsonl"))
    fake_env.set(DEMO_REPLAY="1")
    character = client.post("/generate/character/", json={"imgUrl": common["imgUrl"]}).json()["s3_url"]
    run_flow(client, common, "replay")

    def pictures(story_id):
        path = fake_env.data_dir / "files" / "storybook" / story_id / "content.json"
        return [page["illustUrl"] for page in json.loads(path.read_text(encoding="utf-8"))]

    assert character == common["charImgUrl"]
    assert pictures("replay") == pictures("first") and len(set(pictures("first"))) == 6
    assert all(line["cached"] for line in lines(fake_env, "gen-log.jsonl")[mark:])


def test_intro_adds_exactly_two_log_lines(client, fake_env):
    common = prepare(client)
    before = len(lines(fake_env, "gen-log.jsonl"))
    assert client.post("/generate/intro/", json=intro_body(common)).status_code == 200
    added = lines(fake_env, "gen-log.jsonl")[before:]
    assert [line["kind"] for line in added] == ["text", "image"]


@pytest.mark.parametrize("error,code,retryable", [
    ("limit", 503, False), ("declined", 422, False), ("timeout", 504, True), ("no_image", 504, True),
])
def test_gen_fake_error_becomes_a_c2_response(client, fake_env, error, code, retryable):
    common = prepare(client)
    fake_env.set(GEN_FAKE_ERROR=error)
    requests = [
        ("/generate/character/", {"imgUrl": common["imgUrl"]}),
        ("/generate/feature-card/", {"imgUrl": common["imgUrl"], "charImgUrl": common["charImgUrl"]}),
        ("/generate/intro/", intro_body(common)),
        ("/generate/content/", {**common, "question": "q", "choice": "c", "page": 1, "story": ["a"]}),
        ("/generate/story/", {**common, "storyId": "s1", "question": "q", "choice": "c", "story": ["a"] * 5,
                              "illustUrls": [common["charImgUrl"]] * 5}),
    ]
    for path, body in requests:
        r = client.post(path, json=body)
        assert r.status_code == code, (path, r.text)
        answer = r.json()
        assert set(answer) == {"errorClass", "message", "retryable", "resetsAt"}
        assert (answer["errorClass"], answer["retryable"]) == (error, retryable)
        assert answer["message"]
        assert (answer["resetsAt"] is not None) == (error == "limit")
        assert f'"retryable":{str(retryable).lower()}' in r.text.replace(" ", "")
    assert not (fake_env.data_dir / "files" / "storybook").exists()


def test_debug_fake_error_hits_only_the_next_generation(client, fake_env):
    common = prepare(client)
    body = intro_body(common)
    assert client.post("/debug/fake-error", json={"error": "limit", "times": 1}).json() == {"ok": True}
    assert client.post("/generate/intro/", json=body).status_code == 503
    assert client.post("/generate/intro/", json=body).status_code == 200

    assert client.post("/debug/fake-error", json={"error": "timeout", "times": 1}).status_code == 200
    r = client.post("/generate/intro/", json=body)
    assert r.status_code == 504 and r.json()["retryable"] is True
    assert client.post("/generate/intro/", json=body).status_code == 200

    assert client.post("/debug/fake-error", json={"error": "bogus", "times": 1}).status_code == 422
    assert client.post("/debug/fake-error", json={"error": "limit", "times": -1}).status_code == 422


def test_debug_fake_error_is_404_in_real_mode(client, fake_env):
    fake_env.set(GEN_FAKE="0")
    assert client.post("/debug/fake-error", json={"error": "limit", "times": 1}).status_code == 404
    fake_env.set(GEN_FAKE="1")
    assert client.post("/generate/intro/", json=intro_body(prepare(client))).status_code == 200


def test_bad_page_and_foreign_or_escaping_urls_are_rejected(client, fake_env):
    common = prepare(client)
    content = {**common, "question": "q", "choice": "c", "page": 1, "story": ["a"]}
    before = len(lines(fake_env, "fake-calls.jsonl"))
    assert client.post("/generate/content/", json={**content, "page": 7}).status_code == 422
    assert client.post("/generate/content/", json={**content, "page": 0}).status_code == 422
    for field in ("imgUrl", "charImgUrl"):
        for bad in ("http://evil.example/x.png", f"{BASE}/../../../etc/passwd", f"{BASE}/uploads/../../photos/synthetic.jpg",
                    f"{BASE}/uploads/missing.png"):
            r = client.post("/generate/content/", json={**content, field: bad})
            assert r.status_code == 400, (field, bad, r.text)
            assert r.json()["retryable"] is False
    finish = {**common, "storyId": "s1", "question": "q", "choice": "c", "story": ["a"] * 5,
              "illustUrls": [common["charImgUrl"]] * 5}
    assert client.post("/generate/story/", json={**finish, "illustUrls": ["http://evil.example/x.png"] * 5}).status_code == 400
    assert client.post("/generate/story/", json={**finish, "illustUrls": finish["illustUrls"][:4]}).status_code == 422
    assert client.post("/generate/story/", json={**finish, "storyId": "../../escape"}).status_code == 422
    assert client.post("/generate/character/", json={"imgUrl": "http://evil.example/x.png"}).status_code == 400
    assert len(lines(fake_env, "fake-calls.jsonl")) == before  # 거절된 요청은 생성을 부르지 않는다


def test_two_interleaved_flows_do_not_mix(client, fake_env):
    a = {**prepare(client), "charName": "가람"}
    b = {**prepare(client), "charName": "나래"}
    state = {}
    for key, common in (("a", a), ("b", b)):
        body = client.post("/generate/intro/", json=intro_body(common)).json()
        state[key] = {"stories": [f"{key}-0"], "urls": [body["s3_url"]]}
    for page in (1, 2, 3, 4):
        for key, common in (("a", a), ("b", b)):
            s = state[key]
            body = client.post("/generate/content/", json={**common, "question": f"{key}-q", "choice": f"{key}-c",
                                                           "page": page, "story": s["stories"]}).json()
            s["stories"].append(f"{key}-{page}")
            s["urls"].append(body["s3_url"])
    for key, common in (("a", a), ("b", b)):
        s = state[key]
        done = client.post("/generate/story/", json={**common, "storyId": f"id-{key}", "question": f"{key}-q",
                                                     "choice": f"{key}-c", "story": s["stories"],
                                                     "illustUrls": s["urls"]}).json()
        s["urls"].append(done["ending"]["s3_url"])
    assert not set(state["a"]["urls"]) & set(state["b"]["urls"])
    for key in ("a", "b"):
        content = json.loads((fake_env.data_dir / "files" / "storybook" / f"id-{key}" / "content.json").read_text("utf-8"))
        assert [item["illustUrl"] for item in content] == state[key]["urls"]
    texts = [c["prompt"] for c in lines(fake_env, "fake-calls.jsonl")
             if c["kind"] == "text" and c["schema_name"].endswith(("content.json", "ending.json", "refine.json"))]
    assert len(texts) == 12
    names = {"a": "가람", "b": "나래"}
    for prompt in texts:
        mine, other = ("a", "b") if "a-0" in prompt else ("b", "a")
        assert f"{mine}-0" in prompt
        assert f"{other}-" not in prompt and names[other] not in prompt


def test_names_and_choices_pass_through_as_data(client, fake_env):
    common = {**prepare(client), "charName": '미{나}"\n{charName} {0}'}
    choice = '{choice}\n"따옴표" \\ %s {scene}'
    assert client.post("/generate/intro/", json=intro_body(common)).status_code == 200
    r = client.post("/generate/content/", json={**common, "question": "{question}?", "choice": choice, "page": 1,
                                                "story": ["{story} 첫 장면"]})
    assert r.status_code == 200, r.text
    prompt = [c["prompt"] for c in lines(fake_env, "fake-calls.jsonl") if c["kind"] == "text"][-1]
    for literal in (common["charName"], choice, "{question}?", "{story} 첫 장면"):
        assert literal in prompt


def test_baseline_repaired_uses_the_photo_and_the_baseline_prompts(client, fake_env):
    common = prepare(client)
    fake_env.set(GEN_METHOD="baseline_repaired")
    before = len(lines(fake_env, "fake-calls.jsonl"))
    assert client.post("/generate/character/", json={"imgUrl": common["imgUrl"]}).status_code == 200
    intro = client.post("/generate/intro/", json=intro_body(common))
    assert intro.status_code == 200, intro.text
    portrait, _, scene = lines(fake_env, "fake-calls.jsonl")[before:]
    assert portrait["prompt"] == ("portrait of the character, waist-up, facing the viewer, gentle smile, "
                                  "plain light background")
    assert scene["prompt"] == f"{intro.json()['illustPrompt']} {common['charLook']}"
    photo_path = str((fake_env.data_dir / "files").resolve()) + common["imgUrl"][len(BASE):]
    assert portrait["images"] == [photo_path] and scene["images"] == [photo_path]
    assert [line["method"] for line in lines(fake_env, "gen-log.jsonl")[-3:]] == [
        "baseline_repaired", "baseline_repaired", "baseline_repaired"]


def test_only_the_planned_routes_exist(client):
    paths = set(app.openapi()["paths"])
    assert {"/generate/character/", "/generate/feature-card/", "/generate/intro/", "/generate/content/",
            "/generate/story/", "/debug/fake-error"} <= paths
    assert not {"/generate/sticker/", "/test/"} & paths


def stub_calls(env):
    path = env.codex_home / "calls.jsonl"
    return len(path.read_text().splitlines()) if path.exists() else 0


def limit_line(used):
    return json.dumps({"cached": False, "limit": {"used_percent_before": None, "used_percent_after": used,
                                                  "resets_at": 1791255029}}) + "\n"


def test_real_mode_stops_before_generating_once_the_demo_cap_is_used(client, fake_env):
    common = prepare(client)
    fake_env.set(GEN_FAKE="0", CODEX_BIN=fake_env.fake_codex)
    log = fake_env.data_dir / "lab" / "gen-log.jsonl"
    with log.open("a") as f:
        f.write(limit_line(50.0))
    card = {"imgUrl": common["imgUrl"], "charImgUrl": common["charImgUrl"]}
    assert client.post("/generate/feature-card/", json=card).status_code == 200  # 시작값 50
    called = stub_calls(fake_env)
    assert called == 1
    with log.open("a") as f:
        f.write(limit_line(59.9))
    assert client.post("/generate/feature-card/", json=card).status_code == 200
    with log.open("a") as f:
        f.write(limit_line(60.0))
    r = client.post("/generate/feature-card/", json=card)
    assert r.status_code == 503
    assert r.json() == {"errorClass": "limit", "message": r.json()["message"], "retryable": False,
                        "resetsAt": 1791255029}
    assert stub_calls(fake_env) == called + 1


def test_real_limit_result_is_a_503(client, fake_env):
    common = prepare(client)
    fake_env.set(GEN_FAKE="0", CODEX_BIN=fake_env.fake_codex, FAKE_CODEX_MODE="limit")
    r = client.post("/generate/feature-card/", json={"imgUrl": common["imgUrl"], "charImgUrl": common["charImgUrl"]})
    assert r.status_code == 503 and r.json()["errorClass"] == "limit"


def test_limit_guard_counts_from_the_value_read_at_server_start(fake_env):
    fake_env.set(GEN_FAKE="0", CODEX_BIN=fake_env.fake_codex)
    log = fake_env.data_dir / "lab" / "gen-log.jsonl"
    log.parent.mkdir(parents=True)
    log.write_text(limit_line(50.0))
    generate._guard = None
    try:
        with TestClient(app) as started:  # 컨텍스트에 들어가면 서버 시작(lifespan)을 거친다
            photo = upload(started)
            with log.open("a") as f:
                f.write(limit_line(60.0))  # 시작 뒤 DEMO_CAP_POINTS(10)만큼 올랐다
            r = started.post("/generate/feature-card/", json={"imgUrl": photo, "charImgUrl": photo})
            assert r.status_code == 503, r.text
            assert (r.json()["errorClass"], r.json()["resetsAt"]) == ("limit", 1791255029)
            assert stub_calls(fake_env) == 0
    finally:
        generate._guard = None


def test_story_makes_no_picture_when_the_refine_text_job_fails(client, fake_env, monkeypatch):
    common = prepare(client)

    async def refine_times_out(paragraphs, **kwargs):
        return {"status": "timeout", "text": {}, "limit": {"used_percent_before": None, "used_percent_after": None,
                                                           "resets_at": None}}

    monkeypatch.setattr("app.gen.text.refine_story", refine_times_out)
    before = lines(fake_env, "fake-calls.jsonl")
    r = client.post("/generate/story/", json={**common, "storyId": "s1", "question": "q", "choice": "c",
                                              "story": ["a"] * 5, "illustUrls": [common["charImgUrl"]] * 5})
    assert r.status_code == 504, r.text
    assert r.json() == {"errorClass": "timeout", "message": r.json()["message"], "retryable": True, "resetsAt": None}
    added = lines(fake_env, "fake-calls.jsonl")[len(before):]
    assert [c["kind"] for c in added] == ["text"]  # 결말 글만 불렸다: 그림 호출이 없다
    assert added[0]["schema_name"].endswith("ending.json")
    assert not (fake_env.data_dir / "files" / "storybook").exists()


def test_choice_gets_the_scene_made_ahead_for_it(prefetch_client, fake_env, monkeypatch):
    client = prefetch_client
    common = prepare(client)
    made = counting(monkeypatch, "_content")
    intro = client.post("/generate/intro/", json=intro_body(common)).json()
    assert made == intro["options"]  # 도입부를 돌려줄 때 선택지 셋의 다음 장면을 모두 띄웠다

    pick = intro["options"][1]
    task = generate._ahead[generate._ahead_key("content", SimpleNamespace(**common), [intro["intro"]],
                                               intro["question"], pick)]
    ahead = client.portal.call(result_of, task)
    r = client.post("/generate/content/", json={**common, "question": intro["question"], "choice": pick,
                                                "page": 1, "story": [intro["intro"]]})
    assert r.status_code == 200, r.text
    assert r.json() == ahead  # 고른 선택지는 미리 만든 결과를 그대로 받는다
    assert made == intro["options"] + r.json()["choices"]  # 요청에서 새로 만들지 않고 다음 묶음만 띄웠다


def test_full_flow_with_prefetch_uses_the_ending_made_ahead(prefetch_client, fake_env, monkeypatch):
    client = prefetch_client
    common = prepare(client)
    endings = counting(monkeypatch, "_ending")
    *scenes, done = run_flow(client, common, "ahead")
    assert endings == scenes[-1]["choices"]  # 4장을 돌려줄 때 결말 셋을 띄웠고, 완성 요청은 새로 만들지 않았다
    content = json.loads((fake_env.data_dir / "files" / "storybook" / "ahead" / "content.json").read_text("utf-8"))
    assert [item["illustUrl"] for item in content] == [b["s3_url"] for b in scenes] + [done["ending"]["s3_url"]]
    assert set(done["ending"]) == {"story", "s3_url", "illustPrompt"}


def test_failed_prefetch_is_returned_once_then_the_retry_generates(prefetch_client, fake_env):
    client = prefetch_client
    common = prepare(client)
    intro = client.post("/generate/intro/", json=intro_body(common)).json()
    client.portal.call(settle)
    pick = intro["options"][0]
    key = generate._ahead_key("content", SimpleNamespace(**common), [intro["intro"]], intro["question"], pick)
    generate._ahead[key] = client.portal.call(fail_with_timeout)
    body = {**common, "question": intro["question"], "choice": pick, "page": 1, "story": [intro["intro"]]}
    first = client.post("/generate/content/", json=body)
    assert (first.status_code, first.json()["errorClass"]) == (504, "timeout")
    again = client.post("/generate/content/", json=body)
    assert again.status_code == 200, again.text


async def result_of(task):
    return await asyncio.wait_for(asyncio.shield(task), 10)


async def fail_with_timeout():
    async def boom():
        raise generate.Failure("timeout")

    task = asyncio.create_task(boom())
    await asyncio.gather(task, return_exceptions=True)
    return task
