import { v4 as uuidv4 } from 'uuid';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../config/redis';
import { logger, EventType } from '../utils/logger';
import {
  PlayerNotFoundError,
  NotFriendsError,
  FriendGroupNotFoundError,
  FriendGroupFullError,
  FriendGroupPermissionError,
  ChallengeNotFoundError,
  ChallengeAlreadyExistsError,
  ChallengeNotActiveError,
  CannotChallengeSelfError,
} from '../utils/errors';
import {
  FriendRanking,
  RankTier,
  TierDivision,
  PaginatedResponse,
  FriendLeaderboardQuery,
  FriendChallenge,
  FriendGroup,
  ActivityFeedItem,
  HeadToHeadComparison,
  PlayerRanking,
} from '../types';

interface Friendship {
  id: string;
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: Date;
  acceptedAt?: Date;
}

interface PlayerData {
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  score: number;
  mmr: number;
  tier: RankTier;
  division?: TierDivision;
  wins: number;
  losses: number;
  winRate: number;
  gamesPlayed: number;
  lastActiveAt: Date;
}

class FriendRankingService {
  private friendships: Map<string, Friendship> = new Map();
  private playerData: Map<string, PlayerData> = new Map();
  private friendGroups: Map<string, FriendGroup> = new Map();
  private challenges: Map<string, FriendChallenge> = new Map();
  private activityFeed: Map<string, ActivityFeedItem[]> = new Map();
  private headToHeadStats: Map<string, { wins: number; losses: number; draws: number; lastMatchAt?: Date }> = new Map();

  constructor() {
    logger.info(EventType.SERVICE_STARTED, 'Friend ranking service initialized');
  }

  public async addFriendship(userId: string, friendId: string): Promise<Friendship> {
    const friendshipId = this.getFriendshipKey(userId, friendId);
    const now = new Date();

    const friendship: Friendship = {
      id: uuidv4(),
      userId,
      friendId,
      status: 'accepted',
      createdAt: now,
      acceptedAt: now,
    };

    this.friendships.set(friendshipId, friendship);
    await this.invalidateFriendCache(userId);
    await this.invalidateFriendCache(friendId);

    return friendship;
  }

  public async removeFriendship(userId: string, friendId: string): Promise<boolean> {
    const friendshipId = this.getFriendshipKey(userId, friendId);
    const deleted = this.friendships.delete(friendshipId);

    if (deleted) {
      await this.invalidateFriendCache(userId);
      await this.invalidateFriendCache(friendId);
    }

    return deleted;
  }

  public async getFriends(userId: string): Promise<string[]> {
    const friends: string[] = [];

    for (const [, friendship] of this.friendships) {
      if (friendship.status !== 'accepted') continue;

      if (friendship.userId === userId) {
        friends.push(friendship.friendId);
      } else if (friendship.friendId === userId) {
        friends.push(friendship.userId);
      }
    }

    return friends;
  }

  public async areFriends(userId: string, friendId: string): Promise<boolean> {
    const friendshipId = this.getFriendshipKey(userId, friendId);
    const friendship = this.friendships.get(friendshipId);
    return friendship?.status === 'accepted';
  }

  public async updatePlayerData(data: PlayerData): Promise<void> {
    this.playerData.set(data.playerId, data);
    await this.invalidateFriendCache(data.playerId);

    const friends = await this.getFriends(data.playerId);
    for (const friendId of friends) {
      await this.invalidateFriendCache(friendId);
    }
  }

