import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friendship, FriendshipStatus } from '../../database/entities/friendship.entity';
import { SocialProfile } from '../../database/entities/social-profile.entity';
import { BlockedUser } from '../../database/entities/blocked-user.entity';
import { NotificationService } from '../notification/notification.service';
import { Neo4jService } from '../friend/neo4j.service';
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
  constructor(
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    @InjectRepository(SocialProfile)
    private readonly profileRepository: Repository<SocialProfile>,
    @InjectRepository(BlockedUser)
    private readonly blockedUserRepository: Repository<BlockedUser>,
    private readonly notificationService: NotificationService,
    private readonly neo4jService: Neo4jService,
  ) {}

  async sendFriendRequest(requesterId: string, dto: SendFriendRequestDto): Promise<Friendship> {
    if (requesterId === dto.addresseeId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    const requesterProfile = await this.profileRepository.findOne({
      where: { id: requesterId },
    });
    if (!requesterProfile) {
      throw new NotFoundException('Requester profile not found');
    }

    const addresseeProfile = await this.profileRepository.findOne({
      where: { id: dto.addresseeId },
    });
    if (!addresseeProfile) {
      throw new NotFoundException('Addressee profile not found');
    }

    if (!addresseeProfile.allowFriendRequests) {
      throw new BadRequestException('User does not accept friend requests');
    }

    const isBlocked = await this.blockedUserRepository.findOne({
      where: [
        { blockerId: dto.addresseeId, blockedId: requesterId },
        { blockerId: requesterId, blockedId: dto.addresseeId },
      ],
    });
    if (isBlocked) {
      throw new BadRequestException('Cannot send friend request to this user');
    }

    const existingFriendship = await this.friendshipRepository.findOne({
      where: [
        { requesterId, addresseeId: dto.addresseeId },
        { requesterId: dto.addresseeId, addresseeId: requesterId },
      ],
    });

    if (existingFriendship) {
      if (existingFriendship.status === FriendshipStatus.ACCEPTED) {
        throw new ConflictException('Already friends with this user');
      }
      if (existingFriendship.status === FriendshipStatus.PENDING) {
        throw new ConflictException('Friend request already pending');
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

    return savedFriendship;
  }

  async acceptFriendRequest(userId: string, requestId: string): Promise<Friendship> {
    const friendship = await this.friendshipRepository.findOne({
      where: { id: requestId, addresseeId: userId, status: FriendshipStatus.PENDING },
      relations: ['requester', 'addressee'],
    });

    if (!friendship) {
      throw new NotFoundException('Friend request not found');
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

    return savedFriendship;
  }

  async rejectFriendRequest(userId: string, requestId: string): Promise<Friendship> {
    const friendship = await this.friendshipRepository.findOne({
      where: { id: requestId, addresseeId: userId, status: FriendshipStatus.PENDING },
    });

    if (!friendship) {
      throw new NotFoundException('Friend request not found');
    }

    friendship.status = FriendshipStatus.REJECTED;
    return this.friendshipRepository.save(friendship);
  }

  async cancelFriendRequest(userId: string, requestId: string): Promise<void> {
    const friendship = await this.friendshipRepository.findOne({
      where: { id: requestId, requesterId: userId, status: FriendshipStatus.PENDING },
    });

    if (!friendship) {
      throw new NotFoundException('Friend request not found');
    }

    friendship.status = FriendshipStatus.CANCELLED;
    await this.friendshipRepository.save(friendship);
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    const friendship = await this.friendshipRepository.findOne({
      where: [
        { requesterId: userId, addresseeId: friendId, status: FriendshipStatus.ACCEPTED },
        { requesterId: friendId, addresseeId: userId, status: FriendshipStatus.ACCEPTED },
      ],
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    await this.friendshipRepository.remove(friendship);

    await this.profileRepository.decrement({ id: userId }, 'friendCount', 1);
    await this.profileRepository.decrement({ id: friendId }, 'friendCount', 1);

    await this.neo4jService.removeFriendship(userId, friendId);
  }

  async getFriends(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<FriendListResponseDto>> {
    const { page = 1, limit = 20 } = pagination;
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

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
    return this.neo4jService.getMutualFriends(userId1, userId2);
  }

  async getFriendsOfFriends(userId: string, limit: number = 20): Promise<SocialProfile[]> {
    return this.neo4jService.getFriendsOfFriends(userId, limit);
  }

  async getThirdDegreeFriends(userId: string, limit: number = 20): Promise<SocialProfile[]> {
    return this.neo4jService.getThirdDegreeFriends(userId, limit);
  }
}
