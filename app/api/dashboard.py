from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter
from app.services import (
    ResourceService,
    BudgetService,
    CostService,
    ForecastService,
    AnomalyService,
    RecommendationService,
)
from app.models import ForecastRequest, ForecastHorizon

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])


@router.get("")
async def get_dashboard(
    project_id: Optional[str] = None,
    team_id: Optional[str] = None,
):
    resource_service = ResourceService()
    budget_service = BudgetService()
    cost_service = CostService()
    forecast_service = ForecastService()
    anomaly_service = AnomalyService()
    recommendation_service = RecommendationService()

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=30)

    resources = resource_service.get_resources(
        project_id=project_id, team_id=team_id, is_active=True
    )

    budgets = budget_service.get_budgets(
        project_id=project_id, team_id=team_id, is_active=True
    )

    budget_statuses = []
    for budget in budgets:
        status = budget_service.get_budget_status(budget.id)
        if status:
            budget_statuses.append(status)

    unacknowledged_alerts = budget_service.get_alerts(acknowledged=False)

    cost_report = cost_service.generate_cost_report(
        start_date=start_date,
        end_date=end_date,
        project_id=project_id,
        team_id=team_id,
    )

    forecast_request = ForecastRequest(
        project_id=project_id,
        team_id=team_id,
        horizon=ForecastHorizon.MONTHLY,
        periods=3,
    )
    forecast = forecast_service.generate_forecast(forecast_request)

    trend = forecast_service.analyze_trend(
        project_id=project_id,
        days=30,
    )

    anomaly_summary = anomaly_service.get_anomaly_summary(
        project_id=project_id,
    )

    optimization_summary = recommendation_service.get_optimization_summary(
        project_id=project_id,
        team_id=team_id,
    )

    return {
        "summary": {
            "total_resources": len(resources),
            "active_budgets": len(budgets),
            "total_cost_30d": cost_report.total_cost,
            "unacknowledged_alerts": len(unacknowledged_alerts),
            "unresolved_anomalies": anomaly_summary["unresolved_count"],
            "potential_savings": optimization_summary.total_potential_savings,
        },
        "cost_breakdown": {
            "by_provider": cost_report.by_provider,
            "by_resource_type": cost_report.by_resource_type,
            "by_project": cost_report.by_project,
            "by_team": cost_report.by_team,
        },
        "budget_status": budget_statuses,
        "alerts": [
            {
                "id": alert.id,
                "severity": alert.severity,
                "message": alert.message,
                "created_at": alert.created_at,
            }
            for alert in unacknowledged_alerts[:5]
        ],
        "forecast": {
            "total_predicted_cost": forecast.total_predicted_cost,
            "confidence_score": forecast.confidence_score,
            "predictions": [
                {
                    "date": p.date,
                    "predicted_value": p.predicted_value,
                    "lower_bound": p.lower_bound,
                    "upper_bound": p.upper_bound,
                }
                for p in forecast.predictions
            ],
        },
        "trend": {
            "direction": trend.trend_direction,
            "percentage": trend.trend_percentage,
            "seasonality_detected": trend.seasonality_detected,
            "average_daily_cost": trend.average_daily_cost,
            "projected_monthly_cost": trend.projected_monthly_cost,
        },
        "anomalies": anomaly_summary,
        "optimization": {
            "total_recommendations": optimization_summary.total_recommendations,
            "total_potential_savings": optimization_summary.total_potential_savings,
            "implementation_rate": optimization_summary.implementation_rate,
            "top_recommendations": [
                {
                    "id": rec.id,
                    "title": rec.title,
                    "priority": rec.priority,
                    "projected_savings": rec.projected_savings,
                }
                for rec in optimization_summary.top_recommendations[:3]
            ],
        },
    }


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "N1.49",
        "module": "cost-guard",
    }
