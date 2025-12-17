# GameVerse N1.19 Leaderboard API

A high-performance leaderboard system built with TypeScript, Node.js, PostgreSQL, and Redis. Features Redis sorted sets for real-time rankings, a decay algorithm for score aging, and pagination support.

## Features

- **Redis Sorted Sets**: O(log N) operations for ranking queries
- **Decay Algorithm**: Exponential decay with configurable half-life to keep leaderboards fresh
- **Pagination**: Efficient pagination for large leaderboards
- **Player Management**: CRUD operations for player profiles
- **Score Submission**: Submit and track high scores per game
- **Nearby Rankings**: Get players around a specific player's rank

## Tech Stack

- TypeScript
- Node.js / Express
- PostgreSQL (persistent storage)
- Redis (real-time rankings)

## API Endpoints

### Players

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/players` | Create a new player |
| GET | `/api/players/:id` | Get player by ID |
| PUT | `/api/players/:id` | Update player |
| DELETE | `/api/players/:id` | Delete player |

### Leaderboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/leaderboard/scores` | Submit a score |
| GET | `/api/leaderboard/:gameId` | Get leaderboard (paginated) |
| GET | `/api/leaderboard/:gameId/player/:playerId` | Get player rank |
| GET | `/api/leaderboard/:gameId/player/:playerId/nearby` | Get nearby players |
| POST | `/api/leaderboard/:gameId/decay` | Apply decay to all scores |
| POST | `/api/leaderboard/:gameId/sync` | Sync Redis from PostgreSQL |

## Environment Variables

```env
PORT=3000
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=gameverse
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
REDIS_URL=redis://localhost:6379
DECAY_HALF_LIFE_DAYS=30
DECAY_MIN_SCORE=0
DECAY_INTERVAL_HOURS=1
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Production

```bash
npm start
```

## Lint

```bash
npm run lint
```

## Decay Algorithm

The decay algorithm uses exponential decay with a configurable half-life:

```
decayed_score = raw_score * (0.5 ^ (elapsed_days / half_life_days))
```

This ensures older scores gradually decrease in value, keeping the leaderboard dynamic and rewarding recent activity.
