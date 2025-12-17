# GameVerse N1.23 Party Module

A comprehensive party system backend for GameVerse featuring group formation, invite system, voice chat coordination, and party benefits.

## Features

### Group Formation
- Create, join, and leave parties
- Party leadership management and transfer
- Member roles (Leader, Officer, Member)
- Ready status tracking
- Party status management (Active, In-Game, Idle)

### Invite System
- Send and receive party invites
- Bulk invite support
- Invite expiration handling
- Accept, decline, and cancel invites

### Voice Chat Coordination
- Voice channel creation per party
- Join/leave voice channels
- Mute/unmute functionality
- Speaking status tracking
- Moderator controls

### Party Benefits
- XP multipliers based on party size
- Loot bonuses
- Achievement bonuses
- Drop rate bonuses
- Exclusive party rewards

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Testing**: Jest + Supertest
- **Containerization**: Docker & Docker Compose

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL 16 (or use Docker)
- Redis 7 (or use Docker)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/gameverse-backend.git
cd gameverse-backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment file:
```bash
cp .env.example .env
```

4. Start with Docker:
```bash
docker-compose up -d
```

Or start services individually and run locally:
```bash
npm run dev
```

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Watch mode
npm run test:watch
```

### Building

```bash
npm run build
npm start
```

## API Endpoints

### Parties
- `GET /api/v1/parties/public` - List public parties
- `POST /api/v1/parties` - Create a party
- `GET /api/v1/parties/me` - Get current user's party
- `GET /api/v1/parties/:partyId` - Get party details
- `PATCH /api/v1/parties/:partyId` - Update party
- `DELETE /api/v1/parties/:partyId` - Disband party
- `POST /api/v1/parties/:partyId/join` - Join party
- `POST /api/v1/parties/:partyId/leave` - Leave party
- `POST /api/v1/parties/:partyId/transfer-leadership` - Transfer leadership
- `POST /api/v1/parties/:partyId/ready` - Set ready status
- `GET /api/v1/parties/:partyId/members` - Get party members

### Invites
- `GET /api/v1/invites/received` - Get received invites
- `GET /api/v1/invites/sent` - Get sent invites
- `POST /api/v1/invites/party/:partyId` - Send invite
- `POST /api/v1/invites/party/:partyId/bulk` - Send bulk invites
- `POST /api/v1/invites/:inviteId/accept` - Accept invite
- `POST /api/v1/invites/:inviteId/decline` - Decline invite
- `DELETE /api/v1/invites/:inviteId` - Cancel invite

### Voice Chat
- `GET /api/v1/voice/me` - Get user voice status
- `POST /api/v1/voice/party/:partyId` - Create voice channel
- `GET /api/v1/voice/party/:partyId` - Get party voice channel
- `POST /api/v1/voice/:channelId/join` - Join voice channel
- `POST /api/v1/voice/:channelId/leave` - Leave voice channel
- `PATCH /api/v1/voice/:channelId/status` - Update voice status
- `GET /api/v1/voice/:channelId/participants` - Get participants

### Benefits
- `GET /api/v1/benefits` - Get all benefits
- `GET /api/v1/benefits/applicable` - Get applicable benefits
- `GET /api/v1/benefits/party/:partyId/calculate` - Calculate party benefits
- `GET /api/v1/benefits/party/:partyId/summary` - Get benefits summary
- `POST /api/v1/benefits/party/:partyId/apply/xp` - Apply XP bonus
- `POST /api/v1/benefits/party/:partyId/apply/loot` - Apply loot bonus

### Users
- `POST /api/v1/users` - Create user
- `GET /api/v1/users/me` - Get current user
- `PATCH /api/v1/users/me` - Update current user
- `GET /api/v1/users/search` - Search users
- `GET /api/v1/users/online` - Get online users

## Authentication

All authenticated endpoints require the `x-user-id` header with a valid UUID.

```bash
curl -H "x-user-id: 123e4567-e89b-12d3-a456-426614174000" \
  http://localhost:3000/api/v1/parties/me
```

## Docker

### Production
```bash
docker-compose up -d
```

### Development
```bash
docker-compose -f docker-compose.dev.yml up
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment | development |
| PORT | Server port | 3000 |
| POSTGRES_HOST | PostgreSQL host | localhost |
| POSTGRES_PORT | PostgreSQL port | 5432 |
| POSTGRES_DB | Database name | gameverse |
| POSTGRES_USER | Database user | gameverse |
| POSTGRES_PASSWORD | Database password | gameverse |
| REDIS_HOST | Redis host | localhost |
| REDIS_PORT | Redis port | 6379 |

## License

MIT
