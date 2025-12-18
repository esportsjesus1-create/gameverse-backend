"""Pydantic schemas for fraud detection data models."""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    """Risk level classification."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FlagAction(str, Enum):
    """Automated flag action types."""
    ALLOW = "allow"
    REVIEW = "review"
    BLOCK = "block"
    SUSPEND = "suspend"


class EventType(str, Enum):
    """Types of user events."""
    LOGIN = "login"
    LOGOUT = "logout"
    GAMEPLAY = "gameplay"
    CHAT = "chat"
    PURCHASE = "purchase"
    TRADE = "trade"
    ACHIEVEMENT = "achievement"
    LEVEL_UP = "level_up"
    ITEM_USE = "item_use"
    SOCIAL = "social"


class TransactionType(str, Enum):
    """Types of transactions."""
    PURCHASE = "purchase"
    SALE = "sale"
    TRADE = "trade"
    GIFT = "gift"
    REFUND = "refund"
    CURRENCY_EXCHANGE = "currency_exchange"
    SUBSCRIPTION = "subscription"


class UserEvent(BaseModel):
    """Represents a user event in the game."""
    event_id: str = Field(..., description="Unique event identifier")
    user_id: str = Field(..., description="User identifier")
    event_type: EventType = Field(..., description="Type of event")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    session_id: Optional[str] = Field(None, description="Session identifier")
    device_id: Optional[str] = Field(None, description="Device identifier")
    ip_address: Optional[str] = Field(None, description="IP address")
    geo_location: Optional[str] = Field(None, description="Geographic location")
    metadata: dict = Field(default_factory=dict, description="Additional event data")


class Transaction(BaseModel):
    """Represents a financial transaction."""
    transaction_id: str = Field(..., description="Unique transaction identifier")
    user_id: str = Field(..., description="User identifier")
    transaction_type: TransactionType = Field(..., description="Type of transaction")
    amount: float = Field(..., ge=0, description="Transaction amount")
    currency: str = Field(default="USD", description="Currency code")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    payment_method: Optional[str] = Field(None, description="Payment method used")
    device_id: Optional[str] = Field(None, description="Device identifier")
    ip_address: Optional[str] = Field(None, description="IP address")
    geo_location: Optional[str] = Field(None, description="Geographic location")
    item_id: Optional[str] = Field(None, description="Item being purchased/sold")
    recipient_id: Optional[str] = Field(None, description="Recipient user ID for trades/gifts")
    metadata: dict = Field(default_factory=dict, description="Additional transaction data")


class BehaviorEvent(BaseModel):
    """Represents a behavior event for pattern analysis."""
    event_id: str = Field(..., description="Unique event identifier")
    user_id: str = Field(..., description="User identifier")
    action: str = Field(..., description="Action performed")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    session_id: Optional[str] = Field(None, description="Session identifier")
    duration_ms: Optional[int] = Field(None, ge=0, description="Action duration in milliseconds")
    input_type: Optional[str] = Field(None, description="Input type (keyboard, mouse, touch)")
    coordinates: Optional[tuple[float, float]] = Field(None, description="Screen coordinates")
    metadata: dict = Field(default_factory=dict, description="Additional behavior data")


class DetectorResult(BaseModel):
    """Result from a single detector."""
    detector_name: str = Field(..., description="Name of the detector")
    score: float = Field(..., ge=0, le=1, description="Normalized score (0-1)")
    confidence: float = Field(..., ge=0, le=1, description="Confidence level (0-1)")
    reasons: list[str] = Field(default_factory=list, description="Reasons for the score")
    metadata: dict = Field(default_factory=dict, description="Additional detector data")


class FraudScore(BaseModel):
    """Comprehensive fraud score result."""
    entity_id: str = Field(..., description="Entity identifier (user/session/device)")
    entity_type: str = Field(default="user", description="Type of entity")
    overall_score: float = Field(..., ge=0, le=1, description="Overall risk score (0-1)")
    risk_level: RiskLevel = Field(..., description="Risk level classification")
    detector_results: list[DetectorResult] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict = Field(default_factory=dict, description="Additional scoring data")


class FlagDecision(BaseModel):
    """Automated flagging decision."""
    flag_id: str = Field(..., description="Unique flag identifier")
    entity_id: str = Field(..., description="Entity identifier")
    entity_type: str = Field(default="user", description="Type of entity")
    action: FlagAction = Field(..., description="Recommended action")
    risk_score: float = Field(..., ge=0, le=1, description="Risk score that triggered flag")
    risk_level: RiskLevel = Field(..., description="Risk level")
    triggered_detectors: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list, description="Reasons for flagging")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = Field(None, description="Flag expiration time")
    metadata: dict = Field(default_factory=dict, description="Additional flag data")
