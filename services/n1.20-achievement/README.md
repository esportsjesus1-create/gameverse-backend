# GameVerse N1.20 Achievement Module

A comprehensive achievement system for the GameVerse platform with progress tracking, unlock logic, and real-time notifications.

## Features

- **Achievement Management**: Create, update, and manage achievements with different types (single, progressive, tiered)
- **Progress Tracking**: Track user progress towards achievements with Redis caching for performance
- **Unlock Logic**: Automatic achievement unlocking when criteria are met
- **Notification System**: Real-time notifications for achievement unlocks and tier advancements
- **RESTful API**: Full CRUD operations for achievements, progress, and notifications

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.3+
- **Framework**: Express.js
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Testing**: Jest with supertest
- **Containerization**: Docker & Docker Compose

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Start all services (PostgreSQL, Redis, Achievement Service)
docker-compose up -d

# View logs
docker-compose logs -f achievement-service

# Stop services
docker-compose down
```

### Local Development

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Start PostgreSQL and Redis (using Docker)
docker-compose up -d postgres redis

# Run database migrations
pnpm db:migrate

# Seed sample data (optional)
pnpm db:seed

# Start development server
pnpm dev
```

## API Endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Service status |
| GET | `/api/v1/health/ready` | Readiness check (DB + Redis) |
| GET | `/api/v1/health/live` | Liveness check |

### Achievements

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/achievements` | List all achievements |
| GET | `/api/v1/achievements/:id` | Get achievement by ID |
| GET | `/api/v1/achievements/category/:category` | Get achievements by category |
| POST | `/api/v1/achievements` | Create achievement |
| PUT | `/api/v1/achievements/:id` | Update achievement |
| DELETE | `/api/v1/achievements/:id` | Delete achievement |

### User Achievements

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/:userId/achievements` | Get user's achievements |
| GET | `/api/v1/users/:userId/achievements/unlocked` | Get unlocked achievements |
| GET | `/api/v1/users/:userId/achievements/stats` | Get achievement stats |
| GET | `/api/v1/users/:userId/achievements/:achievementId/progress` | Get progress |
| POST | `/api/v1/users/:userId/achievements/:achievementId/progress` | Update progress |
| POST | `/api/v1/users/:userId/achievements/:achievementId/unlock` | Check and unlock |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/:userId/notifications` | Get notifications |
| GET | `/api/v1/users/:userId/notifications/unread-count` | Get unread count |
| PUT | `/api/v1/users/:userId/notifications/read-all` | Mark all as read |
| PUT | `/api/v1/users/:userId/notifications/:id/read` | Mark as read |
| DELETE | `/api/v1/users/:userId/notifications/:id` | Delete notification |

## Achievement Types

- **Single**: One-time achievements (e.g., "Complete your first game")
- **Progressive**: Incremental achievements (e.g., "Play 100 games")
- **Tiered**: Multi-level achievements with milestones (e.g., Bronze/Silver/Gold collector)

## Achievement Categories

- `gameplay` - Game-related achievements
- `social` - Social interaction achievements
- `collection` - Item collection achievements
- `exploration` - Discovery achievements
- `competitive` - Competitive/ranking achievements
- `special` - Special/seasonal achievements

## Testing

```bash
# Run unit tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run integration tests
pnpm test:integration

# Run tests in watch mode
pnpm test:watch
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | Database user | `gameverse` |
| `DB_PASSWORD` | Database password | `gameverse` |
| `DB_NAME` | Database name | `gameverse_achievements` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |

## Project Structure

```
n1.20-achievement/
├── src/
│   ├── config/          # Configuration (database, redis, env)
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   ├── models/          # Data models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── types/           # TypeScript types
│   ├── utils/           # Utilities
│   ├── db/              # Migrations and seeds
│   └── index.ts         # Application entry point
├── tests/
│   ├── unit/            # Unit tests
│   └── integration/     # Integration tests
├── Dockerfile           # Production Docker image
├── docker-compose.yml   # Production compose
├── docker-compose.dev.yml # Development compose
└── init-db.sql          # Database initialization
```

## License

MIT
