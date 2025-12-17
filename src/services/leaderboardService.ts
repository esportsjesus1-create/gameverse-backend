import { getPgPool } from '../config/database';
import {
  LeaderboardEntry,
  PaginatedLeaderboard,
  PlayerRankResponse,
  Score,
} from '../types/leaderboard';
import { calculateDecayedScore, getDecayConfig } from '../utils/decay';
import * as redisLeaderboard from './redisLeaderboard';
import * as playerService from './playerService';

export const submitScore = async (
  playerId: string,
  gameId: string,
  rawScore: number
): Promise<Score> => {
  const pool = getPgPool();
  const now = new Date();
  const decayedScore = calculateDecayedScore(rawScore, now, now, getDecayConfig());

  const result = await pool.query(
    `INSERT INTO scores (player_id, game_id, raw_score, decayed_score, submitted_at, last_decay_at)
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT (player_id, game_id)
     DO UPDATE SET
       raw_score = CASE WHEN $3 > scores.raw_score THEN $3 ELSE scores.raw_score END,
       decayed_score = CASE WHEN $3 > scores.raw_score THEN $4 ELSE scores.decayed_score END,
       submitted_at = CASE WHEN $3 > scores.raw_score THEN $5 ELSE scores.submitted_at END,
       last_decay_at = CASE WHEN $3 > scores.raw_score THEN $5 ELSE scores.last_decay_at END
     RETURNING id, player_id, game_id, raw_score, decayed_score, submitted_at, last_decay_at`,
    [playerId, gameId, rawScore, decayedScore, now]
  );

  const row = result.rows[0];
  const score: Score = {
    id: row.id,
    playerId: row.player_id,
    gameId: row.game_id,
    rawScore: parseInt(row.raw_score),
    decayedScore: parseFloat(row.decayed_score),
    submittedAt: row.submitted_at,
    lastDecayAt: row.last_decay_at,
  };

  await redisLeaderboard.updatePlayerScore(gameId, playerId, score.decayedScore);

  return score;
};

