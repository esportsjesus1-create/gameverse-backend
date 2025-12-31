import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockedUser } from '../../database/entities/blocked-user.entity';
import { SocialProfile } from '../../database/entities/social-profile.entity';
import { Friendship, FriendshipStatus } from '../../database/entities/friendship.entity';
import { Neo4jService } from '../friend/neo4j.service';
import { SocialLoggerService } from '../../common/services/logger.service';
import { SocialCacheService, CACHE_KEYS, CACHE_TTL } from '../../common/services/cache.service';
import {
  BlockSelfException,
  BlockNotFoundException,
  BlockAlreadyExistsException,
  ProfileNotFoundException,
  DatabaseException,
  SocialErrorCode,
} from '../../common/exceptions/social.exceptions';
import {
  BlockUserDto,
  BlockedUserResponseDto,
  IsBlockedResponseDto,
} from './dto/block.dto';
import { PaginationDto, PaginatedResponseDto } from '../friend/dto/friend.dto';

@Injectable()
export class BlockService {
  private readonly logger: SocialLoggerService;

  constructor(
    @InjectRepository(BlockedUser)
    private readonly blockedUserRepository: Repository<BlockedUser>,
    @InjectRepository(SocialProfile)
    private readonly profileRepository: Repository<SocialProfile>,
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    private readonly neo4jService: Neo4jService,
    private readonly cacheService: SocialCacheService,
  ) {
    this.logger = new SocialLoggerService();
    this.logger.setContext('BlockService');
  }

  async blockUser(blockerId: string, dto: BlockUserDto): Promise<BlockedUser> {
    const startTime = Date.now();

    try {
      if (blockerId === dto.blockedId) {
        this.logger.logBlockAction('block', blockerId, dto.blockedId, false, SocialErrorCode.BLOCK_SELF);
        throw new BlockSelfException();
      }

      const blockerProfile = await this.profileRepository.findOne({
        where: { id: blockerId },
      });
      if (!blockerProfile) {
        this.logger.logBlockAction('block', blockerId, dto.blockedId, false, SocialErrorCode.PROFILE_NOT_FOUND);
        throw new ProfileNotFoundException(blockerId);
      }

      const blockedProfile = await this.profileRepository.findOne({
        where: { id: dto.blockedId },
      });
      if (!blockedProfile) {
        this.logger.logBlockAction('block', blockerId, dto.blockedId, false, SocialErrorCode.PROFILE_NOT_FOUND);
        throw new ProfileNotFoundException(dto.blockedId);
      }

      const existingBlock = await this.blockedUserRepository.findOne({
        where: { blockerId, blockedId: dto.blockedId },
      });
      if (existingBlock) {
        this.logger.logBlockAction('block', blockerId, dto.blockedId, false, SocialErrorCode.BLOCK_ALREADY_EXISTS);
        throw new BlockAlreadyExistsException();
      }

      const existingFriendship = await this.friendshipRepository.findOne({
        where: [
          { requesterId: blockerId, addresseeId: dto.blockedId, status: FriendshipStatus.ACCEPTED },
          { requesterId: dto.blockedId, addresseeId: blockerId, status: FriendshipStatus.ACCEPTED },
        ],
      });

      if (existingFriendship) {
        await this.friendshipRepository.remove(existingFriendship);
        await this.profileRepository.decrement({ id: blockerId }, 'friendCount', 1);
        await this.profileRepository.decrement({ id: dto.blockedId }, 'friendCount', 1);
        await this.neo4jService.removeFriendship(blockerId, dto.blockedId);
        this.logger.log('Removed friendship due to block', { userId: blockerId, operation: 'blockUser' });
      }

      await this.friendshipRepository
        .createQueryBuilder()
        .delete()
        .where('(requesterId = :blockerId AND addresseeId = :blockedId)', {
          blockerId,
          blockedId: dto.blockedId,
        })
        .orWhere('(requesterId = :blockedId AND addresseeId = :blockerId)', {
          blockerId,
          blockedId: dto.blockedId,
        })
        .andWhere('status = :status', { status: FriendshipStatus.PENDING })
        .execute();

      const blockedUser = this.blockedUserRepository.create({
        blockerId,
        blockedId: dto.blockedId,
        reason: dto.reason || null,
      });

      const savedBlock = await this.blockedUserRepository.save(blockedUser);

      await this.invalidateBlockCaches(blockerId, dto.blockedId);

      this.logger.logBlockAction('block', blockerId, dto.blockedId, true);
      this.logger.logQueryPerformance('blockUser', Date.now() - startTime);

      return savedBlock;
    } catch (error) {
      if (error instanceof BlockSelfException ||
          error instanceof BlockAlreadyExistsException ||
          error instanceof ProfileNotFoundException) {
        throw error;
      }
      this.logger.error('Failed to block user', (error as Error).stack, {
        userId: blockerId,
        operation: 'blockUser',
      });
      throw new DatabaseException('blockUser');
    }
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const startTime = Date.now();

    try {
      const block = await this.blockedUserRepository.findOne({
        where: { blockerId, blockedId },
      });

      if (!block) {
        this.logger.logBlockAction('unblock', blockerId, blockedId, false, SocialErrorCode.BLOCK_NOT_FOUND);
        throw new BlockNotFoundException();
      }

      await this.blockedUserRepository.remove(block);

      await this.invalidateBlockCaches(blockerId, blockedId);

      this.logger.logBlockAction('unblock', blockerId, blockedId, true);
      this.logger.logQueryPerformance('unblockUser', Date.now() - startTime);
    } catch (error) {
      if (error instanceof BlockNotFoundException) {
        throw error;
      }
      this.logger.error('Failed to unblock user', (error as Error).stack, {
        userId: blockerId,
        operation: 'unblockUser',
      });
      throw new DatabaseException('unblockUser');
    }
  }

