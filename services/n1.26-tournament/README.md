# GameVerse N1.26 Tournament Module

Tournament management service for the GameVerse platform with bracket generation, match scheduling, and comprehensive tournament management.

## Features

- Tournament CRUD operations with configurable settings
- Multiple bracket formats: Single Elimination, Double Elimination, Round Robin
- Automatic bracket generation with proper seeding
- Match scheduling and result tracking
- Participant management with check-in support
- Automatic bracket progression on match completion

## Tech Stack

- TypeScript
- Node.js with Express
- PostgreSQL with Prisma ORM
- Jest for testing
- Docker for containerization

## API Endpoints

### Tournaments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/tournaments | Create tournament |
| GET | /api/v1/tournaments | List tournaments |
| GET | /api/v1/tournaments/:id | Get tournament |
| PUT | /api/v1/tournaments/:id | Update tournament |
| DELETE | /api/v1/tournaments/:id | Delete tournament |
| PATCH | /api/v1/tournaments/:id/status | Update status |
| POST | /api/v1/tournaments/:id/generate-bracket | Generate bracket |
| GET | /api/v1/tournaments/:id/bracket | Get bracket |

### Participants

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/tournaments/:id/participants | Add participant |
| GET | /api/v1/tournaments/:id/participants | List participants |
| PUT | /api/v1/tournaments/:id/participants/:pid | Update participant |
| DELETE | /api/v1/tournaments/:id/participants/:pid | Remove participant |
| POST | /api/v1/tournaments/:id/participants/:pid/check-in | Check in |
| POST | /api/v1/tournaments/:id/participants/:pid/withdraw | Withdraw |

### Matches

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/matches/:id | Get match |
| PUT | /api/v1/matches/:id | Update result |
| POST | /api/v1/matches/:id/start | Start match |
| POST | /api/v1/matches/:id/cancel | Cancel match |
| POST | /api/v1/matches/:id/schedule | Schedule match |

## Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Type check
npm run typecheck

# Build for production
npm run build
```

## Docker

```bash
# Start with Docker Compose (production)
docker-compose up -d

# Start with development mode (hot reload)
docker-compose --profile dev up tournament-dev

# View logs
docker-compose logs -f tournament-service

# Stop services
docker-compose down
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| NODE_ENV | Environment | development |
| DATABASE_URL | PostgreSQL connection string | - |
| LOG_LEVEL | Logging level | info |

## Tournament Formats

### Single Elimination
Standard knockout format where losing a match eliminates the participant.

### Double Elimination
Participants must lose twice to be eliminated. Includes winners and losers brackets.

### Round Robin
Every participant plays against every other participant once.

## License

MIT
