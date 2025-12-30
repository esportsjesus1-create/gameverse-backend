import pytest


class TestPredictiveAPI:
    """Test cases for Predictive Modeling API endpoints."""

    def test_get_player_predictions(self, client, created_player, created_session):
        """Test getting predictive metrics for a player."""
        player_id = created_player["id"]
        response = client.get(f"/api/v1/analytics/predictive/player/{player_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["player_id"] == player_id
        assert "churn_probability" in data
        assert "predicted_ltv" in data
        assert "engagement_score" in data
        assert "next_session_probability" in data

    def test_get_player_predictions_not_found(self, client):
        """Test getting predictions for non-existent player."""
        response = client.get("/api/v1/analytics/predictive/player/non-existent-id")
        assert response.status_code == 404

    def test_get_churn_probability(self, client, created_player, created_session):
        """Test getting churn probability for a player."""
        player_id = created_player["id"]
        response = client.get(f"/api/v1/analytics/predictive/churn/{player_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["player_id"] == player_id
        assert "churn_probability" in data
        assert 0 <= data["churn_probability"] <= 1

    def test_get_predicted_ltv(self, client, created_player, created_session):
        """Test getting predicted lifetime value."""
        player_id = created_player["id"]
        response = client.get(f"/api/v1/analytics/predictive/ltv/{player_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["player_id"] == player_id
        assert "predicted_ltv" in data
        assert data["predicted_ltv"] >= 0

    def test_get_engagement_score(self, client, created_player, created_session):
        """Test getting engagement score."""
        player_id = created_player["id"]
        response = client.get(f"/api/v1/analytics/predictive/engagement/{player_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["player_id"] == player_id
        assert "engagement_score" in data
        assert 0 <= data["engagement_score"] <= 1

    def test_get_next_session_probability(self, client, created_player, created_session):
        """Test getting next session probability."""
        player_id = created_player["id"]
        response = client.get(f"/api/v1/analytics/predictive/next-session/{player_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["player_id"] == player_id
        assert "next_session_probability" in data
        assert 0 <= data["next_session_probability"] <= 1

    def test_get_high_value_players(self, client, created_player, created_session):
        """Test getting high-value players."""
        response = client.get("/api/v1/analytics/predictive/high-value?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_at_risk_high_value_players(self, client, created_player):
        """Test getting at-risk high-value players."""
        response = client.get(
            "/api/v1/analytics/predictive/at-risk-high-value?churn_threshold=0.5&ltv_threshold=50"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
