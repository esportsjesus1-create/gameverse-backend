import pytest
from fastapi.testclient import TestClient
from app.main import app


class TestDashboardAPI:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.fixture
    def setup_data(self, client):
        resource_response = client.post(
            "/api/v1/resources",
            json={
                "name": "test-server",
                "resource_type": "compute",
                "provider": "aws",
                "region": "us-east-1",
                "project_id": "project-1",
                "team_id": "team-1",
                "unit_cost": 0.10,
            },
        )
        resource_id = resource_response.json()["id"]

        for i in range(10):
            client.post(
                "/api/v1/resources/usage",
                json={
                    "resource_id": resource_id,
                    "usage_value": 10.0 + i,
                },
            )

        client.post(
            "/api/v1/budgets",
            json={
                "name": "Monthly Budget",
                "amount": 1000.0,
                "period": "monthly",
                "project_id": "project-1",
            },
        )

        return resource_id

    def test_get_dashboard(self, client, setup_data):
        response = client.get("/api/v1/dashboard")
        assert response.status_code == 200
        data = response.json()

        assert "summary" in data
        assert "cost_breakdown" in data
        assert "budget_status" in data
        assert "alerts" in data
        assert "forecast" in data
        assert "trend" in data
        assert "anomalies" in data
        assert "optimization" in data

    def test_get_dashboard_summary(self, client, setup_data):
        response = client.get("/api/v1/dashboard")
        data = response.json()

        summary = data["summary"]
        assert "total_resources" in summary
        assert "active_budgets" in summary
        assert "total_cost_30d" in summary
        assert "unacknowledged_alerts" in summary
        assert "unresolved_anomalies" in summary
        assert "potential_savings" in summary

    def test_get_dashboard_by_project(self, client, setup_data):
        response = client.get("/api/v1/dashboard?project_id=project-1")
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data

    def test_get_dashboard_by_team(self, client, setup_data):
        response = client.get("/api/v1/dashboard?team_id=team-1")
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data

    def test_health_check(self, client):
        response = client.get("/api/v1/dashboard/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "N1.49"
        assert data["module"] == "cost-guard"

    def test_healthz_endpoint(self, client):
        response = client.get("/healthz")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
