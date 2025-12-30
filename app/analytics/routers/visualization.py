from typing import Dict, Any
from datetime import date
from fastapi import APIRouter, Query

from ..models.metrics import TimeSeriesData, DashboardData
from ..services.visualization_service import VisualizationService

router = APIRouter(prefix="/visualization", tags=["Data Visualization"])


@router.get("/time-series", response_model=TimeSeriesData)
async def get_time_series(
    metric_name: str = Query(
        ...,
        description="Metric name: dau, wau, mau, new_users, sessions, events, d1_retention, d7_retention, stickiness",
    ),
    start_date: date = Query(...),
    end_date: date = Query(...),
    aggregation: str = Query("daily", regex="^(daily|weekly|monthly)$"),
):
    """Get time series data for a specific metric."""
    return VisualizationService.get_time_series(
        metric_name, start_date, end_date, aggregation
    )


@router.get("/dashboard/overview", response_model=DashboardData)
async def get_overview_dashboard(
    start_date: date = Query(...),
    end_date: date = Query(...),
):
    """Get overview dashboard with key metrics."""
    return VisualizationService.get_overview_dashboard(start_date, end_date)


@router.get("/dashboard/retention", response_model=DashboardData)
async def get_retention_dashboard(
    start_date: date = Query(...),
    end_date: date = Query(...),
):
    """Get retention-focused dashboard."""
    return VisualizationService.get_retention_dashboard(start_date, end_date)


@router.get("/dashboard/engagement", response_model=DashboardData)
async def get_engagement_dashboard(
    start_date: date = Query(...),
    end_date: date = Query(...),
):
    """Get engagement-focused dashboard."""
    return VisualizationService.get_engagement_dashboard(start_date, end_date)


@router.get("/export", response_model=Dict[str, Any])
async def export_data(
    data_type: str = Query(
        ...,
        description="Data type: events, sessions, players, engagement, retention",
    ),
    start_date: date = Query(...),
    end_date: date = Query(...),
    format: str = Query("json", regex="^(json|csv)$"),
):
    """Export analytics data."""
    return VisualizationService.export_data(data_type, start_date, end_date, format)
