import pytest
from app.services import BudgetService
from app.models import (
    BudgetCreate,
    BudgetUpdate,
    BudgetPeriod,
    AlertSeverity,
)


class TestBudgetService:
    @pytest.fixture
    def service(self):
        return BudgetService()

    @pytest.fixture
    def sample_budget(self):
        return BudgetCreate(
            name="Monthly Cloud Budget",
            amount=1000.0,
            period=BudgetPeriod.MONTHLY,
            project_id="project-1",
            team_id="team-1",
            warning_threshold=0.8,
            critical_threshold=0.95,
            notification_emails=["admin@example.com"],
        )

    def test_create_budget(self, service, sample_budget):
        budget = service.create_budget(sample_budget)
        assert budget.id is not None
        assert budget.name == "Monthly Cloud Budget"
        assert budget.amount == 1000.0
        assert budget.period == BudgetPeriod.MONTHLY
        assert budget.current_spend == 0.0
        assert budget.is_active is True

    def test_get_budget(self, service, sample_budget):
        created = service.create_budget(sample_budget)
        retrieved = service.get_budget(created.id)
        assert retrieved is not None
        assert retrieved.id == created.id

    def test_get_nonexistent_budget(self, service):
        result = service.get_budget("nonexistent")
        assert result is None

    def test_get_budgets_no_filter(self, service, sample_budget):
        service.create_budget(sample_budget)
        budgets = service.get_budgets()
        assert len(budgets) == 1

    def test_get_budgets_by_project(self, service):
        service.create_budget(
            BudgetCreate(
                name="Budget 1",
                amount=1000.0,
                period=BudgetPeriod.MONTHLY,
                project_id="project-1",
            )
        )
        service.create_budget(
            BudgetCreate(
                name="Budget 2",
                amount=2000.0,
                period=BudgetPeriod.MONTHLY,
                project_id="project-2",
            )
        )

        budgets = service.get_budgets(project_id="project-1")
        assert len(budgets) == 1
        assert budgets[0].name == "Budget 1"

    def test_get_budgets_by_period(self, service):
        service.create_budget(
            BudgetCreate(
                name="Monthly Budget",
                amount=1000.0,
                period=BudgetPeriod.MONTHLY,
            )
        )
        service.create_budget(
            BudgetCreate(
                name="Weekly Budget",
                amount=250.0,
                period=BudgetPeriod.WEEKLY,
            )
        )

        budgets = service.get_budgets(period=BudgetPeriod.MONTHLY)
        assert len(budgets) == 1
        assert budgets[0].name == "Monthly Budget"

    def test_update_budget(self, service, sample_budget):
        created = service.create_budget(sample_budget)
        updated = service.update_budget(
            created.id,
            BudgetUpdate(name="Updated Budget", amount=1500.0),
        )
        assert updated is not None
        assert updated.name == "Updated Budget"
        assert updated.amount == 1500.0

    def test_update_nonexistent_budget(self, service):
        result = service.update_budget(
            "nonexistent",
            BudgetUpdate(name="Test"),
        )
        assert result is None

    def test_delete_budget(self, service, sample_budget):
        created = service.create_budget(sample_budget)
        result = service.delete_budget(created.id)
        assert result is True
        assert service.get_budget(created.id) is None

    def test_delete_nonexistent_budget(self, service):
        result = service.delete_budget("nonexistent")
        assert result is False

    def test_update_budget_spend(self, service, sample_budget):
        budget = service.create_budget(sample_budget)
        updated = service.update_budget_spend(budget.id, 500.0)
        assert updated is not None
        assert updated.current_spend == 500.0

    def test_update_budget_spend_nonexistent(self, service):
        result = service.update_budget_spend("nonexistent", 100.0)
        assert result is None

    def test_budget_warning_alert(self, service, sample_budget):
        budget = service.create_budget(sample_budget)
        service.update_budget_spend(budget.id, 850.0)

        alerts = service.get_alerts(budget_id=budget.id)
        assert len(alerts) >= 1
        assert any(a.severity == AlertSeverity.WARNING for a in alerts)

    def test_budget_critical_alert(self, service, sample_budget):
        budget = service.create_budget(sample_budget)
        service.update_budget_spend(budget.id, 960.0)

        alerts = service.get_alerts(budget_id=budget.id)
        assert len(alerts) >= 1
        assert any(a.severity == AlertSeverity.CRITICAL for a in alerts)

    def test_get_alerts(self, service, sample_budget):
        budget = service.create_budget(sample_budget)
        service.update_budget_spend(budget.id, 850.0)

        alerts = service.get_alerts()
        assert len(alerts) >= 1

    def test_get_alerts_by_severity(self, service, sample_budget):
        budget = service.create_budget(sample_budget)
        service.update_budget_spend(budget.id, 850.0)

        warning_alerts = service.get_alerts(severity=AlertSeverity.WARNING)
        assert all(a.severity == AlertSeverity.WARNING for a in warning_alerts)

    def test_acknowledge_alert(self, service, sample_budget):
        budget = service.create_budget(sample_budget)
        service.update_budget_spend(budget.id, 850.0)

        alerts = service.get_alerts(budget_id=budget.id)
        assert len(alerts) > 0

        acknowledged = service.acknowledge_alert(alerts[0].id, "admin")
        assert acknowledged is not None
        assert acknowledged.acknowledged is True
        assert acknowledged.acknowledged_by == "admin"

    def test_get_budget_status(self, service, sample_budget):
        budget = service.create_budget(sample_budget)
        service.update_budget_spend(budget.id, 500.0)

        status = service.get_budget_status(budget.id)
        assert status is not None
        assert status["budget_id"] == budget.id
        assert status["current_spend"] == 500.0
        assert status["remaining"] == 500.0
        assert status["spend_percentage"] == 0.5
        assert status["status"] == "normal"

    def test_get_budget_status_warning(self, service, sample_budget):
        budget = service.create_budget(sample_budget)
        service.update_budget_spend(budget.id, 850.0)

        status = service.get_budget_status(budget.id)
        assert status["status"] == "warning"

    def test_get_budget_status_critical(self, service, sample_budget):
        budget = service.create_budget(sample_budget)
        service.update_budget_spend(budget.id, 960.0)

        status = service.get_budget_status(budget.id)
        assert status["status"] == "critical"

    def test_get_budget_status_nonexistent(self, service):
        result = service.get_budget_status("nonexistent")
        assert result is None
