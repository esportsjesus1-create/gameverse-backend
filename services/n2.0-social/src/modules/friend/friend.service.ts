import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friendship, FriendshipStatus } from '../../database/entities/friendship.entity';
import { SocialProfile } from '../../database/entities/social-profile.entity';
import { BlockedUser } from '../../database/entities/blocked-user.entity';
import { NotificationService } from '../notification/notification.service';
import { Neo4jService } from '../friend/neo4j.service';
import { SocialLoggerService } from '../../common/services/logger.service';
import { SocialCacheService, CACHE_KEYS, CACHE_TTL } from '../../common/services/cache.service';
import {
  FriendRequestSelfException,
  FriendRequestBlockedException,
  FriendRequestNotFoundException,
  FriendRequestAlreadyPendingException,
  AlreadyFriendsException,
  FriendRequestNotAllowedException,
  FriendshipNotFoundException,
  ProfileNotFoundException,
  DatabaseException,
  SocialErrorCode,
} from '../../common/exceptions/social.exceptions';
import {
  SendFriendRequestDto,
  PaginationDto,
  FriendListResponseDto,
  FriendRequestResponseDto,
  SentFriendRequestResponseDto,
  PaginatedResponseDto,
} from './dto/friend.dto';

@Injectable()
export class FriendService {
  private readonly logger: SocialLoggerService;

  constructor(
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    @InjectRepository(SocialProfile)
    private readonly profileRepository: Repository<SocialProfile>,
    @InjectRepository(BlockedUser)
    private readonly blockedUserRepository: Repository<BlockedUser>,
    private readonly notificationService: NotificationService,
    private readonly neo4jService: Neo4jService,
    private readonly cacheService: SocialCacheService,
  ) {
    this.logger = new SocialLoggerService();
    this.logger.setContext('FriendService');
  }

  async sendFriendRequest(requesterId: string, dto: SendFriendRequestDto): Promise<Friendship> {
    const startTime = Date.now();

    try {
      if (requesterId === dto.addresseeId) {
        this.logger.logFriendRequest('send', requesterId, dto.addresseeId, false, SocialErrorCode.FRIEND_REQUEST_SELF);
        throw new FriendRequestSelfException();
      }

      const requesterProfile = await this.profileRepository.findOne({
        where: { id: requesterId },
      });
      if (!requesterProfile) {
        this.logger.logFriendRequest('send', requesterId, dto.addresseeId, false, SocialErrorCode.PROFILE_NOT_FOUND);
        throw new ProfileNotFoundException(requesterId);
      }

      const addresseeProfile = await this.profileRepository.findOne({
        where: { id: dto.addresseeId },
      });
      if (!addresseeProfile) {
        this.logger.logFriendRequest('send', requesterId, dto.addresseeId, false, SocialErrorCode.PROFILE_NOT_FOUND);
        throw new ProfileNotFoundException(dto.addresseeId);
      }

      if (!addresseeProfile.allowFriendRequests) {
        this.logger.logFriendRequest('send', requesterId, dto.addresseeId, false, SocialErrorCode.FRIEND_REQUEST_NOT_ALLOWED);
        throw new FriendRequestNotAllowedException();
      }

      const isBlocked = await this.blockedUserRepository.findOne({
        where: [
          { blockerId: dto.addresseeId, blockedId: requesterId },
          { blockerId: requesterId, blockedId: dto.addresseeId },
        ],
      });
      if (isBlocked) {
        this.logger.logFriendRequest('send', requesterId, dto.addresseeId, false, SocialErrorCode.FRIEND_REQUEST_BLOCKED);
        throw new FriendRequestBlockedException();
      }

      const existingFriendship = await this.friendshipRepository.findOne({
        where: [
          { requesterId, addresseeId: dto.addresseeId },
          { requesterId: dto.addresseeId, addresseeId: requesterId },
        ],
      });

      if (existingFriendship) {
        if (existingFriendship.status === FriendshipStatus.ACCEPTED) {
          this.logger.logFriendRequest('send', requesterId, dto.addresseeId, false, SocialErrorCode.FRIEND_REQUEST_ALREADY_FRIENDS);
          throw new AlreadyFriendsException();
        }
        if (existingFriendship.status === FriendshipStatus.PENDING) {
          this.logger.logFriendRequest('send', requesterId, dto.addresseeId, false, SocialErrorCode.FRIEND_REQUEST_ALREADY_PENDING);
          throw new FriendRequestAlreadyPendingException();
        }
      }

      const friendship = this.friendshipRepository.create({
        requesterId,
        addresseeId: dto.addresseeId,
        message: dto.message || null,
        status: FriendshipStatus.PENDING,
      });

      const savedFriendship = await this.friendshipRepository.save(friendship);

      await this.notificationService.createFriendRequestNotification(
        dto.addresseeId,
        requesterId,
        requesterProfile.displayName,
      );

      this.logger.logFriendRequest('send', requesterId, dto.addresseeId, true);
      this.logger.logQueryPerformance('sendFriendRequest', Date.now() - startTime);

      return savedFriendship;
    } catch (error) {
      if (error instanceof FriendRequestSelfException ||
          error instanceof FriendRequestBlockedException ||
          error instanceof FriendRequestAlreadyPendingException ||
          error instanceof AlreadyFriendsException ||
          error instanceof FriendRequestNotAllowedException ||
          error instanceof ProfileNotFoundException) {
        throw error;
      }
      this.logger.error('Failed to send friend request', (error as Error).stack, {
        userId: requesterId,
        operation: 'sendFriendRequest',
      });
      throw new DatabaseException('sendFriendRequest');
    }
  }

