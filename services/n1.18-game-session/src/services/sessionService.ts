import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, getClient } from '../db/postgres';
import { redis, getSessionCacheKey } from '../db/redis';
import {
  GameSession,
  SessionPlayer,
  PlayerStats,
  SessionStatus,
  PlayerConnectionStatus,
  CreateSessionRequest,
  UpdatePlayerStatsRequest,
} from '../types';

interface DbGameSession {
  id: string;
  game_type: string;
  status: string;
  started_at: Date | null;
  paused_at: Date | null;
  ended_at: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface DbSessionPlayer {
  id: string;
  session_id: string;
  player_id: string;
  player_name: string;
  team_id: string | null;
  connection_status: string;
  joined_at: Date;
  left_at: Date | null;
}

interface DbPlayerStats {
  id: string;
  session_id: string;
  player_id: string;
  kills: number;
  deaths: number;
  assists: number;
  damage_dealt: number;
  damage_received: number;
  objectives_completed: number;
  score: number;
  custom_stats: Record<string, number>;
  updated_at: Date;
}

function mapDbToSession(db: DbGameSession): GameSession {
  return {
    id: db.id,
    gameType: db.game_type,
    status: db.status as SessionStatus,
    startedAt: db.started_at,
    pausedAt: db.paused_at,
    endedAt: db.ended_at,
    metadata: db.metadata,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

function mapDbToPlayer(db: DbSessionPlayer): SessionPlayer {
  return {
    id: db.id,
    sessionId: db.session_id,
    playerId: db.player_id,
    playerName: db.player_name,
    teamId: db.team_id,
    connectionStatus: db.connection_status as PlayerConnectionStatus,
    joinedAt: db.joined_at,
    leftAt: db.left_at,
  };
}

function mapDbToStats(db: DbPlayerStats): PlayerStats {
  return {
    id: db.id,
    sessionId: db.session_id,
    playerId: db.player_id,
    kills: db.kills,
    deaths: db.deaths,
    assists: db.assists,
    damageDealt: db.damage_dealt,
    damageReceived: db.damage_received,
    objectivesCompleted: db.objectives_completed,
    score: db.score,
    customStats: db.custom_stats,
    updatedAt: db.updated_at,
  };
}

export async function createSession(request: CreateSessionRequest): Promise<GameSession> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const sessionResult = await client.query<DbGameSession>(
      `INSERT INTO game_sessions (game_type, status, metadata)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [request.gameType, SessionStatus.PENDING, JSON.stringify(request.metadata || {})]
    );
    
    const session = sessionResult.rows[0];
    if (!session) {
      throw new Error('Failed to create session');
    }
    
    for (const player of request.players) {
      await client.query(
        `INSERT INTO session_players (session_id, player_id, player_name, team_id)
         VALUES ($1, $2, $3, $4)`,
        [session.id, player.playerId, player.playerName, player.teamId || null]
      );
      
      await client.query(
        `INSERT INTO player_stats (session_id, player_id)
         VALUES ($1, $2)`,
        [session.id, player.playerId]
      );
    }
    
    await client.query('COMMIT');
    
    return mapDbToSession(session);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getSession(sessionId: string): Promise<GameSession | null> {
  const cached = await redis.get(getSessionCacheKey(sessionId));
  if (cached) {
    return JSON.parse(cached) as GameSession;
  }
  
  const session = await queryOne<DbGameSession>(
    'SELECT * FROM game_sessions WHERE id = $1',
    [sessionId]
  );
  
  if (session) {
    const mapped = mapDbToSession(session);
    await redis.setex(getSessionCacheKey(sessionId), 60, JSON.stringify(mapped));
    return mapped;
  }
  
  return null;
}

export async function getSessionPlayers(sessionId: string): Promise<SessionPlayer[]> {
  const players = await query<DbSessionPlayer>(
    'SELECT * FROM session_players WHERE session_id = $1',
    [sessionId]
  );
  
  return players.map(mapDbToPlayer);
}

export async function getPlayerStats(sessionId: string): Promise<PlayerStats[]> {
  const stats = await query<DbPlayerStats>(
    'SELECT * FROM player_stats WHERE session_id = $1',
    [sessionId]
  );
  
  return stats.map(mapDbToStats);
}

export async function startSession(sessionId: string): Promise<GameSession> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  
  if (session.status !== SessionStatus.PENDING) {
    throw new Error(`Cannot start session with status: ${session.status}`);
  }
  
  const result = await queryOne<DbGameSession>(
    `UPDATE game_sessions 
     SET status = $1, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [SessionStatus.ACTIVE, sessionId]
  );
  
  if (!result) {
    throw new Error('Failed to start session');
  }
  
  const updated = mapDbToSession(result);
  await redis.del(getSessionCacheKey(sessionId));
  
  return updated;
}

export async function pauseSession(sessionId: string): Promise<GameSession> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  
  if (session.status !== SessionStatus.ACTIVE) {
    throw new Error(`Cannot pause session with status: ${session.status}`);
  }
  
  const result = await queryOne<DbGameSession>(
    `UPDATE game_sessions 
     SET status = $1, paused_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [SessionStatus.PAUSED, sessionId]
  );
  
  if (!result) {
    throw new Error('Failed to pause session');
  }
  
  const updated = mapDbToSession(result);
  await redis.del(getSessionCacheKey(sessionId));
  
  return updated;
}

export async function resumeSession(sessionId: string): Promise<GameSession> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  
  if (session.status !== SessionStatus.PAUSED) {
    throw new Error(`Cannot resume session with status: ${session.status}`);
  }
  
  const result = await queryOne<DbGameSession>(
    `UPDATE game_sessions 
     SET status = $1, paused_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [SessionStatus.ACTIVE, sessionId]
  );
  
  if (!result) {
    throw new Error('Failed to resume session');
  }
  
  const updated = mapDbToSession(result);
  await redis.del(getSessionCacheKey(sessionId));
  
  return updated;
}

export async function endSession(sessionId: string): Promise<GameSession> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  
  if (session.status === SessionStatus.ENDED) {
    throw new Error('Session already ended');
  }
  
