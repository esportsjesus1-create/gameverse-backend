"""FastAPI routes for fraud detection endpoints."""

from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..engine.fraud_engine import FraudEngine
from ..models.schemas import (
    UserEvent,
    Transaction,
    BehaviorEvent,
    FraudScore,
    FlagDecision,
    FlagAction,
    RiskLevel,
    EventType,
    TransactionType,
)

router = APIRouter(prefix="/fraud", tags=["fraud-detection"])

# Global fraud engine instance
_fraud_engine: Optional[FraudEngine] = None


def get_fraud_engine() -> FraudEngine:
    """Get or create the fraud engine instance."""
    global _fraud_engine
    if _fraud_engine is None:
        _fraud_engine = FraudEngine()
    return _fraud_engine


# Request/Response Models

class UserEventRequest(BaseModel):
    """Request model for user event submission."""
    user_id: str = Field(..., description="User identifier")
    event_type: EventType = Field(..., description="Type of event")
    session_id: Optional[str] = Field(None, description="Session identifier")
    device_id: Optional[str] = Field(None, description="Device identifier")
    ip_address: Optional[str] = Field(None, description="IP address")
    geo_location: Optional[str] = Field(None, description="Geographic location")
    metadata: dict = Field(default_factory=dict, description="Additional event data")


class TransactionRequest(BaseModel):
    """Request model for transaction submission."""
    user_id: str = Field(..., description="User identifier")
    transaction_type: TransactionType = Field(..., description="Type of transaction")
    amount: float = Field(..., ge=0, description="Transaction amount")
    currency: str = Field(default="USD", description="Currency code")
    payment_method: Optional[str] = Field(None, description="Payment method used")
    device_id: Optional[str] = Field(None, description="Device identifier")
    ip_address: Optional[str] = Field(None, description="IP address")
    geo_location: Optional[str] = Field(None, description="Geographic location")
    item_id: Optional[str] = Field(None, description="Item being purchased/sold")
    recipient_id: Optional[str] = Field(None, description="Recipient user ID")
    metadata: dict = Field(default_factory=dict, description="Additional data")


class BehaviorEventRequest(BaseModel):
    """Request model for behavior event submission."""
    user_id: str = Field(..., description="User identifier")
    action: str = Field(..., description="Action performed")
    session_id: Optional[str] = Field(None, description="Session identifier")
    duration_ms: Optional[int] = Field(None, ge=0, description="Action duration in ms")
    input_type: Optional[str] = Field(None, description="Input type")
    coordinates: Optional[tuple[float, float]] = Field(None, description="Screen coordinates")
    metadata: dict = Field(default_factory=dict, description="Additional data")


class BehaviorBatchRequest(BaseModel):
    """Request model for batch behavior events."""
    user_id: str = Field(..., description="User identifier")
    events: list[BehaviorEventRequest] = Field(..., description="List of behavior events")


class AnalyzeUserRequest(BaseModel):
    """Request model for user analysis."""
    user_id: str = Field(..., description="User identifier")


class FraudScoreResponse(BaseModel):
    """Response model for fraud score."""
    entity_id: str
    entity_type: str
    overall_score: float
    risk_level: str
    detector_results: list[dict]
    timestamp: str
    metadata: dict


class FlagDecisionResponse(BaseModel):
    """Response model for flag decision."""
    flag_id: str
    entity_id: str
    entity_type: str
    action: str
    risk_score: float
    risk_level: str
    triggered_detectors: list[str]
    reasons: list[str]
    timestamp: str
    expires_at: Optional[str]


class AnalysisResponse(BaseModel):
    """Response model for fraud analysis."""
    fraud_score: FraudScoreResponse
    flag_decision: Optional[FlagDecisionResponse]
    is_blocked: bool


class ConfigureDetectorRequest(BaseModel):
    """Request model for detector configuration."""
    detector_name: str = Field(..., description="Name of detector")
    weight: Optional[float] = Field(None, ge=0, le=10, description="Detector weight")
    enabled: Optional[bool] = Field(None, description="Enable/disable detector")


class ManualFlagRequest(BaseModel):
    """Request model for manual flagging."""
    entity_id: str = Field(..., description="Entity identifier")
    action: FlagAction = Field(..., description="Flag action")
    reason: str = Field(..., description="Reason for flagging")
    entity_type: str = Field(default="user", description="Entity type")
    expires_hours: Optional[int] = Field(None, ge=1, description="Hours until expiration")


# Helper functions

def fraud_score_to_response(score: FraudScore) -> FraudScoreResponse:
    """Convert FraudScore to response model."""
    return FraudScoreResponse(
        entity_id=score.entity_id,
        entity_type=score.entity_type,
        overall_score=score.overall_score,
        risk_level=score.risk_level.value,
        detector_results=[
            {
                "detector_name": r.detector_name,
                "score": r.score,
                "confidence": r.confidence,
                "reasons": r.reasons,
            }
            for r in score.detector_results
        ],
        timestamp=score.timestamp.isoformat(),
        metadata=score.metadata,
    )


