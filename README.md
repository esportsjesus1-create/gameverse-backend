# GameVerse Developer Portal API - N1.47

A comprehensive developer portal backend for GameVerse, providing API documentation, SDK management, API key generation, rate limiting dashboard, webhook configuration, sandbox environments, and developer analytics.

## Features

- **Authentication**: Developer registration, login, and JWT-based authentication
- **API Documentation**: Create, manage, and search API documentation with endpoint details
- **SDK Management**: Manage SDKs for multiple languages with version control and download tracking
- **API Key Generation**: Generate, regenerate, and manage API keys with tier-based limits
- **Rate Limiting Dashboard**: Monitor API usage, track rate limits, and view exceeded limits
- **Webhook Configuration**: Configure webhooks with event subscriptions, test deliveries, and delivery logs
- **Sandbox Environment**: Create isolated sandbox environments for testing with request logging
- **Developer Analytics**: Track usage metrics, view trends, and generate sample analytics data

## Tech Stack

- **Framework**: FastAPI
- **Database**: SQLite (SQLAlchemy ORM)
- **Authentication**: JWT with bcrypt password hashing
- **Testing**: pytest with coverage reporting

## Quick Start

### Using Docker

```bash
docker-compose up --build
```

The API will be available at `http://localhost:8000`

### Local Development

1. Install dependencies:
```bash
poetry install
```

2. Run the development server:
```bash
poetry run fastapi dev app/main.py
```

3. Access the API documentation at `http://localhost:8000/docs`

## API Endpoints

### Authentication
- `POST /api/v1/dev-portal/auth/register` - Register a new developer
- `POST /api/v1/dev-portal/auth/login` - Login and get access token
- `GET /api/v1/dev-portal/auth/me` - Get current developer info
- `PUT /api/v1/dev-portal/auth/me` - Update current developer

### API Keys
- `POST /api/v1/dev-portal/api-keys/` - Create a new API key
- `GET /api/v1/dev-portal/api-keys/` - List all API keys
- `GET /api/v1/dev-portal/api-keys/{key_id}` - Get API key details
- `PUT /api/v1/dev-portal/api-keys/{key_id}` - Update API key
- `DELETE /api/v1/dev-portal/api-keys/{key_id}` - Delete API key
- `POST /api/v1/dev-portal/api-keys/{key_id}/regenerate` - Regenerate API key

### Rate Limiting
- `GET /api/v1/dev-portal/rate-limiting/dashboard` - Get rate limit dashboard
- `GET /api/v1/dev-portal/rate-limiting/logs/{api_key_id}` - Get rate limit logs
- `POST /api/v1/dev-portal/rate-limiting/simulate` - Simulate rate limit usage
- `GET /api/v1/dev-portal/rate-limiting/exceeded/{api_key_id}` - Get exceeded limits

### Webhooks
- `POST /api/v1/dev-portal/webhooks/` - Create a webhook
- `GET /api/v1/dev-portal/webhooks/` - List webhooks
- `GET /api/v1/dev-portal/webhooks/{webhook_id}` - Get webhook details
- `PUT /api/v1/dev-portal/webhooks/{webhook_id}` - Update webhook
- `DELETE /api/v1/dev-portal/webhooks/{webhook_id}` - Delete webhook
- `POST /api/v1/dev-portal/webhooks/{webhook_id}/test` - Test webhook
- `GET /api/v1/dev-portal/webhooks/{webhook_id}/deliveries` - Get delivery logs
- `GET /api/v1/dev-portal/webhooks/events/available` - Get available events

### Sandbox
- `POST /api/v1/dev-portal/sandbox/` - Create sandbox environment
- `GET /api/v1/dev-portal/sandbox/` - List sandbox environments
- `GET /api/v1/dev-portal/sandbox/{sandbox_id}` - Get sandbox details
- `PUT /api/v1/dev-portal/sandbox/{sandbox_id}` - Update sandbox
- `DELETE /api/v1/dev-portal/sandbox/{sandbox_id}` - Delete sandbox
- `POST /api/v1/dev-portal/sandbox/{sandbox_id}/reset` - Reset sandbox
- `POST /api/v1/dev-portal/sandbox/{sandbox_id}/simulate` - Simulate request
- `GET /api/v1/dev-portal/sandbox/{sandbox_id}/logs` - Get request logs

### Analytics
- `GET /api/v1/dev-portal/analytics/summary` - Get analytics summary
- `GET /api/v1/dev-portal/analytics/daily` - Get daily analytics
- `GET /api/v1/dev-portal/analytics/endpoints` - Get endpoint analytics
- `GET /api/v1/dev-portal/analytics/api-keys` - Get API key analytics
- `GET /api/v1/dev-portal/analytics/usage-trends` - Get usage trends
- `POST /api/v1/dev-portal/analytics/generate-sample-data` - Generate sample data

### SDKs
- `GET /api/v1/dev-portal/sdks/` - List SDKs
- `GET /api/v1/dev-portal/sdks/languages` - Get available languages
- `GET /api/v1/dev-portal/sdks/{sdk_id}` - Get SDK details
- `POST /api/v1/dev-portal/sdks/` - Create SDK (Pro/Enterprise)
- `PUT /api/v1/dev-portal/sdks/{sdk_id}` - Update SDK (Pro/Enterprise)
- `DELETE /api/v1/dev-portal/sdks/{sdk_id}` - Delete SDK (Enterprise)
- `POST /api/v1/dev-portal/sdks/{sdk_id}/download` - Download SDK
- `GET /api/v1/dev-portal/sdks/latest/{language}` - Get latest SDK for language

### Documentation
- `GET /api/v1/dev-portal/documentation/` - List documentation
- `GET /api/v1/dev-portal/documentation/categories` - Get categories
- `GET /api/v1/dev-portal/documentation/search` - Search documentation
- `GET /api/v1/dev-portal/documentation/{doc_id}` - Get documentation
- `POST /api/v1/dev-portal/documentation/` - Create documentation (Pro/Enterprise)
- `PUT /api/v1/dev-portal/documentation/{doc_id}` - Update documentation
- `DELETE /api/v1/dev-portal/documentation/{doc_id}` - Delete documentation (Enterprise)
- `POST /api/v1/dev-portal/documentation/endpoints` - Create endpoint documentation

## Developer Tiers

- **Free**: 2 API keys, 3 webhooks, 1 sandbox, 60 req/min, 1000 req/day
- **Basic**: 5 API keys, 10 webhooks, 3 sandboxes, 120 req/min, 10000 req/day
- **Pro**: 20 API keys, 50 webhooks, 10 sandboxes, 300 req/min, 100000 req/day, SDK/Doc management
- **Enterprise**: 100 API keys, 200 webhooks, 50 sandboxes, 1000 req/min, 1000000 req/day, Full access

## Testing

Run tests with coverage:
```bash
poetry run pytest tests/ -v --cov=app --cov-report=term-missing
```

## License

Proprietary - GameVerse
