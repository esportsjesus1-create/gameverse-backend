import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  SocialFeedEvent,
  FeedEventType,
  FeedEventVisibility,
  FeedEventLike,
  FeedEventComment,
} from '../../database/entities/social-feed-event.entity';
import { SocialProfile } from '../../database/entities/social-profile.entity';
import {
  Friendship,
  FriendshipStatus,
} from '../../database/entities/friendship.entity';
import { BlockedUser } from '../../database/entities/blocked-user.entity';
import { NotificationService } from '../notification/notification.service';
import {
  CreatePostDto,
  CreateCommentDto,
  ShareAchievementDto,
  ShareGameResultDto,
  FeedEventResponseDto,
  CommentResponseDto,
} from './dto/social-feed.dto';
import { PaginationDto, PaginatedResponseDto } from '../friend/dto/friend.dto';

@Injectable()
export class SocialFeedService {
  constructor(
    @InjectRepository(SocialFeedEvent)
    private readonly feedEventRepository: Repository<SocialFeedEvent>,
    @InjectRepository(FeedEventLike)
    private readonly likeRepository: Repository<FeedEventLike>,
    @InjectRepository(FeedEventComment)
    private readonly commentRepository: Repository<FeedEventComment>,
    @InjectRepository(SocialProfile)
    private readonly profileRepository: Repository<SocialProfile>,
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    @InjectRepository(BlockedUser)
    private readonly blockedUserRepository: Repository<BlockedUser>,
    private readonly notificationService: NotificationService,
  ) {}

