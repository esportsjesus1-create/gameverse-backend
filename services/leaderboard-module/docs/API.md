# GameVerse Leaderboard Module API Documentation

## Overview

The GameVerse Leaderboard Module provides comprehensive ranking functionality including global rankings, seasonal rankings, regional rankings, friend-based rankings, and real-time updates via WebSocket.

**Base URL:** `/api/v1/leaderboard`

**Version:** 1.0.0

## Authentication

All endpoints support three tiers of access:
- **Anonymous:** 30 requests/minute
- **Authenticated:** 100 requests/minute (requires valid JWT)
- **Premium:** 500 requests/minute (requires premium subscription)

Include the JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

## Rate Limiting

Rate limit information is included in response headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `X-RateLimit-Tier`: Current rate limit tier

---

## Functional Requirements

### FR-001: Global Leaderboard Retrieval
**Endpoint:** `GET /global`

Retrieve the global leaderboard with pagination and filtering.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | integer | No | 1 | Page number (1-indexed) |
| limit | integer | No | 50 | Results per page (max 100) |
| sortBy | string | No | RANK | Sort field (RANK, SCORE, WINS, WIN_RATE, MMR, GAMES_PLAYED, LAST_ACTIVE) |
| sortOrder | string | No | ASC | Sort order (ASC, DESC) |
| minScore | integer | No | - | Minimum score filter |
| maxScore | integer | No | - | Maximum score filter |
| tier | string | No | - | Filter by tier |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "playerId": "uuid",
      "playerName": "string",
      "rank": 1,
      "score": 10000,
      "tier": "DIAMOND",
      "division": 1,
      "mmr": 2200,
      "wins": 100,
      "losses": 50,
      "gamesPlayed": 150,
      "winRate": 66.67,
      "lastActive": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 10000,
    "totalPages": 200,
    "hasNext": true,
    "hasPrev": false
  },
  "metadata": {
    "requestId": "uuid",
    "timestamp": "2024-01-01T00:00:00Z",
    "duration": 45
  }
}
```

---

### FR-002: Top 100 Leaderboard
**Endpoint:** `GET /global/top100`

Retrieve the top 100 players from the global leaderboard. This endpoint is optimized with Redis caching.

**Response:** Same structure as FR-001 with max 100 entries.

---

### FR-003: Leaderboard Statistics
**Endpoint:** `GET /global/statistics`

Retrieve statistical information about the leaderboard.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPlayers": 10000,
    "averageScore": 5500,
    "medianScore": 5000,
    "highestScore": 99999,
    "lowestScore": 100,
    "standardDeviation": 2500,
    "tierDistribution": {
      "BRONZE": 3000,
      "SILVER": 2500,
      "GOLD": 2000,
      "PLATINUM": 1500,
      "DIAMOND": 700,
      "MASTER": 250,
      "GRANDMASTER": 45,
      "CHALLENGER": 5
    },
    "lastUpdated": "2024-01-01T00:00:00Z"
  }
}
```

---

### FR-004: Player Rank Lookup
**Endpoint:** `GET /player/:playerId/rank`

Retrieve a specific player's rank and statistics.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| playerId | uuid | Yes | Player's unique identifier |

**Response:**
```json
{
  "success": true,
  "data": {
    "playerId": "uuid",
    "playerName": "string",
    "rank": 150,
    "score": 7500,
    "tier": "PLATINUM",
    "division": 2,
    "mmr": 1850,
    "percentile": 98.5
  }
}
```

---

### FR-005: Player Context
**Endpoint:** `GET /player/:playerId/context`

Retrieve players ranked above and below a specific player.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| contextSize | integer | No | 5 | Number of players above/below (max 50) |

**Response:**
```json
{
  "success": true,
  "data": {
    "player": { /* player entry */ },
    "above": [ /* entries ranked above */ ],
    "below": [ /* entries ranked below */ ]
  }
}
```

---

### FR-006: Player Search
**Endpoint:** `GET /global/search`

Search for players by name.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | Yes | Search query (min 2 characters) |
| limit | integer | No | Max results (default 20) |

