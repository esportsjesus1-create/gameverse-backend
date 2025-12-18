from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
import uuid


class SessionBase(BaseModel):
    player_id: str
    platform: Optional[str] = None
    device_type: Optional[str] = None
    app_version: Optional[str] = None
    country: Optional[str] = None


class SessionCreate(SessionBase):
    pass


class SessionUpdate(BaseModel):
    end_time: Optional[datetime] = None
    duration_minutes: Optional[float] = None
    events_count: Optional[int] = None
    screens_viewed: Optional[List[str]] = None
    features_used: Optional[List[str]] = None


class Session(SessionBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    start_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    duration_minutes: float = 0.0
    events_count: int = 0
    screens_viewed: List[str] = Field(default_factory=list)
    features_used: List[str] = Field(default_factory=list)
    is_active: bool = True

    class Config:
        from_attributes = True
