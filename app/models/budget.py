from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class BudgetPeriod(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class BudgetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    amount: float = Field(..., gt=0)
    period: BudgetPeriod
    project_id: Optional[str] = None
    team_id: Optional[str] = None
    resource_type: Optional[str] = None
    warning_threshold: float = Field(default=0.8, ge=0, le=1)
    critical_threshold: float = Field(default=0.95, ge=0, le=1)
    notification_emails: list[str] = Field(default_factory=list)
    webhook_url: Optional[str] = None


class BudgetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    amount: Optional[float] = Field(None, gt=0)
    period: Optional[BudgetPeriod] = None
    warning_threshold: Optional[float] = Field(None, ge=0, le=1)
    critical_threshold: Optional[float] = Field(None, ge=0, le=1)
    notification_emails: Optional[list[str]] = None
    webhook_url: Optional[str] = None
    is_active: Optional[bool] = None


class Budget(BudgetCreate):
    id: str
    created_at: datetime
    updated_at: datetime
    current_spend: float = 0.0
    is_active: bool = True


class BudgetAlertCreate(BaseModel):
    budget_id: str
    severity: AlertSeverity
    message: str
    current_spend: float
    threshold_percentage: float


class BudgetAlert(BudgetAlertCreate):
    id: str
    created_at: datetime
    acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
