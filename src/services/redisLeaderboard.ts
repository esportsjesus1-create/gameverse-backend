import { getRedisClient } from '../config/database';

const LEADERBOARD_KEY_PREFIX = 'leaderboard:';

const getLeaderboardKey = (gameId: string): string => {
  return `${LEADERBOARD_KEY_PREFIX}${gameId}`;
};

export const updatePlayerScore = async (
  gameId: string,
  playerId: string,
  score: number
): Promise<void> => {
  const redis = await getRedisClient();
  const key = getLeaderboardKey(gameId);
  await redis.zAdd(key, { score, value: playerId });
};

export const removePlayerFromLeaderboard = async (
  gameId: string,
  playerId: string
): Promise<void> => {
  const redis = await getRedisClient();
  const key = getLeaderboardKey(gameId);
  await redis.zRem(key, playerId);
};

export const getPlayerRank = async (
  gameId: string,
  playerId: string
): Promise<number | null> => {
  const redis = await getRedisClient();
  const key = getLeaderboardKey(gameId);
  const rank = await redis.zRevRank(key, playerId);
  return rank !== null ? rank + 1 : null;
};

export const getPlayerScore = async (
  gameId: string,
  playerId: string
): Promise<number | null> => {
  const redis = await getRedisClient();
  const key = getLeaderboardKey(gameId);
  return await redis.zScore(key, playerId);
};

export const getTopPlayers = async (
  gameId: string,
  start: number,
  stop: number
): Promise<Array<{ playerId: string; score: number }>> => {
  const redis = await getRedisClient();
  const key = getLeaderboardKey(gameId);
  
  const results = await redis.zRangeWithScores(key, start, stop, { REV: true });
  
  return results.map((entry) => ({
    playerId: entry.value,
    score: entry.score,
  }));
};

export const getTotalPlayers = async (gameId: string): Promise<number> => {
  const redis = await getRedisClient();
  const key = getLeaderboardKey(gameId);
  return await redis.zCard(key);
};

export const getPlayersAroundRank = async (
  gameId: string,
  playerId: string,
  range: number = 5
): Promise<Array<{ playerId: string; score: number; rank: number }>> => {
  const redis = await getRedisClient();
  const key = getLeaderboardKey(gameId);
  
  const playerRank = await redis.zRevRank(key, playerId);
  if (playerRank === null) {
    return [];
  }

  const start = Math.max(0, playerRank - range);
  const stop = playerRank + range;

  const results = await redis.zRangeWithScores(key, start, stop, { REV: true });

  return results.map((entry, index) => ({
    playerId: entry.value,
    score: entry.score,
    rank: start + index + 1,
  }));
};

export const bulkUpdateScores = async (
  gameId: string,
  scores: Array<{ playerId: string; score: number }>
): Promise<void> => {
  const redis = await getRedisClient();
  const key = getLeaderboardKey(gameId);
  
  if (scores.length === 0) return;

  const members = scores.map((s) => ({
    score: s.score,
    value: s.playerId,
  }));

  await redis.zAdd(key, members);
};

export const clearLeaderboard = async (gameId: string): Promise<void> => {
  const redis = await getRedisClient();
  const key = getLeaderboardKey(gameId);
  await redis.del(key);
};

export const getPercentile = async (
  gameId: string,
  playerId: string
): Promise<number | null> => {
  const redis = await getRedisClient();
  const key = getLeaderboardKey(gameId);
  
  const rank = await redis.zRevRank(key, playerId);
  if (rank === null) return null;

  const total = await redis.zCard(key);
  if (total === 0) return null;

  return ((total - rank) / total) * 100;
};
