import pytest
from fastapi.testclient import TestClient


class TestWebhookEndpoints:
    def test_create_webhook(self, client: TestClient, auth_headers):
        response = client.post(
            "/api/v1/dev-portal/webhooks/",
            headers=auth_headers,
            json={
                "name": "Test Webhook",
                "url": "https://example.com/webhook",
                "events": ["game.created", "player.joined"],
                "retry_count": 3,
                "timeout_seconds": 30
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Webhook"
        assert data["url"] == "https://example.com/webhook"
        assert "secret" in data
        assert data["is_active"] is True

    def test_list_webhooks(self, client: TestClient, auth_headers):
        client.post(
            "/api/v1/dev-portal/webhooks/",
            headers=auth_headers,
            json={
                "name": "Webhook 1",
                "url": "https://example.com/hook1",
                "events": ["game.created"]
            }
        )
        
        response = client.get(
            "/api/v1/dev-portal/webhooks/",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_webhook(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/webhooks/",
            headers=auth_headers,
            json={
                "name": "Get Test",
                "url": "https://example.com/hook",
                "events": ["game.created"]
            }
        )
        webhook_id = create_response.json()["id"]
        
        response = client.get(
            f"/api/v1/dev-portal/webhooks/{webhook_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Get Test"

    def test_get_webhook_not_found(self, client: TestClient, auth_headers):
        response = client.get(
            "/api/v1/dev-portal/webhooks/99999",
            headers=auth_headers
        )
        assert response.status_code == 404

    def test_update_webhook(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/webhooks/",
            headers=auth_headers,
            json={
                "name": "Original",
                "url": "https://example.com/hook",
                "events": ["game.created"]
            }
        )
        webhook_id = create_response.json()["id"]
        
        response = client.put(
            f"/api/v1/dev-portal/webhooks/{webhook_id}",
            headers=auth_headers,
            json={"name": "Updated", "is_active": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated"
        assert data["is_active"] is False

    def test_delete_webhook(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/webhooks/",
            headers=auth_headers,
            json={
                "name": "To Delete",
                "url": "https://example.com/hook",
                "events": ["game.created"]
            }
        )
        webhook_id = create_response.json()["id"]
        
        response = client.delete(
            f"/api/v1/dev-portal/webhooks/{webhook_id}",
            headers=auth_headers
        )
        assert response.status_code == 204

    def test_regenerate_webhook_secret(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/webhooks/",
            headers=auth_headers,
            json={
                "name": "Regenerate Secret",
                "url": "https://example.com/hook",
                "events": ["game.created"]
            }
        )
        webhook_id = create_response.json()["id"]
        original_secret = create_response.json()["secret"]
        
        response = client.post(
            f"/api/v1/dev-portal/webhooks/{webhook_id}/regenerate-secret",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["secret"] != original_secret

    def test_test_webhook(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/webhooks/",
            headers=auth_headers,
            json={
                "name": "Test Webhook",
                "url": "https://example.com/hook",
                "events": ["game.created"]
            }
        )
        webhook_id = create_response.json()["id"]
        
        response = client.post(
            f"/api/v1/dev-portal/webhooks/{webhook_id}/test",
            headers=auth_headers,
            json={"event_type": "test.event"}
        )
        assert response.status_code == 200
        assert "delivery_id" in response.json()

    def test_get_webhook_deliveries(self, client: TestClient, auth_headers):
        create_response = client.post(
            "/api/v1/dev-portal/webhooks/",
            headers=auth_headers,
            json={
                "name": "Deliveries Test",
                "url": "https://example.com/hook",
                "events": ["game.created"]
            }
        )
        webhook_id = create_response.json()["id"]
        
        client.post(
            f"/api/v1/dev-portal/webhooks/{webhook_id}/test",
            headers=auth_headers,
            json={"event_type": "test.event"}
        )
        
        response = client.get(
            f"/api/v1/dev-portal/webhooks/{webhook_id}/deliveries",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert len(response.json()) >= 1

    def test_get_available_events(self, client: TestClient):
        response = client.get("/api/v1/dev-portal/webhooks/events/available")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert len(data["events"]) > 0