def flag_decision_to_response(flag: FlagDecision) -> FlagDecisionResponse:
    """Convert FlagDecision to response model."""
    return FlagDecisionResponse(
        flag_id=flag.flag_id,
        entity_id=flag.entity_id,
        entity_type=flag.entity_type,
        action=flag.action.value,
        risk_score=flag.risk_score,
        risk_level=flag.risk_level.value,
        triggered_detectors=flag.triggered_detectors,
        reasons=flag.reasons,
        timestamp=flag.timestamp.isoformat(),
        expires_at=flag.expires_at.isoformat() if flag.expires_at else None,
    )


# Endpoints

@router.post("/events", response_model=AnalysisResponse)
async def submit_event(request: UserEventRequest) -> AnalysisResponse:
    """
    Submit a user event for fraud analysis.
    
    The event will be stored and analyzed for suspicious patterns.
    """
    engine = get_fraud_engine()
    
    # Create event
    event = UserEvent(
        event_id=str(uuid4()),
        user_id=request.user_id,
        event_type=request.event_type,
        timestamp=datetime.utcnow(),
        session_id=request.session_id,
        device_id=request.device_id,
        ip_address=request.ip_address,
        geo_location=request.geo_location,
        metadata=request.metadata,
    )
    
    # Add event
    engine.add_event(event)
    
    # Analyze user
    fraud_score, flag_decision = engine.analyze_user(request.user_id)
    
    return AnalysisResponse(
        fraud_score=fraud_score_to_response(fraud_score),
        flag_decision=flag_decision_to_response(flag_decision) if flag_decision else None,
        is_blocked=engine.is_user_blocked(request.user_id),
    )


@router.post("/transactions", response_model=AnalysisResponse)
async def submit_transaction(request: TransactionRequest) -> AnalysisResponse:
    """
    Submit a transaction for fraud analysis.
    
    The transaction will be analyzed for fraudulent patterns including
    velocity checks, amount anomalies, and geographic impossibilities.
    """
    engine = get_fraud_engine()
    
    # Create transaction
    transaction = Transaction(
        transaction_id=str(uuid4()),
        user_id=request.user_id,
        transaction_type=request.transaction_type,
        amount=request.amount,
        currency=request.currency,
        timestamp=datetime.utcnow(),
        payment_method=request.payment_method,
        device_id=request.device_id,
        ip_address=request.ip_address,
        geo_location=request.geo_location,
        item_id=request.item_id,
        recipient_id=request.recipient_id,
        metadata=request.metadata,
    )
    
    # Analyze transaction
    fraud_score, flag_decision = engine.analyze_transaction(transaction)
    
    return AnalysisResponse(
        fraud_score=fraud_score_to_response(fraud_score),
        flag_decision=flag_decision_to_response(flag_decision) if flag_decision else None,
        is_blocked=engine.is_user_blocked(request.user_id),
    )


@router.post("/behavior", response_model=AnalysisResponse)
async def submit_behavior(request: BehaviorEventRequest) -> AnalysisResponse:
    """
    Submit a behavior event for analysis.
    
    Behavior events are analyzed for bot-like patterns and anomalies.
    """
    engine = get_fraud_engine()
    
    # Create behavior event
    event = BehaviorEvent(
        event_id=str(uuid4()),
        user_id=request.user_id,
        action=request.action,
        timestamp=datetime.utcnow(),
        session_id=request.session_id,
        duration_ms=request.duration_ms,
        input_type=request.input_type,
        coordinates=request.coordinates,
        metadata=request.metadata,
    )
    
    # Analyze behavior
    fraud_score, flag_decision = engine.analyze_behavior(
        request.user_id,
        [event]
    )
    
    return AnalysisResponse(
        fraud_score=fraud_score_to_response(fraud_score),
        flag_decision=flag_decision_to_response(flag_decision) if flag_decision else None,
        is_blocked=engine.is_user_blocked(request.user_id),
    )


@router.post("/behavior/batch", response_model=AnalysisResponse)
async def submit_behavior_batch(request: BehaviorBatchRequest) -> AnalysisResponse:
    """
    Submit a batch of behavior events for analysis.
    
    More efficient for analyzing multiple events at once.
    """
    engine = get_fraud_engine()
    
    # Create behavior events
    events = [
        BehaviorEvent(
            event_id=str(uuid4()),
            user_id=request.user_id,
            action=e.action,
            timestamp=datetime.utcnow(),
            session_id=e.session_id,
            duration_ms=e.duration_ms,
            input_type=e.input_type,
            coordinates=e.coordinates,
            metadata=e.metadata,
        )
        for e in request.events
    ]
    
    # Analyze behavior
    fraud_score, flag_decision = engine.analyze_behavior(
        request.user_id,
        events
    )
    
    return AnalysisResponse(
        fraud_score=fraud_score_to_response(fraud_score),
        flag_decision=flag_decision_to_response(flag_decision) if flag_decision else None,
        is_blocked=engine.is_user_blocked(request.user_id),
    )


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_user(request: AnalyzeUserRequest) -> AnalysisResponse:
    """
    Perform comprehensive fraud analysis for a user.
    
    Analyzes all stored events, transactions, and behavior for the user.
    """
    engine = get_fraud_engine()
    
    fraud_score, flag_decision = engine.analyze_user(request.user_id)
    
    return AnalysisResponse(
        fraud_score=fraud_score_to_response(fraud_score),
        flag_decision=flag_decision_to_response(flag_decision) if flag_decision else None,
        is_blocked=engine.is_user_blocked(request.user_id),
    )


