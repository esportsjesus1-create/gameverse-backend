import pytest
from fastapi.testclient import TestClient


class TestAuthEndpoints:
    def test_register_developer(self, client: TestClient):
        response = client.post(
            "/api/v1/dev-portal/auth/register",
            json={
                "email": "newdev@example.com",
                "username": "newdev",
                "password": "securepassword123",
                "company_name": "New Company"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newdev@example.com"
        assert data["username"] == "newdev"
        assert data["tier"] == "free"
        assert data["is_active"] is True

    def test_register_duplicate_email(self, client: TestClient, test_developer):
        response = client.post(
            "/api/v1/dev-portal/auth/register",
            json={
                "email": "test@example.com",
                "username": "differentuser",
                "password": "securepassword123"
            }
        )
        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]

    def test_register_duplicate_username(self, client: TestClient, test_developer):
        response = client.post(
            "/api/v1/dev-portal/auth/register",
            json={
                "email": "different@example.com",
                "username": "testdev",
                "password": "securepassword123"
            }
        )
        assert response.status_code == 400
        assert "Username already taken" in response.json()["detail"]

    def test_login_success(self, client: TestClient, test_developer):
        response = client.post(
            "/api/v1/dev-portal/auth/login",
            params={"email": "test@example.com", "password": "testpassword123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client: TestClient, test_developer):
        response = client.post(
            "/api/v1/dev-portal/auth/login",
            params={"email": "test@example.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client: TestClient):
        response = client.post(
            "/api/v1/dev-portal/auth/login",
            params={"email": "nonexistent@example.com", "password": "password123"}
        )
        assert response.status_code == 401

    def test_get_current_developer(self, client: TestClient, auth_headers, test_developer):
        response = client.get(
            "/api/v1/dev-portal/auth/me",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["username"] == "testdev"

    def test_get_current_developer_unauthorized(self, client: TestClient):
        response = client.get("/api/v1/dev-portal/auth/me")
        assert response.status_code == 403

    def test_update_current_developer(self, client: TestClient, auth_headers, test_developer):
        response = client.put(
            "/api/v1/dev-portal/auth/me",
            headers=auth_headers,
            json={"company_name": "Updated Company"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["company_name"] == "Updated Company"

    def test_update_developer_duplicate_email(self, client: TestClient, auth_headers, test_developer, pro_developer):
        response = client.put(
            "/api/v1/dev-portal/auth/me",
            headers=auth_headers,
            json={"email": "pro@example.com"}
        )
        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]
