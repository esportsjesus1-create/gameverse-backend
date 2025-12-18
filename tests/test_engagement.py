import pytest
from datetime import date, datetime, timedelta


class TestEngagementAPI:
    """Test cases for Engagement Metrics API endpoints."""

    def test_get_engagement_metrics(self, client, created_player):
        """Test getting engagement metrics for a date."""
        session_data = {"player_id": created_player["id"]}
        client.post("/api/v1/analytics/sessions/", json=session_data)
        
        today = date.today().isoformat()
        response = client.get(f"/api/v1/analytics/engagement/metrics?target_date={today}")
        assert response.status_code == 200
        data = response.json()
        assert "daily_active_users" in data
        assert "weekly_active_users" in data
        assert "monthly_active_users" in data
        assert "total_sessions" in data

    def test_get_engagement_trend(self, client, created_player):
        """Test getting engagement trend over a date range."""
        session_data = {"player_id": created_player["id"]}
        client.post("/api/v1/analytics/sessions/", json=session_data)
        
        today = date.today()
        start_date = (today - timedelta(days=7)).isoformat()
        end_date = today.isoformat()
        
        response = client.get(
            f"/api/v1/analytics/engagement/trend?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 8

    def test_get_dau(self, client, created_player):
        """Test getting Daily Active Users."""
        session_data = {"player_id": created_player["id"]}
        client.post("/api/v1/analytics/sessions/", json=session_data)
        
        today = date.today().isoformat()
        response = client.get(f"/api/v1/analytics/engagement/dau?target_date={today}")
        assert response.status_code == 200
        data = response.json()
        assert "dau" in data
        assert data["dau"] >= 1

    def test_get_wau(self, client, created_player):
        """Test getting Weekly Active Users."""
        session_data = {"player_id": created_player["id"]}
        client.post("/api/v1/analytics/sessions/", json=session_data)
        
        today = date.today().isoformat()
        response = client.get(f"/api/v1/analytics/engagement/wau?target_date={today}")
        assert response.status_code == 200
        data = response.json()
        assert "wau" in data

    def test_get_mau(self, client, created_player):
        """Test getting Monthly Active Users."""
        session_data = {"player_id": created_player["id"]}
        client.post("/api/v1/analytics/sessions/", json=session_data)
        
        today = date.today().isoformat()
        response = client.get(f"/api/v1/analytics/engagement/mau?target_date={today}")
        assert response.status_code == 200
        data = response.json()
        assert "mau" in data

    def test_get_stickiness(self, client, created_player):
        """Test getting DAU/MAU stickiness."""
        session_data = {"player_id": created_player["id"]}
        client.post("/api/v1/analytics/sessions/", json=session_data)
        
        today = date.today().isoformat()
        response = client.get(f"/api/v1/analytics/engagement/stickiness?target_date={today}")
        assert response.status_code == 200
        data = response.json()
        assert "stickiness" in data

    def test_get_feature_usage(self, client, created_session):
        """Test getting feature usage statistics."""
        session_id = created_session["id"]
        client.post(f"/api/v1/analytics/sessions/{session_id}/feature-use?feature_name=chat")
        client.post(f"/api/v1/analytics/sessions/{session_id}/feature-use?feature_name=leaderboard")
        
        response = client.get("/api/v1/analytics/engagement/feature-usage")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)

    def test_get_screen_views(self, client, created_session):
        """Test getting screen view statistics."""
        session_id = created_session["id"]
        client.post(f"/api/v1/analytics/sessions/{session_id}/screen-view?screen_name=home")
        client.post(f"/api/v1/analytics/sessions/{session_id}/screen-view?screen_name=profile")
        
        response = client.get("/api/v1/analytics/engagement/screen-views")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
