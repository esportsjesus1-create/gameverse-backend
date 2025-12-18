from typing import Optional
from fastapi import APIRouter, Query
from app.models import (
    UsageForecast,
    ForecastRequest,
    TrendAnalysis,
)
from app.services import ForecastService

router = APIRouter(prefix="/api/v1/forecasts", tags=["Forecasts"])
service = ForecastService()


@router.post("", response_model=UsageForecast, status_code=201)
async def generate_forecast(request: ForecastRequest):
    return service.generate_forecast(request)


@router.get("", response_model=list[UsageForecast])
async def list_forecasts(
    resource_id: Optional[str] = None,
    project_id: Optional[str] = None,
):
    return service.get_forecasts(
        resource_id=resource_id,
        project_id=project_id,
    )


@router.get("/trend", response_model=TrendAnalysis)
async def analyze_trend(
    resource_id: Optional[str] = None,
    project_id: Optional[str] = None,
    days: int = Query(default=30, ge=7, le=365),
):
    return service.analyze_trend(
        resource_id=resource_id,
        project_id=project_id,
        days=days,
    )
