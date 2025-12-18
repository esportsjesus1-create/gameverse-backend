import pytest
from fastapi.testclient import TestClient


class TestRateLimitingEndpoints:
    def test_get_rate_limit_dashboard_empty(self, client: TestClient, auth_headers):
        response = client.get(
            "/api/v1/dev-portal/rate-limiting/dashboard",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_get_rate_limit_dashboard_with_keys(self, client: TestClient, auth_headers):
        client.post(
            "/api/v1/dev-portal/api-keys/",
            headers=auth_headers,
            json={"name": "Dashboard Test Key"}
        )
        
        response = client.get(
            "/api/v1/dev-portal/rate-limiting/dashboard",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert "api_key_name" in data[0]
        assert "minute_limit" in data[0]
        assert "day_limit" in data[0]

    def test_simulate_rate_limit_usage(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/api-keys/",
            headers=auth_headers,
            json={"name": "Simulate Test Key"}
        )
        key_id = create_response.json()["id"]
        
        response = client.post(
            "/api/v1/dev-portal/rate-limiting/simulate",
            headers=auth_headers,
            params={
                "api_key_id": key_id,
                "endpoint": "/api/v1/games",
                "requests_count": 10
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["requests_added"] == 10

    def test_get_rate_limit_logs(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/api-keys/",
            headers=auth_headers,
            json={"name": "Logs Test Key"}
        )
        key_id = create_response.json()["id"]
        
        client.post(
            "/api/v1/dev-portal/rate-limiting/simulate",
            headers=auth_headers,
            params={
                "api_key_id": key_id,
                "endpoint": "/api/v1/games",
                "requests_count": 5
            }
        )
        
        response = client.get(
            f"/api/v1/dev-portal/rate-limiting/logs/{key_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_rate_limit_logs_not_found(self, client: TestClient, auth_headers):
        response = client.get(
            "/api/v1/dev-portal/rate-limiting/logs/99999",
            headers=auth_headers
        )
        assert response.status_code == 404

    def test_get_exceeded_limits(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/api-keys/",
            headers=auth_headers,
            json={"name": "Exceeded Test Key"}
        )
        key_id = create_response.json()["id"]
        
        client.post(
            "/api/v1/dev-portal/rate-limiting/simulate",
            headers=auth_headers,
            params={
                "api_key_id": key_id,
                "endpoint": "/api/v1/games",
                "requests_count": 1000
            }
        )
        
        response = client.get(
            f"/api/v1/dev-portal/rate-limiting/exceeded/{key_id}",
            headers=auth_headers
        )
        assert response.status_code == 200

    def test_simulate_rate_limit_not_found(self, client: TestClient, auth_headers):
        response = client.post(
            "/api/v1/dev-portal/rate-limiting/simulate",
            headers=auth_headers,
            params={
                "api_key_id": 99999,
                "endpoint": "/api/v1/games",
                "requests_count": 10
            }
        )
        assert response.status_code == 404
