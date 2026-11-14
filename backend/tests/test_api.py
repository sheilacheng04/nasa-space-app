import time
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.config import Settings
from backend.database import CachedResource, LoginSession, User
from backend.main import create_app
from backend.security import COOKIE, digest

HEADERS = {"X-Pacific-Request": "1"}
PASSWORD = "a-test-only-password-2026"
ROWS = [{"name": "Rice, north", "lat": 15.5, "lng": 120.9, "value": 0, "category": "mm", "date": "2026-11-01"}]


@pytest.fixture
def settings(tmp_path):
    return Settings(database_url="sqlite:///" + (tmp_path / "api.db").as_posix(), production=False, origin="", ai_enabled=False, ai_key="")


@pytest.fixture
def app(settings):
    return create_app(settings)


@pytest.fixture
def client(app):
    with TestClient(app, headers=HEADERS) as client:
        yield client


def register(client, username="test_user"):
    response = client.post("/api/auth/register", json={"username": username, "password": PASSWORD})
    assert response.status_code == 201, response.text
    return response.json()["user"]


def save(client):
    response = client.post("/api/datasets", json={"name": "Field trip", "observations": ROWS})
    assert response.status_code == 201, response.text
    return response.json()


def test_real_bootstrap_health_and_openapi(client):
    assert client.get("/api/health").json()["database"] == "sqlite"
    data = client.get("/api/bootstrap").json()
    assert len(data["sites"]) == 3
    assert len(data["news"]["items"]) > 0
    assert client.get("/api/data/observations/angat.json").json()["status"] == "pending"
    assert "/api/datasets" in client.get("/api/openapi.json").json()["paths"]


def test_anonymous_data_access_but_no_private_access(client):
    assert client.get("/api/auth/me").json() == {"user": None}
    assert client.get("/api/datasets").status_code == 401
    assert client.post("/api/datasets", json={"name": "Private", "observations": ROWS}).status_code == 401


def test_register_login_and_password_storage(client, app):
    user = register(client)
    cookie = client.cookies.get(COOKIE)
    with app.state.database.session() as db:
        stored = db.get(User, user["id"])
        assert stored.password_hash.startswith("$argon2id$")
        assert PASSWORD not in stored.password_hash
        assert db.get(LoginSession, digest(cookie)) is not None
        assert db.get(LoginSession, cookie) is None
    assert client.get("/api/auth/me").json()["user"] == user
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").json()["user"] is None
    wrong = client.post("/api/auth/login", json={"username": "test_user", "password": "not-the-right-password"})
    assert wrong.status_code == 401
    right = client.post("/api/auth/login", json={"username": "TEST_USER", "password": PASSWORD})
    assert right.status_code == 200
    assert "httponly" in right.headers["set-cookie"].lower()
    assert "samesite=lax" in right.headers["set-cookie"].lower()
    assert client.cookies.get(COOKIE) != cookie


def test_logout_and_expiry_revoke_sessions(client, app):
    register(client)
    token = client.cookies.get(COOKIE)
    client.post("/api/auth/logout")
    client.cookies.set(COOKIE, token, domain="testserver.local", path="/")
    assert client.get("/api/datasets").status_code == 401
    client.post("/api/auth/login", json={"username": "test_user", "password": PASSWORD})
    token = client.cookies.get(COOKIE)
    with app.state.database.session() as db:
        db.get(LoginSession, digest(token)).expires_at = int(time.time()) - 1
        db.commit()
    assert client.get("/api/datasets").status_code == 401


def test_datasets_survive_application_restart_and_roundtrip(client, settings):
    register(client)
    item = save(client)
    cookie = client.cookies.get(COOKIE)
    with TestClient(create_app(settings), headers=HEADERS) as restarted:
        restarted.cookies.set(COOKIE, cookie)
        loaded = restarted.get("/api/datasets/" + item["id"]).json()
        assert loaded["observations"] == ROWS
        assert restarted.get("/api/datasets").json()["datasets"][0]["id"] == item["id"]
        edited = restarted.put("/api/datasets/" + item["id"], json={"name": "Renamed", "observations": [{**ROWS[0], "value": None}]})
        assert edited.status_code == 200
        assert edited.json()["observations"][0]["value"] is None
        exported = restarted.get("/api/datasets/" + item["id"] + "/export.csv")
        assert exported.status_code == 200
        assert '"Rice, north"' in exported.text
        assert restarted.delete("/api/datasets/" + item["id"]).status_code == 204
        assert restarted.get("/api/datasets/" + item["id"]).status_code == 404


