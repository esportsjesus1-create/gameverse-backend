# N1.27 Season Module

GameVerse Season Module with ranked tiers, MMR calculation, and soft reset logic.

## Features

- **Ranked Tiers System**: Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster, Challenger
- **MMR Calculation**: ELO-based rating system with K-factor adjustments and streak bonuses
- **Soft Reset Logic**: Season transition with configurable reset factor
- **Redis Caching**: High-performance caching for player data and leaderboards
- **Placement Matches**: Configurable placement system for new seasons

## Tech Stack

- TypeScript
- Node.js + Express
- PostgreSQL (Prisma ORM)
- Redis (ioredis)
- Jest (testing)
- Docker

## Quick Start

### Development

```bash
# Start dependencies
docker-compose -f docker-compose.dev.yml up -d

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start development server
npm run dev
```

### Production

```bash
# Build and start all services
docker-compose up -d

# Run migrations
docker-compose run --rm migrate
```

## API Endpoints

### Seasons

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/seasons` | Create new season |
| GET | `/api/v1/seasons/active` | Get active season |
| GET | `/api/v1/seasons/:seasonId` | Get season by ID |
| GET | `/api/v1/seasons/number/:number` | Get season by number |
| POST | `/api/v1/seasons/:seasonId/end` | End a season |
| POST | `/api/v1/seasons/:seasonId/soft-reset` | Calculate soft reset |

### Players

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/players/:playerId/season/:seasonId/rank` | Get player rank |
| GET | `/api/v1/players/:playerId/season/:seasonId` | Get player season data |
| GET | `/api/v1/players/:playerId/season/:seasonId/history` | Get match history |
| POST | `/api/v1/players/mmr` | Update MMR after match |

### Leaderboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/leaderboard/:seasonId` | Get leaderboard |

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3027 | Server port |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `REDIS_HOST` | localhost | Redis host |
| `REDIS_PORT` | 6379 | Redis port |
| `DEFAULT_MMR` | 1200 | Starting MMR for new players |
| `SOFT_RESET_FACTOR` | 0.5 | MMR compression factor (0-1) |
| `PLACEMENT_MATCHES_REQUIRED` | 10 | Placement matches count |

## Ranked Tiers

| Tier | MMR Range | Divisions |
|------|-----------|-----------|
| Bronze | 0-799 | IV, III, II, I |
| Silver | 800-1199 | IV, III, II, I |
| Gold | 1200-1599 | IV, III, II, I |
| Platinum | 1600-1999 | IV, III, II, I |
| Diamond | 2000-2399 | IV, III, II, I |
| Master | 2400-2799 | None |
| Grandmaster | 2800-3199 | None |
| Challenger | 3200-5000 | None |

## MMR Calculation

The system uses an ELO-based formula:

```
Expected Score = 1 / (1 + 10^((OpponentMMR - PlayerMMR) / 400))
MMR Change = K * (ActualScore - ExpectedScore) + StreakBonus
```

K-factor adjustments:
- New players (<30 games): K = 48
- Standard players: K = 32
- High MMR (2400+): K = 16

## Soft Reset Formula

```
NewMMR = CurrentMMR * ResetFactor + BaseMMR * (1 - ResetFactor)
```

With default 0.5 factor: `NewMMR = (CurrentMMR + 1200) / 2`

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests with coverage
npm test -- --coverage
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm test` | Run tests |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript check |

## License

MIT