  async acceptFriendRequest(userId: string, requestId: string): Promise<Friendship> {
    const startTime = Date.now();

    try {
      const friendship = await this.friendshipRepository.findOne({
        where: { id: requestId, addresseeId: userId, status: FriendshipStatus.PENDING },
        relations: ['requester', 'addressee'],
      });

      if (!friendship) {
        this.logger.logFriendRequest('accept', userId, requestId, false, SocialErrorCode.FRIEND_REQUEST_NOT_FOUND);
        throw new FriendRequestNotFoundException(requestId);
      }

      friendship.status = FriendshipStatus.ACCEPTED;
      friendship.acceptedAt = new Date();

      const savedFriendship = await this.friendshipRepository.save(friendship);

      await this.profileRepository.increment({ id: userId }, 'friendCount', 1);
      await this.profileRepository.increment({ id: friendship.requesterId }, 'friendCount', 1);

      await this.neo4jService.createFriendship(userId, friendship.requesterId);

      await this.notificationService.createFriendRequestAcceptedNotification(
        friendship.requesterId,
        userId,
        friendship.addressee.displayName,
      );

      await this.invalidateFriendCaches(userId, friendship.requesterId);

      this.logger.logFriendRequest('accept', userId, friendship.requesterId, true);
      this.logger.logFriendshipChange('add', userId, friendship.requesterId, true);
      this.logger.logQueryPerformance('acceptFriendRequest', Date.now() - startTime);

      return savedFriendship;
    } catch (error) {
      if (error instanceof FriendRequestNotFoundException) {
        throw error;
      }
      this.logger.error('Failed to accept friend request', (error as Error).stack, {
        userId,
        operation: 'acceptFriendRequest',
      });
      throw new DatabaseException('acceptFriendRequest');
    }
  }

  async rejectFriendRequest(userId: string, requestId: string): Promise<Friendship> {
    const startTime = Date.now();

    try {
      const friendship = await this.friendshipRepository.findOne({
        where: { id: requestId, addresseeId: userId, status: FriendshipStatus.PENDING },
      });

      if (!friendship) {
        this.logger.logFriendRequest('reject', userId, requestId, false, SocialErrorCode.FRIEND_REQUEST_NOT_FOUND);
        throw new FriendRequestNotFoundException(requestId);
      }

      friendship.status = FriendshipStatus.REJECTED;
      const savedFriendship = await this.friendshipRepository.save(friendship);

      this.logger.logFriendRequest('reject', userId, friendship.requesterId, true);
      this.logger.logQueryPerformance('rejectFriendRequest', Date.now() - startTime);

      return savedFriendship;
    } catch (error) {
      if (error instanceof FriendRequestNotFoundException) {
        throw error;
      }
      this.logger.error('Failed to reject friend request', (error as Error).stack, {
        userId,
        operation: 'rejectFriendRequest',
      });
      throw new DatabaseException('rejectFriendRequest');
    }
  }