export const getLeaderboard = async (
  gameId: string,
  page: number = 1,
  pageSize: number = 10
): Promise<PaginatedLeaderboard> => {
  const start = (page - 1) * pageSize;
  const stop = start + pageSize - 1;

  const [topPlayers, totalEntries] = await Promise.all([
    redisLeaderboard.getTopPlayers(gameId, start, stop),
    redisLeaderboard.getTotalPlayers(gameId),
  ]);

  const pool = getPgPool();
  const playerIds = topPlayers.map((p) => p.playerId);

  if (playerIds.length === 0) {
    return {
      entries: [],
      pagination: {
        page,
        pageSize,
        totalEntries,
        totalPages: Math.ceil(totalEntries / pageSize),
        hasNextPage: false,
        hasPreviousPage: page > 1,
      },
    };
  }

  const playersResult = await pool.query(
    `SELECT p.id, p.username, s.raw_score, s.submitted_at
     FROM players p
     JOIN scores s ON p.id = s.player_id
     WHERE p.id = ANY($1) AND s.game_id = $2`,
    [playerIds, gameId]
  );

  const playerMap = new Map<string, { username: string; rawScore: number; submittedAt: Date }>();
  for (const row of playersResult.rows) {
    playerMap.set(row.id, {
      username: row.username,
      rawScore: parseInt(row.raw_score),
      submittedAt: row.submitted_at,
    });
  }

  const entries: LeaderboardEntry[] = topPlayers.map((player, index) => {
    const playerData = playerMap.get(player.playerId);
    return {
      rank: start + index + 1,
      playerId: player.playerId,
      username: playerData?.username || 'Unknown',
      score: player.score,
      rawScore: playerData?.rawScore || 0,
      submittedAt: playerData?.submittedAt || new Date(),
    };
  });

  const totalPages = Math.ceil(totalEntries / pageSize);

  return {
    entries,
    pagination: {
      page,
      pageSize,
      totalEntries,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};

export const getPlayerRank = async (
  gameId: string,
  playerId: string
): Promise<PlayerRankResponse | null> => {
  const player = await playerService.getPlayerById(playerId);
  if (!player) {
    return null;
  }

  const [rank, score, percentile] = await Promise.all([
    redisLeaderboard.getPlayerRank(gameId, playerId),
    redisLeaderboard.getPlayerScore(gameId, playerId),
    redisLeaderboard.getPercentile(gameId, playerId),
  ]);

  if (rank === null || score === null) {
    return null;
  }

  const pool = getPgPool();
  const scoreResult = await pool.query(
    `SELECT raw_score FROM scores WHERE player_id = $1 AND game_id = $2`,
    [playerId, gameId]
  );

  const rawScore = scoreResult.rows[0]?.raw_score
    ? parseInt(scoreResult.rows[0].raw_score)
    : 0;

  return {
    playerId,
    username: player.username,
    rank,
    score,
    rawScore,
    percentile: percentile || 0,
  };
};

export const applyDecayToAllScores = async (gameId: string): Promise<number> => {
  const pool = getPgPool();
  const config = getDecayConfig();
  const now = new Date();

  const result = await pool.query(
    `SELECT id, player_id, raw_score, submitted_at
     FROM scores
     WHERE game_id = $1`,
    [gameId]
  );

  const updates: Array<{ playerId: string; score: number }> = [];

  for (const row of result.rows) {
    const newDecayedScore = calculateDecayedScore(
      parseInt(row.raw_score),
      new Date(row.submitted_at),
      now,
      config
    );

    await pool.query(
      `UPDATE scores SET decayed_score = $1, last_decay_at = $2 WHERE id = $3`,
      [newDecayedScore, now, row.id]
    );

    updates.push({ playerId: row.player_id, score: newDecayedScore });
  }

  if (updates.length > 0) {
    await redisLeaderboard.bulkUpdateScores(gameId, updates);
  }

  return updates.length;
};

export const syncLeaderboardFromPostgres = async (gameId: string): Promise<number> => {
  const pool = getPgPool();

  const result = await pool.query(
    `SELECT player_id, decayed_score
     FROM scores
     WHERE game_id = $1`,
    [gameId]
  );

  await redisLeaderboard.clearLeaderboard(gameId);

  const scores = result.rows.map((row) => ({
    playerId: row.player_id,
    score: parseFloat(row.decayed_score),
  }));

  if (scores.length > 0) {
    await redisLeaderboard.bulkUpdateScores(gameId, scores);
  }

  return scores.length;
};

export const getPlayersAroundPlayer = async (
  gameId: string,
  playerId: string,
  range: number = 5
): Promise<LeaderboardEntry[]> => {
  const nearbyPlayers = await redisLeaderboard.getPlayersAroundRank(
    gameId,
    playerId,
    range
  );

  if (nearbyPlayers.length === 0) {
    return [];
  }

  const pool = getPgPool();
  const playerIds = nearbyPlayers.map((p) => p.playerId);

  const playersResult = await pool.query(
    `SELECT p.id, p.username, s.raw_score, s.submitted_at
     FROM players p
     JOIN scores s ON p.id = s.player_id
     WHERE p.id = ANY($1) AND s.game_id = $2`,
    [playerIds, gameId]
  );

  const playerMap = new Map<string, { username: string; rawScore: number; submittedAt: Date }>();
  for (const row of playersResult.rows) {
    playerMap.set(row.id, {
      username: row.username,
      rawScore: parseInt(row.raw_score),
      submittedAt: row.submitted_at,
    });
  }

  return nearbyPlayers.map((player) => {
    const playerData = playerMap.get(player.playerId);
    return {
      rank: player.rank,
      playerId: player.playerId,
      username: playerData?.username || 'Unknown',
      score: player.score,
      rawScore: playerData?.rawScore || 0,
      submittedAt: playerData?.submittedAt || new Date(),
    };
  });
};
