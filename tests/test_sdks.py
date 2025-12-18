import pytest
from fastapi.testclient import TestClient


class TestSDKEndpoints:
    def test_list_sdks_empty(self, client: TestClient):
        response = client.get("/api/v1/dev-portal/sdks/")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_available_languages(self, client: TestClient):
        response = client.get("/api/v1/dev-portal/sdks/languages")
        assert response.status_code == 200
        data = response.json()
        assert "supported_languages" in data
        assert len(data["supported_languages"]) > 0

    def test_create_sdk_free_tier_forbidden(self, client: TestClient, auth_headers):
        response = client.post(
            "/api/v1/dev-portal/sdks/",
            headers=auth_headers,
            json={
                "name": "GameVerse SDK",
                "language": "python",
                "version": "1.0.0",
                "download_url": "https://example.com/sdk.zip"
            }
        )
        assert response.status_code == 403

    def test_create_sdk_pro_tier(self, client: TestClient, pro_auth_headers):
        response = client.post(
            "/api/v1/dev-portal/sdks/",
            headers=pro_auth_headers,
            json={
                "name": "GameVerse SDK",
                "language": "python",
                "version": "1.0.0",
                "description": "Python SDK for GameVerse",
                "download_url": "https://example.com/sdk.zip",
                "documentation_url": "https://docs.example.com",
                "is_stable": True
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "GameVerse SDK"
        assert data["language"] == "python"
        assert data["version"] == "1.0.0"

    def test_list_sdks_with_data(self, client: TestClient, pro_auth_headers):
        client.post(
            "/api/v1/dev-portal/sdks/",
            headers=pro_auth_headers,
            json={
                "name": "GameVerse SDK",
                "language": "javascript",
                "version": "1.0.0",
                "download_url": "https://example.com/sdk.zip"
            }
        )
        
        response = client.get("/api/v1/dev-portal/sdks/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_sdk(self, client: TestClient, pro_auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/sdks/",
            headers=pro_auth_headers,
            json={
                "name": "Get Test SDK",
                "language": "java",
                "version": "1.0.0",
                "download_url": "https://example.com/sdk.zip"
            }
        )
        sdk_id = create_response.json()["id"]
        
        response = client.get(f"/api/v1/dev-portal/sdks/{sdk_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Get Test SDK"

    def test_get_sdk_not_found(self, client: TestClient):
        response = client.get("/api/v1/dev-portal/sdks/99999")
        assert response.status_code == 404

    def test_update_sdk(self, client: TestClient, pro_auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/sdks/",
            headers=pro_auth_headers,
            json={
                "name": "Update Test SDK",
                "language": "go",
                "version": "1.0.0",
                "download_url": "https://example.com/sdk.zip"
            }
        )
        sdk_id = create_response.json()["id"]
        
        response = client.put(
            f"/api/v1/dev-portal/sdks/{sdk_id}",
            headers=pro_auth_headers,
            json={"description": "Updated description"}
        )
        assert response.status_code == 200
        assert response.json()["description"] == "Updated description"

    def test_delete_sdk_pro_forbidden(self, client: TestClient, pro_auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/sdks/",
            headers=pro_auth_headers,
            json={
                "name": "Delete Test SDK",
                "language": "rust",
                "version": "1.0.0",
                "download_url": "https://example.com/sdk.zip"
            }
        )
        sdk_id = create_response.json()["id"]
        
        response = client.delete(
            f"/api/v1/dev-portal/sdks/{sdk_id}",
            headers=pro_auth_headers
        )
        assert response.status_code == 403

    def test_delete_sdk_enterprise(self, client: TestClient, enterprise_auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/sdks/",
            headers=enterprise_auth_headers,
            json={
                "name": "Enterprise Delete SDK",
                "language": "csharp",
                "version": "1.0.0",
                "download_url": "https://example.com/sdk.zip"
            }
        )
        sdk_id = create_response.json()["id"]
        
        response = client.delete(
            f"/api/v1/dev-portal/sdks/{sdk_id}",
            headers=enterprise_auth_headers
        )
        assert response.status_code == 204

    def test_download_sdk(self, client: TestClient, pro_auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/sdks/",
            headers=pro_auth_headers,
            json={
                "name": "Download Test SDK",
                "language": "swift",
                "version": "1.0.0",
                "download_url": "https://example.com/sdk.zip"
            }
        )
        sdk_id = create_response.json()["id"]
        
        response = client.post(
            f"/api/v1/dev-portal/sdks/{sdk_id}/download",
            headers=pro_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "download_url" in data

    def test_get_latest_sdk(self, client: TestClient, pro_auth_headers):
        client.post(
            "/api/v1/dev-portal/sdks/",
            headers=pro_auth_headers,
            json={
                "name": "Latest Test SDK",
                "language": "kotlin",
                "version": "1.0.0",
                "download_url": "https://example.com/sdk.zip",
                "is_stable": True
            }
        )
        
        response = client.get("/api/v1/dev-portal/sdks/latest/kotlin")
        assert response.status_code == 200
        assert response.json()["language"] == "kotlin"

    def test_get_latest_sdk_not_found(self, client: TestClient):
        response = client.get("/api/v1/dev-portal/sdks/latest/nonexistent")
        assert response.status_code == 404
