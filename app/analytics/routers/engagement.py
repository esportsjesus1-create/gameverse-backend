from typing import List, Optional, Dict, Any
from datetime import date, datetime
from fastapi import APIRouter, Query

from ..models.metrics import EngagementMetrics
from ..services.engagement_service import EngagementService

router = APIRouter(prefix="/engagement", tags=["Engagement Metrics"])


@router.get("/metrics", response_model=EngagementMetrics)
async def get_engagement_metrics(target_date: date = Query(...)):
    """Get comprehensive engagement metrics for a specific date."""
    return EngagementService.get_engagement_metrics(target_date)


@router.get("/trend", response_model=List[EngagementMetrics])
async def get_engagement_trend(
    start_date: date = Query(...),
    end_date: date = Query(...),
):
    """Get engagement metrics trend over a date range."""
    return EngagementService.get_engagement_trend(start_date, end_date)


@router.get("/dau", response_model=Dict[str, Any])
async def get_dau(target_date: date = Query(...)):
    """Get Daily Active Users for a specific date."""
    return {"date": str(target_date), "dau": EngagementService.calculate_dau(target_date)}


@router.get("/wau", response_model=Dict[str, Any])
async def get_wau(target_date: date = Query(...)):
    """Get Weekly Active Users (7 days ending on target_date)."""
    return {"date": str(target_date), "wau": EngagementService.calculate_wau(target_date)}


@router.get("/mau", response_model=Dict[str, Any])
async def get_mau(target_date: date = Query(...)):
    """Get Monthly Active Users (30 days ending on target_date)."""
    return {"date": str(target_date), "mau": EngagementService.calculate_mau(target_date)}


@router.get("/stickiness", response_model=Dict[str, Any])
async def get_stickiness(target_date: date = Query(...)):
    """Get DAU/MAU stickiness ratio."""
    return {
        "date": str(target_date),
        "stickiness": EngagementService.calculate_stickiness(target_date),
    }


@router.get("/feature-usage", response_model=Dict[str, int])
async def get_feature_usage(
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
):
    """Get feature usage statistics."""
    return EngagementService.get_feature_usage_stats(
        start_time=start_time, end_time=end_time
    )


@router.get("/screen-views", response_model=Dict[str, int])
async def get_screen_views(
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
):
    """Get screen view statistics."""
    return EngagementService.get_screen_view_stats(
        start_time=start_time, end_time=end_time
    )
