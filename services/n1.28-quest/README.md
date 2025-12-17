# N1.28 Quest Module

GameVerse Quest Module - Daily/Weekly quest system with objectives tracking and reward distribution.

## Features

- **Daily/Weekly Quest System**: Automatic reset at configurable times (midnight UTC for daily, Monday for weekly)
- **Objectives Tracking**: Multiple objective types (kill, collect, achieve, visit, interact, win, play, spend, earn)
- **Reward Distribution**: Support for XP, currency, items, achievements, badges, and titles
- **Caching**: Redis-based caching for improved performance
- **Scheduled Tasks**: Automatic quest expiration and reset using node-cron

## Tech Stack

- TypeScript
- Node.js + Express
- PostgreSQL
- Redis
- Docker

## API Endpoints

### Quests
- `POST /api/v1/quests` - Create a new quest
- `GET /api/v1/quests` - List quests with pagination and filters
- `GET /api/v1/quests/active` - Get active quests
- `GET /api/v1/quests/:id` - Get quest by ID
- `PATCH /api/v1/quests/:id/status` - Update quest status
- `DELETE /api/v1/quests/:id` - Delete quest

### User Quests
- `GET /api/v1/users/:userId/quests` - Get user's quests
- `GET /api/v1/users/:userId/quests/active` - Get user's active quests
- `GET /api/v1/users/:userId/quests/:questId` - Get specific user quest
- `POST /api/v1/users/:userId/quests/:questId/accept` - Accept a quest
- `POST /api/v1/users/:userId/quests/:questId/progress` - Update quest progress
- `POST /api/v1/users/:userId/quests/:questId/claim` - Claim quest rewards

### Rewards
- `GET /api/v1/users/:userId/rewards` - Get user's rewards
- `GET /api/v1/users/:userId/rewards/recent` - Get recent rewards
- `GET /api/v1/users/:userId/rewards/summary` - Get reward summary by type
- `GET /api/v1/users/:userId/rewards/quest/:questId` - Get rewards for specific quest

### Health
- `GET /api/v1/health` - Full health check
- `GET /api/v1/health/ready` - Readiness probe
- `GET /api/v1/health/live` - Liveness probe

## Development

### Prerequisites
- Node.js 18+
- PostgreSQL 16+
- Redis 7+

### Local Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run development server
npm run dev
```

### Using Docker

```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose up -d
```

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests in watch mode
npm run test:watch
```

### Linting

```bash
# Check for lint errors
npm run lint

# Fix lint errors
npm run lint:fix

# Type check
npm run typecheck
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment | development |
| PORT | Server port | 3028 |
| HOST | Server host | 0.0.0.0 |
| POSTGRES_HOST | PostgreSQL host | localhost |
| POSTGRES_PORT | PostgreSQL port | 5432 |
| POSTGRES_DB | Database name | gameverse_quest |
| POSTGRES_USER | Database user | gameverse |
| POSTGRES_PASSWORD | Database password | gameverse_secret |
| REDIS_HOST | Redis host | localhost |
| REDIS_PORT | Redis port | 6379 |
| REDIS_PASSWORD | Redis password | (empty) |
| DAILY_RESET_HOUR | Hour for daily reset (UTC) | 0 |
| WEEKLY_RESET_DAY | Day for weekly reset (0=Sun) | 1 |
| QUEST_CACHE_TTL | Cache TTL in seconds | 300 |
| LOG_LEVEL | Logging level | info |

## Database Schema

The module uses the following tables:
- `quests` - Quest definitions
- `quest_objectives` - Quest objectives
- `quest_rewards` - Quest rewards
- `user_quests` - User quest assignments
- `user_quest_progress` - User progress on objectives
- `user_rewards` - Claimed rewards

## License

MIT
