import { v4 as uuidv4 } from 'uuid';
import {
  Leaderboard,
  LeaderboardEntry,
  UserRanking,
  ScoreUpdate,
  LeaderboardSnapshot,
  DecayConfig,
  CreateLeaderboardInput,
  GetLeaderboardOptions,
  PaginatedResult,
  DEFAULT_DECAY_CONFIG,
  LeaderboardError,
  LeaderboardNotFoundError,
  UserNotRankedError,
  LeaderboardInactiveError,
} from '../types';
import { config } from '../config';

const leaderboards: Map<string, Leaderboard> = new Map();
const leaderboardScores: Map<string, Map<string, { score: number; username: string; metadata?: Record<string, unknown>; lastUpdatedAt: Date }>> = new Map();
const snapshots: Map<string, LeaderboardSnapshot[]> = new Map();

export class LeaderboardService {
  async createLeaderboard(input: CreateLeaderboardInput): Promise<Leaderboard> {
    const leaderboardId = uuidv4();
    const now = new Date();

    const decayConfig: DecayConfig = {
      ...DEFAULT_DECAY_CONFIG,
      ...input.decayConfig,
    };

    const leaderboard: Leaderboard = {
      id: leaderboardId,
      name: input.name,
      type: input.type,
      category: input.category,
      gameMode: input.gameMode,
      seasonId: input.seasonId,
      decayConfig,
      isActive: true,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      createdAt: now,
      updatedAt: now,
    };

    leaderboards.set(leaderboardId, leaderboard);
    leaderboardScores.set(leaderboardId, new Map());

    return leaderboard;
  }

  async getLeaderboardById(id: string): Promise<Leaderboard | null> {
    return leaderboards.get(id) || null;
  }

  async getLeaderboards(type?: string, category?: string): Promise<Leaderboard[]> {
    let result = Array.from(leaderboards.values());

    if (type) {
      result = result.filter(lb => lb.type === type);
    }

    if (category) {
      result = result.filter(lb => lb.category === category);
    }

    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateScore(update: ScoreUpdate): Promise<UserRanking> {
    const leaderboard = leaderboards.get(update.leaderboardId);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError();
    }

    if (!leaderboard.isActive) {
      throw new LeaderboardInactiveError();
    }

    const scores = leaderboardScores.get(update.leaderboardId)!;
    const existing = scores.get(update.userId);

    let newScore = update.score;
    if (update.increment && existing) {
      newScore = existing.score + update.score;
    }

    const previousRank = existing ? this.calculateRank(update.leaderboardId, update.userId) : undefined;

    scores.set(update.userId, {
      score: newScore,
      username: update.username,
      metadata: update.metadata || existing?.metadata,
      lastUpdatedAt: new Date(),
    });

    leaderboard.updatedAt = new Date();

    const rank = this.calculateRank(update.leaderboardId, update.userId);
    const totalPlayers = scores.size;
    const percentile = ((totalPlayers - rank) / totalPlayers) * 100;

    return {
      leaderboardId: update.leaderboardId,
      userId: update.userId,
      username: update.username,
      score: newScore,
      rank,
      percentile,
      previousRank,
      rankChange: previousRank ? previousRank - rank : undefined,
      metadata: update.metadata,
    };
  }

  async getTopEntries(leaderboardId: string, options: GetLeaderboardOptions = {}): Promise<LeaderboardEntry[]> {
    const leaderboard = leaderboards.get(leaderboardId);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError();
    }

    const scores = leaderboardScores.get(leaderboardId)!;
    const start = options.start || 0;
    const count = Math.min(options.count || config.leaderboard.defaultPageSize, config.leaderboard.maxPageSize);

    const sortedEntries = Array.from(scores.entries())
      .map(([userId, data]) => ({
        userId,
        username: data.username,
        score: data.score,
        metadata: data.metadata,
        lastUpdatedAt: data.lastUpdatedAt,
      }))
      .sort((a, b) => b.score - a.score);

