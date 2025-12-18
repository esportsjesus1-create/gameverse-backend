from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CostCenterCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    parent_id: Optional[str] = None
    budget_limit: Optional[float] = Field(None, ge=0)
    tags: dict[str, str] = Field(default_factory=dict)


class CostCenter(CostCenterCreate):
    id: str
    created_at: datetime
    updated_at: datetime
    total_cost: float = 0.0
    is_active: bool = True


class CostAllocationCreate(BaseModel):
    resource_id: str
    cost_center_id: str
    project_id: Optional[str] = None
    team_id: Optional[str] = None
    allocation_percentage: float = Field(default=100.0, ge=0, le=100)
    tags: dict[str, str] = Field(default_factory=dict)


class CostAllocation(CostAllocationCreate):
    id: str
    created_at: datetime
    updated_at: datetime


class CostBreakdown(BaseModel):
    category: str
    amount: float
    percentage: float
    trend: float
    resources: list[str] = Field(default_factory=list)


class CostReport(BaseModel):
    id: str
    start_date: datetime
    end_date: datetime
    total_cost: float
    by_provider: dict[str, float] = Field(default_factory=dict)
    by_resource_type: dict[str, float] = Field(default_factory=dict)
    by_project: dict[str, float] = Field(default_factory=dict)
    by_team: dict[str, float] = Field(default_factory=dict)
    by_cost_center: dict[str, float] = Field(default_factory=dict)
    breakdowns: list[CostBreakdown] = Field(default_factory=list)
    generated_at: datetime
