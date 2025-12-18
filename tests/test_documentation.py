import pytest
from fastapi.testclient import TestClient


class TestDocumentationEndpoints:
    def test_list_documentation_empty(self, client: TestClient):
        response = client.get("/api/v1/dev-portal/documentation/")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_documentation_categories(self, client: TestClient):
        response = client.get("/api/v1/dev-portal/documentation/categories")
        assert response.status_code == 200
        data = response.json()
        assert "default_categories" in data
        assert len(data["default_categories"]) > 0

    def test_create_documentation_free_tier_forbidden(self, client: TestClient, auth_headers):
        response = client.post(
            "/api/v1/dev-portal/documentation/",
            headers=auth_headers,
            json={
                "title": "Getting Started",
                "slug": "getting-started",
                "category": "Getting Started",
                "content": "# Getting Started\n\nWelcome to GameVerse!"
            }
        )
        assert response.status_code == 403

    def test_create_documentation_pro_tier(self, client: TestClient, pro_auth_headers):
        response = client.post(
            "/api/v1/dev-portal/documentation/",
            headers=pro_auth_headers,
            json={
                "title": "Getting Started",
                "slug": "getting-started",
                "category": "Getting Started",
                "content": "# Getting Started\n\nWelcome to GameVerse!",
                "version": "1.0",
                "is_published": True
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Getting Started"
        assert data["slug"] == "getting-started"

    def test_list_documentation_with_data(self, client: TestClient, pro_auth_headers):
        client.post(
            "/api/v1/dev-portal/documentation/",
            headers=pro_auth_headers,
            json={
                "title": "Authentication",
                "slug": "authentication",
                "category": "Authentication",
                "content": "# Authentication\n\nLearn about authentication."
            }
        )
        
        response = client.get("/api/v1/dev-portal/documentation/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_documentation(self, client: TestClient, pro_auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/documentation/",
            headers=pro_auth_headers,
            json={
                "title": "Get Test",
                "slug": "get-test",
                "category": "Test",
                "content": "Test content"
            }
        )
        doc_id = create_response.json()["id"]
        
        response = client.get(f"/api/v1/dev-portal/documentation/{doc_id}")
        assert response.status_code == 200
        assert response.json()["title"] == "Get Test"

    def test_get_documentation_by_slug(self, client: TestClient, pro_auth_headers):
        client.post(
            "/api/v1/dev-portal/documentation/",
            headers=pro_auth_headers,
            json={
                "title": "Slug Test",
                "slug": "slug-test",
                "category": "Test",
                "content": "Test content"
            }
        )
        
        response = client.get("/api/v1/dev-portal/documentation/slug/slug-test")
        assert response.status_code == 200
        assert response.json()["slug"] == "slug-test"

    def test_get_documentation_not_found(self, client: TestClient):
        response = client.get("/api/v1/dev-portal/documentation/99999")
        assert response.status_code == 404

    def test_update_documentation(self, client: TestClient, pro_auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/documentation/",
            headers=pro_auth_headers,
            json={
                "title": "Update Test",
                "slug": "update-test",
                "category": "Test",
                "content": "Original content"
            }
        )
        doc_id = create_response.json()["id"]
        
        response = client.put(
            f"/api/v1/dev-portal/documentation/{doc_id}",
            headers=pro_auth_headers,
            json={"content": "Updated content"}
        )
        assert response.status_code == 200
        assert response.json()["content"] == "Updated content"

    def test_delete_documentation_pro_forbidden(self, client: TestClient, pro_auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/documentation/",
            headers=pro_auth_headers,
            json={
                "title": "Delete Test",
                "slug": "delete-test",
                "category": "Test",
                "content": "Test content"
            }
        )
        doc_id = create_response.json()["id"]
        
        response = client.delete(
            f"/api/v1/dev-portal/documentation/{doc_id}",
            headers=pro_auth_headers
        )
        assert response.status_code == 403

    def test_delete_documentation_enterprise(self, client: TestClient, enterprise_auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/documentation/",
            headers=enterprise_auth_headers,
            json={
                "title": "Enterprise Delete",
                "slug": "enterprise-delete",
                "category": "Test",
                "content": "Test content"
            }
        )
        doc_id = create_response.json()["id"]
        
        response = client.delete(
            f"/api/v1/dev-portal/documentation/{doc_id}",
            headers=enterprise_auth_headers
        )
        assert response.status_code == 204

    def test_search_documentation(self, client: TestClient, pro_auth_headers):
        client.post(
            "/api/v1/dev-portal/documentation/",
            headers=pro_auth_headers,
            json={
                "title": "Search Test",
                "slug": "search-test",
                "category": "Test",
                "content": "This is searchable content about games"
            }
        )
        
        response = client.get(
            "/api/v1/dev-portal/documentation/search",
            params={"q": "games"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "documentation" in data
        assert "endpoints" in data

    def test_create_endpoint(self, client: TestClient, pro_auth_headers):
        doc_response = client.post(
            "/api/v1/dev-portal/documentation/",
            headers=pro_auth_headers,
            json={
                "title": "Games API",
                "slug": "games-api",
                "category": "Games",
                "content": "Games API documentation"
            }
        )
        doc_id = doc_response.json()["id"]
        
        response = client.post(
            "/api/v1/dev-portal/documentation/endpoints",
            headers=pro_auth_headers,
            json={
                "documentation_id": doc_id,
                "method": "GET",
                "path": "/api/v1/games",
                "summary": "List all games",
                "description": "Returns a list of all games",
                "requires_auth": True
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["method"] == "GET"
        assert data["path"] == "/api/v1/games"

    def test_get_documentation_endpoints(self, client: TestClient, pro_auth_headers):
        doc_response = client.post(
            "/api/v1/dev-portal/documentation/",
            headers=pro_auth_headers,
            json={
                "title": "Players API",
                "slug": "players-api",
                "category": "Players",
                "content": "Players API documentation"
            }
        )
        doc_id = doc_response.json()["id"]
        
        client.post(
            "/api/v1/dev-portal/documentation/endpoints",
            headers=pro_auth_headers,
            json={
                "documentation_id": doc_id,
                "method": "GET",
                "path": "/api/v1/players",
                "summary": "List all players"
            }
        )
        
        response = client.get(f"/api/v1/dev-portal/documentation/{doc_id}/endpoints")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_endpoint(self, client: TestClient, pro_auth_headers):
        doc_response = client.post(
            "/api/v1/dev-portal/documentation/",
            headers=pro_auth_headers,
            json={
                "title": "Matches API",
                "slug": "matches-api",
                "category": "Matches",
                "content": "Matches API documentation"
            }
        )
        doc_id = doc_response.json()["id"]
        
        endpoint_response = client.post(
            "/api/v1/dev-portal/documentation/endpoints",
            headers=pro_auth_headers,
            json={
                "documentation_id": doc_id,
                "method": "POST",
                "path": "/api/v1/matches",
                "summary": "Create a match"
            }
        )
        endpoint_id = endpoint_response.json()["id"]
        
        response = client.get(f"/api/v1/dev-portal/documentation/endpoints/{endpoint_id}")
        assert response.status_code == 200
        assert response.json()["method"] == "POST"

    def test_update_endpoint(self, client: TestClient, pro_auth_headers):
        doc_response = client.post(
            "/api/v1/dev-portal/documentation/",
            headers=pro_auth_headers,
            json={
                "title": "Leaderboards API",
                "slug": "leaderboards-api",
                "category": "Leaderboards",
                "content": "Leaderboards API documentation"
            }
        )
        doc_id = doc_response.json()["id"]
        
        endpoint_response = client.post(
            "/api/v1/dev-portal/documentation/endpoints",
            headers=pro_auth_headers,
            json={
                "documentation_id": doc_id,
                "method": "GET",
                "path": "/api/v1/leaderboards",
                "summary": "Get leaderboards"
            }
        )
        endpoint_id = endpoint_response.json()["id"]
        
        response = client.put(
            f"/api/v1/dev-portal/documentation/endpoints/{endpoint_id}",
            headers=pro_auth_headers,
            json={"summary": "Updated summary"}
        )
        assert response.status_code == 200
        assert response.json()["summary"] == "Updated summary"