@router.get("/users/{user_id}/risk", response_model=dict)
async def get_user_risk(user_id: str) -> dict:
    """
    Get risk history and statistics for a user.
    """
    engine = get_fraud_engine()
    return engine.get_user_risk_history(user_id)


@router.get("/users/{user_id}/flags", response_model=list[FlagDecisionResponse])
async def get_user_flags(
    user_id: str,
    include_expired: bool = Query(False, description="Include expired flags"),
) -> list[FlagDecisionResponse]:
    """
    Get all flags for a user.
    """
    engine = get_fraud_engine()
    flags = engine.flag_store.get_entity_flags(user_id, include_expired=include_expired)
    return [flag_decision_to_response(f) for f in flags]


@router.get("/users/{user_id}/blocked", response_model=dict)
async def check_user_blocked(user_id: str) -> dict:
    """
    Check if a user is currently blocked.
    """
    engine = get_fraud_engine()
    return {
        "user_id": user_id,
        "is_blocked": engine.is_user_blocked(user_id),
    }


@router.post("/flags/manual", response_model=FlagDecisionResponse)
async def create_manual_flag(request: ManualFlagRequest) -> FlagDecisionResponse:
    """
    Create a manual flag for an entity.
    """
    from ..detectors.flagging import create_manual_flag as create_flag
    
    engine = get_fraud_engine()
    
    flag = create_flag(
        entity_id=request.entity_id,
        action=request.action,
        reason=request.reason,
        entity_type=request.entity_type,
        expires_hours=request.expires_hours,
    )
    
    engine.flag_store.add_flag(flag)
    
    return flag_decision_to_response(flag)


@router.delete("/flags/{entity_id}/block")
async def remove_block(entity_id: str) -> dict:
    """
    Remove active block for an entity.
    """
    engine = get_fraud_engine()
    removed = engine.flag_store.remove_block(entity_id)
    
    return {
        "entity_id": entity_id,
        "block_removed": removed,
    }


@router.get("/flags/recent", response_model=list[FlagDecisionResponse])
async def get_recent_flags(
    hours: int = Query(24, ge=1, le=168, description="Hours to look back"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum flags to return"),
) -> list[FlagDecisionResponse]:
    """
    Get recent flags across all entities.
    """
    engine = get_fraud_engine()
    flags = engine.flag_store.get_recent_flags(hours=hours, limit=limit)
    return [flag_decision_to_response(f) for f in flags]


@router.get("/flags/blocks", response_model=list[FlagDecisionResponse])
async def get_active_blocks() -> list[FlagDecisionResponse]:
    """
    Get all currently active blocks.
    """
    engine = get_fraud_engine()
    blocks = engine.flag_store.get_active_blocks()
    return [flag_decision_to_response(f) for f in blocks]


@router.post("/config/detector", response_model=dict)
async def configure_detector(request: ConfigureDetectorRequest) -> dict:
    """
    Configure a fraud detector.
    """
    engine = get_fraud_engine()
    
    success = engine.configure_detector(
        detector_name=request.detector_name,
        weight=request.weight,
        enabled=request.enabled,
    )
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Detector '{request.detector_name}' not found"
        )
    
    return {
        "detector_name": request.detector_name,
        "configured": True,
    }


@router.get("/config/thresholds", response_model=dict)
async def get_thresholds() -> dict:
    """
    Get current risk level thresholds.
    """
    engine = get_fraud_engine()
    return {
        "scoring_thresholds": {
            k.value: v for k, v in engine.scoring_engine.get_thresholds().items()
        },
        "flagging_thresholds": {
            k.value: v for k, v in engine.flagger.get_thresholds().items()
        },
    }


@router.get("/statistics", response_model=dict)
async def get_statistics() -> dict:
    """
    Get fraud detection engine statistics.
    """
    engine = get_fraud_engine()
    return engine.get_statistics()


@router.delete("/users/{user_id}/data")
async def clear_user_data(user_id: str) -> dict:
    """
    Clear all stored data for a user.
    
    This removes events, transactions, and behavior data but not flags.
    """
    engine = get_fraud_engine()
    engine.clear_user_data(user_id)
    
    return {
        "user_id": user_id,
        "data_cleared": True,
    }
