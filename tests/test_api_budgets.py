import pytest
from fastapi.testclient import TestClient
from app.main import app


class TestBudgetsAPI:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.fixture
    def sample_budget(self):
        return {
            "name": "Monthly Cloud Budget",
            "amount": 1000.0,
            "period": "monthly",
            "project_id": "project-1",
            "team_id": "team-1",
            "warning_threshold": 0.8,
            "critical_threshold": 0.95,
            "notification_emails": ["admin@example.com"],
        }

    def test_create_budget(self, client, sample_budget):
        response = client.post("/api/v1/budgets", json=sample_budget)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Monthly Cloud Budget"
        assert data["amount"] == 1000.0
        assert "id" in data

    def test_list_budgets(self, client, sample_budget):
        client.post("/api/v1/budgets", json=sample_budget)
        response = client.get("/api/v1/budgets")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_list_budgets_by_project(self, client, sample_budget):
        client.post("/api/v1/budgets", json=sample_budget)
        response = client.get("/api/v1/budgets?project_id=project-1")
        assert response.status_code == 200
        data = response.json()
        assert all(b["project_id"] == "project-1" for b in data)

    def test_get_budget(self, client, sample_budget):
        create_response = client.post("/api/v1/budgets", json=sample_budget)
        budget_id = create_response.json()["id"]

        response = client.get(f"/api/v1/budgets/{budget_id}")
        assert response.status_code == 200
        assert response.json()["id"] == budget_id

    def test_get_nonexistent_budget(self, client):
        response = client.get("/api/v1/budgets/nonexistent")
        assert response.status_code == 404

    def test_update_budget(self, client, sample_budget):
        create_response = client.post("/api/v1/budgets", json=sample_budget)
        budget_id = create_response.json()["id"]

        response = client.patch(
            f"/api/v1/budgets/{budget_id}",
            json={"name": "Updated Budget", "amount": 1500.0},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Budget"
        assert response.json()["amount"] == 1500.0

    def test_delete_budget(self, client, sample_budget):
        create_response = client.post("/api/v1/budgets", json=sample_budget)
        budget_id = create_response.json()["id"]

        response = client.delete(f"/api/v1/budgets/{budget_id}")
        assert response.status_code == 204

    def test_update_budget_spend(self, client, sample_budget):
        create_response = client.post("/api/v1/budgets", json=sample_budget)
        budget_id = create_response.json()["id"]

        response = client.post(f"/api/v1/budgets/{budget_id}/spend?amount=500.0")
        assert response.status_code == 200
        assert response.json()["current_spend"] == 500.0

    def test_get_budget_status(self, client, sample_budget):
        create_response = client.post("/api/v1/budgets", json=sample_budget)
        budget_id = create_response.json()["id"]

        client.post(f"/api/v1/budgets/{budget_id}/spend?amount=500.0")

        response = client.get(f"/api/v1/budgets/{budget_id}/status")
        assert response.status_code == 200
        data = response.json()
        assert data["current_spend"] == 500.0
        assert data["remaining"] == 500.0
        assert data["status"] == "normal"

    def test_list_alerts(self, client, sample_budget):
        create_response = client.post("/api/v1/budgets", json=sample_budget)
        budget_id = create_response.json()["id"]

        client.post(f"/api/v1/budgets/{budget_id}/spend?amount=850.0")

        response = client.get("/api/v1/budgets/alerts/list")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_acknowledge_alert(self, client, sample_budget):
        create_response = client.post("/api/v1/budgets", json=sample_budget)
        budget_id = create_response.json()["id"]

        client.post(f"/api/v1/budgets/{budget_id}/spend?amount=850.0")

        alerts_response = client.get(f"/api/v1/budgets/alerts/list?budget_id={budget_id}")
        alerts = alerts_response.json()

        if alerts:
            alert_id = alerts[0]["id"]
            response = client.post(
                f"/api/v1/budgets/alerts/{alert_id}/acknowledge?acknowledged_by=admin"
            )
            assert response.status_code == 200
            assert response.json()["acknowledged"] is True