  async getBlockedUsers(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<BlockedUserResponseDto>> {
    const startTime = Date.now();
    const { page = 1, limit = 20 } = pagination;

    const cacheKey = `${CACHE_KEYS.BLOCKED_USERS(userId)}:${page}:${limit}`;
    const cached = await this.cacheService.get<PaginatedResponseDto<BlockedUserResponseDto>>(cacheKey);
    if (cached) {
      this.logger.debug('Cache hit for getBlockedUsers', { userId, operation: 'getBlockedUsers' });
      return cached;
    }

    const skip = (page - 1) * limit;

    const [blocks, total] = await this.blockedUserRepository
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.blocked', 'blocked')
      .where('b.blockerId = :userId', { userId })
      .skip(skip)
      .take(limit)
      .orderBy('b.createdAt', 'DESC')
      .getManyAndCount();

    const data: BlockedUserResponseDto[] = blocks.map((b) => ({
      id: b.id,
      blockedId: b.blocked.id,
      blockedUsername: b.blocked.username,
      blockedDisplayName: b.blocked.displayName,
      blockedAvatarUrl: b.blocked.avatarUrl || undefined,
      reason: b.reason || undefined,
      createdAt: b.createdAt,
    }));

    const result = {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.cacheService.set(cacheKey, result, { ttl: CACHE_TTL.BLOCKED_USERS });
    this.logger.logQueryPerformance('getBlockedUsers', Date.now() - startTime, total);

    return result;
  }

  async isBlocked(userId1: string, userId2: string): Promise<IsBlockedResponseDto> {
    const block1 = await this.blockedUserRepository.findOne({
      where: { blockerId: userId1, blockedId: userId2 },
    });

    const block2 = await this.blockedUserRepository.findOne({
      where: { blockerId: userId2, blockedId: userId1 },
    });

    if (block1 && block2) {
      return { isBlocked: true, direction: 'mutual' };
    }
    if (block1) {
      return { isBlocked: true, direction: 'blocker' };
    }
    if (block2) {
      return { isBlocked: true, direction: 'blocked' };
    }

    return { isBlocked: false };
  }

  async canSendFriendRequest(requesterId: string, addresseeId: string): Promise<boolean> {
    const blockStatus = await this.isBlocked(requesterId, addresseeId);
    return !blockStatus.isBlocked;
  }

  async isBlockedByUser(blockerId: string, blockedId: string): Promise<boolean> {
    const block = await this.blockedUserRepository.findOne({
      where: { blockerId, blockedId },
    });
    return !!block;
  }

  private async invalidateBlockCaches(blockerId: string, blockedId: string): Promise<void> {
    await Promise.all([
      this.cacheService.deletePattern(`blocked:${blockerId}*`),
      this.cacheService.deletePattern(`blocked:${blockedId}*`),
    ]);
  }
}
