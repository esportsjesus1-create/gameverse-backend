import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PartyChatMessage, MessageType, MessageStatus } from '../entities/party-chat-message.entity';
import { PartyMember } from '../entities/party-member.entity';
import { PartySettings } from '../entities/party-settings.entity';
import {
  SendMessageDto,
  EditMessageDto,
  AddReactionDto,
  GetMessagesQueryDto,
  MarkAsReadDto,
  SystemMessageDto,
} from '../dto';
import { RedisCacheService } from './redis-cache.service';
import { PartyService } from './party.service';

@Injectable()
export class PartyChatService {
  private readonly logger = new Logger(PartyChatService.name);
  private readonly MAX_MESSAGE_LENGTH = 2000;
  private readonly MAX_PINNED_MESSAGES = 50;

  constructor(
    @InjectRepository(PartyChatMessage)
    private messageRepository: Repository<PartyChatMessage>,
    @InjectRepository(PartyMember)
    private memberRepository: Repository<PartyMember>,
    @InjectRepository(PartySettings)
    private settingsRepository: Repository<PartySettings>,
    private cacheService: RedisCacheService,
    private partyService: PartyService,
  ) {}

  async sendMessage(partyId: string, senderId: string, dto: SendMessageDto): Promise<PartyChatMessage> {
    const settings = await this.settingsRepository.findOne({ where: { partyId } });
    if (settings && !settings.chatEnabled) {
      throw new ForbiddenException('Chat is disabled for this party');
    }

    const member = await this.memberRepository.findOne({
      where: { partyId, userId: senderId, leftAt: undefined },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this party');
    }

    if (member.isMuted) {
      throw new ForbiddenException('You are muted in this party');
    }

    let content = dto.content;
    if (settings?.chatFilters) {
      content = this.applyFilters(content, settings.chatFilters);
    }

    if (dto.replyToId) {
      const replyTo = await this.messageRepository.findOne({
        where: { id: dto.replyToId, partyId },
      });
      if (!replyTo) {
        throw new NotFoundException('Reply target message not found');
      }
    }

    const message = this.messageRepository.create({
      id: uuidv4(),
      partyId,
      senderId,
      senderUsername: member.username,
      senderAvatarUrl: member.avatarUrl,
      type: dto.type || MessageType.TEXT,
      content,
      status: MessageStatus.SENT,
      replyToId: dto.replyToId,
      mentions: dto.mentions,
      attachments: dto.attachments,
      metadata: dto.metadata,
      reactions: {},
      readBy: [senderId],
    });

    const savedMessage = await this.messageRepository.save(message);

    if (dto.mentions && dto.mentions.length > 0) {
      await this.notifyMentions(partyId, savedMessage, dto.mentions);
    }

    this.logger.log(`Message ${savedMessage.id} sent in party ${partyId} by user ${senderId}`);

    return savedMessage;
  }

  async editMessage(messageId: string, userId: string, dto: EditMessageDto): Promise<PartyChatMessage> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    if (message.status === MessageStatus.DELETED) {
      throw new BadRequestException('Cannot edit a deleted message');
    }

    const settings = await this.settingsRepository.findOne({ where: { partyId: message.partyId } });
    let content = dto.content;
    if (settings?.chatFilters) {
      content = this.applyFilters(content, settings.chatFilters);
    }

    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();
    message.updatedAt = new Date();

    return this.messageRepository.save(message);
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const party = await this.partyService.findById(message.partyId);
    const isLeader = party.leaderId === userId;
    const isOwner = message.senderId === userId;

    if (!isLeader && !isOwner) {
      throw new ForbiddenException('You can only delete your own messages or be the party leader');
    }

    message.status = MessageStatus.DELETED;
    message.deletedAt = new Date();
    message.content = '[Message deleted]';

    await this.messageRepository.save(message);

    this.logger.log(`Message ${messageId} deleted by user ${userId}`);
  }