---

### FR-007: Tier-Based Filtering
**Endpoint:** `GET /global/tier/:tier`

Retrieve leaderboard entries filtered by tier.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| tier | string | Yes | Tier name (BRONZE, SILVER, GOLD, etc.) |

---

### FR-008: Seasonal Leaderboard
**Endpoint:** `GET /seasonal`

Retrieve the current season's leaderboard.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | integer | No | 1 | Page number |
| limit | integer | No | 50 | Results per page |
| tier | string | No | - | Filter by tier |

---

### FR-009: Active Season Info
**Endpoint:** `GET /seasonal/active`

Retrieve information about the currently active season.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Season 5",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-03-31T23:59:59Z",
    "isActive": true,
    "daysRemaining": 45,
    "rewards": [ /* reward tiers */ ]
  }
}
```

---

### FR-010: Season by ID
**Endpoint:** `GET /seasonal/:seasonId`

Retrieve leaderboard for a specific season.

---

### FR-011: Player Seasonal Rank
**Endpoint:** `GET /seasonal/player/:playerId/rank`

Retrieve a player's rank in the current season.

---

### FR-012: Seasonal Reward Preview
**Endpoint:** `GET /seasonal/player/:playerId/rewards`

Preview rewards a player will receive based on current rank.

**Response:**
```json
{
  "success": true,
  "data": {
    "tier": "DIAMOND",
    "division": 1,
    "rewards": [
      {
        "type": "CURRENCY",
        "amount": 5000,
        "name": "Season Tokens"
      },
      {
        "type": "COSMETIC",
        "itemId": "uuid",
        "name": "Diamond Border"
      }
    ],
    "nextTierRewards": [ /* rewards at next tier */ ]
  }
}
```

---

### FR-013: Decay Status
**Endpoint:** `GET /seasonal/player/:playerId/decay`

Check a player's rank decay status.

**Response:**
```json
{
  "success": true,
  "data": {
    "playerId": "uuid",
    "isDecaying": false,
    "daysUntilDecay": 7,
    "decayProtected": false,
    "lastActivity": "2024-01-01T00:00:00Z",
    "decayAmount": 25
  }
}
```

---

### FR-014: Placement Status
**Endpoint:** `GET /seasonal/player/:playerId/placement`

Check a player's placement match progress.

**Response:**
```json
{
  "success": true,
  "data": {
    "playerId": "uuid",
    "placementGamesPlayed": 7,
    "placementGamesRequired": 10,
    "isPlacementComplete": false,
    "provisionalTier": "GOLD",
    "wins": 5,
    "losses": 2
  }
}
```

---

### FR-015: Seasonal Tier Distribution
**Endpoint:** `GET /seasonal/:seasonId/tier-distribution`

Get tier distribution for a season.

---

### FR-016: Regional Leaderboard
**Endpoint:** `GET /regional/:region`

Retrieve leaderboard for a specific region.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| region | string | Yes | Region code (NA, EU, ASIA, OCE, SA, MENA, SEA, JP, KR, CN) |

---

### FR-017: Supported Regions
**Endpoint:** `GET /regional/regions`

List all supported regions.

**Response:**
```json
{
  "success": true,
  "data": [
    { "code": "NA", "name": "North America" },
    { "code": "EU", "name": "Europe" },
    { "code": "ASIA", "name": "Asia" },
    { "code": "OCE", "name": "Oceania" },
    { "code": "SA", "name": "South America" },
    { "code": "MENA", "name": "Middle East & North Africa" },
    { "code": "SEA", "name": "Southeast Asia" },
    { "code": "JP", "name": "Japan" },
    { "code": "KR", "name": "Korea" },
    { "code": "CN", "name": "China" }
  ]
}
```

---

### FR-018: Player Regional Rank
**Endpoint:** `GET /regional/player/:playerId/:region`

Get a player's rank within a specific region.

---

### FR-019: Regional Statistics
**Endpoint:** `GET /regional/:region/statistics`

Get statistics for a specific region.

---

### FR-020: All Regional Statistics
**Endpoint:** `GET /regional`

Get statistics for all regions.

---

### FR-021: Cross-Region Comparison
**Endpoint:** `GET /regional/player/:playerId/comparison`

Compare a player's hypothetical rank across all regions.

**Response:**
```json
{
  "success": true,
  "data": {
    "playerId": "uuid",
    "homeRegion": "NA",
    "homeRank": 150,
    "comparisons": {
      "NA": { "rank": 150, "percentile": 98.5 },
      "EU": { "hypotheticalRank": 180, "percentile": 97.8 },
      "ASIA": { "hypotheticalRank": 220, "percentile": 96.5 }
    }
  }
}
```

---

### FR-022: Friend Leaderboard
**Endpoint:** `GET /friends/:playerId`

Get leaderboard among a player's friends.

---

### FR-023: Rank Among Friends
**Endpoint:** `GET /friends/:playerId/rank`

Get a player's rank among their friends.

**Response:**
```json
{
  "success": true,
  "data": {
    "playerId": "uuid",
    "rank": 3,
    "totalFriends": 25,
    "percentile": 88.0
  }
}
```

---

### FR-024: Friend Comparison
**Endpoint:** `GET /friends/compare/:player1Id/:player2Id`

Compare two friends' statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "player1": { /* player stats */ },
    "player2": { /* player stats */ },
    "scoreDifference": 500,
    "headToHead": {
      "player1Wins": 15,
      "player2Wins": 10,
      "totalGames": 25
    }
  }
}
```

