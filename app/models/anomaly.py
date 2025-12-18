from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class AnomalyType(str, Enum):
    SPIKE = "spike"
    DROP = "drop"
    UNUSUAL_PATTERN = "unusual_pattern"
    THRESHOLD_BREACH = "threshold_breach"
    TREND_DEVIATION = "trend_deviation"


class AnomalySeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AnomalyConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    resource_id: Optional[str] = None
    project_id: Optional[str] = None
    sensitivity: float = Field(default=2.0, ge=0.5, le=5.0)
    min_data_points: int = Field(default=10, ge=5)
    detection_window_hours: int = Field(default=24, ge=1)
    notification_emails: list[str] = Field(default_factory=list)
    webhook_url: Optional[str] = None
    is_active: bool = True


class AnomalyConfig(AnomalyConfigCreate):
    id: str
    created_at: datetime
    updated_at: datetime


class Anomaly(BaseModel):
    id: str
    config_id: str
    resource_id: Optional[str] = None
    project_id: Optional[str] = None
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    detected_at: datetime
    description: str
    expected_value: float
    actual_value: float
    deviation_percentage: float
    baseline_mean: float
    baseline_std: float
    is_resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
