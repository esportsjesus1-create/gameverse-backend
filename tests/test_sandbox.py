import pytest
from fastapi.testclient import TestClient


class TestSandboxEndpoints:
    def test_create_sandbox(self, client: TestClient, auth_headers):
        response = client.post(
            "/api/v1/dev-portal/sandbox/",
            headers=auth_headers,
            json={
                "name": "Test Sandbox",
                "description": "A test sandbox environment",
                "mock_data_enabled": True,
                "rate_limit_disabled": True,
                "log_all_requests": True
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Sandbox"
        assert "base_url" in data
        assert data["is_active"] is True

    def test_list_sandboxes(self, client: TestClient, auth_headers):
        client.post(
            "/api/v1/dev-portal/sandbox/",
            headers=auth_headers,
            json={"name": "Sandbox 1"}
        )
        
        response = client.get(
            "/api/v1/dev-portal/sandbox/",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_sandbox(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/sandbox/",
            headers=auth_headers,
            json={"name": "Get Test"}
        )
        sandbox_id = create_response.json()["id"]
        
        response = client.get(
            f"/api/v1/dev-portal/sandbox/{sandbox_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Get Test"

    def test_get_sandbox_not_found(self, client: TestClient, auth_headers):
        response = client.get(
            "/api/v1/dev-portal/sandbox/99999",
            headers=auth_headers
        )
        assert response.status_code == 404

    def test_update_sandbox(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/sandbox/",
            headers=auth_headers,
            json={"name": "Original"}
        )
        sandbox_id = create_response.json()["id"]
        
        response = client.put(
            f"/api/v1/dev-portal/sandbox/{sandbox_id}",
            headers=auth_headers,
            json={"name": "Updated", "mock_data_enabled": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated"
        assert data["mock_data_enabled"] is False

    def test_delete_sandbox(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/sandbox/",
            headers=auth_headers,
            json={"name": "To Delete"}
        )
        sandbox_id = create_response.json()["id"]
        
        response = client.delete(
            f"/api/v1/dev-portal/sandbox/{sandbox_id}",
            headers=auth_headers
        )
        assert response.status_code == 204

    def test_reset_sandbox(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/sandbox/",
            headers=auth_headers,
            json={"name": "Reset Test"}
        )
        sandbox_id = create_response.json()["id"]
        original_url = create_response.json()["base_url"]
        
        response = client.post(
            f"/api/v1/dev-portal/sandbox/{sandbox_id}/reset",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["base_url"] != original_url

    def test_simulate_sandbox_request(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/sandbox/",
            headers=auth_headers,
            json={"name": "Simulate Test"}
        )
        sandbox_id = create_response.json()["id"]
        
        response = client.post(
            f"/api/v1/dev-portal/sandbox/{sandbox_id}/simulate",
            headers=auth_headers,
            params={"method": "GET", "endpoint": "/games"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "sandbox_url" in data
        assert data["method"] == "GET"

    def test_get_sandbox_logs(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/sandbox/",
            headers=auth_headers,
            json={"name": "Logs Test", "log_all_requests": True}
        )
        sandbox_id = create_response.json()["id"]
        
        client.post(
            f"/api/v1/dev-portal/sandbox/{sandbox_id}/simulate",
            headers=auth_headers,
            params={"method": "GET", "endpoint": "/games"}
        )
        
        response = client.get(
            f"/api/v1/dev-portal/sandbox/{sandbox_id}/logs",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert len(response.json()) >= 1

    def test_clear_sandbox_logs(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/sandbox/",
            headers=auth_headers,
            json={"name": "Clear Logs Test"}
        )
        sandbox_id = create_response.json()["id"]
        
        client.post(
            f"/api/v1/dev-portal/sandbox/{sandbox_id}/simulate",
            headers=auth_headers,
            params={"method": "GET", "endpoint": "/games"}
        )
        
        response = client.delete(
            f"/api/v1/dev-portal/sandbox/{sandbox_id}/logs",
            headers=auth_headers
        )
        assert response.status_code == 204

    def test_sandbox_limit_free_tier(self, client: TestClient, auth_headers):
        client.post(
            "/api/v1/dev-portal/sandbox/",
            headers=auth_headers,
            json={"name": "Sandbox 1"}
        )
        
        response = client.post(
            "/api/v1/dev-portal/sandbox/",
            headers=auth_headers,
            json={"name": "Exceeding Sandbox"}
        )
        assert response.status_code == 400
        assert "Maximum sandbox environments limit" in response.json()["detail"]
