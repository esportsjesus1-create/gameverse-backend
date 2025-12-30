# GameVerse Social Module (n2.0-social)

Social Module for the GameVerse Platform implementing 52 Functional Requirements for friend management, presence, social feed, profiles, and notifications.

## Features

### FR-1: Friend Management (8 requirements)
- Send, accept, reject, cancel friend requests
- Remove friends
- List friends with pagination
- List incoming/outgoing friend requests

### FR-2: Block Management (6 requirements)
- Block/unblock users
- List blocked users
- Check block status
- Automatic friendship removal on block

### FR-3: Social Feed (10 requirements)
- Post status updates
- Like/unlike posts
- Comment on posts
- Share achievements and game results
- Paginated feed with visibility controls

### FR-4: Presence (8 requirements)
- Online/offline/away status
- Custom status messages
- Real-time presence via Redis pub/sub
- Auto-offline after timeout
- Gamerstake presence sync

### FR-5: Profile (10 requirements)
- Profile management (bio, avatar, etc.)
- Visibility settings (public/friends/private)
- Gaming platform connections
- Game statistics and achievements
- User search

### FR-6: Notifications (10 requirements)
- Friend request notifications
- Post interaction notifications
- Achievement notifications
- Mark as read/unread
- Delete notifications

## Tech Stack

- **Framework**: NestJS 10
- **Database**: PostgreSQL 15 (TypeORM)
- **Cache/Pub-Sub**: Redis 7
- **Graph Database**: Neo4j 5 (friend connections)
- **API Documentation**: Swagger/OpenAPI

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Neo4j 5+

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run database migrations
npm run migration:run

# Start development server
npm run start:dev
```

### Using Docker

```bash
# Start all services
docker-compose up -d

# Run migrations
docker-compose exec social-api npm run migration:run
```

## API Documentation

Once the server is running, access Swagger documentation at:
- http://localhost:3000/api/docs

## Project Structure

```
src/
├── common/              # Shared utilities
│   ├── decorators/      # Custom decorators
│   ├── filters/         # Exception filters
│   ├── guards/          # Auth guards
│   ├── interceptors/    # Response interceptors
│   └── pipes/           # Validation pipes
├── config/              # Configuration
├── database/
│   ├── entities/        # TypeORM entities
│   └── migrations/      # Database migrations
└── modules/
    ├── friend/          # Friend management
    ├── block/           # Block management
    ├── social-feed/     # Social feed
    ├── presence/        # User presence
    ├── profile/         # User profiles
    ├── notification/    # Notifications
    └── gamerstake/      # Gamerstake integration
```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Gamerstake Integration

The module supports bidirectional sync with Gamerstake:
- Friend graph sync (every 5 minutes)
- Unified presence across platforms
- Profile data import

Configure via environment variables:
- `GAMERSTAKE_API_URL`
- `GAMERSTAKE_API_KEY`
- `GAMERSTAKE_SYNC_INTERVAL_MS`

## Neo4j Graph Database

Used for efficient friend-of-friend queries:
- 2nd degree connections (friends of friends)
- 3rd degree connections
- Friend recommendations
- Mutual friend counts

## License

MIT
