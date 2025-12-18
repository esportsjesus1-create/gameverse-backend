import pytest
from datetime import date, timedelta


class TestVisualizationAPI:
    """Test cases for Data Visualization API endpoints."""

    def test_get_time_series_dau(self, client, created_player):
        """Test getting DAU time series."""
        session_data = {"player_id": created_player["id"]}
        client.post("/api/v1/analytics/sessions/", json=session_data)
        
        today = date.today()
        start_date = (today - timedelta(days=7)).isoformat()
        end_date = today.isoformat()
        
        response = client.get(
            f"/api/v1/analytics/visualization/time-series?metric_name=dau&start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["metric_name"] == "dau"
        assert "data_points" in data
        assert len(data["data_points"]) == 8

    def test_get_time_series_sessions(self, client, created_player):
        """Test getting sessions time series."""
        session_data = {"player_id": created_player["id"]}
        client.post("/api/v1/analytics/sessions/", json=session_data)
        
        today = date.today()
        start_date = (today - timedelta(days=3)).isoformat()
        end_date = today.isoformat()
        
        response = client.get(
            f"/api/v1/analytics/visualization/time-series?metric_name=sessions&start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["metric_name"] == "sessions"

    def test_get_overview_dashboard(self, client, created_player):
        """Test getting overview dashboard."""
        session_data = {"player_id": created_player["id"]}
        client.post("/api/v1/analytics/sessions/", json=session_data)
        
        today = date.today()
        start_date = (today - timedelta(days=7)).isoformat()
        end_date = today.isoformat()
        
        response = client.get(
            f"/api/v1/analytics/visualization/dashboard/overview?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["dashboard_id"] == "overview"
        assert "widgets" in data
        assert len(data["widgets"]) >= 4

    def test_get_retention_dashboard(self, client, created_player):
        """Test getting retention dashboard."""
        session_data = {"player_id": created_player["id"]}
        client.post("/api/v1/analytics/sessions/", json=session_data)
        
        today = date.today()
        start_date = (today - timedelta(days=7)).isoformat()
        end_date = today.isoformat()
        
        response = client.get(
            f"/api/v1/analytics/visualization/dashboard/retention?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["dashboard_id"] == "retention"
        assert "widgets" in data

    def test_get_engagement_dashboard(self, client, created_player):
        """Test getting engagement dashboard."""
        session_data = {"player_id": created_player["id"]}
        client.post("/api/v1/analytics/sessions/", json=session_data)
        
        today = date.today()
        start_date = (today - timedelta(days=7)).isoformat()
        end_date = today.isoformat()
        
        response = client.get(
            f"/api/v1/analytics/visualization/dashboard/engagement?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["dashboard_id"] == "engagement"
        assert "widgets" in data

    def test_export_events_data(self, client, created_player):
        """Test exporting events data."""
        event_data = {
            "player_id": created_player["id"],
            "event_type": "session_start",
            "event_name": "game_start",
        }
        client.post("/api/v1/analytics/events/", json=event_data)
        
        today = date.today()
        start_date = (today - timedelta(days=1)).isoformat()
        end_date = today.isoformat()
        
        response = client.get(
            f"/api/v1/analytics/visualization/export?data_type=events&start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data_type"] == "events"
        assert "data" in data
        assert "record_count" in data

    def test_export_sessions_data(self, client, created_player):
        """Test exporting sessions data."""
        session_data = {"player_id": created_player["id"]}
        client.post("/api/v1/analytics/sessions/", json=session_data)
        
        today = date.today()
        start_date = (today - timedelta(days=1)).isoformat()
        end_date = today.isoformat()
        
        response = client.get(
            f"/api/v1/analytics/visualization/export?data_type=sessions&start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data_type"] == "sessions"

    def test_export_engagement_data(self, client, created_player):
        """Test exporting engagement data."""
        session_data = {"player_id": created_player["id"]}
        client.post("/api/v1/analytics/sessions/", json=session_data)
        
        today = date.today()
        start_date = (today - timedelta(days=3)).isoformat()
        end_date = today.isoformat()
        
        response = client.get(
            f"/api/v1/analytics/visualization/export?data_type=engagement&start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data_type"] == "engagement"
