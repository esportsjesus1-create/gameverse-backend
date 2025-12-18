import pytest
from fastapi.testclient import TestClient
from app.main import app


class TestResourcesAPI:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.fixture
    def sample_resource(self):
        return {
            "name": "test-server",
            "resource_type": "compute",
            "provider": "aws",
            "region": "us-east-1",
            "tags": {"env": "test"},
            "project_id": "project-1",
            "team_id": "team-1",
            "unit_cost": 0.10,
            "unit": "hour",
        }

    def test_create_resource(self, client, sample_resource):
        response = client.post("/api/v1/resources", json=sample_resource)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "test-server"
        assert "id" in data

    def test_list_resources(self, client, sample_resource):
        client.post("/api/v1/resources", json=sample_resource)
        response = client.get("/api/v1/resources")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_list_resources_by_provider(self, client, sample_resource):
        client.post("/api/v1/resources", json=sample_resource)
        response = client.get("/api/v1/resources?provider=aws")
        assert response.status_code == 200
        data = response.json()
        assert all(r["provider"] == "aws" for r in data)

    def test_get_resource(self, client, sample_resource):
        create_response = client.post("/api/v1/resources", json=sample_resource)
        resource_id = create_response.json()["id"]

        response = client.get(f"/api/v1/resources/{resource_id}")
        assert response.status_code == 200
        assert response.json()["id"] == resource_id

    def test_get_nonexistent_resource(self, client):
        response = client.get("/api/v1/resources/nonexistent")
        assert response.status_code == 404

    def test_update_resource(self, client, sample_resource):
        create_response = client.post("/api/v1/resources", json=sample_resource)
        resource_id = create_response.json()["id"]

        response = client.patch(
            f"/api/v1/resources/{resource_id}",
            json={"name": "updated-server"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "updated-server"

    def test_delete_resource(self, client, sample_resource):
        create_response = client.post("/api/v1/resources", json=sample_resource)
        resource_id = create_response.json()["id"]

        response = client.delete(f"/api/v1/resources/{resource_id}")
        assert response.status_code == 204

    def test_record_usage(self, client, sample_resource):
        create_response = client.post("/api/v1/resources", json=sample_resource)
        resource_id = create_response.json()["id"]

        response = client.post(
            "/api/v1/resources/usage",
            json={"resource_id": resource_id, "usage_value": 10.0},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["resource_id"] == resource_id
        assert data["cost"] == 1.0

    def test_record_usage_nonexistent_resource(self, client):
        response = client.post(
            "/api/v1/resources/usage",
            json={"resource_id": "nonexistent", "usage_value": 10.0},
        )
        assert response.status_code == 404

    def test_list_usage(self, client, sample_resource):
        create_response = client.post("/api/v1/resources", json=sample_resource)
        resource_id = create_response.json()["id"]

        client.post(
            "/api/v1/resources/usage",
            json={"resource_id": resource_id, "usage_value": 10.0},
        )

        response = client.get(f"/api/v1/resources/usage/list?resource_id={resource_id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_usage_summary(self, client, sample_resource):
        create_response = client.post("/api/v1/resources", json=sample_resource)
        resource_id = create_response.json()["id"]

        client.post(
            "/api/v1/resources/usage",
            json={"resource_id": resource_id, "usage_value": 10.0},
        )

        response = client.get(
            f"/api/v1/resources/usage/summary?resource_id={resource_id}"
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_usage" in data
        assert "total_cost" in data

    def test_get_total_cost(self, client, sample_resource):
        create_response = client.post("/api/v1/resources", json=sample_resource)
        resource_id = create_response.json()["id"]

        client.post(
            "/api/v1/resources/usage",
            json={"resource_id": resource_id, "usage_value": 10.0},
        )

        response = client.get(f"/api/v1/resources/cost/total?resource_id={resource_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["total_cost"] == 1.0
