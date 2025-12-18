from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class ForecastHorizon(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class ForecastRequest(BaseModel):
    resource_id: Optional[str] = None
    project_id: Optional[str] = None
    team_id: Optional[str] = None
    horizon: ForecastHorizon = ForecastHorizon.MONTHLY
    periods: int = Field(default=3, ge=1, le=12)


class ForecastDataPoint(BaseModel):
    date: datetime
    predicted_value: float
    lower_bound: float
    upper_bound: float
    confidence: float = Field(ge=0, le=1)


class UsageForecast(BaseModel):
    id: str
    resource_id: Optional[str] = None
    project_id: Optional[str] = None
    team_id: Optional[str] = None
    horizon: ForecastHorizon
    generated_at: datetime
    predictions: list[ForecastDataPoint] = Field(default_factory=list)
    total_predicted_cost: float
    confidence_score: float = Field(ge=0, le=1)
    model_type: str = "linear_regression"


class TrendAnalysis(BaseModel):
    id: str
    resource_id: Optional[str] = None
    project_id: Optional[str] = None
    period_start: datetime
    period_end: datetime
    trend_direction: str
    trend_percentage: float
    seasonality_detected: bool = False
    seasonal_pattern: Optional[str] = None
    peak_usage_time: Optional[str] = None
    average_daily_cost: float
    projected_monthly_cost: float