---

### FR-025: Activity Feed
**Endpoint:** `GET /friends/:playerId/activity`

Get activity feed for a player's friends.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | integer | No | 20 | Max items to return |
| types | string | No | - | Comma-separated activity types |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "RANK_UP",
      "playerId": "uuid",
      "playerName": "FriendName",
      "data": {
        "oldTier": "GOLD",
        "newTier": "PLATINUM"
      },
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### FR-026: Score Submission
**Endpoint:** `POST /scores/submit`

Submit a new score.

**Request Body:**
```json
{
  "playerId": "uuid",
  "score": 10000,
  "gameId": "uuid",
  "matchId": "uuid",
  "sessionId": "uuid",
  "gameMode": "RANKED",
  "region": "NA",
  "validationChecksum": "string",
  "validationData": {},
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "playerId": "uuid",
    "score": 10000,
    "status": "VALIDATED",
    "previousRank": 155,
    "newRank": 150,
    "submittedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### FR-027: Batch Score Submission
**Endpoint:** `POST /scores/batch`

Submit multiple scores at once (max 100).

**Request Body:**
```json
{
  "submissions": [
    { "playerId": "uuid", "score": 10000 },
    { "playerId": "uuid", "score": 8000 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "successful": [ /* successful submissions */ ],
    "failed": [ /* failed submissions with errors */ ],
    "totalProcessed": 100,
    "successCount": 98,
    "failureCount": 2
  }
}
```

---

### FR-028: Get Submission
**Endpoint:** `GET /scores/:submissionId`

Retrieve a specific score submission.

---

### FR-029: Player Submissions
**Endpoint:** `GET /scores/player/:playerId`

Get all submissions for a player.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | integer | No | 1 | Page number |
| limit | integer | No | 20 | Results per page |
| status | string | No | - | Filter by status |
| startDate | string | No | - | Filter by date range start |
| endDate | string | No | - | Filter by date range end |

---

### FR-030: Dispute Submission
**Endpoint:** `POST /scores/:submissionId/dispute`

Dispute a score submission.

**Request Body:**
```json
{
  "playerId": "uuid",
  "reason": "This score was incorrectly recorded due to a server error."
}
```

---

### FR-031: Submission Audit Trail
**Endpoint:** `GET /scores/:submissionId/audit`

Get the audit trail for a submission.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "action": "SUBMITTED",
      "timestamp": "2024-01-01T00:00:00Z",
      "actor": "player-uuid"
    },
    {
      "action": "VALIDATED",
      "timestamp": "2024-01-01T00:00:01Z",
      "actor": "system"
    },
    {
      "action": "APPROVED",
      "timestamp": "2024-01-01T00:05:00Z",
      "actor": "admin-uuid"
    }
  ]
}
```

---

### FR-032: Admin Score Action
**Endpoint:** `POST /admin/scores/action`

Perform admin action on a submission.

**Request Body:**
```json
{
  "submissionId": "uuid",
  "adminId": "uuid",
  "action": "APPROVE | REJECT | ROLLBACK",
  "reason": "string (optional)"
}
```

---

### FR-033: Submission Statistics
**Endpoint:** `GET /admin/scores/statistics`

Get submission statistics (admin only).

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSubmissions": 100000,
    "byStatus": {
      "PENDING": 50,
      "VALIDATED": 500,
      "APPROVED": 98000,
      "REJECTED": 1400,
      "DISPUTED": 30,
      "ROLLED_BACK": 20
    },
    "averageProcessingTime": 150,
    "antiCheatFlags": 250
  }
}
```

---

### FR-034: Health Check
**Endpoint:** `GET /health`

Check service health status.

**Response:**
```json
{
  "status": "healthy",
  "service": "gameverse-leaderboard",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00Z",
  "dependencies": {
    "redis": "healthy",
    "websocket": {
      "connections": 150,
      "subscriptions": 500
    }
  }
}
```

---

### FR-035: Readiness Check
**Endpoint:** `GET /ready`

Check if service is ready to accept traffic.

---

### FR-036: WebSocket Connection
**Endpoint:** `WS /live`

Establish WebSocket connection for real-time updates.

**Subscribe Message:**
```json
{
  "action": "SUBSCRIBE",
  "leaderboardIds": ["uuid1", "uuid2"]
}
```

**Unsubscribe Message:**
```json
{
  "action": "UNSUBSCRIBE",
  "leaderboardIds": ["uuid1"]
}
```

**Server Messages:**
```json
{
  "type": "RANK_CHANGE",
  "leaderboardId": "uuid",
  "data": {
    "playerId": "uuid",
    "playerName": "string",
    "oldRank": 150,
    "newRank": 145,
    "score": 10500
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

---

### FR-037: Leaderboard by Leaderboard ID
**Endpoint:** `GET /global/top100/:leaderboardId`

Get top 100 for a specific leaderboard.

---

### FR-038: Statistics by Leaderboard ID
**Endpoint:** `GET /global/statistics/:leaderboardId`

Get statistics for a specific leaderboard.

---

### FR-039: Seasonal Leaderboard by Tier
**Endpoint:** `GET /seasonal/:seasonId/tier/:tier`

Get seasonal leaderboard filtered by tier.

---

### FR-040: Regional Leaderboard by Tier
**Endpoint:** `GET /regional/:region/tier/:tier`

Get regional leaderboard filtered by tier.

---

### FR-041: Regional Tier Distribution
**Endpoint:** `GET /regional/:region/tier-distribution`

Get tier distribution for a region.

---

### FR-042: Regional Top Performers
**Endpoint:** `GET /regional/top-performers`

Get top performers from each region.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| count | integer | No | 10 | Top N from each region |

---

### FR-043: Friend Group Leaderboard
**Endpoint:** `GET /friends/group/:groupId`

Get leaderboard for a friend group.

---

### FR-044: Mutual Friends Leaderboard
**Endpoint:** `GET /friends/mutual/:player1Id/:player2Id`

Get leaderboard of mutual friends between two players.

---

### FR-045: Player Seasonal Progression
**Endpoint:** `GET /seasonal/player/:playerId/progression`

Get a player's rank progression throughout the season.

**Response:**
```json
{
  "success": true,
  "data": {
    "playerId": "uuid",
    "history": [
      {
        "date": "2024-01-01",
        "rank": 500,
        "tier": "GOLD",
        "division": 2,
        "mmr": 1500
      },
      {
        "date": "2024-01-15",
        "rank": 300,
        "tier": "PLATINUM",
        "division": 4,
        "mmr": 1700
      }
    ]
  }
}
```

---

### FR-046: Pending Submissions (Admin)
**Endpoint:** `GET /admin/scores/pending`

Get all pending score submissions for review.

---

### FR-047: Player Ban Status
**Endpoint:** `GET /admin/players/:playerId/ban-status`

Check if a player is banned.

---

### FR-048: Ban Player (Admin)
**Endpoint:** `POST /admin/players/:playerId/ban`

Ban a player from submitting scores.

**Request Body:**
```json
{
  "adminId": "uuid",
  "reason": "Cheating detected",
  "duration": "PERMANENT | TEMPORARY",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

---

### FR-049: Unban Player (Admin)
**Endpoint:** `POST /admin/players/:playerId/unban`

Remove a player's ban.

---

### FR-050: Leaderboard Reset (Admin)
**Endpoint:** `POST /admin/leaderboard/:leaderboardId/reset`

Reset a leaderboard (removes all entries).

**Request Body:**
```json
{
  "adminId": "uuid",
  "reason": "Season end reset",
  "createSnapshot": true
}
```

---

## Error Codes

The API uses standardized error codes for all error responses:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| NOT_FOUND | 404 | Resource not found |
| BAD_REQUEST | 400 | Invalid request parameters |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Access denied |
| CONFLICT | 409 | Resource conflict |
| VALIDATION_ERROR | 422 | Request validation failed |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| INTERNAL_SERVER_ERROR | 500 | Server error |
| SERVICE_UNAVAILABLE | 503 | Service temporarily unavailable |
| LEADERBOARD_NOT_FOUND | 404 | Leaderboard does not exist |
| PLAYER_NOT_FOUND | 404 | Player does not exist |
| SEASON_NOT_FOUND | 404 | Season does not exist |
| LEADERBOARD_INACTIVE | 400 | Leaderboard is not active |
| LEADERBOARD_FULL | 400 | Leaderboard has reached max entries |
| INVALID_SCORE | 400 | Score value is invalid |
| SCORE_VALIDATION_FAILED | 400 | Score failed validation |
| ANTI_CHEAT_VIOLATION | 403 | Anti-cheat system flagged submission |
| PLAYER_BANNED | 403 | Player is banned |
| PLAYER_SUSPENDED | 403 | Player is temporarily suspended |
| SEASON_NOT_ACTIVE | 400 | Season is not currently active |
| SEASON_ENDED | 400 | Season has ended |
| PLACEMENT_NOT_COMPLETED | 400 | Placement matches not completed |
| REGION_NOT_SUPPORTED | 400 | Region is not supported |
| NOT_FRIENDS | 400 | Players are not friends |
| CHALLENGE_EXPIRED | 400 | Challenge has expired |
| WEBSOCKET_SUBSCRIPTION_LIMIT | 400 | Max subscriptions reached |
| QUERY_TIMEOUT | 504 | Query exceeded time limit |

---

## WebSocket Events

### Server-to-Client Events

| Event Type | Description |
|------------|-------------|
| RANK_CHANGE | Player rank changed |
| SCORE_UPDATE | Player score updated |
| NEW_ENTRY | New player entered leaderboard |
| ENTRY_REMOVED | Player removed from leaderboard |
| LEADERBOARD_RESET | Leaderboard was reset |
| HEARTBEAT | Connection keepalive |

### Client-to-Server Events

| Event Type | Description |
|------------|-------------|
| SUBSCRIBE | Subscribe to leaderboard updates |
| UNSUBSCRIBE | Unsubscribe from leaderboard updates |

---

## Performance Guarantees

- All read operations: < 100ms response time
- Top 100 queries: < 50ms (cached)
- Score submissions: < 200ms processing time
- WebSocket latency: < 100ms for updates

---

## Changelog

### v1.0.0 (2024-01-01)
- Initial release
- Global, seasonal, regional, and friend leaderboards
- Real-time WebSocket updates
- Anti-cheat validation
- 3-tier rate limiting
- Comprehensive admin tools
