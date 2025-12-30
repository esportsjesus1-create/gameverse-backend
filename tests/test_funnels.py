import pytest


class TestFunnelsAPI:
    """Test cases for Funnel Analysis API endpoints."""

    def test_create_funnel(self, client, sample_funnel_data):
        """Test creating a new funnel."""
        response = client.post("/api/v1/analytics/funnels/", json=sample_funnel_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == sample_funnel_data["name"]
        assert len(data["steps"]) == 3
        assert "id" in data

    def test_get_funnel(self, client, sample_funnel_data):
        """Test getting a funnel by ID."""
        create_response = client.post("/api/v1/analytics/funnels/", json=sample_funnel_data)
        funnel_id = create_response.json()["id"]
        
        response = client.get(f"/api/v1/analytics/funnels/{funnel_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == funnel_id

    def test_get_funnel_not_found(self, client):
        """Test getting a non-existent funnel."""
        response = client.get("/api/v1/analytics/funnels/non-existent-id")
        assert response.status_code == 404

    def test_get_all_funnels(self, client, sample_funnel_data):
        """Test getting all funnels."""
        client.post("/api/v1/analytics/funnels/", json=sample_funnel_data)
        sample_funnel_data["name"] = "Another Funnel"
        client.post("/api/v1/analytics/funnels/", json=sample_funnel_data)
        
        response = client.get("/api/v1/analytics/funnels/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_delete_funnel(self, client, sample_funnel_data):
        """Test deleting a funnel."""
        create_response = client.post("/api/v1/analytics/funnels/", json=sample_funnel_data)
        funnel_id = create_response.json()["id"]
        
        response = client.delete(f"/api/v1/analytics/funnels/{funnel_id}")
        assert response.status_code == 200
        
        response = client.get(f"/api/v1/analytics/funnels/{funnel_id}")
        assert response.status_code == 404

    def test_analyze_funnel(self, client, sample_funnel_data, created_player):
        """Test analyzing a funnel."""
        create_response = client.post("/api/v1/analytics/funnels/", json=sample_funnel_data)
        funnel_id = create_response.json()["id"]
        
        events = [
            {"player_id": created_player["id"], "event_type": "tutorial_start", "event_name": "tutorial_begin"},
            {"player_id": created_player["id"], "event_type": "tutorial_complete", "event_name": "tutorial_finish"},
        ]
        for event in events:
            client.post("/api/v1/analytics/events/", json=event)
        
        response = client.get(f"/api/v1/analytics/funnels/{funnel_id}/analyze")
        assert response.status_code == 200
        data = response.json()
        assert data["funnel_id"] == funnel_id
        assert "total_users_entered" in data
        assert "overall_conversion_rate" in data
        assert "steps" in data

    def test_compare_funnels(self, client, sample_funnel_data):
        """Test comparing multiple funnels."""
        response1 = client.post("/api/v1/analytics/funnels/", json=sample_funnel_data)
        funnel_id1 = response1.json()["id"]
        
        sample_funnel_data["name"] = "Funnel 2"
        response2 = client.post("/api/v1/analytics/funnels/", json=sample_funnel_data)
        funnel_id2 = response2.json()["id"]
        
        response = client.get(
            f"/api/v1/analytics/funnels/compare?funnel_ids={funnel_id1},{funnel_id2}"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_funnel_drop_off(self, client, sample_funnel_data, created_player):
        """Test getting funnel drop-off analysis."""
        create_response = client.post("/api/v1/analytics/funnels/", json=sample_funnel_data)
        funnel_id = create_response.json()["id"]
        
        events = [
            {"player_id": created_player["id"], "event_type": "tutorial_start", "event_name": "tutorial_begin"},
            {"player_id": created_player["id"], "event_type": "tutorial_complete", "event_name": "tutorial_finish"},
        ]
        for event in events:
            client.post("/api/v1/analytics/events/", json=event)
        
        response = client.get(f"/api/v1/analytics/funnels/{funnel_id}/drop-off")
        assert response.status_code == 200
        data = response.json()
        assert "funnel_id" in data
        assert "drop_offs" in data