  async createPost(
    authorId: string,
    dto: CreatePostDto,
  ): Promise<SocialFeedEvent> {
    const profile = await this.profileRepository.findOne({
      where: { id: authorId },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const event = this.feedEventRepository.create({
      authorId,
      eventType: FeedEventType.STATUS_UPDATE,
      content: dto.content,
      visibility: dto.visibility || FeedEventVisibility.FRIENDS,
      metadata: dto.metadata || null,
    });

    return this.feedEventRepository.save(event);
  }

  async deletePost(userId: string, postId: string): Promise<void> {
    const event = await this.feedEventRepository.findOne({
      where: { id: postId },
    });

    if (!event) {
      throw new NotFoundException('Post not found');
    }

    if (event.authorId !== userId) {
      throw new ForbiddenException("Cannot delete another user's post");
    }

    event.isDeleted = true;
    await this.feedEventRepository.save(event);
  }

  async likePost(userId: string, postId: string): Promise<void> {
    const event = await this.feedEventRepository.findOne({
      where: { id: postId, isDeleted: false },
    });

    if (!event) {
      throw new NotFoundException('Post not found');
    }

    const canView = await this.canViewPost(userId, event);
    if (!canView) {
      throw new ForbiddenException('Cannot access this post');
    }

    const existingLike = await this.likeRepository.findOne({
      where: { eventId: postId, userId },
    });

    if (existingLike) {
      throw new BadRequestException('Already liked this post');
    }

    const like = this.likeRepository.create({
      eventId: postId,
      userId,
    });

    await this.likeRepository.save(like);
    await this.feedEventRepository.increment({ id: postId }, 'likeCount', 1);

    if (event.authorId !== userId) {
      const likerProfile = await this.profileRepository.findOne({
        where: { id: userId },
      });
      if (likerProfile) {
        await this.notificationService.createPostLikedNotification(
          event.authorId,
          userId,
          likerProfile.displayName,
          postId,
        );
      }
    }
  }

  async unlikePost(userId: string, postId: string): Promise<void> {
    const like = await this.likeRepository.findOne({
      where: { eventId: postId, userId },
    });

    if (!like) {
      throw new NotFoundException('Like not found');
    }

    await this.likeRepository.remove(like);
    await this.feedEventRepository.decrement({ id: postId }, 'likeCount', 1);
  }

  async commentOnPost(
    userId: string,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<FeedEventComment> {
    const event = await this.feedEventRepository.findOne({
      where: { id: postId, isDeleted: false },
    });

    if (!event) {
      throw new NotFoundException('Post not found');
    }

    const canView = await this.canViewPost(userId, event);
    if (!canView) {
      throw new ForbiddenException('Cannot access this post');
    }

    if (dto.parentCommentId) {
      const parentComment = await this.commentRepository.findOne({
        where: { id: dto.parentCommentId, eventId: postId },
      });
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    const comment = this.commentRepository.create({
      eventId: postId,
      authorId: userId,
      content: dto.content,
      parentCommentId: dto.parentCommentId || null,
    });

    const savedComment = await this.commentRepository.save(comment);
    await this.feedEventRepository.increment({ id: postId }, 'commentCount', 1);

    if (event.authorId !== userId) {
      const commenterProfile = await this.profileRepository.findOne({
        where: { id: userId },
      });
      if (commenterProfile) {
        await this.notificationService.createPostCommentedNotification(
          event.authorId,
          userId,
          commenterProfile.displayName,
          postId,
        );
      }
    }

    return savedComment;
  }

  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException("Cannot delete another user's comment");
    }

    comment.isDeleted = true;
    await this.commentRepository.save(comment);
    await this.feedEventRepository.decrement(
      { id: comment.eventId },
      'commentCount',
      1,
    );
  }

  async getFeed(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<FeedEventResponseDto>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const friendIds = await this.getFriendIds(userId);
    const blockedIds = await this.getBlockedUserIds(userId);

    const authorIds = [userId, ...friendIds].filter(
      (id) => !blockedIds.includes(id),
    );

    const [events, total] = await this.feedEventRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.author', 'author')
      .where('e.authorId IN (:...authorIds)', { authorIds })
      .andWhere('e.isDeleted = false')
      .andWhere(
        '(e.visibility = :public OR e.visibility = :friends OR (e.visibility = :private AND e.authorId = :userId))',
        {
          public: FeedEventVisibility.PUBLIC,
          friends: FeedEventVisibility.FRIENDS,
          private: FeedEventVisibility.PRIVATE,
          userId,
        },
      )
      .skip(skip)
      .take(limit)
      .orderBy('e.createdAt', 'DESC')
      .getManyAndCount();

    const eventIds = events.map((e) => e.id);
    const userLikes = await this.likeRepository.find({
      where: { eventId: In(eventIds), userId },
    });
    const likedEventIds = new Set(userLikes.map((l) => l.eventId));

    const data: FeedEventResponseDto[] = events.map((e) => ({
      id: e.id,
      authorId: e.author.id,
      authorUsername: e.author.username,
      authorDisplayName: e.author.displayName,
      authorAvatarUrl: e.author.avatarUrl || undefined,
      eventType: e.eventType,
      content: e.content,
      metadata: e.metadata || undefined,
      visibility: e.visibility,
      likeCount: e.likeCount,
      commentCount: e.commentCount,
      isLikedByCurrentUser: likedEventIds.has(e.id),
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserPosts(
    currentUserId: string,
    targetUserId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<FeedEventResponseDto>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const isBlocked = await this.isBlocked(currentUserId, targetUserId);
    if (isBlocked) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    const areFriends = await this.areFriends(currentUserId, targetUserId);
    const isSelf = currentUserId === targetUserId;

    let visibilityCondition: string;
    if (isSelf) {
      visibilityCondition = '1=1';
    } else if (areFriends) {
      visibilityCondition = 'e.visibility IN (:...visibilities)';
    } else {
      visibilityCondition = 'e.visibility = :publicOnly';
    }

    const queryBuilder = this.feedEventRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.author', 'author')
      .where('e.authorId = :targetUserId', { targetUserId })
      .andWhere('e.isDeleted = false');

    if (isSelf) {
      // No additional visibility filter needed
    } else if (areFriends) {
      queryBuilder.andWhere(visibilityCondition, {
        visibilities: [FeedEventVisibility.PUBLIC, FeedEventVisibility.FRIENDS],
      });
    } else {
      queryBuilder.andWhere(visibilityCondition, {
        publicOnly: FeedEventVisibility.PUBLIC,
      });
    }

    const [events, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('e.createdAt', 'DESC')
      .getManyAndCount();

    const eventIds = events.map((e) => e.id);
    const userLikes =
      eventIds.length > 0
        ? await this.likeRepository.find({
            where: { eventId: In(eventIds), userId: currentUserId },
          })
        : [];
    const likedEventIds = new Set(userLikes.map((l) => l.eventId));

    const data: FeedEventResponseDto[] = events.map((e) => ({
      id: e.id,
      authorId: e.author.id,
      authorUsername: e.author.username,
      authorDisplayName: e.author.displayName,
      authorAvatarUrl: e.author.avatarUrl || undefined,
      eventType: e.eventType,
      content: e.content,
      metadata: e.metadata || undefined,
      visibility: e.visibility,
      likeCount: e.likeCount,
      commentCount: e.commentCount,
      isLikedByCurrentUser: likedEventIds.has(e.id),
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async shareAchievement(
    userId: string,
    dto: ShareAchievementDto,
  ): Promise<SocialFeedEvent> {
    const profile = await this.profileRepository.findOne({
      where: { id: userId },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const content = `Unlocked achievement: ${dto.achievementName}${dto.gameName ? ` in ${dto.gameName}` : ''}`;

    const event = this.feedEventRepository.create({
      authorId: userId,
      eventType: FeedEventType.ACHIEVEMENT,
      content,
      visibility: dto.visibility || FeedEventVisibility.FRIENDS,
      metadata: {
        achievementId: dto.achievementId,
        achievementName: dto.achievementName,
        description: dto.description,
        gameId: dto.gameId,
        gameName: dto.gameName,
        iconUrl: dto.iconUrl,
      },
    });

    return this.feedEventRepository.save(event);
  }

  async shareGameResult(
    userId: string,
    dto: ShareGameResultDto,
  ): Promise<SocialFeedEvent> {
    const profile = await this.profileRepository.findOne({
      where: { id: userId },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const content = `${dto.result === 'win' ? 'Won' : dto.result === 'loss' ? 'Lost' : 'Played'} a game of ${dto.gameName}${dto.score ? ` - Score: ${dto.score}` : ''}`;

    const event = this.feedEventRepository.create({
      authorId: userId,
      eventType: FeedEventType.GAME_RESULT,
      content,
      visibility: dto.visibility || FeedEventVisibility.FRIENDS,
      metadata: {
        gameId: dto.gameId,
        gameName: dto.gameName,
        result: dto.result,
        score: dto.score,
        duration: dto.duration,
        ...dto.metadata,
      },
    });

    return this.feedEventRepository.save(event);
  }

  async getPostComments(
    userId: string,
    postId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<CommentResponseDto>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const event = await this.feedEventRepository.findOne({
      where: { id: postId, isDeleted: false },
    });

    if (!event) {
      throw new NotFoundException('Post not found');
    }

    const canView = await this.canViewPost(userId, event);
    if (!canView) {
      throw new ForbiddenException('Cannot access this post');
    }

    const [comments, total] = await this.commentRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.author', 'author')
      .where('c.eventId = :postId', { postId })
      .andWhere('c.isDeleted = false')
      .skip(skip)
      .take(limit)
      .orderBy('c.createdAt', 'ASC')
      .getManyAndCount();

    const data: CommentResponseDto[] = comments.map((c) => ({
      id: c.id,
      authorId: c.author.id,
      authorUsername: c.author.username,
      authorDisplayName: c.author.displayName,
      authorAvatarUrl: c.author.avatarUrl || undefined,
      content: c.content,
      parentCommentId: c.parentCommentId || undefined,
      createdAt: c.createdAt,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async canViewPost(
    userId: string,
    event: SocialFeedEvent,
  ): Promise<boolean> {
    if (event.authorId === userId) return true;
    if (event.visibility === FeedEventVisibility.PUBLIC) return true;

    const isBlocked = await this.isBlocked(userId, event.authorId);
    if (isBlocked) return false;

    if (event.visibility === FeedEventVisibility.FRIENDS) {
      return this.areFriends(userId, event.authorId);
    }

    return false;
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

  private async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.blockedUserRepository.find({
      where: [{ blockerId: userId }, { blockedId: userId }],
    });

    return blocks.map((b) =>
      b.blockerId === userId ? b.blockedId : b.blockerId,
    );
  }

  private async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await this.friendshipRepository.findOne({
      where: [
        {
          requesterId: userId1,
          addresseeId: userId2,
          status: FriendshipStatus.ACCEPTED,
        },
        {
          requesterId: userId2,
          addresseeId: userId1,
          status: FriendshipStatus.ACCEPTED,
        },
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
}
