from typing import List, Dict, Any
from datetime import date
from fastapi import APIRouter, Query

from ..models.metrics import RetentionMetrics, CohortRetention
from ..services.retention_service import RetentionService

router = APIRouter(prefix="/retention", tags=["Retention Tracking"])


@router.get("/metrics", response_model=RetentionMetrics)
async def get_retention_metrics(target_date: date = Query(...)):
    """Get retention metrics for users who signed up on target_date."""
    return RetentionService.get_retention_metrics(target_date)


@router.get("/day-n", response_model=Dict[str, Any])
async def get_day_n_retention(
    cohort_date: date = Query(...),
    n: int = Query(..., ge=1),
):
    """Get Day-N retention for a specific cohort."""
    retention = RetentionService.calculate_day_n_retention(cohort_date, n)
    return {
        "cohort_date": str(cohort_date),
        "day": n,
        "retention_rate": retention,
    }


@router.get("/cohort", response_model=CohortRetention)
async def get_cohort_retention(
    cohort_date: date = Query(...),
    max_days: int = Query(30, ge=1, le=90),
):
    """Get retention curve for a specific cohort."""
    return RetentionService.get_cohort_retention(cohort_date, max_days)


@router.get("/cohort-matrix", response_model=List[CohortRetention])
async def get_cohort_matrix(
    start_date: date = Query(...),
    end_date: date = Query(...),
    max_days: int = Query(14, ge=1, le=30),
):
    """Get retention matrix for multiple cohorts."""
    return RetentionService.get_cohort_retention_matrix(start_date, end_date, max_days)


@router.get("/churned", response_model=Dict[str, Any])
async def get_churned_users(
    target_date: date = Query(...),
    inactivity_days: int = Query(14, ge=1),
):
    """Get count of churned users."""
    count = RetentionService.count_churned_users(target_date, inactivity_days)
    return {"date": str(target_date), "churned_users": count}


@router.get("/returned", response_model=Dict[str, Any])
async def get_returned_users(target_date: date = Query(...)):
    """Get count of users who returned after being inactive."""
    count = RetentionService.count_returned_users(target_date)
    return {"date": str(target_date), "returned_users": count}


@router.get("/churn-rate", response_model=Dict[str, Any])
async def get_churn_rate(
    target_date: date = Query(...),
    period_days: int = Query(30, ge=1),
):
    """Get churn rate over a period."""
    rate = RetentionService.calculate_churn_rate(target_date, period_days)
    return {"date": str(target_date), "period_days": period_days, "churn_rate": rate}


@router.get("/at-risk", response_model=List[Dict[str, Any]])
async def get_at_risk_players(
    inactivity_threshold_days: int = Query(7, ge=1),
):
    """Get players at risk of churning."""
    return RetentionService.identify_at_risk_players(inactivity_threshold_days)
