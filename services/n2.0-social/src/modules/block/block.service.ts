import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockedUser } from '../../database/entities/blocked-user.entity';
import { SocialProfile } from '../../database/entities/social-profile.entity';
import {
  Friendship,
  FriendshipStatus,
} from '../../database/entities/friendship.entity';
import { Neo4jService } from '../friend/neo4j.service';
import {
  BlockUserDto,
  BlockedUserResponseDto,
  IsBlockedResponseDto,
} from './dto/block.dto';
import { PaginationDto, PaginatedResponseDto } from '../friend/dto/friend.dto';

@Injectable()
export class BlockService {
  constructor(
    @InjectRepository(BlockedUser)
    private readonly blockedUserRepository: Repository<BlockedUser>,
    @InjectRepository(SocialProfile)
    private readonly profileRepository: Repository<SocialProfile>,
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    private readonly neo4jService: Neo4jService,
  ) {}

  async blockUser(blockerId: string, dto: BlockUserDto): Promise<BlockedUser> {
    if (blockerId === dto.blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const blockerProfile = await this.profileRepository.findOne({
      where: { id: blockerId },
    });
    if (!blockerProfile) {
      throw new NotFoundException('Blocker profile not found');
    }

    const blockedProfile = await this.profileRepository.findOne({
      where: { id: dto.blockedId },
    });
    if (!blockedProfile) {
      throw new NotFoundException('User to block not found');
    }

    const existingBlock = await this.blockedUserRepository.findOne({
      where: { blockerId, blockedId: dto.blockedId },
    });
    if (existingBlock) {
      throw new ConflictException('User is already blocked');
    }

    const existingFriendship = await this.friendshipRepository.findOne({
      where: [
        {
          requesterId: blockerId,
          addresseeId: dto.blockedId,
          status: FriendshipStatus.ACCEPTED,
        },
        {
          requesterId: dto.blockedId,
          addresseeId: blockerId,
          status: FriendshipStatus.ACCEPTED,
        },
      ],
    });

    if (existingFriendship) {
      await this.friendshipRepository.remove(existingFriendship);
      await this.profileRepository.decrement(
        { id: blockerId },
        'friendCount',
        1,
      );
      await this.profileRepository.decrement(
        { id: dto.blockedId },
        'friendCount',
        1,
      );
      await this.neo4jService.removeFriendship(blockerId, dto.blockedId);
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

    return this.blockedUserRepository.save(blockedUser);
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const block = await this.blockedUserRepository.findOne({
      where: { blockerId, blockedId },
    });

    if (!block) {
      throw new NotFoundException('Block record not found');
    }

    await this.blockedUserRepository.remove(block);
  }

  async getBlockedUsers(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<BlockedUserResponseDto>> {
    const { page = 1, limit = 20 } = pagination;
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

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async isBlocked(
    userId1: string,
    userId2: string,
  ): Promise<IsBlockedResponseDto> {
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

  async canSendFriendRequest(
    requesterId: string,
    addresseeId: string,
  ): Promise<boolean> {
    const blockStatus = await this.isBlocked(requesterId, addresseeId);
    return !blockStatus.isBlocked;
  }

  async isBlockedByUser(
    blockerId: string,
    blockedId: string,
  ): Promise<boolean> {
    const block = await this.blockedUserRepository.findOne({
      where: { blockerId, blockedId },
    });
    return !!block;
  }
}
