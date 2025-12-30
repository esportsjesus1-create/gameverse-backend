import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SocialProfile,
  GamingPlatform,
} from '../../database/entities/social-profile.entity';
import {
  Friendship,
  FriendshipStatus,
} from '../../database/entities/friendship.entity';
import { FriendService } from '../friend/friend.service';
import { PresenceService } from '../presence/presence.service';
import { ProfileService } from '../profile/profile.service';
import { Neo4jService } from '../friend/neo4j.service';

export interface GamerstakeFriend {
  userId: string;
  gamerstakeUserId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface GamerstakePresence {
  status: string;
  activity?: string;
  gameName?: string;
  lastSeen?: Date;
}

export interface GamerstakeProfile {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  gameStatistics?: SocialProfile['gameStatistics'];
  achievements?: SocialProfile['achievements'];
  gamingPlatforms?: GamingPlatform[];
}

@Injectable()
export class GamerstakeService {
  private readonly logger = new Logger(GamerstakeService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly syncIntervalMs: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SocialProfile)
    private readonly profileRepository: Repository<SocialProfile>,
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    private readonly friendService: FriendService,
    private readonly presenceService: PresenceService,
    private readonly profileService: ProfileService,
    private readonly neo4jService: Neo4jService,
  ) {
    this.apiUrl =
      this.configService.get<string>('gamerstake.apiUrl') ||
      'https://api.gamerstake.com';
    this.apiKey = this.configService.get<string>('gamerstake.apiKey') || '';
    this.syncIntervalMs =
      this.configService.get<number>('gamerstake.syncIntervalMs') || 300000;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncFriendGraph(): Promise<void> {
    this.logger.log('Starting Gamerstake friend graph sync...');

    try {
      const profilesWithGamerstake = await this.profileRepository.find({
        where: { gamerstakeUserId: undefined },
      });

      const linkedProfiles = profilesWithGamerstake.filter(
        (p) => p.gamerstakeUserId,
      );

      for (const profile of linkedProfiles) {
        try {
          await this.syncUserFriends(profile);
        } catch (error) {
          this.logger.error(
            `Failed to sync friends for user ${profile.id}:`,
            error,
          );
        }
      }

      this.logger.log(
        `Completed friend graph sync for ${linkedProfiles.length} users`,
      );
    } catch (error) {
      this.logger.error('Friend graph sync failed:', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncPresence(): Promise<void> {
    this.logger.log('Starting Gamerstake presence sync...');

    try {
      const profilesWithGamerstake = await this.profileRepository.find({
        where: { gamerstakeUserId: undefined },
      });

      const linkedProfiles = profilesWithGamerstake.filter(
        (p) => p.gamerstakeUserId,
      );

      for (const profile of linkedProfiles) {
        try {
          const gamerstakePresence = await this.fetchGamerstakePresence(
            profile.gamerstakeUserId!,
          );
          if (gamerstakePresence) {
            await this.presenceService.syncWithGamerstake(
              profile.id,
              gamerstakePresence,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to sync presence for user ${profile.id}:`,
            error,
          );
        }
      }

      this.logger.log(
        `Completed presence sync for ${linkedProfiles.length} users`,
      );
    } catch (error) {
      this.logger.error('Presence sync failed:', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncProfiles(): Promise<void> {
    this.logger.log('Starting Gamerstake profile sync...');

    try {
      const profilesWithGamerstake = await this.profileRepository.find({
        where: { gamerstakeUserId: undefined },
      });

      const linkedProfiles = profilesWithGamerstake.filter(
        (p) => p.gamerstakeUserId,
      );

      for (const profile of linkedProfiles) {
        try {
          const gamerstakeProfile = await this.fetchGamerstakeProfile(
            profile.gamerstakeUserId!,
          );
          if (gamerstakeProfile) {
            await this.profileService.syncFromGamerstake(
              profile.id,
              gamerstakeProfile,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to sync profile for user ${profile.id}:`,
            error,
          );
        }
      }

      this.logger.log(
        `Completed profile sync for ${linkedProfiles.length} users`,
      );
    } catch (error) {
      this.logger.error('Profile sync failed:', error);
    }
  }

  async linkGamerstakeAccount(
    userId: string,
    gamerstakeUserId: string,
  ): Promise<SocialProfile> {
    const profile = await this.profileRepository.findOne({
      where: { id: userId },
    });
    if (!profile) {
      throw new Error('Profile not found');
    }

    profile.gamerstakeUserId = gamerstakeUserId;
    profile.gamerstakeLastSyncAt = new Date();

    const savedProfile = await this.profileRepository.save(profile);

    await this.syncUserFriends(savedProfile);
    const gamerstakePresence =
      await this.fetchGamerstakePresence(gamerstakeUserId);
    if (gamerstakePresence) {
      await this.presenceService.syncWithGamerstake(userId, gamerstakePresence);
    }
    const gamerstakeProfile =
      await this.fetchGamerstakeProfile(gamerstakeUserId);
    if (gamerstakeProfile) {
      await this.profileService.syncFromGamerstake(userId, gamerstakeProfile);
    }

    return savedProfile;
  }

  async unlinkGamerstakeAccount(userId: string): Promise<SocialProfile> {
    const profile = await this.profileRepository.findOne({
      where: { id: userId },
    });
    if (!profile) {
      throw new Error('Profile not found');
    }

    profile.gamerstakeUserId = null;
    profile.gamerstakeLastSyncAt = null;

    return this.profileRepository.save(profile);
  }

  private async syncUserFriends(profile: SocialProfile): Promise<void> {
    if (!profile.gamerstakeUserId) return;

    const gamerstakeFriends = await this.fetchGamerstakeFriends(
      profile.gamerstakeUserId,
    );

    for (const gsFriend of gamerstakeFriends) {
      const friendProfile = await this.profileRepository.findOne({
        where: { gamerstakeUserId: gsFriend.gamerstakeUserId },
      });

      if (friendProfile) {
        const existingFriendship = await this.friendshipRepository.findOne({
          where: [
            { requesterId: profile.id, addresseeId: friendProfile.id },
            { requesterId: friendProfile.id, addresseeId: profile.id },
          ],
        });

        if (!existingFriendship) {
          const friendship = this.friendshipRepository.create({
            requesterId: profile.id,
            addresseeId: friendProfile.id,
            status: FriendshipStatus.ACCEPTED,
            acceptedAt: new Date(),
            message: 'Synced from Gamerstake',
          });

          await this.friendshipRepository.save(friendship);

          await this.profileRepository.increment(
            { id: profile.id },
            'friendCount',
            1,
          );
          await this.profileRepository.increment(
            { id: friendProfile.id },
            'friendCount',
            1,
          );

          await this.neo4jService.createFriendship(
            profile.id,
            friendProfile.id,
          );
        }
      }
    }

    profile.gamerstakeLastSyncAt = new Date();
    await this.profileRepository.save(profile);
  }

  private async fetchGamerstakeFriends(
    gamerstakeUserId: string,
  ): Promise<GamerstakeFriend[]> {
    try {
      const response = await fetch(
        `${this.apiUrl}/users/${gamerstakeUserId}/friends`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Gamerstake API error: ${response.status}`);
      }

      const data = await response.json();
      return data.friends || [];
    } catch (error) {
      this.logger.error(
        `Failed to fetch Gamerstake friends for ${gamerstakeUserId}:`,
        error,
      );
      return [];
    }
  }

  private async fetchGamerstakePresence(
    gamerstakeUserId: string,
  ): Promise<GamerstakePresence | null> {
    try {
      const response = await fetch(
        `${this.apiUrl}/users/${gamerstakeUserId}/presence`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Gamerstake API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error(
        `Failed to fetch Gamerstake presence for ${gamerstakeUserId}:`,
        error,
      );
      return null;
    }
  }

  private async fetchGamerstakeProfile(
    gamerstakeUserId: string,
  ): Promise<GamerstakeProfile | null> {
    try {
      const response = await fetch(
        `${this.apiUrl}/users/${gamerstakeUserId}/profile`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Gamerstake API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error(
        `Failed to fetch Gamerstake profile for ${gamerstakeUserId}:`,
        error,
      );
      return null;
    }
  }

  async exportFriendsToGamerstake(userId: string): Promise<void> {
    const profile = await this.profileRepository.findOne({
      where: { id: userId },
    });
    if (!profile || !profile.gamerstakeUserId) {
      throw new Error('Profile not linked to Gamerstake');
    }

    const friendships = await this.friendshipRepository.find({
      where: [
        { requesterId: userId, status: FriendshipStatus.ACCEPTED },
        { addresseeId: userId, status: FriendshipStatus.ACCEPTED },
      ],
      relations: ['requester', 'addressee'],
    });

    const friendsToExport = friendships
      .map((f) => {
        const friend = f.requesterId === userId ? f.addressee : f.requester;
        return friend.gamerstakeUserId;
      })
      .filter((id): id is string => id !== null);

    if (friendsToExport.length > 0) {
      try {
        await fetch(
          `${this.apiUrl}/users/${profile.gamerstakeUserId}/friends/import`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ friendIds: friendsToExport }),
          },
        );
      } catch (error) {
        this.logger.error(
          `Failed to export friends to Gamerstake for ${userId}:`,
          error,
        );
        throw error;
      }
    }
  }
}
