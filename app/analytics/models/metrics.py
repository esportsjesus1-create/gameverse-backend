from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class EngagementMetrics(BaseModel):
    date: date
    daily_active_users: int = 0
    weekly_active_users: int = 0
    monthly_active_users: int = 0
    new_users: int = 0
    returning_users: int = 0
    total_sessions: int = 0
    average_session_duration: float = 0.0
    average_sessions_per_user: float = 0.0
    total_events: int = 0
    average_events_per_session: float = 0.0
    stickiness: float = 0.0


class CohortRetention(BaseModel):
    cohort_date: date
    cohort_size: int
    retention_by_day: Dict[int, float] = Field(default_factory=dict)


class RetentionMetrics(BaseModel):
    date: date
    d1_retention: float = 0.0
    d7_retention: float = 0.0
    d14_retention: float = 0.0
    d30_retention: float = 0.0
    d60_retention: float = 0.0
    d90_retention: float = 0.0
    churned_users: int = 0
    returned_users: int = 0
    churn_rate: float = 0.0


class PredictiveMetrics(BaseModel):
    player_id: str
    churn_probability: float = 0.0
    predicted_ltv: float = 0.0
    engagement_score: float = 0.0
    next_session_probability: float = 0.0
    recommended_actions: List[str] = Field(default_factory=list)
    risk_factors: List[str] = Field(default_factory=list)
    prediction_confidence: float = 0.0


class TimeSeriesDataPoint(BaseModel):
    timestamp: datetime
    value: float
    label: Optional[str] = None


class TimeSeriesData(BaseModel):
    metric_name: str
    data_points: List[TimeSeriesDataPoint] = Field(default_factory=list)
    aggregation: str = "daily"
    start_date: datetime
    end_date: datetime


class DashboardWidget(BaseModel):
    id: str
    title: str
    widget_type: str
    data: Any
    config: Dict[str, Any] = Field(default_factory=dict)


class DashboardData(BaseModel):
    dashboard_id: str
    title: str
    widgets: List[DashboardWidget] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    filters: Dict[str, Any] = Field(default_factory=dict)
