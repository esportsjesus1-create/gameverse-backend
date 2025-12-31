# GameVerse Analytics Module - API Documentation

## Overview

The GameVerse Analytics Module provides comprehensive analytics capabilities for tracking, querying, and aggregating game metrics and events. This module operates as a complementary layer on top of GamerStake, providing production-ready analytics with 40+ domain-specific error codes, structured logging, caching, and security features.

## Base URL

```
/api/v1
```

## Authentication

All endpoints require authentication via the `Authorization` header with a valid JWT token. The module uses Role-Based Access Control (RBAC) with three roles:

- **ADMIN**: Full access to all features
- **ANALYST**: Read/write access to metrics, events, queries, and reports
- **VIEWER**: Read-only access to metrics and events

## Rate Limiting

The API implements 3-tier rate limiting based on user tier:

| Tier | Requests/Minute | Requests/Hour | Requests/Day |
|------|-----------------|---------------|--------------|
| BASIC | 60 | 1,000 | 10,000 |
| STANDARD | 300 | 5,000 | 50,000 |
| PREMIUM | 1,000 | 20,000 | 200,000 |

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time when the rate limit resets

---

## Functional Requirements

### FR-001: Create Metric
**Endpoint:** `POST /api/v1/metrics`
**Permission:** METRICS_WRITE

Create a new metric definition.

**Request Body:**
```json
{
  "name": "player_login_count",
  "type": "COUNTER",
  "category": "PLAYER",
  "description": "Number of player logins",
  "unit": "count",
  "labels": {
    "env": "production"
  }
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "player_login_count",
    "type": "COUNTER",
    "category": "PLAYER",
    "value": 0,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### FR-002: Get Metric by ID
**Endpoint:** `GET /api/v1/metrics/:metricId`
**Permission:** METRICS_READ

Retrieve a specific metric by its ID.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "player_login_count",
    "type": "COUNTER",
    "category": "PLAYER",
    "value": 1500,
    "labels": {},
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T00:00:00Z"
  }
}
```

### FR-003: Update Metric
**Endpoint:** `PATCH /api/v1/metrics/:metricId`
**Permission:** METRICS_WRITE

Update metric properties (description, labels, unit).

**Request Body:**
```json
{
  "description": "Updated description",
  "labels": {
    "env": "staging"
  }
}
```

### FR-004: Delete Metric
**Endpoint:** `DELETE /api/v1/metrics/:metricId`
**Permission:** METRICS_DELETE

Delete a metric and all associated data points.

**Response:** `204 No Content`

### FR-005: Record Metric Value
**Endpoint:** `POST /api/v1/metrics/record`
**Permission:** METRICS_WRITE

Record a new value for a metric.

**Request Body:**
```json
{
  "metricId": "uuid",
  "value": 100,
  "timestamp": "2024-01-01T00:00:00Z",
  "labels": {
    "region": "us-east"
  }
}
```

### FR-006: Batch Record Metrics
**Endpoint:** `POST /api/v1/metrics/batch`
**Permission:** METRICS_WRITE

Record multiple metric values in a single request (max 1000).

**Request Body:**
```json
{
  "metrics": [
    { "metricId": "uuid1", "value": 100 },
    { "metricId": "uuid2", "value": 200 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recorded": 2,
    "failed": 0,
    "metrics": [...],
    "errors": []
  }
}
```

### FR-007: Query Metrics
**Endpoint:** `GET /api/v1/metrics`
**Permission:** METRICS_READ

Query metrics with filters and pagination.

**Query Parameters:**
- `names`: Comma-separated metric names
- `types`: Comma-separated metric types (COUNTER, GAUGE, HISTOGRAM, SUMMARY, TIMER)
- `categories`: Comma-separated categories
- `labels`: JSON-encoded label filters
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 50, max: 1000)

### FR-008: Get Metric Time Series
**Endpoint:** `GET /api/v1/metrics/:metricId/series`
**Permission:** METRICS_READ

Get time series data for a metric.

**Query Parameters:**
- `start`: Start timestamp (ISO 8601)
- `end`: End timestamp (ISO 8601)
- `granularity`: MINUTE, HOUR, DAY, WEEK, MONTH, QUARTER, YEAR

### FR-009: Aggregate Metric
**Endpoint:** `GET /api/v1/metrics/:metricId/aggregate`
**Permission:** METRICS_READ

Compute aggregation over metric data.

**Query Parameters:**
- `type`: SUM, AVG, MIN, MAX, COUNT, COUNT_DISTINCT, MEDIAN, PERCENTILE, STDDEV, VARIANCE
- `start`: Start timestamp
- `end`: End timestamp
- `percentile`: Percentile value (for PERCENTILE type)

