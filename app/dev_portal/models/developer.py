from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from ..database import Base


class DeveloperTier(str, enum.Enum):
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class Developer(Base):
    __tablename__ = "developers"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=True)
    tier = Column(SQLEnum(DeveloperTier), default=DeveloperTier.FREE)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    api_keys = relationship("APIKey", back_populates="developer", cascade="all, delete-orphan")
    webhooks = relationship("Webhook", back_populates="developer", cascade="all, delete-orphan")
    sandbox_environments = relationship("SandboxEnvironment", back_populates="developer", cascade="all, delete-orphan")
    analytics = relationship("DeveloperAnalytics", back_populates="developer", cascade="all, delete-orphan")
    sdk_downloads = relationship("SDKDownload", back_populates="developer", cascade="all, delete-orphan")


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    developer_id = Column(Integer, ForeignKey("developers.id"), nullable=False)
    key_hash = Column(String(255), unique=True, nullable=False)
    key_prefix = Column(String(10), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    environment = Column(String(20), default="production")
    rate_limit_tier = Column(String(50), default="standard")
    requests_per_minute = Column(Integer, default=60)
    requests_per_day = Column(Integer, default=10000)
    last_used_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    developer = relationship("Developer", back_populates="api_keys")
    rate_limit_logs = relationship("RateLimitLog", back_populates="api_key", cascade="all, delete-orphan")


class RateLimitLog(Base):
    __tablename__ = "rate_limit_logs"

    id = Column(Integer, primary_key=True, index=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"), nullable=False)
    endpoint = Column(String(255), nullable=False)
    requests_count = Column(Integer, default=0)
    window_start = Column(DateTime, nullable=False)
    window_end = Column(DateTime, nullable=False)
    limit_exceeded = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    api_key = relationship("APIKey", back_populates="rate_limit_logs")


class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(Integer, primary_key=True, index=True)
    developer_id = Column(Integer, ForeignKey("developers.id"), nullable=False)
    name = Column(String(100), nullable=False)
    url = Column(String(500), nullable=False)
    secret = Column(String(255), nullable=False)
    events = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    retry_count = Column(Integer, default=3)
    timeout_seconds = Column(Integer, default=30)
    last_triggered_at = Column(DateTime, nullable=True)
    last_status_code = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    developer = relationship("Developer", back_populates="webhooks")
    delivery_logs = relationship("WebhookDeliveryLog", back_populates="webhook", cascade="all, delete-orphan")


class WebhookDeliveryLog(Base):
    __tablename__ = "webhook_delivery_logs"

    id = Column(Integer, primary_key=True, index=True)
    webhook_id = Column(Integer, ForeignKey("webhooks.id"), nullable=False)
    event_type = Column(String(100), nullable=False)
    payload = Column(Text, nullable=False)
    response_status = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    delivery_time_ms = Column(Integer, nullable=True)
    success = Column(Boolean, default=False)
    attempt_number = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    webhook = relationship("Webhook", back_populates="delivery_logs")


class SandboxEnvironment(Base):
    __tablename__ = "sandbox_environments"

    id = Column(Integer, primary_key=True, index=True)
    developer_id = Column(Integer, ForeignKey("developers.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    base_url = Column(String(500), nullable=False)
    is_active = Column(Boolean, default=True)
    mock_data_enabled = Column(Boolean, default=True)
    rate_limit_disabled = Column(Boolean, default=True)
    log_all_requests = Column(Boolean, default=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    developer = relationship("Developer", back_populates="sandbox_environments")
    request_logs = relationship("SandboxRequestLog", back_populates="sandbox", cascade="all, delete-orphan")


class SandboxRequestLog(Base):
    __tablename__ = "sandbox_request_logs"

    id = Column(Integer, primary_key=True, index=True)
    sandbox_id = Column(Integer, ForeignKey("sandbox_environments.id"), nullable=False)
    method = Column(String(10), nullable=False)
    endpoint = Column(String(500), nullable=False)
    request_headers = Column(Text, nullable=True)
    request_body = Column(Text, nullable=True)
    response_status = Column(Integer, nullable=False)
    response_body = Column(Text, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sandbox = relationship("SandboxEnvironment", back_populates="request_logs")


class DeveloperAnalytics(Base):
    __tablename__ = "developer_analytics"

    id = Column(Integer, primary_key=True, index=True)
    developer_id = Column(Integer, ForeignKey("developers.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    total_requests = Column(Integer, default=0)
    successful_requests = Column(Integer, default=0)
    failed_requests = Column(Integer, default=0)
    avg_response_time_ms = Column(Float, default=0.0)
    bandwidth_used_mb = Column(Float, default=0.0)
    unique_endpoints = Column(Integer, default=0)
    error_rate = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    developer = relationship("Developer", back_populates="analytics")


class SDK(Base):
    __tablename__ = "sdks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    language = Column(String(50), nullable=False)
    version = Column(String(20), nullable=False)
    description = Column(Text, nullable=True)
    download_url = Column(String(500), nullable=False)
    documentation_url = Column(String(500), nullable=True)
    changelog = Column(Text, nullable=True)
    min_runtime_version = Column(String(50), nullable=True)
    is_stable = Column(Boolean, default=True)
    is_deprecated = Column(Boolean, default=False)
    download_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    downloads = relationship("SDKDownload", back_populates="sdk", cascade="all, delete-orphan")


class SDKDownload(Base):
    __tablename__ = "sdk_downloads"

    id = Column(Integer, primary_key=True, index=True)
    sdk_id = Column(Integer, ForeignKey("sdks.id"), nullable=False)
    developer_id = Column(Integer, ForeignKey("developers.id"), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sdk = relationship("SDK", back_populates="downloads")
    developer = relationship("Developer", back_populates="sdk_downloads")


class APIDocumentation(Base):
    __tablename__ = "api_documentation"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    slug = Column(String(200), unique=True, nullable=False)
    category = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    version = Column(String(20), default="1.0")
    is_published = Column(Boolean, default=True)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    endpoints = relationship("APIEndpoint", back_populates="documentation", cascade="all, delete-orphan")


class APIEndpoint(Base):
    __tablename__ = "api_endpoints"

    id = Column(Integer, primary_key=True, index=True)
    documentation_id = Column(Integer, ForeignKey("api_documentation.id"), nullable=False)
    method = Column(String(10), nullable=False)
    path = Column(String(500), nullable=False)
    summary = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    request_body_schema = Column(Text, nullable=True)
    response_schema = Column(Text, nullable=True)
    parameters = Column(Text, nullable=True)
    example_request = Column(Text, nullable=True)
    example_response = Column(Text, nullable=True)
    is_deprecated = Column(Boolean, default=False)
    requires_auth = Column(Boolean, default=True)
    rate_limit_info = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    documentation = relationship("APIDocumentation", back_populates="endpoints")
