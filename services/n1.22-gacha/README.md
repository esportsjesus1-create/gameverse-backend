# GameVerse N1.22 Gacha Module

A comprehensive gacha/loot box system with probability engine and pity system for the GameVerse backend platform.

## Features

- **Probability Engine**: Weighted random selection with cryptographically secure random number generation
- **Pity System**: Soft pity, hard pity, and guaranteed featured mechanics
- **Banner Management**: Support for Standard, Limited, and Event banners
- **Item Pool Management**: Configurable item pools with multiple rarity tiers
- **Pull History**: Complete tracking of all player pulls
- **Redis Caching**: Fast read/write for pity counters and banner configurations
- **Rate Limiting**: Built-in protection against abuse

## Tech Stack

- TypeScript
- Node.js with Express
- PostgreSQL (TypeORM)
- Redis (ioredis)
- Jest for testing
- Docker & docker-compose

## Quick Start

### Using Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f gacha-service

# Stop services
docker-compose down
```

### Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start development server
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Build for production
npm run build
```

## API Endpoints

### Player Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/gacha/pull` | Execute single or multi pull (1-10) |
| POST | `/gacha/pull/multi` | Execute 10 pulls |
| GET | `/gacha/banners` | List active banners |
| GET | `/gacha/banners/:id` | Get banner details |
| GET | `/gacha/history/:playerId` | Get pull history |
| GET | `/gacha/pity/:playerId` | Get pity status |

### Admin Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/gacha/admin/banner` | Create banner |
| PUT | `/gacha/admin/banner/:id` | Update banner |
| DELETE | `/gacha/admin/banner/:id` | Delete banner |
| POST | `/gacha/admin/items` | Create item |
| GET | `/gacha/admin/items` | List items |
| PUT | `/gacha/admin/items/:id` | Update item |
| DELETE | `/gacha/admin/items/:id` | Delete item |

### Utility

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/gacha/health` | Health check |
| POST | `/gacha/simulate` | Simulate pulls |

## Pity System

The gacha module implements a comprehensive pity system:

- **Soft Pity**: Starting at pull 74, the legendary rate increases by 6% per pull
- **Hard Pity**: Guaranteed legendary at pull 90
- **50/50 System**: 50% chance to get featured item on legendary pull
- **Guaranteed Featured**: After losing 50/50, next legendary is guaranteed featured

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3022 | Server port |
| NODE_ENV | development | Environment |
| POSTGRES_HOST | localhost | PostgreSQL host |
| POSTGRES_PORT | 5432 | PostgreSQL port |
| POSTGRES_USER | gameverse | PostgreSQL user |
| POSTGRES_PASSWORD | gameverse_secret | PostgreSQL password |
| POSTGRES_DB | gameverse_gacha | PostgreSQL database |
| REDIS_HOST | localhost | Redis host |
| REDIS_PORT | 6379 | Redis port |
| DEFAULT_SOFT_PITY_START | 74 | Soft pity start |
| DEFAULT_HARD_PITY | 90 | Hard pity threshold |
| DEFAULT_LEGENDARY_RATE | 0.006 | Base legendary rate |

## Testing

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

## Project Structure

```
n1.22-gacha/
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Express middleware
│   ├── models/           # TypeORM entities
│   ├── repositories/     # Data access layer
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── types/            # TypeScript types
│   └── index.ts          # Application entry
├── tests/
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## License

MIT