### FR-010: Track Event
**Endpoint:** `POST /api/v1/events`
**Permission:** EVENTS_WRITE

Track a single analytics event.

**Request Body:**
```json
{
  "type": "PLAYER_LOGIN",
  "playerId": "player-123",
  "sessionId": "session-456",
  "correlationId": "corr-789",
  "payload": {
    "action": "login",
    "method": "oauth"
  },
  "metadata": {
    "source": "web",
    "version": "1.0"
  }
}
```

### FR-011: Batch Track Events
**Endpoint:** `POST /api/v1/events/batch`
**Permission:** EVENTS_WRITE

Track multiple events in a single request (max 500).

### FR-012: Get Event by ID
**Endpoint:** `GET /api/v1/events/:eventId`
**Permission:** EVENTS_READ

Retrieve a specific event by its ID.

### FR-013: Query Events
**Endpoint:** `GET /api/v1/events`
**Permission:** EVENTS_READ

Query events with filters and pagination.

**Query Parameters:**
- `types`: Comma-separated event types
- `playerId`: Filter by player ID
- `sessionId`: Filter by session ID
- `correlationId`: Filter by correlation ID
- `timeRange.start`: Start timestamp
- `timeRange.end`: End timestamp
- `sortBy`: Field to sort by (default: timestamp)
- `sortOrder`: ASC or DESC (default: DESC)
- `page`: Page number
- `limit`: Results per page

### FR-014: Get Events by Player
**Endpoint:** `GET /api/v1/events/player/:playerId`
**Permission:** EVENTS_READ

Get all events for a specific player.

### FR-015: Get Events by Session
**Endpoint:** `GET /api/v1/events/session/:sessionId`
**Permission:** EVENTS_READ

Get all events for a specific session.

### FR-016: Get Events by Correlation ID
**Endpoint:** `GET /api/v1/events/correlation/:correlationId`
**Permission:** EVENTS_READ

Get all events with a specific correlation ID.

### FR-017: Get Event Type Distribution
**Endpoint:** `GET /api/v1/events/distribution`
**Permission:** EVENTS_READ

Get distribution of event types.

### FR-018: Delete Event
**Endpoint:** `DELETE /api/v1/events/:eventId`
**Permission:** EVENTS_DELETE

Delete a specific event.

### FR-019: Get Event Queue Status
**Endpoint:** `GET /api/v1/events/queue/status`
**Permission:** ADMIN

Get the current status of the event processing queue.

### FR-020: Process Event Queue
**Endpoint:** `POST /api/v1/events/queue/process`
**Permission:** ADMIN

Manually trigger event queue processing.

### FR-021: Enable Event Tracking
**Endpoint:** `POST /api/v1/events/tracking/enable`
**Permission:** ADMIN

Enable event tracking system-wide.

### FR-022: Disable Event Tracking
**Endpoint:** `POST /api/v1/events/tracking/disable`
**Permission:** ADMIN

Disable event tracking system-wide.

### FR-023: Execute Analytics Query
**Endpoint:** `POST /api/v1/queries/execute`
**Permission:** QUERY_BASIC

Execute an analytics query with aggregations.

**Request Body:**
```json
{
  "name": "Daily Active Users",
  "metrics": ["player_login_count"],
  "filters": [
    {
      "field": "category",
      "operator": "EQ",
      "value": "PLAYER"
    }
  ],
  "groupBy": ["region"],
  "aggregations": [
    {
      "field": "value",
      "type": "SUM",
      "alias": "total_logins"
    }
  ],
  "timeRange": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  },
  "granularity": "DAY",
  "orderBy": [
    { "field": "total_logins", "direction": "DESC" }
  ],
  "limit": 100,
  "offset": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "queryId": "uuid",
    "totalRows": 30,
    "executionTimeMs": 45,
    "fromCache": false,
    "truncated": false,
    "executedAt": "2024-01-15T00:00:00Z"
  }
}
```

### FR-024: Save Query
**Endpoint:** `POST /api/v1/queries`
**Permission:** QUERY_ADVANCED

Save a query for later execution.

### FR-025: List Saved Queries
**Endpoint:** `GET /api/v1/queries`
**Permission:** QUERY_BASIC

List all saved queries.

### FR-026: Get Saved Query
**Endpoint:** `GET /api/v1/queries/:queryId`
**Permission:** QUERY_BASIC

Get a specific saved query.

### FR-027: Delete Saved Query
**Endpoint:** `DELETE /api/v1/queries/:queryId`
**Permission:** QUERY_ADVANCED

Delete a saved query.

