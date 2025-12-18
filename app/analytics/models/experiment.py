from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import uuid


class ExperimentStatus(str, Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Variant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    weight: float = 1.0
    config: Dict[str, Any] = Field(default_factory=dict)
    participants: int = 0
    conversions: int = 0
    total_value: float = 0.0


class ExperimentBase(BaseModel):
    name: str
    description: Optional[str] = None
    hypothesis: Optional[str] = None
    primary_metric: str
    secondary_metrics: List[str] = Field(default_factory=list)
    target_sample_size: int = 1000
    minimum_detectable_effect: float = 0.05


class ExperimentCreate(ExperimentBase):
    variants: List[Variant]


class ExperimentResult(BaseModel):
    experiment_id: str
    variant_id: str
    variant_name: str
    participants: int
    conversions: int
    conversion_rate: float
    total_value: float
    average_value: float
    confidence_interval_lower: float
    confidence_interval_upper: float
    p_value: Optional[float] = None
    is_significant: bool = False
    is_winner: bool = False
    lift_vs_control: Optional[float] = None


class Experiment(ExperimentBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: ExperimentStatus = ExperimentStatus.DRAFT
    variants: List[Variant] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    total_participants: int = 0
    assignments: Dict[str, str] = Field(default_factory=dict)

    class Config:
        from_attributes = True
