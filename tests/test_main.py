import pytest
from fastapi.testclient import TestClient


class TestMainEndpoints:
    def test_healthz(self, client: TestClient):
        response = client.get("/healthz")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_root(self, client: TestClient):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "GameVerse Developer Portal"
        assert data["version"] == "N1.47"
        assert "endpoints" in data
        assert "auth" in data["endpoints"]
        assert "api_keys" in data["endpoints"]
        assert "webhooks" in data["endpoints"]
        assert "sandbox" in data["endpoints"]
        assert "analytics" in data["endpoints"]
        assert "sdks" in data["endpoints"]
        assert "documentation" in data["endpoints"]

    def test_openapi_docs(self, client: TestClient):
        response = client.get("/docs")
        assert response.status_code == 200

    def test_openapi_json(self, client: TestClient):
        response = client.get("/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert data["info"]["title"] == "GameVerse Developer Portal API"
        assert data["info"]["version"] == "1.47.0"
