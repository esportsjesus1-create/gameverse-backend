from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class CloudProvider(str, Enum):
    AWS = "aws"
    GCP = "gcp"
    AZURE = "azure"
    ON_PREMISE = "on_premise"


class ResourceType(str, Enum):
    COMPUTE = "compute"
    MEMORY = "memory"
    STORAGE = "storage"
    NETWORK = "network"
    DATABASE = "database"
    SERVERLESS = "serverless"


class ResourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    resource_type: ResourceType
    provider: CloudProvider
    region: str = Field(..., min_length=1, max_length=100)
    tags: dict[str, str] = Field(default_factory=dict)
    project_id: Optional[str] = None
    team_id: Optional[str] = None
    unit_cost: float = Field(..., ge=0)
    unit: str = Field(default="hour")


class Resource(ResourceCreate):
    id: str
    created_at: datetime
    updated_at: datetime
    is_active: bool = True


class ResourceUsageCreate(BaseModel):
    resource_id: str
    usage_value: float = Field(..., ge=0)
    timestamp: Optional[datetime] = None
    metadata: dict[str, str] = Field(default_factory=dict)


class ResourceUsage(ResourceUsageCreate):
    id: str
    timestamp: datetime
    cost: float
