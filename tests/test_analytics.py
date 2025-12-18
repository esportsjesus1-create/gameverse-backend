import pytest
from fastapi.testclient import TestClient


class TestAnalyticsEndpoints:
    def test_get_analytics_summary_empty(self, client: TestClient, auth_headers):
        response = client.get(
            "/api/v1/dev-portal/analytics/summary",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_requests"] == 0
        assert data["daily_breakdown"] == []

    def test_generate_sample_analytics(self, client: TestClient, auth_headers):
        response = client.post(
            "/api/v1/dev-portal/analytics/generate-sample-data",
            headers=auth_headers,
            params={"days": 7}
        )
        assert response.status_code == 200
        assert "Generated 7 days" in response.json()["message"]

    def test_get_analytics_summary_with_data(self, client: TestClient, auth_headers):
        client.post(
            "/api/v1/dev-portal/analytics/generate-sample-data",
            headers=auth_headers,
            params={"days": 7}
        )
        
        response = client.get(
            "/api/v1/dev-portal/analytics/summary",
            headers=auth_headers,
            params={"days": 7}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_requests"] > 0
        assert len(data["daily_breakdown"]) == 7

    def test_get_daily_analytics(self, client: TestClient, auth_headers):
        client.post(
            "/api/v1/dev-portal/analytics/generate-sample-data",
            headers=auth_headers,
            params={"days": 5}
        )
        
        response = client.get(
            "/api/v1/dev-portal/analytics/daily",
            headers=auth_headers,
            params={"days": 5}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5

    def test_get_endpoint_analytics(self, client: TestClient, auth_headers):
        response = client.get(
            "/api/v1/dev-portal/analytics/endpoints",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert "endpoints" in response.json()

    def test_get_api_key_analytics(self, client: TestClient, auth_headers):
        client.post(
            "/api/v1/dev-portal/api-keys/",
            headers=auth_headers,
            json={"name": "Analytics Test Key"}
        )
        
        response = client.get(
            "/api/v1/dev-portal/analytics/api-keys",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "api_keys" in data
        assert len(data["api_keys"]) >= 1

    def test_get_usage_trends_insufficient_data(self, client: TestClient, auth_headers):
        response = client.get(
            "/api/v1/dev-portal/analytics/usage-trends",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["trend"] == "insufficient_data"

    def test_get_usage_trends_with_data(self, client: TestClient, auth_headers):
        client.post(
            "/api/v1/dev-portal/analytics/generate-sample-data",
            headers=auth_headers,
            params={"days": 30}
        )
        
        response = client.get(
            "/api/v1/dev-portal/analytics/usage-trends",
            headers=auth_headers,
            params={"days": 30}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["trend"] in ["growing", "declining", "stable"]
        assert "growth_rate_percent" in data
