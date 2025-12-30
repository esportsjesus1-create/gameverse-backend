import pytest
from datetime import datetime, timedelta


class TestPlayersAPI:
    """Test cases for Players API endpoints."""

    def test_create_player(self, client, sample_player_data):
        """Test creating a new player."""
        response = client.post("/api/v1/analytics/players/", json=sample_player_data)
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == sample_player_data["username"]
        assert data["email"] == sample_player_data["email"]
        assert data["country"] == sample_player_data["country"]
        assert "id" in data
        assert "created_at" in data

    def test_get_player(self, client, created_player):
        """Test getting a player by ID."""
        player_id = created_player["id"]
        response = client.get(f"/api/v1/analytics/players/{player_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == player_id

    def test_get_player_not_found(self, client):
        """Test getting a non-existent player."""
        response = client.get("/api/v1/analytics/players/non-existent-id")
        assert response.status_code == 404

    def test_get_all_players(self, client, sample_player_data):
        """Test getting all players."""
        client.post("/api/v1/analytics/players/", json=sample_player_data)
        sample_player_data["username"] = "player2"
        client.post("/api/v1/analytics/players/", json=sample_player_data)
        
        response = client.get("/api/v1/analytics/players/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_players_pagination(self, client, sample_player_data):
        """Test player pagination."""
        for i in range(5):
            sample_player_data["username"] = f"player{i}"
            client.post("/api/v1/analytics/players/", json=sample_player_data)
        
        response = client.get("/api/v1/analytics/players/?skip=2&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_update_player(self, client, created_player):
        """Test updating a player."""
        player_id = created_player["id"]
        update_data = {"username": "updated_username"}
        response = client.patch(f"/api/v1/analytics/players/{player_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "updated_username"

    def test_delete_player(self, client, created_player):
        """Test deleting a player."""
        player_id = created_player["id"]
        response = client.delete(f"/api/v1/analytics/players/{player_id}")
        assert response.status_code == 200
        
        response = client.get(f"/api/v1/analytics/players/{player_id}")
        assert response.status_code == 404

    def test_get_player_behavior(self, client, created_player):
        """Test getting player behavior summary."""
        player_id = created_player["id"]
        response = client.get(f"/api/v1/analytics/players/{player_id}/behavior")
        assert response.status_code == 200
        data = response.json()
        assert data["player_id"] == player_id
        assert "total_events" in data
        assert "total_sessions" in data

    def test_get_player_journey(self, client, created_player):
        """Test getting player journey."""
        player_id = created_player["id"]
        
        event_data = {
            "player_id": player_id,
            "event_type": "session_start",
            "event_name": "game_start",
        }
        client.post("/api/v1/analytics/events/", json=event_data)
        
        response = client.get(f"/api/v1/analytics/players/{player_id}/journey")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_player_segments(self, client, sample_player_data):
        """Test getting player segments."""
        client.post("/api/v1/analytics/players/", json=sample_player_data)
        
        response = client.get("/api/v1/analytics/players/segments")
        assert response.status_code == 200
        data = response.json()
        assert "new" in data or "casual" in data

    def test_get_action_frequency(self, client, created_player):
        """Test getting action frequency."""
        player_id = created_player["id"]
        
        event_data = {
            "player_id": player_id,
            "event_type": "button_click",
            "event_name": "play_button",
        }
        client.post("/api/v1/analytics/events/", json=event_data)
        client.post("/api/v1/analytics/events/", json=event_data)
        
        response = client.get(f"/api/v1/analytics/players/action-frequency?player_id={player_id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
