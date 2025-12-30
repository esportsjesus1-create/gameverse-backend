import pytest
from datetime import datetime


class TestSessionsAPI:
    """Test cases for Sessions API endpoints."""

    def test_start_session(self, client, created_player):
        """Test starting a new session."""
        session_data = {
            "player_id": created_player["id"],
            "platform": "iOS",
            "device_type": "iPhone",
            "app_version": "1.0.0",
            "country": "US",
        }
        response = client.post("/api/v1/analytics/sessions/", json=session_data)
        assert response.status_code == 200
        data = response.json()
        assert data["player_id"] == created_player["id"]
        assert data["is_active"] is True
        assert "id" in data
        assert "start_time" in data

    def test_end_session(self, client, created_session):
        """Test ending a session."""
        session_id = created_session["id"]
        response = client.post(f"/api/v1/analytics/sessions/{session_id}/end")
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False
        assert data["end_time"] is not None
        assert data["duration_minutes"] >= 0

    def test_get_session(self, client, created_session):
        """Test getting a session by ID."""
        session_id = created_session["id"]
        response = client.get(f"/api/v1/analytics/sessions/{session_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == session_id

    def test_get_session_not_found(self, client):
        """Test getting a non-existent session."""
        response = client.get("/api/v1/analytics/sessions/non-existent-id")
        assert response.status_code == 404

    def test_get_sessions(self, client, created_player):
        """Test getting sessions with filters."""
        session_data = {
            "player_id": created_player["id"],
            "platform": "iOS",
        }
        client.post("/api/v1/analytics/sessions/", json=session_data)
        client.post("/api/v1/analytics/sessions/", json=session_data)
        
        response = client.get(f"/api/v1/analytics/sessions/?player_id={created_player['id']}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_active_sessions(self, client, created_session):
        """Test getting active sessions."""
        response = client.get("/api/v1/analytics/sessions/active")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert all(s["is_active"] for s in data)

    def test_get_session_stats(self, client, created_player):
        """Test getting session statistics."""
        session_data = {"player_id": created_player["id"]}
        session_response = client.post("/api/v1/analytics/sessions/", json=session_data)
        session_id = session_response.json()["id"]
        client.post(f"/api/v1/analytics/sessions/{session_id}/end")
        
        response = client.get("/api/v1/analytics/sessions/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_sessions" in data
        assert "average_duration" in data
        assert "unique_players" in data

    def test_update_session(self, client, created_session):
        """Test updating a session."""
        session_id = created_session["id"]
        update_data = {"events_count": 10}
        response = client.patch(f"/api/v1/analytics/sessions/{session_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["events_count"] == 10

    def test_add_screen_view(self, client, created_session):
        """Test adding a screen view to a session."""
        session_id = created_session["id"]
        response = client.post(
            f"/api/v1/analytics/sessions/{session_id}/screen-view?screen_name=home_screen"
        )
        assert response.status_code == 200
        data = response.json()
        assert "home_screen" in data["screens_viewed"]

    def test_add_feature_use(self, client, created_session):
        """Test adding a feature use to a session."""
        session_id = created_session["id"]
        response = client.post(
            f"/api/v1/analytics/sessions/{session_id}/feature-use?feature_name=chat"
        )
        assert response.status_code == 200
        data = response.json()
        assert "chat" in data["features_used"]
