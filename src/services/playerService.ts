import { getPgPool } from '../config/database';
import { Player } from '../types/leaderboard';
import { v4 as uuidv4 } from 'uuid';

export const createPlayer = async (
  username: string,
  email?: string
): Promise<Player> => {
  const pool = getPgPool();
  const id = uuidv4();
  
  const result = await pool.query(
    `INSERT INTO players (id, username, email)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, created_at, updated_at`,
    [id, username, email]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const getPlayerById = async (id: string): Promise<Player | null> => {
  const pool = getPgPool();
  
  const result = await pool.query(
    `SELECT id, username, email, created_at, updated_at
     FROM players WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const getPlayerByUsername = async (
  username: string
): Promise<Player | null> => {
  const pool = getPgPool();
  
  const result = await pool.query(
    `SELECT id, username, email, created_at, updated_at
     FROM players WHERE username = $1`,
    [username]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const updatePlayer = async (
  id: string,
  updates: { username?: string; email?: string }
): Promise<Player | null> => {
  const pool = getPgPool();
  
  const setClauses: string[] = [];
  const values: (string | undefined)[] = [];
  let paramIndex = 1;

  if (updates.username !== undefined) {
    setClauses.push(`username = $${paramIndex++}`);
    values.push(updates.username);
  }
  if (updates.email !== undefined) {
    setClauses.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }

  if (setClauses.length === 0) {
    return getPlayerById(id);
  }

  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const result = await pool.query(
    `UPDATE players SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, username, email, created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const deletePlayer = async (id: string): Promise<boolean> => {
  const pool = getPgPool();
  
  const result = await pool.query(
    `DELETE FROM players WHERE id = $1`,
    [id]
  );

  return result.rowCount !== null && result.rowCount > 0;
};

export const getOrCreatePlayer = async (
  username: string,
  email?: string
): Promise<Player> => {
  const existing = await getPlayerByUsername(username);
  if (existing) {
    return existing;
  }
  return createPlayer(username, email);
};
