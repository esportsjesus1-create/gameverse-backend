from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
import uuid


class FunnelStep(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    event_type: str
    event_name: str
    order: int
    filters: Optional[dict] = None


class FunnelStepAnalysis(BaseModel):
    step_name: str
    step_order: int
    users_entered: int
    users_completed: int
    conversion_rate: float
    drop_off_rate: float
    average_time_to_complete: Optional[float] = None


class FunnelBase(BaseModel):
    name: str
    description: Optional[str] = None


class FunnelCreate(FunnelBase):
    steps: List[FunnelStep]


class FunnelAnalysis(BaseModel):
    funnel_id: str
    funnel_name: str
    total_users_entered: int
    total_users_completed: int
    overall_conversion_rate: float
    steps: List[FunnelStepAnalysis]
    analysis_period_start: datetime
    analysis_period_end: datetime


class Funnel(FunnelBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    steps: List[FunnelStep] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

    class Config:
        from_attributes = True