    return sortedEntries.slice(start, start + count).map((entry, index) => ({
      rank: start + index + 1,
      userId: entry.userId,
      username: entry.username,
      score: entry.score,
      metadata: entry.metadata,
      lastUpdatedAt: entry.lastUpdatedAt,
    }));
  }

  async getUserRanking(leaderboardId: string, userId: string): Promise<UserRanking> {
    const leaderboard = leaderboards.get(leaderboardId);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError();
    }

    const scores = leaderboardScores.get(leaderboardId)!;
    const userData = scores.get(userId);

    if (!userData) {
      throw new UserNotRankedError();
    }

    const rank = this.calculateRank(leaderboardId, userId);
    const totalPlayers = scores.size;
    const percentile = ((totalPlayers - rank) / totalPlayers) * 100;

    return {
      leaderboardId,
      userId,
      username: userData.username,
      score: userData.score,
      rank,
      percentile,
      metadata: userData.metadata,
    };
  }

  async getAroundUser(leaderboardId: string, userId: string, range?: number): Promise<LeaderboardEntry[]> {
    const leaderboard = leaderboards.get(leaderboardId);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError();
    }

    const scores = leaderboardScores.get(leaderboardId)!;
    const userData = scores.get(userId);

    if (!userData) {
      throw new UserNotRankedError();
    }

    const actualRange = range || config.leaderboard.aroundUserRange;
    const rank = this.calculateRank(leaderboardId, userId);

    const start = Math.max(0, rank - actualRange - 1);
    const count = actualRange * 2 + 1;

    return this.getTopEntries(leaderboardId, { start, count });
  }

  private calculateRank(leaderboardId: string, userId: string): number {
    const scores = leaderboardScores.get(leaderboardId)!;
    const userData = scores.get(userId);

    if (!userData) return -1;

    const userScore = userData.score;
    let rank = 1;

    scores.forEach((data, id) => {
      if (id !== userId && data.score > userScore) {
        rank++;
      }
    });

    return rank;
  }

  async applyDecay(leaderboardId: string): Promise<number> {
    const leaderboard = leaderboards.get(leaderboardId);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError();
    }

    if (leaderboard.decayConfig.type === 'none') {
      return 0;
    }

    const scores = leaderboardScores.get(leaderboardId)!;
    const now = new Date();
    let decayedCount = 0;

    scores.forEach((data, odbyId) => {
      const daysSinceUpdate = (now.getTime() - data.lastUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceUpdate > leaderboard.decayConfig.maxInactivityDays) {
        return;
      }

      let decayAmount = 0;
      const rate = leaderboard.decayConfig.rate;

      switch (leaderboard.decayConfig.type) {
        case 'linear':
          decayAmount = data.score * rate;
          break;
        case 'exponential':
          decayAmount = data.score * (1 - Math.pow(1 - rate, daysSinceUpdate));
          break;
        case 'logarithmic':
          decayAmount = data.score * rate * Math.log(daysSinceUpdate + 1);
          break;
      }

      const newScore = Math.max(leaderboard.decayConfig.minScore, data.score - decayAmount);
      
      if (newScore !== data.score) {
        data.score = newScore;
        decayedCount++;
      }
    });

    leaderboard.updatedAt = now;
    return decayedCount;
  }

  async createSnapshot(leaderboardId: string): Promise<LeaderboardSnapshot> {
    const leaderboard = leaderboards.get(leaderboardId);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError();
    }

    const entries = await this.getTopEntries(leaderboardId, { count: config.leaderboard.maxPageSize });
    const scores = leaderboardScores.get(leaderboardId)!;

    const snapshot: LeaderboardSnapshot = {
      id: uuidv4(),
      leaderboardId,
      entries,
      totalPlayers: scores.size,
      snapshotAt: new Date(),
    };

    const leaderboardSnapshots = snapshots.get(leaderboardId) || [];
    leaderboardSnapshots.push(snapshot);
    snapshots.set(leaderboardId, leaderboardSnapshots);

    return snapshot;
  }

  async getSnapshots(leaderboardId: string): Promise<LeaderboardSnapshot[]> {
    return snapshots.get(leaderboardId) || [];
  }

  async resetLeaderboard(leaderboardId: string): Promise<void> {
    const leaderboard = leaderboards.get(leaderboardId);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError();
    }

    await this.createSnapshot(leaderboardId);

    leaderboardScores.set(leaderboardId, new Map());
    leaderboard.updatedAt = new Date();
  }

  async deleteLeaderboard(leaderboardId: string): Promise<void> {
    leaderboards.delete(leaderboardId);
    leaderboardScores.delete(leaderboardId);
    snapshots.delete(leaderboardId);
  }

  async setLeaderboardActive(leaderboardId: string, active: boolean): Promise<Leaderboard> {
    const leaderboard = leaderboards.get(leaderboardId);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError();
    }

    leaderboard.isActive = active;
    leaderboard.updatedAt = new Date();

    return leaderboard;
  }

  async removeUser(leaderboardId: string, userId: string): Promise<void> {
    const scores = leaderboardScores.get(leaderboardId);
    if (scores) {
      scores.delete(userId);
    }
  }

  getLeaderboardStats(leaderboardId: string): { totalPlayers: number; topScore: number; averageScore: number } | null {
    const scores = leaderboardScores.get(leaderboardId);
    if (!scores || scores.size === 0) {
      return null;
    }

    const scoreValues = Array.from(scores.values()).map(d => d.score);
    const totalPlayers = scoreValues.length;
    const topScore = Math.max(...scoreValues);
    const averageScore = scoreValues.reduce((sum, s) => sum + s, 0) / totalPlayers;

    return { totalPlayers, topScore, averageScore };
  }
}

export const leaderboardService = new LeaderboardService();
