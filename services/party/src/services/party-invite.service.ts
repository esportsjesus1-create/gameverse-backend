import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Party, PartyStatus, PartyVisibility } from '../entities/party.entity';
import { PartyInvite, InviteStatus, InviteType } from '../entities/party-invite.entity';
import { PartyMember } from '../entities/party-member.entity';
import {
  CreateInviteDto,
  RespondToInviteDto,
  JoinByCodeDto,
  JoinByTokenDto,
  BulkInviteDto,
} from '../dto';
import { RedisCacheService } from './redis-cache.service';
import { GamerstakeService } from './gamerstake.service';
import { PartyService } from './party.service';
import { PartyMemberService } from './party-member.service';

@Injectable()
export class PartyInviteService {
  private readonly logger = new Logger(PartyInviteService.name);
  private readonly DEFAULT_INVITE_EXPIRY_HOURS = 24;

  constructor(
    @InjectRepository(PartyInvite)
    private inviteRepository: Repository<PartyInvite>,
    @InjectRepository(Party)
    private partyRepository: Repository<Party>,
    @InjectRepository(PartyMember)
    private memberRepository: Repository<PartyMember>,
    private cacheService: RedisCacheService,
    private gamerstakeService: GamerstakeService,
    private partyService: PartyService,
    private memberService: PartyMemberService,
  ) {}

  private generateInviteToken(): string {
    return uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').substring(0, 32);
  }

  async createInvite(partyId: string, inviterId: string, dto: CreateInviteDto): Promise<PartyInvite> {
    const party = await this.partyService.findById(partyId);

    if (party.status !== PartyStatus.ACTIVE) {
      throw new BadRequestException('Party is not active');
    }

    if (party.currentSize >= party.maxSize) {
      throw new BadRequestException('Party is full');
    }

    await this.partyService.verifyPermission(party, inviterId, 'canInvite');

    const inviter = await this.memberRepository.findOne({
      where: { partyId, userId: inviterId, leftAt: undefined },
    });

    if (!inviter) {
      throw new ForbiddenException('Inviter is not a member of this party');
    }

    if (dto.inviteeId) {
      const existingMember = await this.memberRepository.findOne({
        where: { partyId, userId: dto.inviteeId, leftAt: undefined },
      });

      if (existingMember) {
        throw new ConflictException('User is already a member of this party');
      }

      const existingInvite = await this.inviteRepository.findOne({
        where: {
          partyId,
          inviteeId: dto.inviteeId,
          status: InviteStatus.PENDING,
        },
      });

      if (existingInvite) {
        throw new ConflictException('User already has a pending invite to this party');
      }

      if (party.visibility === PartyVisibility.FRIENDS_ONLY) {
        const areFriends = await this.gamerstakeService.areFriends(inviterId, dto.inviteeId);
        if (!areFriends) {
          throw new ForbiddenException('Can only invite friends in friends-only parties');
        }
      }
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (dto.expiresInHours || this.DEFAULT_INVITE_EXPIRY_HOURS));

    const invite = this.inviteRepository.create({
      id: uuidv4(),
      partyId,
      inviterId,
      inviterUsername: inviter.username,
      inviteeId: dto.inviteeId,
      inviteeUsername: dto.inviteeUsername,
      inviteeEmail: dto.inviteeEmail,
      type: dto.type || InviteType.DIRECT,
      status: InviteStatus.PENDING,
      message: dto.message,
      inviteToken: dto.type === InviteType.LINK ? this.generateInviteToken() : undefined,
      maxUses: dto.maxUses || 0,
      currentUses: 0,
      expiresAt,
      metadata: dto.metadata,
    });

    const savedInvite = await this.inviteRepository.save(invite);

    const ttlSeconds = (dto.expiresInHours || this.DEFAULT_INVITE_EXPIRY_HOURS) * 3600;
    await this.cacheService.setInvite(savedInvite.id, {
      id: savedInvite.id,
      partyId,
      inviterId,
      inviteeId: dto.inviteeId,
      type: savedInvite.type,
      status: savedInvite.status,
      expiresAt: savedInvite.expiresAt,
    }, ttlSeconds);

    if (dto.inviteeId) {
      await this.gamerstakeService.sendNotification(dto.inviteeId, {
        type: 'party_invite',
        title: 'Party Invitation',
        message: `${inviter.username} invited you to join ${party.name}`,
        data: {
          inviteId: savedInvite.id,
          partyId,
          partyName: party.name,
          inviterUsername: inviter.username,
          message: dto.message,
        },
      });
    }

    this.logger.log(`Invite ${savedInvite.id} created for party ${partyId}`);

    return savedInvite;
  }