  public async getFriendLeaderboard(
    query: FriendLeaderboardQuery
  ): Promise<PaginatedResponse<FriendRanking>> {
    const { playerId, page = 1, limit = 50, gameId, groupId } = query;

    const cacheKey = CACHE_KEYS.FRIEND_LEADERBOARD(playerId, gameId);
    const cached = await cacheService.get<PaginatedResponse<FriendRanking>>(cacheKey);
    if (cached) return cached;

    let friendIds: string[];

    if (groupId) {
      const group = this.friendGroups.get(groupId);
      if (!group) {
        throw new FriendGroupNotFoundError(groupId);
      }
      if (!group.memberIds.includes(playerId) && group.ownerId !== playerId) {
        throw new FriendGroupPermissionError(playerId, groupId);
      }
      friendIds = group.memberIds;
    } else {
      friendIds = await this.getFriends(playerId);
    }

    friendIds.push(playerId);

    const friendRankings: FriendRanking[] = [];

    for (const friendId of friendIds) {
      const data = this.playerData.get(friendId);
      if (!data) continue;

      const h2hKey = this.getHeadToHeadKey(playerId, friendId);
      const h2h = this.headToHeadStats.get(h2hKey);

      friendRankings.push({
        playerId,
        friendId,
        friendName: data.playerName,
        friendAvatar: data.playerAvatar,
        rank: 0,
        score: data.score,
        tier: data.tier,
        division: data.division,
        wins: data.wins,
        losses: data.losses,
        winRate: data.winRate,
        headToHeadWins: friendId === playerId ? 0 : (h2h?.wins || 0),
        headToHeadLosses: friendId === playerId ? 0 : (h2h?.losses || 0),
        lastPlayedAt: h2h?.lastMatchAt,
      });
    }

    friendRankings.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.wins - a.wins;
    });

    friendRankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    const offset = (page - 1) * limit;
    const paginatedRankings = friendRankings.slice(offset, offset + limit);
    const total = friendRankings.length;
    const totalPages = Math.ceil(total / limit);

    const result: PaginatedResponse<FriendRanking> = {
      data: paginatedRankings,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };

    await cacheService.set(cacheKey, result, CACHE_TTL.FRIEND_LEADERBOARD);
    return result;
  }

  public async getPlayerRankAmongFriends(playerId: string): Promise<number | null> {
    const friends = await this.getFriends(playerId);
    if (friends.length === 0) return 1;

    const playerData = this.playerData.get(playerId);
    if (!playerData) return null;

    let rank = 1;
    for (const friendId of friends) {
      const friendData = this.playerData.get(friendId);
      if (friendData && friendData.score > playerData.score) {
        rank++;
      }
    }

    return rank;
  }

  public async getFriendComparison(
    player1Id: string,
    player2Id: string
  ): Promise<HeadToHeadComparison> {
    const areFriends = await this.areFriends(player1Id, player2Id);
    if (!areFriends) {
      throw new NotFriendsError(player1Id, player2Id);
    }

    const player1Data = this.playerData.get(player1Id);
    const player2Data = this.playerData.get(player2Id);

    if (!player1Data) {
      throw new PlayerNotFoundError(player1Id);
    }
    if (!player2Data) {
      throw new PlayerNotFoundError(player2Id);
    }

    const h2hKey = this.getHeadToHeadKey(player1Id, player2Id);
    const h2h = this.headToHeadStats.get(h2hKey) || { wins: 0, losses: 0, draws: 0 };

    const player1Ranking: PlayerRanking = {
      playerId: player1Id,
      playerName: player1Data.playerName,
      playerAvatar: player1Data.playerAvatar,
      totalScore: player1Data.score,
      tier: player1Data.tier,
      division: player1Data.division,
      mmr: player1Data.mmr,
      wins: player1Data.wins,
      losses: player1Data.losses,
      winRate: player1Data.winRate,
      gamesPlayed: player1Data.gamesPlayed,
      lastActiveAt: player1Data.lastActiveAt,
    };

    const player2Ranking: PlayerRanking = {
      playerId: player2Id,
      playerName: player2Data.playerName,
      playerAvatar: player2Data.playerAvatar,
      totalScore: player2Data.score,
      tier: player2Data.tier,
      division: player2Data.division,
      mmr: player2Data.mmr,
      wins: player2Data.wins,
      losses: player2Data.losses,
      winRate: player2Data.winRate,
      gamesPlayed: player2Data.gamesPlayed,
      lastActiveAt: player2Data.lastActiveAt,
    };

    return {
      player1: player1Ranking,
      player2: player2Ranking,
      headToHead: {
        player1Wins: h2h.wins,
        player2Wins: h2h.losses,
        draws: h2h.draws,
        lastMatchAt: h2h.lastMatchAt,
      },
      rankDifference: 0,
      scoreDifference: player1Data.score - player2Data.score,
      mmrDifference: player1Data.mmr - player2Data.mmr,
    };
  }

  public async recordHeadToHeadResult(
    winnerId: string,
    loserId: string,
    isDraw = false
  ): Promise<void> {
    const h2hKey = this.getHeadToHeadKey(winnerId, loserId);
    const h2h = this.headToHeadStats.get(h2hKey) || { wins: 0, losses: 0, draws: 0 };

    if (isDraw) {
      h2h.draws++;
    } else {
      h2h.wins++;
    }
    h2h.lastMatchAt = new Date();

    this.headToHeadStats.set(h2hKey, h2h);

    const reverseKey = this.getHeadToHeadKey(loserId, winnerId);
    const reverseH2h = this.headToHeadStats.get(reverseKey) || { wins: 0, losses: 0, draws: 0 };
    if (isDraw) {
      reverseH2h.draws++;
    } else {
      reverseH2h.losses++;
    }
    reverseH2h.lastMatchAt = new Date();
    this.headToHeadStats.set(reverseKey, reverseH2h);
  }

  public async createFriendGroup(
    ownerId: string,
    name: string,
    memberIds: string[],
    isPublic = false
  ): Promise<FriendGroup> {
    const now = new Date();
    const group: FriendGroup = {
      id: uuidv4(),
      name,
      ownerId,
      memberIds: [ownerId, ...memberIds],
      isPublic,
      createdAt: now,
      updatedAt: now,
    };

    this.friendGroups.set(group.id, group);
    return group;
  }

  public async getFriendGroup(groupId: string): Promise<FriendGroup> {
    const group = this.friendGroups.get(groupId);
    if (!group) {
      throw new FriendGroupNotFoundError(groupId);
    }
    return group;
  }

  public async addMemberToGroup(
    groupId: string,
    playerId: string,
    requesterId: string
  ): Promise<FriendGroup> {
    const group = this.friendGroups.get(groupId);
    if (!group) {
      throw new FriendGroupNotFoundError(groupId);
    }

    if (group.ownerId !== requesterId) {
      throw new FriendGroupPermissionError(requesterId, groupId);
    }

    if (group.memberIds.length >= 50) {
      throw new FriendGroupFullError(groupId);
    }

    if (!group.memberIds.includes(playerId)) {
      group.memberIds.push(playerId);
      group.updatedAt = new Date();
    }

    return group;
  }

  public async removeMemberFromGroup(
    groupId: string,
    playerId: string,
    requesterId: string
  ): Promise<FriendGroup> {
    const group = this.friendGroups.get(groupId);
    if (!group) {
      throw new FriendGroupNotFoundError(groupId);
    }

    if (group.ownerId !== requesterId && playerId !== requesterId) {
      throw new FriendGroupPermissionError(requesterId, groupId);
    }

    group.memberIds = group.memberIds.filter((id) => id !== playerId);
    group.updatedAt = new Date();

    return group;
  }

  public async getGroupLeaderboard(
    groupId: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<FriendRanking>> {
    const group = this.friendGroups.get(groupId);
    if (!group) {
      throw new FriendGroupNotFoundError(groupId);
    }

    const rankings: FriendRanking[] = [];

    for (const memberId of group.memberIds) {
      const data = this.playerData.get(memberId);
      if (!data) continue;

      rankings.push({
        playerId: group.ownerId,
        friendId: memberId,
        friendName: data.playerName,
        friendAvatar: data.playerAvatar,
        rank: 0,
        score: data.score,
        tier: data.tier,
        division: data.division,
        wins: data.wins,
        losses: data.losses,
        winRate: data.winRate,
        headToHeadWins: 0,
        headToHeadLosses: 0,
      });
    }

    rankings.sort((a, b) => b.score - a.score);
    rankings.forEach((r, i) => { r.rank = i + 1; });

    const offset = (page - 1) * limit;
    const paginatedRankings = rankings.slice(offset, offset + limit);
    const total = rankings.length;
    const totalPages = Math.ceil(total / limit);

    return {
      data: paginatedRankings,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  public async createChallenge(
    challengerId: string,
    challengedId: string,
    leaderboardId: string,
    targetScore: number,
    expiresInDays = 7
  ): Promise<FriendChallenge> {
    if (challengerId === challengedId) {
      throw new CannotChallengeSelfError();
    }

    const areFriends = await this.areFriends(challengerId, challengedId);
    if (!areFriends) {
      throw new NotFriendsError(challengerId, challengedId);
    }

    const existingChallenge = Array.from(this.challenges.values()).find(
      (c) =>
        c.status === 'ACTIVE' &&
        ((c.challengerId === challengerId && c.challengedId === challengedId) ||
          (c.challengerId === challengedId && c.challengedId === challengerId))
    );

    if (existingChallenge) {
      throw new ChallengeAlreadyExistsError(challengerId, challengedId);
    }

    const challengerData = this.playerData.get(challengerId);
    const challengedData = this.playerData.get(challengedId);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    const challenge: FriendChallenge = {
      id: uuidv4(),
      challengerId,
      challengedId,
      leaderboardId,
      targetScore,
      currentChallengerScore: challengerData?.score || 0,
      currentChallengedScore: challengedData?.score || 0,
      status: 'ACTIVE',
      expiresAt,
      createdAt: now,
    };

    this.challenges.set(challenge.id, challenge);
    logger.info(EventType.FRIEND_CHALLENGE_CREATED, `Challenge created between ${challengerId} and ${challengedId}`);

    return challenge;
  }

  public async getChallenge(challengeId: string): Promise<FriendChallenge> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      throw new ChallengeNotFoundError(challengeId);
    }
    return challenge;
  }

  public async getPlayerChallenges(
    playerId: string,
    status?: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED'
  ): Promise<FriendChallenge[]> {
    return Array.from(this.challenges.values()).filter(
      (c) =>
        (c.challengerId === playerId || c.challengedId === playerId) &&
        (!status || c.status === status)
    );
  }

  public async updateChallengeProgress(
    playerId: string,
    newScore: number
  ): Promise<FriendChallenge[]> {
    const updatedChallenges: FriendChallenge[] = [];

    for (const challenge of this.challenges.values()) {
      if (challenge.status !== 'ACTIVE') continue;

      const now = new Date();
      if (now > challenge.expiresAt) {
        challenge.status = 'EXPIRED';
        logger.info(EventType.FRIEND_CHALLENGE_EXPIRED, `Challenge ${challenge.id} expired`);
        continue;
      }

      if (challenge.challengerId === playerId) {
        challenge.currentChallengerScore = newScore;
      } else if (challenge.challengedId === playerId) {
        challenge.currentChallengedScore = newScore;
      } else {
        continue;
      }

      if (
        challenge.currentChallengerScore >= challenge.targetScore ||
        challenge.currentChallengedScore >= challenge.targetScore
      ) {
        challenge.status = 'COMPLETED';
        challenge.completedAt = now;
        challenge.winnerId =
          challenge.currentChallengerScore >= challenge.targetScore
            ? challenge.challengerId
            : challenge.challengedId;
        logger.info(EventType.FRIEND_CHALLENGE_COMPLETED, `Challenge ${challenge.id} completed, winner: ${challenge.winnerId}`);
      }

      updatedChallenges.push(challenge);
    }

    return updatedChallenges;
  }

  public async cancelChallenge(challengeId: string, requesterId: string): Promise<FriendChallenge> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      throw new ChallengeNotFoundError(challengeId);
    }

    if (challenge.challengerId !== requesterId && challenge.challengedId !== requesterId) {
      throw new FriendGroupPermissionError(requesterId, challengeId);
    }

    if (challenge.status !== 'ACTIVE' && challenge.status !== 'PENDING') {
      throw new ChallengeNotActiveError(challengeId);
    }

    challenge.status = 'CANCELLED';
    return challenge;
  }

  public async getActivityFeed(
    playerId: string,
    limit = 50
  ): Promise<ActivityFeedItem[]> {
    const friends = await this.getFriends(playerId);
    const allActivities: ActivityFeedItem[] = [];

    for (const friendId of friends) {
      const activities = this.activityFeed.get(friendId) || [];
      allActivities.push(...activities);
    }

    allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return allActivities.slice(0, limit);
  }

  public async addActivityFeedItem(
    playerId: string,
    type: ActivityFeedItem['type'],
    data: Record<string, unknown>,
    leaderboardId: string
  ): Promise<void> {
    const playerData = this.playerData.get(playerId);
    if (!playerData) return;

    const item: ActivityFeedItem = {
      id: uuidv4(),
      playerId,
      playerName: playerData.playerName,
      type,
      data,
      leaderboardId,
      timestamp: new Date(),
    };

    const feed = this.activityFeed.get(playerId) || [];
    feed.unshift(item);
    if (feed.length > 100) {
      feed.pop();
    }
    this.activityFeed.set(playerId, feed);
  }

  public async getMutualFriends(player1Id: string, player2Id: string): Promise<string[]> {
    const friends1 = await this.getFriends(player1Id);
    const friends2 = await this.getFriends(player2Id);

    return friends1.filter((f) => friends2.includes(f));
  }

  public async getMutualFriendsLeaderboard(
    player1Id: string,
    player2Id: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<FriendRanking>> {
    const mutualFriends = await this.getMutualFriends(player1Id, player2Id);
    mutualFriends.push(player1Id, player2Id);

    const rankings: FriendRanking[] = [];

    for (const friendId of mutualFriends) {
      const data = this.playerData.get(friendId);
      if (!data) continue;

      rankings.push({
        playerId: player1Id,
        friendId,
        friendName: data.playerName,
        friendAvatar: data.playerAvatar,
        rank: 0,
        score: data.score,
        tier: data.tier,
        division: data.division,
        wins: data.wins,
        losses: data.losses,
        winRate: data.winRate,
        headToHeadWins: 0,
        headToHeadLosses: 0,
      });
    }

    rankings.sort((a, b) => b.score - a.score);
    rankings.forEach((r, i) => { r.rank = i + 1; });

    const offset = (page - 1) * limit;
    const paginatedRankings = rankings.slice(offset, offset + limit);
    const total = rankings.length;
    const totalPages = Math.ceil(total / limit);

    return {
      data: paginatedRankings,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  private getFriendshipKey(userId: string, friendId: string): string {
    return [userId, friendId].sort().join(':');
  }

  private getHeadToHeadKey(player1Id: string, player2Id: string): string {
    return `${player1Id}:${player2Id}`;
  }

  private async invalidateFriendCache(playerId: string): Promise<void> {
    await cacheService.deletePattern(`friends:${playerId}:*`);
  }
}

export const friendRankingService = new FriendRankingService();
export default friendRankingService;
