from typing import Optional
from fastapi import APIRouter, HTTPException
from app.models import (
    Budget,
    BudgetCreate,
    BudgetUpdate,
    BudgetAlert,
    BudgetPeriod,
    AlertSeverity,
)
from app.services import BudgetService

router = APIRouter(prefix="/api/v1/budgets", tags=["Budgets"])
service = BudgetService()


@router.post("", response_model=Budget, status_code=201)
async def create_budget(budget: BudgetCreate):
    return service.create_budget(budget)


@router.get("", response_model=list[Budget])
async def list_budgets(
    project_id: Optional[str] = None,
    team_id: Optional[str] = None,
    period: Optional[BudgetPeriod] = None,
    is_active: Optional[bool] = None,
):
    return service.get_budgets(
        project_id=project_id,
        team_id=team_id,
        period=period,
        is_active=is_active,
    )


@router.get("/{budget_id}", response_model=Budget)
async def get_budget(budget_id: str):
    budget = service.get_budget(budget_id)
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return budget


@router.patch("/{budget_id}", response_model=Budget)
async def update_budget(budget_id: str, updates: BudgetUpdate):
    budget = service.update_budget(budget_id, updates)
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return budget


@router.delete("/{budget_id}", status_code=204)
async def delete_budget(budget_id: str):
    if not service.delete_budget(budget_id):
        raise HTTPException(status_code=404, detail="Budget not found")


@router.post("/{budget_id}/spend", response_model=Budget)
async def update_budget_spend(budget_id: str, amount: float):
    budget = service.update_budget_spend(budget_id, amount)
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return budget


@router.get("/{budget_id}/status")
async def get_budget_status(budget_id: str):
    status = service.get_budget_status(budget_id)
    if not status:
        raise HTTPException(status_code=404, detail="Budget not found")
    return status


@router.get("/alerts/list", response_model=list[BudgetAlert])
async def list_alerts(
    budget_id: Optional[str] = None,
    severity: Optional[AlertSeverity] = None,
    acknowledged: Optional[bool] = None,
):
    return service.get_alerts(
        budget_id=budget_id,
        severity=severity,
        acknowledged=acknowledged,
    )


@router.post("/alerts/{alert_id}/acknowledge", response_model=BudgetAlert)
async def acknowledge_alert(alert_id: str, acknowledged_by: str):
    alert = service.acknowledge_alert(alert_id, acknowledged_by)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert
