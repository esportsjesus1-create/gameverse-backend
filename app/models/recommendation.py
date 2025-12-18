from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class RecommendationType(str, Enum):
    RIGHT_SIZING = "right_sizing"
    RESERVED_INSTANCE = "reserved_instance"
    IDLE_RESOURCE = "idle_resource"
    SCHEDULING = "scheduling"
    STORAGE_OPTIMIZATION = "storage_optimization"
    NETWORK_OPTIMIZATION = "network_optimization"
    COST_REALLOCATION = "cost_reallocation"


class RecommendationPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Recommendation(BaseModel):
    id: str
    resource_id: Optional[str] = None
    project_id: Optional[str] = None
    team_id: Optional[str] = None
    recommendation_type: RecommendationType
    priority: RecommendationPriority
    title: str
    description: str
    current_cost: float
    projected_savings: float
    savings_percentage: float
    implementation_effort: str
    risk_level: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    is_implemented: bool = False
    implemented_at: Optional[datetime] = None
    actual_savings: Optional[float] = None


class OptimizationSummary(BaseModel):
    total_recommendations: int
    total_potential_savings: float
    by_type: dict[str, int] = Field(default_factory=dict)
    by_priority: dict[str, int] = Field(default_factory=dict)
    top_recommendations: list[Recommendation] = Field(default_factory=list)
    implementation_rate: float = 0.0
    realized_savings: float = 0.0
