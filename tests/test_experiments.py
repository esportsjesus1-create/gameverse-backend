import pytest


class TestExperimentsAPI:
    """Test cases for A/B Testing API endpoints."""

    def test_create_experiment(self, client, sample_experiment_data):
        """Test creating a new experiment."""
        response = client.post("/api/v1/analytics/experiments/", json=sample_experiment_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == sample_experiment_data["name"]
        assert len(data["variants"]) == 2
        assert data["status"] == "draft"
        assert "id" in data

    def test_get_experiment(self, client, sample_experiment_data):
        """Test getting an experiment by ID."""
        create_response = client.post("/api/v1/analytics/experiments/", json=sample_experiment_data)
        experiment_id = create_response.json()["id"]
        
        response = client.get(f"/api/v1/analytics/experiments/{experiment_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == experiment_id

    def test_get_experiment_not_found(self, client):
        """Test getting a non-existent experiment."""
        response = client.get("/api/v1/analytics/experiments/non-existent-id")
        assert response.status_code == 404

    def test_get_all_experiments(self, client, sample_experiment_data):
        """Test getting all experiments."""
        client.post("/api/v1/analytics/experiments/", json=sample_experiment_data)
        sample_experiment_data["name"] = "Another Experiment"
        client.post("/api/v1/analytics/experiments/", json=sample_experiment_data)
        
        response = client.get("/api/v1/analytics/experiments/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_start_experiment(self, client, sample_experiment_data):
        """Test starting an experiment."""
        create_response = client.post("/api/v1/analytics/experiments/", json=sample_experiment_data)
        experiment_id = create_response.json()["id"]
        
        response = client.post(f"/api/v1/analytics/experiments/{experiment_id}/start")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "running"
        assert data["started_at"] is not None

    def test_pause_experiment(self, client, sample_experiment_data):
        """Test pausing an experiment."""
        create_response = client.post("/api/v1/analytics/experiments/", json=sample_experiment_data)
        experiment_id = create_response.json()["id"]
        client.post(f"/api/v1/analytics/experiments/{experiment_id}/start")
        
        response = client.post(f"/api/v1/analytics/experiments/{experiment_id}/pause")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "paused"

    def test_stop_experiment(self, client, sample_experiment_data):
        """Test stopping an experiment."""
        create_response = client.post("/api/v1/analytics/experiments/", json=sample_experiment_data)
        experiment_id = create_response.json()["id"]
        client.post(f"/api/v1/analytics/experiments/{experiment_id}/start")
        
        response = client.post(f"/api/v1/analytics/experiments/{experiment_id}/stop")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["ended_at"] is not None

    def test_delete_experiment(self, client, sample_experiment_data):
        """Test deleting an experiment."""
        create_response = client.post("/api/v1/analytics/experiments/", json=sample_experiment_data)
        experiment_id = create_response.json()["id"]
        
        response = client.delete(f"/api/v1/analytics/experiments/{experiment_id}")
        assert response.status_code == 200
        
        response = client.get(f"/api/v1/analytics/experiments/{experiment_id}")
        assert response.status_code == 404

    def test_assign_player_to_variant(self, client, sample_experiment_data, created_player):
        """Test assigning a player to a variant."""
        create_response = client.post("/api/v1/analytics/experiments/", json=sample_experiment_data)
        experiment_id = create_response.json()["id"]
        client.post(f"/api/v1/analytics/experiments/{experiment_id}/start")
        
        response = client.post(
            f"/api/v1/analytics/experiments/{experiment_id}/assign?player_id={created_player['id']}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["player_id"] == created_player["id"]
        assert "variant_id" in data

    def test_record_conversion(self, client, sample_experiment_data, created_player):
        """Test recording a conversion."""
        create_response = client.post("/api/v1/analytics/experiments/", json=sample_experiment_data)
        experiment_id = create_response.json()["id"]
        client.post(f"/api/v1/analytics/experiments/{experiment_id}/start")
        client.post(
            f"/api/v1/analytics/experiments/{experiment_id}/assign?player_id={created_player['id']}"
        )
        
        response = client.post(
            f"/api/v1/analytics/experiments/{experiment_id}/convert?player_id={created_player['id']}&value=10.0"
        )
        assert response.status_code == 200

    def test_get_experiment_results(self, client, sample_experiment_data, created_player):
        """Test getting experiment results."""
        create_response = client.post("/api/v1/analytics/experiments/", json=sample_experiment_data)
        experiment_id = create_response.json()["id"]
        client.post(f"/api/v1/analytics/experiments/{experiment_id}/start")
        
        client.post(
            f"/api/v1/analytics/experiments/{experiment_id}/assign?player_id={created_player['id']}"
        )
        client.post(
            f"/api/v1/analytics/experiments/{experiment_id}/convert?player_id={created_player['id']}"
        )
        
        response = client.get(f"/api/v1/analytics/experiments/{experiment_id}/results")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2

    def test_calculate_sample_size(self, client):
        """Test calculating required sample size."""
        response = client.get(
            "/api/v1/analytics/experiments/sample-size?baseline_rate=0.1&minimum_detectable_effect=0.1"
        )
        assert response.status_code == 200
        data = response.json()
        assert "required_sample_size_per_variant" in data
        assert data["required_sample_size_per_variant"] > 0
