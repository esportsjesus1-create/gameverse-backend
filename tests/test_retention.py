import pytest
from datetime import date, timedelta


class TestRetentionAPI:
    """Test cases for Retention Tracking API endpoints."""

    def test_get_retention_metrics(self, client, created_player):
        """Test getting retention metrics."""
        today = date.today().isoformat()
        response = client.get(f"/api/v1/analytics/retention/metrics?target_date={today}")
        assert response.status_code == 200
        data = response.json()
        assert "d1_retention" in data
        assert "d7_retention" in data
        assert "d30_retention" in data
        assert "churn_rate" in data

    def test_get_day_n_retention(self, client, created_player):
        """Test getting Day-N retention."""
        today = date.today().isoformat()
        response = client.get(
            f"/api/v1/analytics/retention/day-n?cohort_date={today}&n=1"
        )
        assert response.status_code == 200
        data = response.json()
        assert "cohort_date" in data
        assert "day" in data
        assert "retention_rate" in data

    def test_get_cohort_retention(self, client, created_player):
        """Test getting cohort retention curve."""
        today = date.today().isoformat()
        response = client.get(
            f"/api/v1/analytics/retention/cohort?cohort_date={today}&max_days=7"
        )
        assert response.status_code == 200
        data = response.json()
        assert "cohort_date" in data
        assert "cohort_size" in data
        assert "retention_by_day" in data

    def test_get_cohort_matrix(self, client, created_player):
        """Test getting cohort retention matrix."""
        today = date.today()
        start_date = (today - timedelta(days=3)).isoformat()
        end_date = today.isoformat()
        
        response = client.get(
            f"/api/v1/analytics/retention/cohort-matrix?start_date={start_date}&end_date={end_date}&max_days=7"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 4

    def test_get_churned_users(self, client, created_player):
        """Test getting churned users count."""
        today = date.today().isoformat()
        response = client.get(
            f"/api/v1/analytics/retention/churned?target_date={today}&inactivity_days=14"
        )
        assert response.status_code == 200
        data = response.json()
        assert "churned_users" in data

    def test_get_returned_users(self, client, created_player):
        """Test getting returned users count."""
        today = date.today().isoformat()
        response = client.get(f"/api/v1/analytics/retention/returned?target_date={today}")
        assert response.status_code == 200
        data = response.json()
        assert "returned_users" in data

    def test_get_churn_rate(self, client, created_player):
        """Test getting churn rate."""
        today = date.today().isoformat()
        response = client.get(
            f"/api/v1/analytics/retention/churn-rate?target_date={today}&period_days=30"
        )
        assert response.status_code == 200
        data = response.json()
        assert "churn_rate" in data

    def test_get_at_risk_players(self, client, created_player):
        """Test getting at-risk players."""
        response = client.get(
            "/api/v1/analytics/retention/at-risk?inactivity_threshold_days=7"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