  async addReaction(messageId: string, userId: string, dto: AddReactionDto): Promise<PartyChatMessage> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const member = await this.memberRepository.findOne({
      where: { partyId: message.partyId, userId, leftAt: undefined },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this party');
    }

    if (!message.reactions) {
      message.reactions = {};
    }

    if (!message.reactions[dto.reaction]) {
      message.reactions[dto.reaction] = [];
    }

    if (!message.reactions[dto.reaction].includes(userId)) {
      message.reactions[dto.reaction].push(userId);
    }

    message.updatedAt = new Date();

    return this.messageRepository.save(message);
  }

  async removeReaction(messageId: string, userId: string, reaction: string): Promise<PartyChatMessage> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.reactions && message.reactions[reaction]) {
      message.reactions[reaction] = message.reactions[reaction].filter((id: string) => id !== userId);
      if (message.reactions[reaction].length === 0) {
        delete message.reactions[reaction];
      }
    }

    message.updatedAt = new Date();

    return this.messageRepository.save(message);
  }

  async pinMessage(partyId: string, messageId: string, userId: string): Promise<PartyChatMessage> {
    const party = await this.partyService.findById(partyId);
    await this.partyService.verifyPermission(party, userId, 'canChangeSettings');

    const message = await this.messageRepository.findOne({
      where: { id: messageId, partyId },
    });

    if (!message) {
      throw new NotFoundException('Message not found in this party');
    }

    const pinnedCount = await this.messageRepository.count({
      where: { partyId, isPinned: true },
    });

    if (pinnedCount >= this.MAX_PINNED_MESSAGES) {
      throw new BadRequestException(`Maximum ${this.MAX_PINNED_MESSAGES} pinned messages allowed`);
    }

    message.isPinned = true;
    message.pinnedBy = userId;
    message.pinnedAt = new Date();
    message.updatedAt = new Date();

    return this.messageRepository.save(message);
  }

  async unpinMessage(partyId: string, messageId: string, userId: string): Promise<PartyChatMessage> {
    const party = await this.partyService.findById(partyId);
    await this.partyService.verifyPermission(party, userId, 'canChangeSettings');

    const message = await this.messageRepository.findOne({
      where: { id: messageId, partyId },
    });

    if (!message) {
      throw new NotFoundException('Message not found in this party');
    }

    message.isPinned = false;
    message.pinnedBy = null as unknown as string;
    message.pinnedAt = null as unknown as Date;
    message.updatedAt = new Date();

    return this.messageRepository.save(message);
  }

  async getMessages(partyId: string, userId: string, query: GetMessagesQueryDto): Promise<{
    messages: PartyChatMessage[];
    hasMore: boolean;
  }> {
    const member = await this.memberRepository.findOne({
      where: { partyId, userId },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this party');
    }

    const limit = Math.min(query.limit || 50, 100);
    const qb = this.messageRepository
      .createQueryBuilder('message')
      .where('message.partyId = :partyId', { partyId });

    if (!query.includeDeleted) {
      qb.andWhere('message.status != :deleted', { deleted: MessageStatus.DELETED });
    }

    if (query.type) {
      qb.andWhere('message.type = :type', { type: query.type });
    }

    if (query.before) {
      const beforeMessage = await this.messageRepository.findOne({ where: { id: query.before } });
      if (beforeMessage) {
        qb.andWhere('message.createdAt < :beforeDate', { beforeDate: beforeMessage.createdAt });
      }
    }

    if (query.after) {
      const afterMessage = await this.messageRepository.findOne({ where: { id: query.after } });
      if (afterMessage) {
        qb.andWhere('message.createdAt > :afterDate', { afterDate: afterMessage.createdAt });
      }
    }

    const messages = await qb
      .orderBy('message.createdAt', 'DESC')
      .take(limit + 1)
      .getMany();

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop();
    }

    return { messages: messages.reverse(), hasMore };
  }

  async getPinnedMessages(partyId: string): Promise<PartyChatMessage[]> {
    return this.messageRepository.find({
      where: { partyId, isPinned: true },
      order: { pinnedAt: 'DESC' },
    });
  }

  async markAsRead(partyId: string, userId: string, dto: MarkAsReadDto): Promise<void> {
    for (const messageId of dto.messageIds) {
      const message = await this.messageRepository.findOne({
        where: { id: messageId, partyId },
      });

      if (message && message.readBy && !message.readBy.includes(userId)) {
        message.readBy.push(userId);
        await this.messageRepository.save(message);
      }
    }
  }

  async sendSystemMessage(partyId: string, dto: SystemMessageDto): Promise<PartyChatMessage> {
    const message = this.messageRepository.create({
      id: uuidv4(),
      partyId,
      senderId: undefined,
      senderUsername: 'System',
      type: dto.type || MessageType.SYSTEM,
      content: dto.content,
      status: MessageStatus.SENT,
      metadata: dto.metadata,
      reactions: {},
      readBy: [],
    });

    return this.messageRepository.save(message);
  }

  async getMessageCount(partyId: string): Promise<number> {
    return this.messageRepository.count({
      where: { partyId, status: MessageStatus.SENT },
    });
  }

  async getUnreadCount(partyId: string, userId: string): Promise<number> {
    const messages = await this.messageRepository.find({
      where: { partyId, status: MessageStatus.SENT },
      select: ['id', 'readBy'],
    });

    return messages.filter((m) => !m.readBy || !m.readBy.includes(userId)).length;
  }

  async searchMessages(partyId: string, query: string, limit = 20): Promise<PartyChatMessage[]> {
    return this.messageRepository
      .createQueryBuilder('message')
      .where('message.partyId = :partyId', { partyId })
      .andWhere('message.status != :deleted', { deleted: MessageStatus.DELETED })
      .andWhere('message.content ILIKE :query', { query: `%${query}%` })
      .orderBy('message.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  async deleteAllMessages(partyId: string, userId: string): Promise<number> {
    const party = await this.partyService.findById(partyId);
    if (party.leaderId !== userId) {
      throw new ForbiddenException('Only the party leader can delete all messages');
    }

    const result = await this.messageRepository.update(
      { partyId },
      { status: MessageStatus.DELETED, deletedAt: new Date(), content: '[Message deleted]' },
    );

    return result.affected || 0;
  }

  private applyFilters(
    content: string,
    filters: {
      profanityFilter?: boolean;
      linkFilter?: boolean;
      spamFilter?: boolean;
      customBlockedWords?: string[];
    },
  ): string {
    let filtered = content;

    if (filters.linkFilter) {
      filtered = filtered.replace(/(https?:\/\/[^\s]+)/gi, '[link removed]');
    }

    if (filters.customBlockedWords && filters.customBlockedWords.length > 0) {
      for (const word of filters.customBlockedWords) {
        const regex = new RegExp(word, 'gi');
        filtered = filtered.replace(regex, '*'.repeat(word.length));
      }
    }

    return filtered;
  }

  private async notifyMentions(partyId: string, message: PartyChatMessage, mentions: string[]): Promise<void> {
    for (const userId of mentions) {
      if (userId !== message.senderId) {
        await this.cacheService.publishEvent(`user:${userId}:notifications`, {
          type: 'mention',
          partyId,
          messageId: message.id,
          senderUsername: message.senderUsername,
          content: message.content.substring(0, 100),
        });
      }
    }
  }

  async getMessage(messageId: string): Promise<PartyChatMessage | null> {
    return this.messageRepository.findOne({ where: { id: messageId } });
  }

  async getRecentMessages(partyId: string, limit = 10): Promise<PartyChatMessage[]> {
    return this.messageRepository.find({
      where: { partyId, status: MessageStatus.SENT },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
