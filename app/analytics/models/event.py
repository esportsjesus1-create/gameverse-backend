from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
import uuid


class EventType(str, Enum):
    SESSION_START = "session_start"
    SESSION_END = "session_end"
    LEVEL_START = "level_start"
    LEVEL_COMPLETE = "level_complete"
    LEVEL_FAIL = "level_fail"
    PURCHASE = "purchase"
    AD_VIEW = "ad_view"
    ACHIEVEMENT = "achievement"
    SOCIAL_SHARE = "social_share"
    TUTORIAL_START = "tutorial_start"
    TUTORIAL_COMPLETE = "tutorial_complete"
    TUTORIAL_SKIP = "tutorial_skip"
    FEATURE_USE = "feature_use"
    BUTTON_CLICK = "button_click"
    SCREEN_VIEW = "screen_view"
    ERROR = "error"
    CUSTOM = "custom"


class EventBase(BaseModel):
    player_id: str
    event_type: EventType
    event_name: str
    session_id: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    value: Optional[float] = None


class EventCreate(EventBase):
    pass


class Event(EventBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    processed: bool = False

    class Config:
        from_attributes = True
