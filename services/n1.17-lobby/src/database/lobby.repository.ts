import { pool } from './pool';
import { 
  Lobby, 
  LobbyPlayer, 
  LobbyWithPlayers, 
  LobbyStatus, 
  PlayerReadyStatus,
  CreateLobbyRequest,
  LobbyFilters
} from '../types';
import { LoggerService } from '../services/logger.service';

const logger = new LoggerService('LobbyRepository');

function mapRowToLobby(row: Record<string, unknown>): Lobby {
  return {
    id: row.id as string,
    name: row.name as string,
    hostId: row.host_id as string,
    maxPlayers: row.max_players as number,
    minPlayers: row.min_players as number,
    status: row.status as LobbyStatus,
    gameType: row.game_type as string,
    countdownDuration: row.countdown_duration as number,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string)
  };
}

function mapRowToLobbyPlayer(row: Record<string, unknown>): LobbyPlayer {
  return {
    lobbyId: row.lobby_id as string,
    playerId: row.player_id as string,
    readyStatus: row.ready_status as PlayerReadyStatus,
    joinedAt: new Date(row.joined_at as string)
  };
}

export class LobbyRepository {
  async create(data: CreateLobbyRequest): Promise<Lobby> {
    const query = `
      INSERT INTO lobbies (name, host_id, max_players, min_players, game_type, countdown_duration)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      data.name,
      data.hostId,
      data.maxPlayers || 10,
      data.minPlayers || 2,
      data.gameType,
      data.countdownDuration || 10
    ];
    
    const result = await pool.query(query, values);
    const lobby = mapRowToLobby(result.rows[0]);
    logger.info('Lobby created', { lobbyId: lobby.id });
    return lobby;
  }

  async findById(id: string): Promise<Lobby | null> {
    const query = 'SELECT * FROM lobbies WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return mapRowToLobby(result.rows[0]);
  }

  async findByIdWithPlayers(id: string): Promise<LobbyWithPlayers | null> {
    const lobby = await this.findById(id);
    if (!lobby) {
      return null;
    }
    
    const players = await this.getPlayers(id);
    return { ...lobby, players };
  }

  async findAll(filters?: LobbyFilters, page = 1, limit = 20): Promise<{ lobbies: Lobby[]; total: number }> {
    let whereClause = 'WHERE 1=1';
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters?.gameType) {
      whereClause += ` AND game_type = $${paramIndex++}`;
      values.push(filters.gameType);
    }

    if (filters?.hasSpace) {
      whereClause += ` AND (SELECT COUNT(*) FROM lobby_players WHERE lobby_id = lobbies.id) < max_players`;
    }

    const countQuery = `SELECT COUNT(*) FROM lobbies ${whereClause}`;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const offset = (page - 1) * limit;
    const query = `
      SELECT * FROM lobbies 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    
    const result = await pool.query(query, [...values, limit, offset]);
    const lobbies = result.rows.map(mapRowToLobby);

    return { lobbies, total };
  }

  async update(id: string, data: Partial<Lobby>): Promise<Lobby | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.maxPlayers !== undefined) {
      updates.push(`max_players = $${paramIndex++}`);
      values.push(data.maxPlayers);
    }
    if (data.minPlayers !== undefined) {
      updates.push(`min_players = $${paramIndex++}`);
      values.push(data.minPlayers);
    }
    if (data.countdownDuration !== undefined) {
      updates.push(`countdown_duration = $${paramIndex++}`);
      values.push(data.countdownDuration);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE lobbies 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }

    logger.info('Lobby updated', { lobbyId: id });
    return mapRowToLobby(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM lobbies WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    if (result.rowCount && result.rowCount > 0) {
      logger.info('Lobby deleted', { lobbyId: id });
      return true;
    }
    return false;
  }

  async addPlayer(lobbyId: string, playerId: string): Promise<LobbyPlayer> {
    const query = `
      INSERT INTO lobby_players (lobby_id, player_id)
      VALUES ($1, $2)
      ON CONFLICT (lobby_id, player_id) DO NOTHING
      RETURNING *
    `;
    
    const result = await pool.query(query, [lobbyId, playerId]);
    
    if (result.rows.length === 0) {
      const existing = await this.getPlayer(lobbyId, playerId);
      if (existing) {
        return existing;
      }
      throw new Error('Failed to add player to lobby');
    }
    
    logger.info('Player added to lobby', { lobbyId, playerId });
    return mapRowToLobbyPlayer(result.rows[0]);
  }

  async removePlayer(lobbyId: string, playerId: string): Promise<boolean> {
    const query = 'DELETE FROM lobby_players WHERE lobby_id = $1 AND player_id = $2';
    const result = await pool.query(query, [lobbyId, playerId]);
    
    if (result.rowCount && result.rowCount > 0) {
      logger.info('Player removed from lobby', { lobbyId, playerId });
      return true;
    }
    return false;
  }

  async getPlayer(lobbyId: string, playerId: string): Promise<LobbyPlayer | null> {
    const query = 'SELECT * FROM lobby_players WHERE lobby_id = $1 AND player_id = $2';
    const result = await pool.query(query, [lobbyId, playerId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return mapRowToLobbyPlayer(result.rows[0]);
  }

  async getPlayers(lobbyId: string): Promise<LobbyPlayer[]> {
    const query = 'SELECT * FROM lobby_players WHERE lobby_id = $1 ORDER BY joined_at ASC';
    const result = await pool.query(query, [lobbyId]);
    return result.rows.map(mapRowToLobbyPlayer);
  }

  async getPlayerCount(lobbyId: string): Promise<number> {
    const query = 'SELECT COUNT(*) FROM lobby_players WHERE lobby_id = $1';
    const result = await pool.query(query, [lobbyId]);
    return parseInt(result.rows[0].count, 10);
  }

  async setPlayerReady(lobbyId: string, playerId: string, ready: boolean): Promise<LobbyPlayer | null> {
    const status = ready ? PlayerReadyStatus.READY : PlayerReadyStatus.NOT_READY;
    const query = `
      UPDATE lobby_players 
      SET ready_status = $1
      WHERE lobby_id = $2 AND player_id = $3
      RETURNING *
    `;
    
    const result = await pool.query(query, [status, lobbyId, playerId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    logger.info('Player ready status updated', { lobbyId, playerId, ready });
    return mapRowToLobbyPlayer(result.rows[0]);
  }

  async areAllPlayersReady(lobbyId: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as total,
             SUM(CASE WHEN ready_status = 'ready' THEN 1 ELSE 0 END) as ready_count
      FROM lobby_players 
      WHERE lobby_id = $1
    `;
    
    const result = await pool.query(query, [lobbyId]);
    const { total, ready_count } = result.rows[0];
    
    return parseInt(total, 10) > 0 && parseInt(total, 10) === parseInt(ready_count, 10);
  }

  async resetAllPlayersReady(lobbyId: string): Promise<void> {
    const query = `
      UPDATE lobby_players 
      SET ready_status = 'not_ready'
      WHERE lobby_id = $1
    `;
    
    await pool.query(query, [lobbyId]);
    logger.info('All players ready status reset', { lobbyId });
  }

  async getPlayerLobbies(playerId: string): Promise<Lobby[]> {
    const query = `
      SELECT l.* FROM lobbies l
      INNER JOIN lobby_players lp ON l.id = lp.lobby_id
      WHERE lp.player_id = $1
      ORDER BY lp.joined_at DESC
    `;
    
    const result = await pool.query(query, [playerId]);
    return result.rows.map(mapRowToLobby);
  }
}

export const lobbyRepository = new LobbyRepository();
