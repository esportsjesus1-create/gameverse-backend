from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Query

from ..models.metrics import PredictiveMetrics
from ..services.predictive_service import PredictiveService

router = APIRouter(prefix="/predictive", tags=["Predictive Modeling"])


@router.get("/player/{player_id}", response_model=PredictiveMetrics)
async def get_player_predictions(player_id: str):
    """Get comprehensive predictive metrics for a player."""
    metrics = PredictiveService.get_predictive_metrics(player_id)
    if not metrics:
        raise HTTPException(status_code=404, detail="Player not found")
    return metrics


@router.get("/churn/{player_id}", response_model=Dict[str, Any])
async def get_churn_probability(player_id: str):
    """Get churn probability for a specific player."""
    prob = PredictiveService.calculate_churn_probability(player_id)
    return {"player_id": player_id, "churn_probability": prob}


@router.get("/ltv/{player_id}", response_model=Dict[str, Any])
async def get_predicted_ltv(player_id: str):
    """Get predicted lifetime value for a player."""
    ltv = PredictiveService.predict_lifetime_value(player_id)
    return {"player_id": player_id, "predicted_ltv": ltv}


@router.get("/engagement/{player_id}", response_model=Dict[str, Any])
async def get_engagement_score(player_id: str):
    """Get engagement score for a player."""
    score = PredictiveService.calculate_engagement_score(player_id)
    return {"player_id": player_id, "engagement_score": score}


@router.get("/next-session/{player_id}", response_model=Dict[str, Any])
async def get_next_session_probability(player_id: str):
    """Get probability of player returning within 24 hours."""
    prob = PredictiveService.predict_next_session_probability(player_id)
    return {"player_id": player_id, "next_session_probability": prob}


@router.get("/high-value", response_model=List[Dict[str, Any]])
async def get_high_value_players(limit: int = Query(100, ge=1, le=1000)):
    """Get high-value players based on predicted LTV."""
    return PredictiveService.get_high_value_players(limit)


@router.get("/at-risk-high-value", response_model=List[Dict[str, Any]])
async def get_at_risk_high_value_players(
    churn_threshold: float = Query(0.5, ge=0, le=1),
    ltv_threshold: float = Query(50, ge=0),
):
    """Get high-value players at risk of churning."""
    return PredictiveService.get_at_risk_high_value_players(
        churn_threshold, ltv_threshold
    )
