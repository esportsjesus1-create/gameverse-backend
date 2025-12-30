import pytest
from datetime import datetime


class TestEventsAPI:
    """Test cases for Events API endpoints."""

    def test_track_event(self, client, created_player):
        """Test tracking a single event."""
        event_data = {
            "player_id": created_player["id"],
            "event_type": "session_start",
            "event_name": "game_start",
            "properties": {"level": 1},
            "value": 0,
        }
        response = client.post("/api/v1/analytics/events/", json=event_data)
        assert response.status_code == 200
        data = response.json()
        assert data["player_id"] == created_player["id"]
        assert data["event_type"] == "session_start"
        assert "id" in data
        assert "timestamp" in data

    def test_batch_track_events(self, client, created_player):
        """Test tracking multiple events in batch."""
        events_data = [
            {
                "player_id": created_player["id"],
                "event_type": "session_start",
                "event_name": "game_start",
            },
            {
                "player_id": created_player["id"],
                "event_type": "level_start",
                "event_name": "level_1_start",
            },
            {
                "player_id": created_player["id"],
                "event_type": "level_complete",
                "event_name": "level_1_complete",
            },
        ]
        response = client.post("/api/v1/analytics/events/batch", json=events_data)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    def test_get_events(self, client, created_player):
        """Test getting events with filters."""
        event_data = {
            "player_id": created_player["id"],
            "event_type": "session_start",
            "event_name": "game_start",
        }
        client.post("/api/v1/analytics/events/", json=event_data)
        
        response = client.get(f"/api/v1/analytics/events/?player_id={created_player['id']}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_events_by_type(self, client, created_player):
        """Test getting events filtered by type."""
        event_data = {
            "player_id": created_player["id"],
            "event_type": "purchase",
            "event_name": "item_purchase",
            "value": 9.99,
        }
        client.post("/api/v1/analytics/events/", json=event_data)
        
        response = client.get("/api/v1/analytics/events/?event_type=purchase")
        assert response.status_code == 200
        data = response.json()
        assert all(e["event_type"] == "purchase" for e in data)

    def test_get_event_counts(self, client, created_player):
        """Test getting event counts by type."""
        for event_type in ["session_start", "session_start", "purchase"]:
            event_data = {
                "player_id": created_player["id"],
                "event_type": event_type,
                "event_name": "test_event",
            }
            client.post("/api/v1/analytics/events/", json=event_data)
        
        response = client.get("/api/v1/analytics/events/counts")
        assert response.status_code == 200
        data = response.json()
        assert data.get("session_start", 0) == 2
        assert data.get("purchase", 0) == 1

    def test_get_event_timeline(self, client, created_player):
        """Test getting event timeline."""
        event_data = {
            "player_id": created_player["id"],
            "event_type": "session_start",
            "event_name": "game_start",
        }
        client.post("/api/v1/analytics/events/", json=event_data)
        
        response = client.get("/api/v1/analytics/events/timeline?granularity=hour")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_popular_events(self, client, created_player):
        """Test getting popular events."""
        for i in range(5):
            event_data = {
                "player_id": created_player["id"],
                "event_type": "button_click",
                "event_name": "play_button",
            }
            client.post("/api/v1/analytics/events/", json=event_data)
        
        for i in range(3):
            event_data = {
                "player_id": created_player["id"],
                "event_type": "screen_view",
                "event_name": "home_screen",
            }
            client.post("/api/v1/analytics/events/", json=event_data)
        
        response = client.get("/api/v1/analytics/events/popular?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5
        assert data[0]["total_count"] >= data[-1]["total_count"]
