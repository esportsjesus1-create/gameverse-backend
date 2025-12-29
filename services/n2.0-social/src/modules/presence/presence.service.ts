import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserPresence, PresenceStatus } from '../../database/entities/user-presence.entity';
import { SocialProfile } from '../../database/entities/social-profile.entity';
import { Friendship, FriendshipStatus } from '../../database/entities/friendship.entity';
import { RedisService, PresenceUpdate } from './redis.service';
import { ConfigService } from '@nestjs/config';
import {
  SetPresenceStatusDto,
  SetCustomMessageDto,
  SetActivityDto,
  PresenceResponseDto,
} from './dto/presence.dto';

@Injectable()
export class PresenceService {
  private readonly offlineTimeoutMs: number;

  constructor(
    @InjectRepository(UserPresence)
    private readonly presenceRepository: Repository<UserPresence>,
    @InjectRepository(SocialProfile)
    private readonly profileRepository: Repository<SocialProfile>,
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.offlineTimeoutMs = this.configService.get<number>('presence.offlineTimeoutMs') || 300000;
  }

  async setOnline(userId: string): Promise<UserPresence> {
    return this.updatePresenceStatus(userId, PresenceStatus.ONLINE);
  }

  async setOffline(userId: string): Promise<UserPresence> {
    return this.updatePresenceStatus(userId, PresenceStatus.OFFLINE);
  }

  async setAway(userId: string): Promise<UserPresence> {
    return this.updatePresenceStatus(userId, PresenceStatus.AWAY);
  }

  async setStatus(userId: string, dto: SetPresenceStatusDto): Promise<UserPresence> {
    return this.updatePresenceStatus(userId, dto.status);
  }

  async setCustomMessage(userId: string, dto: SetCustomMessageDto): Promise<UserPresence> {
    const presence = await this.getOrCreatePresence(userId);
    presence.customMessage = dto.customMessage || null;
    presence.lastActivityAt = new Date();

    const savedPresence = await this.presenceRepository.save(presence);

    await this.publishPresenceUpdate(userId, savedPresence);

    return savedPresence;
  }

  async setActivity(userId: string, dto: SetActivityDto): Promise<UserPresence> {
    const presence = await this.getOrCreatePresence(userId);

    if (dto.currentActivity !== undefined) {
      presence.currentActivity = dto.currentActivity || null;
    }
    if (dto.currentGameId !== undefined) {
      presence.currentGameId = dto.currentGameId || null;
    }
    if (dto.currentGameName !== undefined) {
      presence.currentGameName = dto.currentGameName || null;
    }

    if (dto.currentGameId || dto.currentGameName) {
      presence.status = PresenceStatus.IN_GAME;
    }

    presence.lastActivityAt = new Date();

    const savedPresence = await this.presenceRepository.save(presence);

    await this.publishPresenceUpdate(userId, savedPresence);

    return savedPresence;
  }

  async getPresence(userId: string): Promise<PresenceResponseDto | null> {
    const cachedPresence = await this.redisService.getCachedPresence(userId);

    if (cachedPresence) {
      const profile = await this.profileRepository.findOne({ where: { id: userId } });
      if (profile) {
        return {
          userId,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl || undefined,
          status: cachedPresence.status as PresenceStatus,
          customMessage: cachedPresence.customMessage,
          currentActivity: cachedPresence.currentActivity,
          currentGameName: cachedPresence.currentGameName,
          lastSeenAt: new Date(cachedPresence.timestamp),
        };
      }
    }

    const presence = await this.presenceRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!presence) {
      return null;
    }

