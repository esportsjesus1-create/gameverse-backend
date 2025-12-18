import pytest
from fastapi.testclient import TestClient


class TestAPIKeyEndpoints:
    def test_create_api_key(self, client: TestClient, auth_headers):
        response = client.post(
            "/api/v1/dev-portal/api-keys/",
            headers=auth_headers,
            json={
                "name": "Test API Key",
                "description": "A test API key",
                "environment": "production"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test API Key"
        assert "api_key" in data
        assert data["api_key"].startswith("gv_")
        assert data["is_active"] is True

    def test_create_api_key_unauthorized(self, client: TestClient):
        response = client.post(
            "/api/v1/dev-portal/api-keys/",
            json={"name": "Test Key"}
        )
        assert response.status_code == 403

    def test_list_api_keys(self, client: TestClient, auth_headers):
        client.post(
            "/api/v1/dev-portal/api-keys/",
            headers=auth_headers,
            json={"name": "Key 1"}
        )
        client.post(
            "/api/v1/dev-portal/api-keys/",
            headers=auth_headers,
            json={"name": "Key 2"}
        )
        
        response = client.get(
            "/api/v1/dev-portal/api-keys/",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_api_key(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/api-keys/",
            headers=auth_headers,
            json={"name": "Test Key"}
        )
        key_id = create_response.json()["id"]
        
        response = client.get(
            f"/api/v1/dev-portal/api-keys/{key_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Test Key"

    def test_get_api_key_not_found(self, client: TestClient, auth_headers):
        response = client.get(
            "/api/v1/dev-portal/api-keys/99999",
            headers=auth_headers
        )
        assert response.status_code == 404

    def test_update_api_key(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/api-keys/",
            headers=auth_headers,
            json={"name": "Original Name"}
        )
        key_id = create_response.json()["id"]
        
        response = client.put(
            f"/api/v1/dev-portal/api-keys/{key_id}",
            headers=auth_headers,
            json={"name": "Updated Name", "is_active": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["is_active"] is False

    def test_delete_api_key(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/api-keys/",
            headers=auth_headers,
            json={"name": "To Delete"}
        )
        key_id = create_response.json()["id"]
        
        response = client.delete(
            f"/api/v1/dev-portal/api-keys/{key_id}",
            headers=auth_headers
        )
        assert response.status_code == 204
        
        get_response = client.get(
            f"/api/v1/dev-portal/api-keys/{key_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 404

    def test_regenerate_api_key(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/api-keys/",
            headers=auth_headers,
            json={"name": "Regenerate Key"}
        )
        key_id = create_response.json()["id"]
        original_prefix = create_response.json()["key_prefix"]
        
        response = client.post(
            f"/api/v1/dev-portal/api-keys/{key_id}/regenerate",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "api_key" in data
        assert data["key_prefix"] != original_prefix

    def test_api_key_limit_free_tier(self, client: TestClient, auth_headers):
        for i in range(2):
            client.post(
                "/api/v1/dev-portal/api-keys/",
                headers=auth_headers,
                json={"name": f"Key {i}"}
            )
        
        response = client.post(
            "/api/v1/dev-portal/api-keys/",
            headers=auth_headers,
            json={"name": "Exceeding Key"}
        )
        assert response.status_code == 400
        assert "Maximum API keys limit" in response.json()["detail"]
