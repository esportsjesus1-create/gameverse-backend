import pytest
from fastapi.testclient import TestClient
from app.main import app


class TestForecastsAPI:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.fixture
    def resource_with_usage(self, client):
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

        for i in range(30):
            client.post(
                "/api/v1/resources/usage",
                json={
                    "resource_id": resource_id,
                    "usage_value": 10.0 + i * 0.5,
                },
            )

        return resource_id

    def test_generate_forecast(self, client, resource_with_usage):
        response = client.post(
            "/api/v1/forecasts",
            json={
                "resource_id": resource_with_usage,
                "horizon": "monthly",
                "periods": 3,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert "predictions" in data
        assert "total_predicted_cost" in data

    def test_generate_forecast_empty(self, client):
        response = client.post(
            "/api/v1/forecasts",
            json={
                "resource_id": "nonexistent",
                "horizon": "monthly",
                "periods": 3,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data["predictions"]) == 0

    def test_list_forecasts(self, client, resource_with_usage):
        client.post(
            "/api/v1/forecasts",
            json={
                "resource_id": resource_with_usage,
                "horizon": "monthly",
                "periods": 3,
            },
        )

        response = client.get(f"/api/v1/forecasts?resource_id={resource_with_usage}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_analyze_trend(self, client, resource_with_usage):
        response = client.get(
            f"/api/v1/forecasts/trend?resource_id={resource_with_usage}&days=30"
        )
        assert response.status_code == 200
        data = response.json()
        assert "trend_direction" in data
        assert "trend_percentage" in data
        assert "average_daily_cost" in data

    def test_analyze_trend_empty(self, client):
        response = client.get("/api/v1/forecasts/trend?resource_id=nonexistent&days=30")
        assert response.status_code == 200
        data = response.json()
        assert data["trend_direction"] == "stable"
        assert data["average_daily_cost"] == 0.0
