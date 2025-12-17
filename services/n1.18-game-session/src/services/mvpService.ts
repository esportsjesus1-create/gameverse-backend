import { config } from '../config';
import { getPlayerStats, getSessionPlayers } from './sessionService';
import { MVPResult, PlayerStats } from '../types';

interface PlayerWithStats {
  playerId: string;
  playerName: string;
  stats: PlayerStats;
}

export function calculatePlayerScore(stats: PlayerStats): {
  totalScore: number;
  breakdown: MVPResult['breakdown'];
} {
  const weights = config.mvp.weights;
  
  const killScore = stats.kills * weights.kill;
  const deathPenalty = stats.deaths * weights.death;
  const assistScore = stats.assists * weights.assist;
  const damageScore = stats.damageDealt * weights.damageDealt;
  const damagePenalty = stats.damageReceived * weights.damageReceived;
  const objectiveScore = stats.objectivesCompleted * weights.objective;
  
  const survivalScore = Math.max(0, -deathPenalty - damagePenalty);
  
  const totalScore = killScore + deathPenalty + assistScore + damageScore + damagePenalty + objectiveScore;
  
  return {
    totalScore: Math.round(totalScore * 100) / 100,
    breakdown: {
      killScore: Math.round(killScore * 100) / 100,
      assistScore: Math.round(assistScore * 100) / 100,
      objectiveScore: Math.round(objectiveScore * 100) / 100,
      damageScore: Math.round(damageScore * 100) / 100,
      survivalScore: Math.round(survivalScore * 100) / 100,
    },
  };
}

export async function calculateMVP(sessionId: string): Promise<MVPResult | null> {
  const [players, allStats] = await Promise.all([
    getSessionPlayers(sessionId),
    getPlayerStats(sessionId),
  ]);
  
  if (players.length === 0 || allStats.length === 0) {
    return null;
  }
  
  const playersWithStats: PlayerWithStats[] = players
    .map((player) => {
      const stats = allStats.find((s) => s.playerId === player.playerId);
      if (!stats) return null;
      return {
        playerId: player.playerId,
        playerName: player.playerName,
        stats,
      };
    })
    .filter((p): p is PlayerWithStats => p !== null);
  
  if (playersWithStats.length === 0) {
    return null;
  }
  
  let mvp: MVPResult | null = null;
  let highestScore = -Infinity;
  
  for (const player of playersWithStats) {
    const { totalScore, breakdown } = calculatePlayerScore(player.stats);
    
    if (totalScore > highestScore) {
      highestScore = totalScore;
      mvp = {
        playerId: player.playerId,
        playerName: player.playerName,
        totalScore,
        breakdown,
      };
    }
  }
  
  return mvp;
}

export async function getAllPlayerScores(sessionId: string): Promise<MVPResult[]> {
  const [players, allStats] = await Promise.all([
    getSessionPlayers(sessionId),
    getPlayerStats(sessionId),
  ]);
  
  const results: MVPResult[] = [];
  
  for (const player of players) {
    const stats = allStats.find((s) => s.playerId === player.playerId);
    if (!stats) continue;
    
    const { totalScore, breakdown } = calculatePlayerScore(stats);
    
    results.push({
      playerId: player.playerId,
      playerName: player.playerName,
      totalScore,
      breakdown,
    });
  }
  
  return results.sort((a, b) => b.totalScore - a.totalScore);
}
