from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
import uuid


class PlayerBase(BaseModel):
    username: str
    email: Optional[str] = None
    country: Optional[str] = None
    platform: Optional[str] = None
    device_type: Optional[str] = None
    app_version: Optional[str] = None


class PlayerCreate(PlayerBase):
    pass


class PlayerUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    country: Optional[str] = None
    platform: Optional[str] = None
    device_type: Optional[str] = None
    app_version: Optional[str] = None
    last_active: Optional[datetime] = None


class Player(PlayerBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active: datetime = Field(default_factory=datetime.utcnow)
    total_sessions: int = 0
    total_playtime_minutes: float = 0.0
    lifetime_value: float = 0.0
    engagement_score: float = 0.0
    churn_risk: float = 0.0
    segment: Optional[str] = None

    class Config:
        from_attributes = True
