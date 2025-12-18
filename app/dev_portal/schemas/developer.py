from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class DeveloperTier(str, Enum):
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class DeveloperBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    company_name: Optional[str] = None


class DeveloperCreate(DeveloperBase):
    password: str = Field(..., min_length=8)


class DeveloperUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    company_name: Optional[str] = None
    tier: Optional[DeveloperTier] = None


class DeveloperResponse(DeveloperBase):
    id: int
    tier: DeveloperTier
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class APIKeyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    environment: str = Field(default="production")


class APIKeyCreate(APIKeyBase):
    expires_at: Optional[datetime] = None


class APIKeyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class APIKeyResponse(APIKeyBase):
    id: int
    key_prefix: str
    is_active: bool
    rate_limit_tier: str
    requests_per_minute: int
    requests_per_day: int
    last_used_at: Optional[datetime]
    expires_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class APIKeyCreatedResponse(APIKeyResponse):
    api_key: str


class RateLimitLogResponse(BaseModel):
    id: int
    endpoint: str
    requests_count: int
    window_start: datetime
    window_end: datetime
    limit_exceeded: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RateLimitDashboard(BaseModel):
    api_key_id: int
    api_key_name: str
    current_minute_usage: int
    current_day_usage: int
    minute_limit: int
    day_limit: int
    minute_usage_percent: float
    day_usage_percent: float
    recent_limit_exceeded_count: int
    top_endpoints: List[dict]


class WebhookBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    url: str = Field(..., max_length=500)
    events: List[str]
    retry_count: int = Field(default=3, ge=0, le=10)
    timeout_seconds: int = Field(default=30, ge=5, le=120)


class WebhookCreate(WebhookBase):
    pass


class WebhookUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    url: Optional[str] = Field(None, max_length=500)
    events: Optional[List[str]] = None
    is_active: Optional[bool] = None
    retry_count: Optional[int] = Field(None, ge=0, le=10)
    timeout_seconds: Optional[int] = Field(None, ge=5, le=120)


class WebhookResponse(WebhookBase):
    id: int
    secret: str
    is_active: bool
    last_triggered_at: Optional[datetime]
    last_status_code: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WebhookDeliveryLogResponse(BaseModel):
    id: int
    event_type: str
    payload: str
    response_status: Optional[int]
    response_body: Optional[str]
    delivery_time_ms: Optional[int]
    success: bool
    attempt_number: int
    created_at: datetime

    class Config:
        from_attributes = True


class WebhookTestRequest(BaseModel):
    event_type: str = "test.event"
    payload: Optional[dict] = None


class SandboxBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    mock_data_enabled: bool = True
    rate_limit_disabled: bool = True
    log_all_requests: bool = True


class SandboxCreate(SandboxBase):
    expires_in_days: Optional[int] = Field(None, ge=1, le=90)


class SandboxUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    mock_data_enabled: Optional[bool] = None
    rate_limit_disabled: Optional[bool] = None
    log_all_requests: Optional[bool] = None


class SandboxResponse(SandboxBase):
    id: int
    base_url: str
    is_active: bool
    expires_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SandboxRequestLogResponse(BaseModel):
    id: int
    method: str
    endpoint: str
    request_headers: Optional[str]
    request_body: Optional[str]
    response_status: int
    response_body: Optional[str]
    response_time_ms: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class AnalyticsResponse(BaseModel):
    id: int
    date: datetime
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_time_ms: float
    bandwidth_used_mb: float
    unique_endpoints: int
    error_rate: float
    created_at: datetime

    class Config:
        from_attributes = True


class AnalyticsSummary(BaseModel):
    period_start: datetime
    period_end: datetime
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_time_ms: float
    total_bandwidth_mb: float
    avg_error_rate: float
    daily_breakdown: List[AnalyticsResponse]


class SDKBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    language: str = Field(..., min_length=1, max_length=50)
    version: str = Field(..., min_length=1, max_length=20)
    description: Optional[str] = None
    download_url: str = Field(..., max_length=500)
    documentation_url: Optional[str] = Field(None, max_length=500)
    changelog: Optional[str] = None
    min_runtime_version: Optional[str] = None


class SDKCreate(SDKBase):
    is_stable: bool = True


class SDKUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    download_url: Optional[str] = Field(None, max_length=500)
    documentation_url: Optional[str] = Field(None, max_length=500)
    changelog: Optional[str] = None
    is_stable: Optional[bool] = None
    is_deprecated: Optional[bool] = None


class SDKResponse(SDKBase):
    id: int
    is_stable: bool
    is_deprecated: bool
    download_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class APIDocumentationBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    slug: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1, max_length=100)
    content: str
    version: str = Field(default="1.0", max_length=20)
    order_index: int = Field(default=0, ge=0)


class APIDocumentationCreate(APIDocumentationBase):
    is_published: bool = True


class APIDocumentationUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    content: Optional[str] = None
    version: Optional[str] = Field(None, max_length=20)
    is_published: Optional[bool] = None
    order_index: Optional[int] = Field(None, ge=0)


class APIDocumentationResponse(APIDocumentationBase):
    id: int
    is_published: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class APIEndpointBase(BaseModel):
    method: str = Field(..., max_length=10)
    path: str = Field(..., max_length=500)
    summary: str = Field(..., max_length=500)
    description: Optional[str] = None
    request_body_schema: Optional[str] = None
    response_schema: Optional[str] = None
    parameters: Optional[str] = None
    example_request: Optional[str] = None
    example_response: Optional[str] = None
    requires_auth: bool = True
    rate_limit_info: Optional[str] = None


class APIEndpointCreate(APIEndpointBase):
    documentation_id: int


class APIEndpointUpdate(BaseModel):
    method: Optional[str] = Field(None, max_length=10)
    path: Optional[str] = Field(None, max_length=500)
    summary: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    request_body_schema: Optional[str] = None
    response_schema: Optional[str] = None
    parameters: Optional[str] = None
    example_request: Optional[str] = None
    example_response: Optional[str] = None
    is_deprecated: Optional[bool] = None
    requires_auth: Optional[bool] = None
    rate_limit_info: Optional[str] = None


class APIEndpointResponse(APIEndpointBase):
    id: int
    documentation_id: int
    is_deprecated: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    developer_id: Optional[int] = None