    return {
      userId: presence.userId,
      username: presence.user.username,
      displayName: presence.user.displayName,
      avatarUrl: presence.user.avatarUrl || undefined,
      status: presence.status,
      customMessage: presence.customMessage || undefined,
      currentActivity: presence.currentActivity || undefined,
      currentGameName: presence.currentGameName || undefined,
      lastSeenAt: presence.lastSeenAt,
    };
  }

  async getFriendsPresence(userId: string): Promise<PresenceResponseDto[]> {
    const friendIds = await this.getFriendIds(userId);

    if (friendIds.length === 0) {
      return [];
    }

    const cachedPresences = await this.redisService.getCachedPresences(friendIds);

    const profiles = await this.profileRepository.find({
      where: { id: In(friendIds) },
    });

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const result: PresenceResponseDto[] = [];

    for (const friendId of friendIds) {
      const profile = profileMap.get(friendId);
      if (!profile || !profile.showOnlineStatus) continue;

      const cached = cachedPresences.get(friendId);

      if (cached) {
        result.push({
          userId: friendId,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl || undefined,
          status: cached.status as PresenceStatus,
          customMessage: cached.customMessage,
          currentActivity: cached.currentActivity,
          currentGameName: cached.currentGameName,
          lastSeenAt: new Date(cached.timestamp),
        });
      } else {
        const presence = await this.presenceRepository.findOne({
          where: { userId: friendId },
        });

        if (presence) {
          result.push({
            userId: friendId,
            username: profile.username,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl || undefined,
            status: presence.status,
            customMessage: presence.customMessage || undefined,
            currentActivity: presence.currentActivity || undefined,
            currentGameName: presence.currentGameName || undefined,
            lastSeenAt: presence.lastSeenAt,
          });
        }
      }
    }

    return result;
  }

  async subscribeToFriendsPresence(
    userId: string,
    callback: (update: PresenceUpdate) => void,
  ): Promise<void> {
    const friendIds = await this.getFriendIds(userId);
    const friendIdSet = new Set(friendIds);

    await this.redisService.subscribeToPresenceUpdates((update) => {
      if (friendIdSet.has(update.userId)) {
        callback(update);
      }
    });
  }

  async heartbeat(userId: string): Promise<void> {
    const presence = await this.getOrCreatePresence(userId);
    presence.lastSeenAt = new Date();
    presence.lastActivityAt = new Date();

    await this.presenceRepository.save(presence);
    await this.redisService.heartbeat(userId);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkOfflineUsers(): Promise<void> {
    const cutoffTime = new Date(Date.now() - this.offlineTimeoutMs);

    const stalePresences = await this.presenceRepository.find({
      where: {
        status: In([PresenceStatus.ONLINE, PresenceStatus.AWAY, PresenceStatus.IN_GAME]),
        lastSeenAt: LessThan(cutoffTime),
      },
    });

    for (const presence of stalePresences) {
      presence.status = PresenceStatus.OFFLINE;
      await this.presenceRepository.save(presence);
      await this.publishPresenceUpdate(presence.userId, presence);
    }
  }

  async syncWithGamerstake(userId: string, gamerstakePresence: {
    status: string;
    activity?: string;
    gameName?: string;
  }): Promise<UserPresence> {
    const presence = await this.getOrCreatePresence(userId);

    const statusMap: Record<string, PresenceStatus> = {
      online: PresenceStatus.ONLINE,
      offline: PresenceStatus.OFFLINE,
      away: PresenceStatus.AWAY,
      busy: PresenceStatus.BUSY,
      in_game: PresenceStatus.IN_GAME,
    };

    presence.status = statusMap[gamerstakePresence.status] || PresenceStatus.ONLINE;
    presence.currentActivity = gamerstakePresence.activity || null;
    presence.currentGameName = gamerstakePresence.gameName || null;
    presence.isGamerstakeSynced = true;
    presence.gamerstakeLastSyncAt = new Date();
    presence.lastSeenAt = new Date();

    const savedPresence = await this.presenceRepository.save(presence);

    await this.publishPresenceUpdate(userId, savedPresence);

    return savedPresence;
  }

  private async updatePresenceStatus(
    userId: string,
    status: PresenceStatus,
  ): Promise<UserPresence> {
    const presence = await this.getOrCreatePresence(userId);
    presence.status = status;
    presence.lastSeenAt = new Date();

    if (status === PresenceStatus.OFFLINE) {
      presence.currentActivity = null;
      presence.currentGameId = null;
      presence.currentGameName = null;
    }

    const savedPresence = await this.presenceRepository.save(presence);

    await this.publishPresenceUpdate(userId, savedPresence);

    return savedPresence;
  }

  private async getOrCreatePresence(userId: string): Promise<UserPresence> {
    let presence = await this.presenceRepository.findOne({ where: { userId } });

    if (!presence) {
      const profile = await this.profileRepository.findOne({ where: { id: userId } });
      if (!profile) {
        throw new NotFoundException('Profile not found');
      }

      presence = this.presenceRepository.create({
        userId,
        status: PresenceStatus.OFFLINE,
        lastSeenAt: new Date(),
      });
      presence = await this.presenceRepository.save(presence);
    }

    return presence;
  }

  private async publishPresenceUpdate(
    userId: string,
    presence: UserPresence,
  ): Promise<void> {
    const update: PresenceUpdate = {
      userId,
      status: presence.status,
      customMessage: presence.customMessage || undefined,
      currentActivity: presence.currentActivity || undefined,
      currentGameName: presence.currentGameName || undefined,
      timestamp: Date.now(),
    };

    await this.redisService.publishPresenceUpdate(update);
  }

  private async getFriendIds(userId: string): Promise<string[]> {
    const friendships = await this.friendshipRepository.find({
      where: [
        { requesterId: userId, status: FriendshipStatus.ACCEPTED },
        { addresseeId: userId, status: FriendshipStatus.ACCEPTED },
      ],
    });

    return friendships.map((f) =>
      f.requesterId === userId ? f.addresseeId : f.requesterId,
    );
  }
}