  async createBulkInvites(partyId: string, inviterId: string, dto: BulkInviteDto): Promise<PartyInvite[]> {
    const invites: PartyInvite[] = [];

    for (const userId of dto.userIds) {
      try {
        const invite = await this.createInvite(partyId, inviterId, {
          inviteeId: userId,
          message: dto.message,
          expiresInHours: dto.expiresInHours,
        });
        invites.push(invite);
      } catch (error) {
        this.logger.warn(`Failed to create invite for user ${userId}: ${error}`);
      }
    }

    return invites;
  }

  async respondToInvite(inviteId: string, userId: string, dto: RespondToInviteDto): Promise<void> {
    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId },
      relations: ['party'],
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Invite is no longer pending');
    }

    if (invite.inviteeId && invite.inviteeId !== userId) {
      throw new ForbiddenException('This invite is not for you');
    }

    if (new Date() > invite.expiresAt) {
      invite.status = InviteStatus.EXPIRED;
      await this.inviteRepository.save(invite);
      throw new BadRequestException('Invite has expired');
    }

    invite.respondedAt = new Date();

    if (dto.accept) {
      const party = await this.partyService.findById(invite.partyId);

      if (party.status !== PartyStatus.ACTIVE) {
        throw new BadRequestException('Party is no longer active');
      }

      if (party.currentSize >= party.maxSize) {
        throw new BadRequestException('Party is full');
      }

      const user = await this.gamerstakeService.getUser(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const profile = await this.gamerstakeService.getProfile(userId);

      await this.memberService.addMember(invite.partyId, {
        userId,
        username: user.username,
        avatarUrl: user.avatarUrl,
        rank: profile?.rank,
        level: profile?.level,
      });

      invite.status = InviteStatus.ACCEPTED;
      invite.inviteeId = userId;
      invite.inviteeUsername = user.username;

      await this.gamerstakeService.sendNotification(invite.inviterId, {
        type: 'invite_accepted',
        title: 'Invite Accepted',
        message: `${user.username} accepted your party invite`,
        data: { partyId: invite.partyId, userId },
      });
    } else {
      invite.status = InviteStatus.DECLINED;

      await this.gamerstakeService.sendNotification(invite.inviterId, {
        type: 'invite_declined',
        title: 'Invite Declined',
        message: `Your party invite was declined`,
        data: { partyId: invite.partyId },
      });
    }

    await this.inviteRepository.save(invite);
    await this.cacheService.deleteInvite(inviteId);

    this.logger.log(`Invite ${inviteId} ${dto.accept ? 'accepted' : 'declined'} by user ${userId}`);
  }

  async joinByCode(userId: string, dto: JoinByCodeDto): Promise<Party> {
    const party = await this.partyService.findByJoinCode(dto.code);

    if (party.status !== PartyStatus.ACTIVE) {
      throw new BadRequestException('Party is not active');
    }

    if (party.currentSize >= party.maxSize) {
      throw new BadRequestException('Party is full');
    }

    const existingMember = await this.memberRepository.findOne({
      where: { partyId: party.id, userId, leftAt: undefined },
    });

    if (existingMember) {
      throw new ConflictException('You are already a member of this party');
    }

    const user = await this.gamerstakeService.getUser(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = await this.gamerstakeService.getProfile(userId);

    await this.memberService.addMember(party.id, {
      userId,
      username: user.username,
      avatarUrl: user.avatarUrl,
      rank: profile?.rank,
      level: profile?.level,
    });

    this.logger.log(`User ${userId} joined party ${party.id} via code`);

    return party;
  }

  async joinByToken(userId: string, dto: JoinByTokenDto): Promise<Party> {
    const invite = await this.inviteRepository.findOne({
      where: { inviteToken: dto.token, status: InviteStatus.PENDING },
    });

    if (!invite) {
      throw new NotFoundException('Invalid or expired invite link');
    }

    if (new Date() > invite.expiresAt) {
      invite.status = InviteStatus.EXPIRED;
      await this.inviteRepository.save(invite);
      throw new BadRequestException('Invite link has expired');
    }

    if (invite.maxUses > 0 && invite.currentUses >= invite.maxUses) {
      throw new BadRequestException('Invite link has reached maximum uses');
    }

    const party = await this.partyService.findById(invite.partyId);

    if (party.status !== PartyStatus.ACTIVE) {
      throw new BadRequestException('Party is not active');
    }

    if (party.currentSize >= party.maxSize) {
      throw new BadRequestException('Party is full');
    }

    const existingMember = await this.memberRepository.findOne({
      where: { partyId: party.id, userId, leftAt: undefined },
    });

    if (existingMember) {
      throw new ConflictException('You are already a member of this party');
    }

    const user = await this.gamerstakeService.getUser(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = await this.gamerstakeService.getProfile(userId);

    await this.memberService.addMember(party.id, {
      userId,
      username: user.username,
      avatarUrl: user.avatarUrl,
      rank: profile?.rank,
      level: profile?.level,
    });

    invite.currentUses += 1;
    if (invite.maxUses > 0 && invite.currentUses >= invite.maxUses) {
      invite.status = InviteStatus.EXPIRED;
    }
    await this.inviteRepository.save(invite);

    this.logger.log(`User ${userId} joined party ${party.id} via invite link`);

    return party;
  }

  async cancelInvite(inviteId: string, userId: string): Promise<void> {
    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.inviterId !== userId) {
      const party = await this.partyService.findById(invite.partyId);
      if (party.leaderId !== userId) {
        throw new ForbiddenException('Only the inviter or party leader can cancel this invite');
      }
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Invite is no longer pending');
    }

    invite.status = InviteStatus.CANCELLED;
    await this.inviteRepository.save(invite);
    await this.cacheService.deleteInvite(inviteId);

    if (invite.inviteeId) {
      await this.gamerstakeService.sendNotification(invite.inviteeId, {
        type: 'invite_cancelled',
        title: 'Invite Cancelled',
        message: 'A party invite was cancelled',
        data: { inviteId },
      });
    }

    this.logger.log(`Invite ${inviteId} cancelled by user ${userId}`);
  }

  async getInvite(inviteId: string): Promise<PartyInvite> {
    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId },
      relations: ['party'],
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    return invite;
  }

  async getPartyInvites(partyId: string, status?: InviteStatus): Promise<PartyInvite[]> {
    const where: Record<string, unknown> = { partyId };
    if (status) {
      where.status = status;
    }

    return this.inviteRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getUserPendingInvites(userId: string): Promise<PartyInvite[]> {
    return this.inviteRepository.find({
      where: { inviteeId: userId, status: InviteStatus.PENDING },
      relations: ['party'],
      order: { createdAt: 'DESC' },
    });
  }

  async getUserSentInvites(userId: string): Promise<PartyInvite[]> {
    return this.inviteRepository.find({
      where: { inviterId: userId },
      relations: ['party'],
      order: { createdAt: 'DESC' },
    });
  }

  async expireOldInvites(): Promise<number> {
    const result = await this.inviteRepository.update(
      {
        status: InviteStatus.PENDING,
        expiresAt: LessThan(new Date()),
      },
      { status: InviteStatus.EXPIRED },
    );

    return result.affected || 0;
  }

  async createInviteLink(partyId: string, inviterId: string, maxUses = 0, expiresInHours = 24): Promise<string> {
    const invite = await this.createInvite(partyId, inviterId, {
      type: InviteType.LINK,
      maxUses,
      expiresInHours,
    });

    return invite.inviteToken || '';
  }

  async getInviteByToken(token: string): Promise<PartyInvite | null> {
    return this.inviteRepository.findOne({
      where: { inviteToken: token },
      relations: ['party'],
    });
  }

  async inviteFriends(partyId: string, inviterId: string): Promise<PartyInvite[]> {
    const friends = await this.gamerstakeService.getOnlineFriends(inviterId);
    const invites: PartyInvite[] = [];

    for (const friend of friends) {
      try {
        const invite = await this.createInvite(partyId, inviterId, {
          inviteeId: friend.friendId,
          inviteeUsername: friend.username,
          type: InviteType.FRIEND_REQUEST,
        });
        invites.push(invite);
      } catch (error) {
        this.logger.warn(`Failed to invite friend ${friend.friendId}: ${error}`);
      }
    }

    return invites;
  }
}