### FR-028: Execute Saved Query
**Endpoint:** `POST /api/v1/queries/:queryId/execute`
**Permission:** QUERY_BASIC

Execute a previously saved query.

### FR-029: Health Check
**Endpoint:** `GET /health`
**Permission:** Public

Check service health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "timestamp": "2024-01-15T00:00:00Z"
  }
}
```

### FR-030: Readiness Check
**Endpoint:** `GET /ready`
**Permission:** Public

Check service readiness including cache status.

### FR-031: Input Sanitization
All user inputs are automatically sanitized to prevent XSS and injection attacks:
- HTML entities are escaped
- Script injections are removed
- Null bytes are stripped
- Whitespace is trimmed

### FR-032: Request ID Tracking
All requests are assigned a unique request ID (X-Request-Id header) for tracing and debugging.

### FR-033: Structured Logging
All operations are logged with structured JSON format including:
- Event type (30+ types)
- Timestamp
- Request ID
- User ID
- Duration
- Metadata

### FR-034: Audit Trail
Security-sensitive operations are logged to an audit trail:
- CREATE, READ, UPDATE, DELETE operations
- Configuration changes
- Authentication events
- Permission denials

### FR-035: Cache Management
Query results are cached with configurable TTL:
- Metrics queries: 60 seconds
- Analytics queries: 300 seconds
- Aggregations: 600 seconds

### FR-036: Error Handling
All errors return structured responses with:
- Error code (40+ domain-specific codes)
- Human-readable message
- Request ID
- Timestamp
- Path

### FR-037: Pagination
All list endpoints support pagination:
- `page`: Page number (1-indexed)
- `limit`: Results per page (max 1000)
- Response includes `total`, `totalPages`, `hasMore`

### FR-038: Time Range Validation
Time range queries are validated:
- Maximum range: 365 days
- End must be after start
- Timestamps must be valid ISO 8601

### FR-039: Batch Size Limits
Batch operations have configurable limits:
- Metrics batch: 1000 max
- Events batch: 500 max

### FR-040: Query Timeout
Queries have a configurable timeout (default: 30 seconds) to prevent long-running operations.

### FR-041: Metric Types
Supported metric types:
- COUNTER: Monotonically increasing value
- GAUGE: Point-in-time value
- HISTOGRAM: Distribution of values
- SUMMARY: Statistical summary
- TIMER: Duration measurements

### FR-042: Metric Categories
Supported metric categories:
- PLAYER: Player-related metrics
- GAME: Game session metrics
- SYSTEM: System performance metrics
- PERFORMANCE: Application performance
- BUSINESS: Business KPIs
- ENGAGEMENT: User engagement
- RETENTION: User retention
- MONETIZATION: Revenue metrics
- SOCIAL: Social features
- CUSTOM: Custom metrics

### FR-043: Event Types
30+ supported event types including:
- PLAYER_LOGIN, PLAYER_LOGOUT, PLAYER_REGISTER
- GAME_START, GAME_END, GAME_PAUSE, GAME_RESUME
- ACHIEVEMENT_UNLOCKED, LEVEL_UP, ITEM_ACQUIRED
- PURCHASE_STARTED, PURCHASE_COMPLETED, PURCHASE_FAILED
- SOCIAL_SHARE, FRIEND_ADDED, GUILD_JOINED
- ERROR_OCCURRED, CRASH_REPORTED
- CUSTOM_EVENT

### FR-044: Aggregation Types
Supported aggregation types:
- SUM, AVG, MIN, MAX, COUNT
- COUNT_DISTINCT, MEDIAN
- PERCENTILE (with configurable percentile)
- STDDEV, VARIANCE

### FR-045: Filter Operators
Supported filter operators:
- EQ, NE (equality)
- GT, GTE, LT, LTE (comparison)
- IN, NOT_IN (set membership)
- CONTAINS, STARTS_WITH, ENDS_WITH (string)
- BETWEEN (range)
- IS_NULL, IS_NOT_NULL (null checks)

### FR-046: Time Granularities
Supported time granularities for aggregation:
- MINUTE, HOUR, DAY
- WEEK, MONTH, QUARTER, YEAR

### FR-047: CORS Support
Cross-Origin Resource Sharing is configurable via environment variables.

### FR-048: Graceful Shutdown
The service handles SIGTERM and SIGINT signals for graceful shutdown:
- Stops accepting new requests
- Completes in-flight requests
- Flushes logs and caches
- Closes connections

### FR-049: Environment Configuration
All settings are configurable via environment variables:
- Server: PORT, HOST, NODE_ENV
- Cache: CACHE_ENABLED, CACHE_DEFAULT_TTL, CACHE_MAX_SIZE
- Rate Limiting: RATE_LIMIT_ENABLED, tier-specific limits
- Query: QUERY_TIMEOUT_MS, QUERY_MAX_RESULTS, QUERY_MAX_TIME_RANGE_DAYS
- Batch: BATCH_MAX_METRICS, BATCH_MAX_EVENTS

### FR-050: Security Headers
Security headers are set via Helmet middleware:
- Content-Security-Policy
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection

---

## Error Codes

### Analytics Core (ANALYTICS_1xxx)
| Code | HTTP Status | Description |
|------|-------------|-------------|
| ANALYTICS_1000 | 500 | Initialization failed |
| ANALYTICS_1001 | 503 | Service unavailable |
| ANALYTICS_1002 | 500 | Configuration error |
| ANALYTICS_1003 | 500 | Internal error |
| ANALYTICS_1004 | 500 | Database connection failed |
| ANALYTICS_1005 | 500 | External service error |
| ANALYTICS_1006 | 500 | Serialization error |

### Metrics (METRICS_2xxx)
| Code | HTTP Status | Description |
|------|-------------|-------------|
| METRICS_2000 | 404 | Metric not found |
| METRICS_2001 | 409 | Metric already exists |
| METRICS_2002 | 400 | Invalid metric type |
| METRICS_2003 | 400 | Invalid metric value |
| METRICS_2004 | 400 | Invalid metric name |
| METRICS_2005 | 400 | Invalid metric category |
| METRICS_2006 | 400 | Invalid metric labels |
| METRICS_2007 | 400 | Metric recording failed |
| METRICS_2008 | 400 | Batch recording failed |
| METRICS_2009 | 400 | Aggregation failed |

### Events (EVENTS_3xxx)
| Code | HTTP Status | Description |
|------|-------------|-------------|
| EVENTS_3000 | 404 | Event not found |
| EVENTS_3001 | 400 | Invalid event type |
| EVENTS_3002 | 400 | Invalid event payload |
| EVENTS_3003 | 400 | Event tracking failed |
| EVENTS_3004 | 400 | Batch tracking failed |
| EVENTS_3005 | 503 | Event queue full |
| EVENTS_3006 | 400 | Event processing failed |
| EVENTS_3007 | 503 | Tracking disabled |
| EVENTS_3008 | 400 | Invalid correlation ID |
| EVENTS_3009 | 400 | Invalid session ID |

### Query (QUERY_4xxx)
| Code | HTTP Status | Description |
|------|-------------|-------------|
| QUERY_4000 | 400 | Invalid syntax |
| QUERY_4001 | 400 | Invalid parameters |
| QUERY_4002 | 400 | Invalid time range |
| QUERY_4003 | 400 | Invalid aggregation |
| QUERY_4004 | 400 | Invalid filter |
| QUERY_4005 | 400 | Invalid group by |
| QUERY_4006 | 504 | Query timeout |
| QUERY_4007 | 500 | Execution failed |
| QUERY_4008 | 400 | Result too large |
| QUERY_4009 | 400 | Unsupported operation |

### Rate Limiting (RATE_6xxx)
| Code | HTTP Status | Description |
|------|-------------|-------------|
| RATE_6000 | 429 | Basic tier limit exceeded |
| RATE_6001 | 429 | Standard tier limit exceeded |
| RATE_6002 | 429 | Premium tier limit exceeded |
| RATE_6003 | 429 | Burst limit exceeded |
| RATE_6004 | 429 | Daily limit exceeded |

### Validation (VALIDATION_7xxx)
| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_7000 | 400 | Required field missing |
| VALIDATION_7001 | 400 | Invalid field type |
| VALIDATION_7002 | 400 | Field out of range |
| VALIDATION_7003 | 400 | Invalid format |
| VALIDATION_7004 | 400 | Schema validation failed |
| VALIDATION_7005 | 400 | Sanitization failed |

### Permission (PERMISSION_8xxx)
| Code | HTTP Status | Description |
|------|-------------|-------------|
| PERMISSION_8000 | 403 | Permission denied |
| PERMISSION_8001 | 403 | Insufficient role |
| PERMISSION_8002 | 403 | Resource access denied |
| PERMISSION_8003 | 401 | Authentication required |
| PERMISSION_8004 | 401 | Invalid token |

---

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 50,
    "totalPages": 2,
    "hasMore": true
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "METRICS_2000",
    "message": "Metric not found",
    "details": { ... },
    "requestId": "uuid",
    "path": "/api/v1/metrics/123",
    "timestamp": "2024-01-15T00:00:00Z"
  }
}
```