  async cancelFriendRequest(userId: string, requestId: string): Promise<void> {
    const startTime = Date.now();

    try {
      const friendship = await this.friendshipRepository.findOne({
        where: { id: requestId, requesterId: userId, status: FriendshipStatus.PENDING },
      });

      if (!friendship) {
        this.logger.logFriendRequest('cancel', userId, requestId, false, SocialErrorCode.FRIEND_REQUEST_NOT_FOUND);
        throw new FriendRequestNotFoundException(requestId);
      }

      friendship.status = FriendshipStatus.CANCELLED;
      await this.friendshipRepository.save(friendship);

      this.logger.logFriendRequest('cancel', userId, friendship.addresseeId, true);
      this.logger.logQueryPerformance('cancelFriendRequest', Date.now() - startTime);
    } catch (error) {
      if (error instanceof FriendRequestNotFoundException) {
        throw error;
      }
      this.logger.error('Failed to cancel friend request', (error as Error).stack, {
        userId,
        operation: 'cancelFriendRequest',
      });
      throw new DatabaseException('cancelFriendRequest');
    }
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    const startTime = Date.now();

    try {
      const friendship = await this.friendshipRepository.findOne({
        where: [
          { requesterId: userId, addresseeId: friendId, status: FriendshipStatus.ACCEPTED },
          { requesterId: friendId, addresseeId: userId, status: FriendshipStatus.ACCEPTED },
        ],
      });

      if (!friendship) {
        this.logger.logFriendshipChange('remove', userId, friendId, false, SocialErrorCode.FRIENDSHIP_NOT_FOUND);
        throw new FriendshipNotFoundException(userId, friendId);
      }

      await this.friendshipRepository.remove(friendship);

      await this.profileRepository.decrement({ id: userId }, 'friendCount', 1);
      await this.profileRepository.decrement({ id: friendId }, 'friendCount', 1);

      await this.neo4jService.removeFriendship(userId, friendId);

      await this.invalidateFriendCaches(userId, friendId);

      this.logger.logFriendshipChange('remove', userId, friendId, true);
      this.logger.logQueryPerformance('removeFriend', Date.now() - startTime);
    } catch (error) {
      if (error instanceof FriendshipNotFoundException) {
        throw error;
      }
      this.logger.error('Failed to remove friend', (error as Error).stack, {
        userId,
        operation: 'removeFriend',
      });
      throw new DatabaseException('removeFriend');
    }
  }

