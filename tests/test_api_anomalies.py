import pytest
from fastapi.testclient import TestClient
from app.main import app


class TestAnomaliesAPI:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.fixture
    def sample_config(self):
        return {
            "name": "Test Anomaly Config",
            "sensitivity": 2.0,
            "min_data_points": 10,
            "detection_window_hours": 24,
            "notification_emails": ["admin@example.com"],
        }

    @pytest.fixture
    def resource_with_anomaly(self, client):
        resource_response = client.post(
            "/api/v1/resources",
            json={
                "name": "test-server",
                "resource_type": "compute",
                "provider": "aws",
                "region": "us-east-1",
                "project_id": "project-1",
                "unit_cost": 0.10,
            },
        )
        resource_id = resource_response.json()["id"]

        for i in range(20):
            usage_value = 10.0 if i < 19 else 100.0
            client.post(
                "/api/v1/resources/usage",
                json={
                    "resource_id": resource_id,
                    "usage_value": usage_value,
                },
            )

        return resource_id

    def test_create_config(self, client, sample_config):
        response = client.post("/api/v1/anomalies/configs", json=sample_config)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Anomaly Config"
        assert "id" in data

    def test_list_configs(self, client, sample_config):
        client.post("/api/v1/anomalies/configs", json=sample_config)
        response = client.get("/api/v1/anomalies/configs")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_config(self, client, sample_config):
        create_response = client.post("/api/v1/anomalies/configs", json=sample_config)
        config_id = create_response.json()["id"]

        response = client.get(f"/api/v1/anomalies/configs/{config_id}")
        assert response.status_code == 200
        assert response.json()["id"] == config_id

    def test_get_nonexistent_config(self, client):
        response = client.get("/api/v1/anomalies/configs/nonexistent")
        assert response.status_code == 404

    def test_update_config(self, client, sample_config):
        create_response = client.post("/api/v1/anomalies/configs", json=sample_config)
        config_id = create_response.json()["id"]

        response = client.patch(
            f"/api/v1/anomalies/configs/{config_id}",
            json={"name": "Updated Config"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Config"

    def test_delete_config(self, client, sample_config):
        create_response = client.post("/api/v1/anomalies/configs", json=sample_config)
        config_id = create_response.json()["id"]

        response = client.delete(f"/api/v1/anomalies/configs/{config_id}")
        assert response.status_code == 204

    def test_detect_anomalies(self, client, resource_with_anomaly):
        config_response = client.post(
            "/api/v1/anomalies/configs",
            json={
                "name": "Test Config",
                "resource_id": resource_with_anomaly,
                "sensitivity": 2.0,
                "min_data_points": 5,
                "detection_window_hours": 48,
            },
        )
        config_id = config_response.json()["id"]

        response = client.post(f"/api/v1/anomalies/detect?config_id={config_id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_list_anomalies(self, client, resource_with_anomaly):
        config_response = client.post(
            "/api/v1/anomalies/configs",
            json={
                "name": "Test Config",
                "resource_id": resource_with_anomaly,
                "sensitivity": 2.0,
                "min_data_points": 5,
                "detection_window_hours": 48,
            },
        )
        config_id = config_response.json()["id"]

        client.post(f"/api/v1/anomalies/detect?config_id={config_id}")

        response = client.get("/api/v1/anomalies")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_resolve_anomaly(self, client, resource_with_anomaly):
        config_response = client.post(
            "/api/v1/anomalies/configs",
            json={
                "name": "Test Config",
                "resource_id": resource_with_anomaly,
                "sensitivity": 2.0,
                "min_data_points": 5,
                "detection_window_hours": 48,
            },
        )
        config_id = config_response.json()["id"]

        detect_response = client.post(f"/api/v1/anomalies/detect?config_id={config_id}")
        anomalies = detect_response.json()

        if anomalies:
            anomaly_id = anomalies[0]["id"]
            response = client.post(
                f"/api/v1/anomalies/{anomaly_id}/resolve?resolution_notes=Investigated"
            )
            assert response.status_code == 200
            assert response.json()["is_resolved"] is True

    def test_get_anomaly_summary(self, client, resource_with_anomaly):
        config_response = client.post(
            "/api/v1/anomalies/configs",
            json={
                "name": "Test Config",
                "resource_id": resource_with_anomaly,
                "sensitivity": 2.0,
                "min_data_points": 5,
                "detection_window_hours": 48,
            },
        )
        config_id = config_response.json()["id"]

        client.post(f"/api/v1/anomalies/detect?config_id={config_id}")

        response = client.get("/api/v1/anomalies/summary")
        assert response.status_code == 200
        data = response.json()
        assert "total_anomalies" in data
        assert "unresolved_count" in data
