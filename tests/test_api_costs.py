import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app


class TestCostsAPI:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.fixture
    def sample_cost_center(self):
        return {
            "name": "Engineering",
            "description": "Engineering department costs",
            "budget_limit": 10000.0,
            "tags": {"department": "engineering"},
        }

    @pytest.fixture
    def sample_resource(self):
        return {
            "name": "test-server",
            "resource_type": "compute",
            "provider": "aws",
            "region": "us-east-1",
            "unit_cost": 0.10,
        }

    def test_create_cost_center(self, client, sample_cost_center):
        response = client.post("/api/v1/costs/centers", json=sample_cost_center)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Engineering"
        assert "id" in data

    def test_list_cost_centers(self, client, sample_cost_center):
        client.post("/api/v1/costs/centers", json=sample_cost_center)
        response = client.get("/api/v1/costs/centers")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_cost_center(self, client, sample_cost_center):
        create_response = client.post("/api/v1/costs/centers", json=sample_cost_center)
        center_id = create_response.json()["id"]

        response = client.get(f"/api/v1/costs/centers/{center_id}")
        assert response.status_code == 200
        assert response.json()["id"] == center_id

    def test_get_nonexistent_cost_center(self, client):
        response = client.get("/api/v1/costs/centers/nonexistent")
        assert response.status_code == 404

    def test_update_cost_center(self, client, sample_cost_center):
        create_response = client.post("/api/v1/costs/centers", json=sample_cost_center)
        center_id = create_response.json()["id"]

        response = client.patch(
            f"/api/v1/costs/centers/{center_id}",
            json={"name": "Updated Engineering"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Engineering"

    def test_delete_cost_center(self, client, sample_cost_center):
        create_response = client.post("/api/v1/costs/centers", json=sample_cost_center)
        center_id = create_response.json()["id"]

        response = client.delete(f"/api/v1/costs/centers/{center_id}")
        assert response.status_code == 204

    def test_create_allocation(self, client, sample_cost_center, sample_resource):
        center_response = client.post("/api/v1/costs/centers", json=sample_cost_center)
        center_id = center_response.json()["id"]

        resource_response = client.post("/api/v1/resources", json=sample_resource)
        resource_id = resource_response.json()["id"]

        response = client.post(
            "/api/v1/costs/allocations",
            json={
                "resource_id": resource_id,
                "cost_center_id": center_id,
                "allocation_percentage": 100.0,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["resource_id"] == resource_id
        assert data["cost_center_id"] == center_id

    def test_list_allocations(self, client, sample_cost_center, sample_resource):
        center_response = client.post("/api/v1/costs/centers", json=sample_cost_center)
        center_id = center_response.json()["id"]

        resource_response = client.post("/api/v1/resources", json=sample_resource)
        resource_id = resource_response.json()["id"]

        client.post(
            "/api/v1/costs/allocations",
            json={
                "resource_id": resource_id,
                "cost_center_id": center_id,
            },
        )

        response = client.get("/api/v1/costs/allocations")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_allocation(self, client, sample_cost_center, sample_resource):
        center_response = client.post("/api/v1/costs/centers", json=sample_cost_center)
        center_id = center_response.json()["id"]

        resource_response = client.post("/api/v1/resources", json=sample_resource)
        resource_id = resource_response.json()["id"]

        create_response = client.post(
            "/api/v1/costs/allocations",
            json={
                "resource_id": resource_id,
                "cost_center_id": center_id,
            },
        )
        allocation_id = create_response.json()["id"]

        response = client.get(f"/api/v1/costs/allocations/{allocation_id}")
        assert response.status_code == 200
        assert response.json()["id"] == allocation_id

    def test_delete_allocation(self, client, sample_cost_center, sample_resource):
        center_response = client.post("/api/v1/costs/centers", json=sample_cost_center)
        center_id = center_response.json()["id"]

        resource_response = client.post("/api/v1/resources", json=sample_resource)
        resource_id = resource_response.json()["id"]

        create_response = client.post(
            "/api/v1/costs/allocations",
            json={
                "resource_id": resource_id,
                "cost_center_id": center_id,
            },
        )
        allocation_id = create_response.json()["id"]

        response = client.delete(f"/api/v1/costs/allocations/{allocation_id}")
        assert response.status_code == 204

    def test_generate_cost_report(self, client, sample_resource):
        resource_response = client.post("/api/v1/resources", json=sample_resource)
        resource_id = resource_response.json()["id"]

        client.post(
            "/api/v1/resources/usage",
            json={"resource_id": resource_id, "usage_value": 100.0},
        )

        end_date = datetime.utcnow().isoformat()
        start_date = (datetime.utcnow() - timedelta(days=30)).isoformat()

        response = client.get(
            f"/api/v1/costs/report?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_cost" in data
        assert "by_provider" in data
        assert "by_resource_type" in data

    def test_get_cost_by_tags(self, client):
        resource_response = client.post(
            "/api/v1/resources",
            json={
                "name": "tagged-server",
                "resource_type": "compute",
                "provider": "aws",
                "region": "us-east-1",
                "tags": {"env": "production"},
                "unit_cost": 0.10,
            },
        )
        resource_id = resource_response.json()["id"]

        client.post(
            "/api/v1/resources/usage",
            json={"resource_id": resource_id, "usage_value": 100.0},
        )

        response = client.post(
            "/api/v1/costs/by-tags",
            json={"env": "production"},
        )
        assert response.status_code == 200
        data = response.json()
        assert resource_id in data