  async getFriends(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<FriendListResponseDto>> {
    const startTime = Date.now();
    const { page = 1, limit = 20 } = pagination;

    const cacheKey = `${CACHE_KEYS.FRIEND_LIST(userId)}:${page}:${limit}`;
    const cached = await this.cacheService.get<PaginatedResponseDto<FriendListResponseDto>>(cacheKey);
    if (cached) {
      this.logger.debug('Cache hit for getFriends', { userId, operation: 'getFriends' });
      return cached;
    }

    const skip = (page - 1) * limit;

    const [friendships, total] = await this.friendshipRepository
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.requester', 'requester')
      .leftJoinAndSelect('f.addressee', 'addressee')
      .leftJoinAndSelect('requester.presence', 'requesterPresence')
      .leftJoinAndSelect('addressee.presence', 'addresseePresence')
      .where('(f.requesterId = :userId OR f.addresseeId = :userId)', { userId })
      .andWhere('f.status = :status', { status: FriendshipStatus.ACCEPTED })
      .skip(skip)
      .take(limit)
      .orderBy('f.acceptedAt', 'DESC')
      .getManyAndCount();

    const data: FriendListResponseDto[] = friendships.map((f) => {
      const friend = f.requesterId === userId ? f.addressee : f.requester;
      const presence = f.requesterId === userId ? f.addressee?.presence : f.requester?.presence;

      return {
        id: friend.id,
        username: friend.username,
        displayName: friend.displayName,
        avatarUrl: friend.avatarUrl || undefined,
        isOnline: presence?.status === 'online' || presence?.status === 'in_game',
        currentActivity: presence?.currentActivity || undefined,
        friendsSince: f.acceptedAt || f.createdAt,
      };
    });

    const result = {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.cacheService.set(cacheKey, result, { ttl: CACHE_TTL.FRIEND_LIST });
    this.logger.logQueryPerformance('getFriends', Date.now() - startTime, total);

    return result;
  }

  async getPendingFriendRequests(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<FriendRequestResponseDto>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [requests, total] = await this.friendshipRepository
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.requester', 'requester')
      .where('f.addresseeId = :userId', { userId })
      .andWhere('f.status = :status', { status: FriendshipStatus.PENDING })
      .skip(skip)
      .take(limit)
      .orderBy('f.createdAt', 'DESC')
      .getManyAndCount();

    const data: FriendRequestResponseDto[] = requests.map((r) => ({
      id: r.id,
      requesterId: r.requester.id,
      requesterUsername: r.requester.username,
      requesterDisplayName: r.requester.displayName,
      requesterAvatarUrl: r.requester.avatarUrl || undefined,
      message: r.message || undefined,
      createdAt: r.createdAt,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSentFriendRequests(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<SentFriendRequestResponseDto>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [requests, total] = await this.friendshipRepository
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.addressee', 'addressee')
      .where('f.requesterId = :userId', { userId })
      .andWhere('f.status = :status', { status: FriendshipStatus.PENDING })
      .skip(skip)
      .take(limit)
      .orderBy('f.createdAt', 'DESC')
      .getManyAndCount();

    const data: SentFriendRequestResponseDto[] = requests.map((r) => ({
      id: r.id,
      addresseeId: r.addressee.id,
      addresseeUsername: r.addressee.username,
      addresseeDisplayName: r.addressee.displayName,
      addresseeAvatarUrl: r.addressee.avatarUrl || undefined,
      message: r.message || undefined,
      createdAt: r.createdAt,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await this.friendshipRepository.findOne({
      where: [
        { requesterId: userId1, addresseeId: userId2, status: FriendshipStatus.ACCEPTED },
        { requesterId: userId2, addresseeId: userId1, status: FriendshipStatus.ACCEPTED },
      ],
    });
    return !!friendship;
  }

  async getMutualFriends(userId1: string, userId2: string): Promise<SocialProfile[]> {
    const cacheKey = CACHE_KEYS.MUTUAL_FRIENDS(userId1, userId2);
    return this.cacheService.getOrSet(
      cacheKey,
      () => this.neo4jService.getMutualFriends(userId1, userId2),
      { ttl: CACHE_TTL.MUTUAL_FRIENDS },
    );
  }

  async getFriendsOfFriends(userId: string, limit: number = 20): Promise<SocialProfile[]> {
    return this.neo4jService.getFriendsOfFriends(userId, limit);
  }

  async getThirdDegreeFriends(userId: string, limit: number = 20): Promise<SocialProfile[]> {
    return this.neo4jService.getThirdDegreeFriends(userId, limit);
  }

  async getFriendCount(userId: string): Promise<number> {
    const cacheKey = CACHE_KEYS.FRIEND_COUNT(userId);
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const count = await this.friendshipRepository.count({
          where: [
            { requesterId: userId, status: FriendshipStatus.ACCEPTED },
            { addresseeId: userId, status: FriendshipStatus.ACCEPTED },
          ],
        });
        return count;
      },
      { ttl: CACHE_TTL.FRIEND_COUNT },
    );
  }

  private async invalidateFriendCaches(userId1: string, userId2: string): Promise<void> {
    await Promise.all([
      this.cacheService.deletePattern(`friends:${userId1}*`),
      this.cacheService.deletePattern(`friends:${userId2}*`),
      this.cacheService.delete(CACHE_KEYS.FRIEND_COUNT(userId1)),
      this.cacheService.delete(CACHE_KEYS.FRIEND_COUNT(userId2)),
      this.cacheService.delete(CACHE_KEYS.MUTUAL_FRIENDS(userId1, userId2)),
    ]);
  }
}
