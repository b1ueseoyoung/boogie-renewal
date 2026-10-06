from fastapi.testclient import TestClient

from app.main import app


def test_health_reports_mode_method_replay(fake_env):
    client = TestClient(app)
    assert client.get("/health").json() == {"ok": True, "mode": "real", "method": "gpt_char", "replay": "0"}
    fake_env.set(GEN_FAKE="1", GEN_METHOD="gpt_photo", DEMO_REPLAY="prefer")
    assert client.get("/health").json() == {"ok": True, "mode": "fake", "method": "gpt_photo", "replay": "prefer"}


def test_health_is_served_and_listed_in_openapi(fake_env):
    assert "/health" in app.openapi()["paths"]
    assert TestClient(app).get("/health").status_code == 200
