from datetime import datetime
from typing import Optional
from app.database import get_database
from app.models import (
    Budget,
    BudgetCreate,
    BudgetUpdate,
    BudgetAlert,
    BudgetAlertCreate,
    AlertSeverity,
    BudgetPeriod,
)
from app.services.resource_service import ResourceService


class BudgetService:
    def __init__(self):
        self.db = get_database()
        self.resource_service = ResourceService()

    def create_budget(self, budget: BudgetCreate) -> Budget:
        data = budget.model_dump()
        data["current_spend"] = 0.0
        data["is_active"] = True
        result = self.db.budgets.create(data)
        return Budget(**result)

    def get_budget(self, budget_id: str) -> Optional[Budget]:
        result = self.db.budgets.get(budget_id)
        if result:
            return Budget(**result)
        return None

    def get_budgets(
        self,
        project_id: Optional[str] = None,
        team_id: Optional[str] = None,
        period: Optional[BudgetPeriod] = None,
        is_active: Optional[bool] = None,
    ) -> list[Budget]:
        filters = {}
        if project_id:
            filters["project_id"] = project_id
        if team_id:
            filters["team_id"] = team_id
        if period:
            filters["period"] = period.value
        if is_active is not None:
            filters["is_active"] = is_active

        results = self.db.budgets.get_all(filters if filters else None)
        return [Budget(**r) for r in results]

    def update_budget(
        self, budget_id: str, updates: BudgetUpdate
    ) -> Optional[Budget]:
        update_data = updates.model_dump(exclude_unset=True)
        result = self.db.budgets.update(budget_id, update_data)
        if result:
            return Budget(**result)
        return None

    def delete_budget(self, budget_id: str) -> bool:
        return self.db.budgets.delete(budget_id)

    def update_budget_spend(self, budget_id: str, amount: float) -> Optional[Budget]:
        budget = self.get_budget(budget_id)
        if not budget:
            return None

        new_spend = budget.current_spend + amount
        result = self.db.budgets.update(budget_id, {"current_spend": new_spend})

        if result:
            updated_budget = Budget(**result)
            self._check_and_create_alerts(updated_budget)
            return updated_budget
        return None

    def _check_and_create_alerts(self, budget: Budget) -> list[BudgetAlert]:
        alerts = []
        spend_percentage = budget.current_spend / budget.amount if budget.amount > 0 else 0

        if spend_percentage >= budget.critical_threshold:
            alert = self._create_alert(
                budget,
                AlertSeverity.CRITICAL,
                f"Budget '{budget.name}' has exceeded critical threshold ({budget.critical_threshold * 100}%)",
                spend_percentage,
            )
            alerts.append(alert)
        elif spend_percentage >= budget.warning_threshold:
            alert = self._create_alert(
                budget,
                AlertSeverity.WARNING,
                f"Budget '{budget.name}' has exceeded warning threshold ({budget.warning_threshold * 100}%)",
                spend_percentage,
            )
            alerts.append(alert)

        return alerts

    def _create_alert(
        self,
        budget: Budget,
        severity: AlertSeverity,
        message: str,
        threshold_percentage: float,
    ) -> BudgetAlert:
        alert_data = BudgetAlertCreate(
            budget_id=budget.id,
            severity=severity,
            message=message,
            current_spend=budget.current_spend,
            threshold_percentage=threshold_percentage,
        )
        data = alert_data.model_dump()
        data["acknowledged"] = False
        result = self.db.budget_alerts.create(data)
        return BudgetAlert(**result)

    def get_alerts(
        self,
        budget_id: Optional[str] = None,
        severity: Optional[AlertSeverity] = None,
        acknowledged: Optional[bool] = None,
    ) -> list[BudgetAlert]:
        filters = {}
        if budget_id:
            filters["budget_id"] = budget_id
        if severity:
            filters["severity"] = severity.value
        if acknowledged is not None:
            filters["acknowledged"] = acknowledged

        results = self.db.budget_alerts.get_all(filters if filters else None)
        return [BudgetAlert(**r) for r in results]

    def acknowledge_alert(
        self, alert_id: str, acknowledged_by: str
    ) -> Optional[BudgetAlert]:
        result = self.db.budget_alerts.update(
            alert_id,
            {
                "acknowledged": True,
                "acknowledged_at": datetime.utcnow(),
                "acknowledged_by": acknowledged_by,
            },
        )
        if result:
            return BudgetAlert(**result)
        return None

    def get_budget_status(self, budget_id: str) -> Optional[dict]:
        budget = self.get_budget(budget_id)
        if not budget:
            return None

        spend_percentage = budget.current_spend / budget.amount if budget.amount > 0 else 0
        remaining = max(0, budget.amount - budget.current_spend)

        status = "normal"
        if spend_percentage >= budget.critical_threshold:
            status = "critical"
        elif spend_percentage >= budget.warning_threshold:
            status = "warning"

        return {
            "budget_id": budget.id,
            "budget_name": budget.name,
            "amount": budget.amount,
            "current_spend": budget.current_spend,
            "remaining": remaining,
            "spend_percentage": spend_percentage,
            "status": status,
            "period": budget.period,
        }