  const result = await queryOne<DbGameSession>(
    `UPDATE game_sessions 
     SET status = $1, ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [SessionStatus.ENDED, sessionId]
  );
  
  if (!result) {
    throw new Error('Failed to end session');
  }
  
  const updated = mapDbToSession(result);
  await redis.del(getSessionCacheKey(sessionId));
  
  const players = await getSessionPlayers(sessionId);
  for (const player of players) {
    const tokenKey = `reconnect:${sessionId}:${player.playerId}`;
    await redis.del(tokenKey);
  }
  
  return updated;
}

export async function updatePlayerStats(
  sessionId: string,
  playerId: string,
  stats: UpdatePlayerStatsRequest
): Promise<PlayerStats> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  
  if (session.status === SessionStatus.ENDED) {
    throw new Error('Cannot update stats for ended session');
  }
  
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;
  
  if (stats.kills !== undefined) {
    updates.push(`kills = kills + $${paramIndex++}`);
    values.push(stats.kills);
  }
  if (stats.deaths !== undefined) {
    updates.push(`deaths = deaths + $${paramIndex++}`);
    values.push(stats.deaths);
  }
  if (stats.assists !== undefined) {
    updates.push(`assists = assists + $${paramIndex++}`);
    values.push(stats.assists);
  }
  if (stats.damageDealt !== undefined) {
    updates.push(`damage_dealt = damage_dealt + $${paramIndex++}`);
    values.push(stats.damageDealt);
  }
  if (stats.damageReceived !== undefined) {
    updates.push(`damage_received = damage_received + $${paramIndex++}`);
    values.push(stats.damageReceived);
  }
  if (stats.objectivesCompleted !== undefined) {
    updates.push(`objectives_completed = objectives_completed + $${paramIndex++}`);
    values.push(stats.objectivesCompleted);
  }
  if (stats.customStats !== undefined) {
    updates.push(`custom_stats = custom_stats || $${paramIndex++}`);
    values.push(JSON.stringify(stats.customStats));
  }
  
  if (updates.length === 0) {
    const existing = await queryOne<DbPlayerStats>(
      'SELECT * FROM player_stats WHERE session_id = $1 AND player_id = $2',
      [sessionId, playerId]
    );
    if (!existing) {
      throw new Error('Player stats not found');
    }
    return mapDbToStats(existing);
  }
  
  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(sessionId, playerId);
  
  const result = await queryOne<DbPlayerStats>(
    `UPDATE player_stats 
     SET ${updates.join(', ')}
     WHERE session_id = $${paramIndex++} AND player_id = $${paramIndex}
     RETURNING *`,
    values
  );
  
  if (!result) {
    throw new Error('Player stats not found');
  }
  
  return mapDbToStats(result);
}

export async function updatePlayerConnectionStatus(
  sessionId: string,
  playerId: string,
  status: PlayerConnectionStatus
): Promise<SessionPlayer> {
  const result = await queryOne<DbSessionPlayer>(
    `UPDATE session_players 
     SET connection_status = $1
     WHERE session_id = $2 AND player_id = $3
     RETURNING *`,
    [status, sessionId, playerId]
  );
  
  if (!result) {
    throw new Error('Player not found in session');
  }
  
  return mapDbToPlayer(result);
}
