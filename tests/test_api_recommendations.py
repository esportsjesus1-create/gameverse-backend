import pytest
from fastapi.testclient import TestClient
from app.main import app


class TestRecommendationsAPI:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.fixture
    def idle_resource(self, client):
        resource_response = client.post(
            "/api/v1/resources",
            json={
                "name": "idle-server",
                "resource_type": "compute",
                "provider": "aws",
                "region": "us-east-1",
                "project_id": "project-1",
                "team_id": "team-1",
                "unit_cost": 0.10,
            },
        )
        return resource_response.json()["id"]

    def test_generate_recommendations(self, client, idle_resource):
        response = client.post(
            "/api/v1/recommendations/generate?project_id=project-1"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_generate_recommendations_by_project(self, client, idle_resource):
        response = client.post(
            "/api/v1/recommendations/generate?project_id=project-1"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_list_recommendations(self, client, idle_resource):
        client.post("/api/v1/recommendations/generate?project_id=project-1")

        response = client.get("/api/v1/recommendations")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_list_recommendations_by_type(self, client, idle_resource):
        client.post("/api/v1/recommendations/generate?project_id=project-1")

        response = client.get(
            "/api/v1/recommendations?recommendation_type=idle_resource"
        )
        assert response.status_code == 200
        data = response.json()
        assert all(r["recommendation_type"] == "idle_resource" for r in data)

    def test_implement_recommendation(self, client, idle_resource):
        generate_response = client.post(
            "/api/v1/recommendations/generate?project_id=project-1"
        )
        recommendations = generate_response.json()

        if recommendations:
            rec_id = recommendations[0]["id"]
            response = client.post(
                f"/api/v1/recommendations/{rec_id}/implement?actual_savings=50.0"
            )
            assert response.status_code == 200
            assert response.json()["is_implemented"] is True
            assert response.json()["actual_savings"] == 50.0

    def test_implement_nonexistent_recommendation(self, client):
        response = client.post("/api/v1/recommendations/nonexistent/implement")
        assert response.status_code == 404

    def test_get_optimization_summary(self, client, idle_resource):
        client.post("/api/v1/recommendations/generate?project_id=project-1")

        response = client.get("/api/v1/recommendations/summary")
        assert response.status_code == 200
        data = response.json()
        assert "total_recommendations" in data
        assert "total_potential_savings" in data
        assert "by_type" in data
        assert "by_priority" in data

    def test_get_optimization_summary_by_project(self, client, idle_resource):
        client.post("/api/v1/recommendations/generate?project_id=project-1")

        response = client.get("/api/v1/recommendations/summary?project_id=project-1")
        assert response.status_code == 200
        data = response.json()
        assert "total_recommendations" in data
