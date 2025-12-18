from typing import Optional
from fastapi import APIRouter, HTTPException
from app.models import (
    Recommendation,
    RecommendationType,
    RecommendationPriority,
    OptimizationSummary,
)
from app.services import RecommendationService

router = APIRouter(prefix="/api/v1/recommendations", tags=["Recommendations"])
service = RecommendationService()


@router.post("/generate", response_model=list[Recommendation])
async def generate_recommendations(
    resource_id: Optional[str] = None,
    project_id: Optional[str] = None,
    team_id: Optional[str] = None,
):
    return service.generate_recommendations(
        resource_id=resource_id,
        project_id=project_id,
        team_id=team_id,
    )


@router.get("", response_model=list[Recommendation])
async def list_recommendations(
    resource_id: Optional[str] = None,
    project_id: Optional[str] = None,
    team_id: Optional[str] = None,
    recommendation_type: Optional[RecommendationType] = None,
    priority: Optional[RecommendationPriority] = None,
    is_implemented: Optional[bool] = None,
):
    return service.get_recommendations(
        resource_id=resource_id,
        project_id=project_id,
        team_id=team_id,
        recommendation_type=recommendation_type,
        priority=priority,
        is_implemented=is_implemented,
    )


@router.post("/{recommendation_id}/implement", response_model=Recommendation)
async def implement_recommendation(
    recommendation_id: str,
    actual_savings: Optional[float] = None,
):
    recommendation = service.implement_recommendation(
        recommendation_id, actual_savings
    )
    if not recommendation:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return recommendation


@router.get("/summary", response_model=OptimizationSummary)
async def get_optimization_summary(
    project_id: Optional[str] = None,
    team_id: Optional[str] = None,
):
    return service.get_optimization_summary(
        project_id=project_id,
        team_id=team_id,
    )