def test_accounts_cannot_access_each_others_datasets(client):
    register(client, "first_user")
    item = save(client)
    client.post("/api/auth/logout")
    register(client, "second_user")
    assert client.get("/api/datasets").json()["datasets"] == []
    path = "/api/datasets/" + item["id"]
    assert client.get(path).status_code == 404
    assert client.get(path + "/export.csv").status_code == 404
    assert client.put(path, json={"name": "Hijack", "observations": ROWS}).status_code == 404
    assert client.delete(path).status_code == 404


@pytest.mark.parametrize("patch_row", [{"lat": 91}, {"lng": -181}, {"lat": "15.5"}, {"value": "nan"}, {"lat": True}, {"name": ""}, {"category": "x" * 201}])
def test_invalid_rows_are_rejected_atomically(client, patch_row):
    register(client)
    result = client.post("/api/datasets", json={"name": "Invalid", "observations": [ROWS[0], {**ROWS[0], **patch_row}]})
    assert result.status_code == 422
    assert client.get("/api/datasets").json()["datasets"] == []


def test_row_and_request_limits(client):
    register(client)
    assert client.post("/api/datasets", json={"name": "Oversize", "observations": ROWS * 2001}).status_code == 422
    assert client.post("/api/datasets", content='{"padding":"' + "x" * 1_200_001 + '"}', headers={"content-type": "application/json"}).status_code == 413


def test_csrf_content_type_and_private_cache_headers(client):
    payload = {"username": "blocked_user", "password": PASSWORD}
    assert client.post("/api/auth/register", json=payload, headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.post("/api/auth/register", json=payload, headers={"X-Pacific-Request": ""}).status_code == 403
    assert client.post("/api/auth/register", content="username=x", headers={"content-type": "text/plain"}).status_code == 415
    assert client.get("/api/auth/me").headers["cache-control"] == "no-store"


def test_password_validation_never_echoes_password(client):
    response = client.post("/api/auth/register", json={"username": "valid_user", "password": "tiny-secret"})
    assert response.status_code == 422
    assert "tiny-secret" not in response.text


def test_duplicate_username_and_database_backed_rate_limit(client):
    register(client)
    assert client.post("/api/auth/register", json={"username": "TEST_USER", "password": PASSWORD}).status_code == 409
    for _ in range(10):
        assert client.post("/api/auth/login", json={"username": "unknown_user", "password": PASSWORD}).status_code == 401
    response = client.post("/api/auth/login", json={"username": "unknown_user", "password": PASSWORD})
    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0


def test_allowlist_blocks_arbitrary_files(client):
    for name in ["secrets.json", ".env", "browse/angat-catalog.json", "observations/unknown.json"]:
        assert client.get("/api/data/" + name).status_code == 404
    assert client.get("/api/weather/unknown").status_code == 404


def test_weather_failure_retains_real_snapshot(client):
    with patch("backend.services.httpx.Client.get", side_effect=httpx.ConnectError("offline")):
        response = client.request("GET", "/api/weather/angat")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "fallback"
    assert "Saved snapshot retained" in data["warning"]
    assert len(data["daily"]) > 0


def test_weather_cached_and_missing_values_preserved(client, app):
    external = httpx.Response(200, request=httpx.Request("GET", "https://archive-api.open-meteo.com/v1/archive"), json={"daily": {"time": ["2026-11-01", "2026-11-02"], "temperature_2m_mean": [None, 28.0], "precipitation_sum": [0, None]}})
    with patch("backend.services.httpx.Client.get", return_value=external) as provider:
        first = client.request("GET", "/api/weather/angat").json()
        second = client.request("GET", "/api/weather/angat").json()
        assert provider.call_count == 1
    assert first["daily"][0]["temperature"] is None
    assert first["daily"][0]["rain"] == 0
    assert second["cached"] is True
    with app.state.database.session() as db:
        assert db.get(CachedResource, "weather:angat") is not None


def test_ai_disabled_and_geocode_failure(client):
    assert client.post("/api/analyze", json={"text": "Climate headline"}).status_code == 503
    assert client.get("/api/geocode?q=ab").status_code == 422
    with patch("backend.services.httpx.Client.get", side_effect=httpx.ConnectError("offline")):
        assert client.request("GET", "/api/geocode?q=Angat").status_code == 502


def test_production_rejects_ephemeral_database():
    with pytest.raises(RuntimeError, match="PostgreSQL"):
        Settings(database_url="sqlite:///temporary.db", production=True, origin="https://example.com")
    with pytest.raises(RuntimeError, match="APP_ORIGIN"):
        Settings(database_url="postgresql://user:pass@localhost/pacific", production=True, origin="")
