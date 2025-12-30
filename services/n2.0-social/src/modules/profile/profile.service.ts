import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import {
  SocialProfile,
  ProfileVisibility,
  GamingPlatform,
} from '../../database/entities/social-profile.entity';
import { Friendship, FriendshipStatus } from '../../database/entities/friendship.entity';
import { BlockedUser } from '../../database/entities/blocked-user.entity';
import { Neo4jService } from '../friend/neo4j.service';
import {
  UpdateProfileDto,
  SetVisibilityDto,
  UpdatePrivacySettingsDto,
  AddGamingPlatformDto,
  ProfileResponseDto,
  FullProfileResponseDto,
  UserSearchResultDto,
} from './dto/profile.dto';
import { PaginationDto, PaginatedResponseDto } from '../friend/dto/friend.dto';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(SocialProfile)
    private readonly profileRepository: Repository<SocialProfile>,
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    @InjectRepository(BlockedUser)
    private readonly blockedUserRepository: Repository<BlockedUser>,
    private readonly neo4jService: Neo4jService,
  ) {}

  async getOwnProfile(userId: string): Promise<FullProfileResponseDto> {
    const profile = await this.profileRepository.findOne({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return this.mapToFullProfileResponse(profile);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SocialProfile> {
    const profile = await this.profileRepository.findOne({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (dto.displayName !== undefined) profile.displayName = dto.displayName;
    if (dto.bio !== undefined) profile.bio = dto.bio || null;
    if (dto.avatarUrl !== undefined) profile.avatarUrl = dto.avatarUrl || null;
    if (dto.bannerUrl !== undefined) profile.bannerUrl = dto.bannerUrl || null;
    if (dto.location !== undefined) profile.location = dto.location || null;
    if (dto.website !== undefined) profile.website = dto.website || null;

    const savedProfile = await this.profileRepository.save(profile);

    await this.neo4jService.createUser(savedProfile);

    return savedProfile;
  }

  async getUserProfile(
    currentUserId: string,
    targetUserId: string,
  ): Promise<ProfileResponseDto | FullProfileResponseDto> {
    const isBlocked = await this.isBlocked(currentUserId, targetUserId);
    if (isBlocked) {
      throw new ForbiddenException('Cannot view this profile');
    }

    const profile = await this.profileRepository.findOne({
      where: { id: targetUserId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (currentUserId === targetUserId) {
      return this.mapToFullProfileResponse(profile);
    }

    const areFriends = await this.areFriends(currentUserId, targetUserId);

    if (profile.visibility === ProfileVisibility.PRIVATE && !areFriends) {
      return this.mapToBasicProfileResponse(profile);
    }

    if (profile.visibility === ProfileVisibility.FRIENDS && !areFriends) {
      return this.mapToBasicProfileResponse(profile);
    }

    return this.mapToProfileResponse(profile);
  }

  async setVisibility(userId: string, dto: SetVisibilityDto): Promise<SocialProfile> {
    const profile = await this.profileRepository.findOne({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    profile.visibility = dto.visibility;
    return this.profileRepository.save(profile);
  }

  async updatePrivacySettings(
    userId: string,
    dto: UpdatePrivacySettingsDto,
  ): Promise<SocialProfile> {
    const profile = await this.profileRepository.findOne({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (dto.allowFriendRequests !== undefined) {
      profile.allowFriendRequests = dto.allowFriendRequests;
    }
    if (dto.showOnlineStatus !== undefined) {
      profile.showOnlineStatus = dto.showOnlineStatus;
    }
    if (dto.showGameActivity !== undefined) {
      profile.showGameActivity = dto.showGameActivity;
    }

    return this.profileRepository.save(profile);
  }

  async addGamingPlatform(
    userId: string,
    dto: AddGamingPlatformDto,
  ): Promise<SocialProfile> {
    const profile = await this.profileRepository.findOne({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const existingPlatform = profile.gamingPlatforms.find(
      (p) => p.platform.toLowerCase() === dto.platform.platform.toLowerCase(),
    );

    if (existingPlatform) {
      throw new ConflictException('Platform already added');
    }

    const newPlatform: GamingPlatform = {
      platform: dto.platform.platform,
      username: dto.platform.username,
      profileUrl: dto.platform.profileUrl,
      verified: false,
      addedAt: new Date(),
    };

    profile.gamingPlatforms = [...profile.gamingPlatforms, newPlatform];
    return this.profileRepository.save(profile);
  }

  async removeGamingPlatform(userId: string, platformName: string): Promise<SocialProfile> {
    const profile = await this.profileRepository.findOne({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const platformIndex = profile.gamingPlatforms.findIndex(
      (p) => p.platform.toLowerCase() === platformName.toLowerCase(),
    );

    if (platformIndex === -1) {
      throw new NotFoundException('Platform not found');
    }

    profile.gamingPlatforms = profile.gamingPlatforms.filter(
      (_, index) => index !== platformIndex,
    );

    return this.profileRepository.save(profile);
  }

  async getGameStatistics(userId: string): Promise<SocialProfile['gameStatistics']> {
    const profile = await this.profileRepository.findOne({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile.gameStatistics;
  }

  async getAchievements(userId: string): Promise<SocialProfile['achievements']> {
    const profile = await this.profileRepository.findOne({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile.achievements;
  }

  async syncFromGamerstake(
    userId: string,
    gamerstakeData: {
      displayName?: string;
      avatarUrl?: string;
      bio?: string;
      gameStatistics?: SocialProfile['gameStatistics'];
      achievements?: SocialProfile['achievements'];
      gamingPlatforms?: GamingPlatform[];
    },
  ): Promise<SocialProfile> {
    const profile = await this.profileRepository.findOne({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (gamerstakeData.displayName) profile.displayName = gamerstakeData.displayName;
    if (gamerstakeData.avatarUrl) profile.avatarUrl = gamerstakeData.avatarUrl;
    if (gamerstakeData.bio) profile.bio = gamerstakeData.bio;
    if (gamerstakeData.gameStatistics) {
      profile.gameStatistics = this.mergeGameStatistics(
        profile.gameStatistics,
        gamerstakeData.gameStatistics,
      );
    }
    if (gamerstakeData.achievements) {
      profile.achievements = this.mergeAchievements(
        profile.achievements,
        gamerstakeData.achievements,
      );
    }
    if (gamerstakeData.gamingPlatforms) {
      profile.gamingPlatforms = this.mergeGamingPlatforms(
        profile.gamingPlatforms,
        gamerstakeData.gamingPlatforms,
      );
    }

    profile.gamerstakeLastSyncAt = new Date();

    return this.profileRepository.save(profile);
  }

  async searchUsers(
    currentUserId: string,
    query: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<UserSearchResultDto>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const blockedIds = await this.getBlockedUserIds(currentUserId);

    const queryBuilder = this.profileRepository
      .createQueryBuilder('p')
      .where('(p.username ILIKE :query OR p.displayName ILIKE :query)', {
        query: `%${query}%`,
      })
      .andWhere('p.visibility != :private', { private: ProfileVisibility.PRIVATE });

    if (blockedIds.length > 0) {
      queryBuilder.andWhere('p.id NOT IN (:...blockedIds)', { blockedIds });
    }

    const [profiles, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('p.username', 'ASC')
      .getManyAndCount();

    const data: UserSearchResultDto[] = await Promise.all(
      profiles.map(async (p) => {
        const mutualFriends = await this.neo4jService.getMutualFriends(currentUserId, p.id);
        return {
          id: p.id,
          username: p.username,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl || undefined,
          isVerified: p.isVerified,
          mutualFriendCount: mutualFriends.length,
        };
      }),
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createProfile(
    userId: string,
    username: string,
    displayName: string,
  ): Promise<SocialProfile> {
    const existingProfile = await this.profileRepository.findOne({
      where: [{ userId }, { username }],
    });

    if (existingProfile) {
      if (existingProfile.userId === userId) {
        throw new ConflictException('Profile already exists for this user');
      }
      throw new ConflictException('Username already taken');
    }

    const profile = this.profileRepository.create({
      userId,
      username,
      displayName,
      visibility: ProfileVisibility.PUBLIC,
      gamingPlatforms: [],
      gameStatistics: [],
      achievements: [],
    });

    const savedProfile = await this.profileRepository.save(profile);

    await this.neo4jService.createUser(savedProfile);

    return savedProfile;
  }

  private mapToFullProfileResponse(profile: SocialProfile): FullProfileResponseDto {
    return {
      id: profile.id,
      userId: profile.userId,
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio || undefined,
      avatarUrl: profile.avatarUrl || undefined,
      bannerUrl: profile.bannerUrl || undefined,
      location: profile.location || undefined,
      website: profile.website || undefined,
      visibility: profile.visibility,
      gamingPlatforms: profile.gamingPlatforms,
      friendCount: profile.friendCount,
      isVerified: profile.isVerified,
      createdAt: profile.createdAt,
      gameStatistics: profile.gameStatistics,
      achievements: profile.achievements,
      allowFriendRequests: profile.allowFriendRequests,
      showOnlineStatus: profile.showOnlineStatus,
      showGameActivity: profile.showGameActivity,
    };
  }

  private mapToProfileResponse(profile: SocialProfile): ProfileResponseDto {
    return {
      id: profile.id,
      userId: profile.userId,
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio || undefined,
      avatarUrl: profile.avatarUrl || undefined,
      bannerUrl: profile.bannerUrl || undefined,
      location: profile.location || undefined,
      website: profile.website || undefined,
      visibility: profile.visibility,
      gamingPlatforms: profile.gamingPlatforms,
      friendCount: profile.friendCount,
      isVerified: profile.isVerified,
      createdAt: profile.createdAt,
    };
  }

  private mapToBasicProfileResponse(profile: SocialProfile): ProfileResponseDto {
    return {
      id: profile.id,
      userId: profile.userId,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl || undefined,
      visibility: profile.visibility,
      gamingPlatforms: [],
      friendCount: profile.friendCount,
      isVerified: profile.isVerified,
      createdAt: profile.createdAt,
    };
  }

  private mergeGameStatistics(
    existing: SocialProfile['gameStatistics'],
    incoming: SocialProfile['gameStatistics'],
  ): SocialProfile['gameStatistics'] {
    const merged = [...existing];
    for (const stat of incoming) {
      const existingIndex = merged.findIndex((s) => s.gameId === stat.gameId);
      if (existingIndex >= 0) {
        merged[existingIndex] = { ...merged[existingIndex], ...stat };
      } else {
        merged.push(stat);
      }
    }
    return merged;
  }

  private mergeAchievements(
    existing: SocialProfile['achievements'],
    incoming: SocialProfile['achievements'],
  ): SocialProfile['achievements'] {
    const merged = [...existing];
    for (const achievement of incoming) {
      const exists = merged.some((a) => a.id === achievement.id);
      if (!exists) {
        merged.push(achievement);
      }
    }
    return merged;
  }

  private mergeGamingPlatforms(
    existing: GamingPlatform[],
    incoming: GamingPlatform[],
  ): GamingPlatform[] {
    const merged = [...existing];
    for (const platform of incoming) {
      const existingIndex = merged.findIndex(
        (p) => p.platform.toLowerCase() === platform.platform.toLowerCase(),
      );
      if (existingIndex >= 0) {
        merged[existingIndex] = { ...merged[existingIndex], ...platform };
      } else {
        merged.push(platform);
      }
    }
    return merged;
  }

  private async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await this.friendshipRepository.findOne({
      where: [
        { requesterId: userId1, addresseeId: userId2, status: FriendshipStatus.ACCEPTED },
        { requesterId: userId2, addresseeId: userId1, status: FriendshipStatus.ACCEPTED },
      ],
    });
    return !!friendship;
  }

  private async isBlocked(userId1: string, userId2: string): Promise<boolean> {
    const block = await this.blockedUserRepository.findOne({
      where: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    });
    return !!block;
  }

  private async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.blockedUserRepository.find({
      where: [{ blockerId: userId }, { blockedId: userId }],
    });
    return blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId));
  }
}
