import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Party, PartyStatus, PartyVisibility } from '../entities/party.entity';
import { PartyMember, MemberRole, MemberStatus, ReadyStatus } from '../entities/party-member.entity';
import {
  AddMemberDto,
  UpdateMemberDto,
  TransferLeadershipDto,
  KickMemberDto,
  SetReadyStatusDto,
  UpdateMemberPermissionsDto,
} from '../dto';
import { RedisCacheService } from './redis-cache.service';
import { GamerstakeService } from './gamerstake.service';
import { PartyService } from './party.service';

@Injectable()
export class PartyMemberService {
  private readonly logger = new Logger(PartyMemberService.name);

  constructor(
    @InjectRepository(Party)
    private partyRepository: Repository<Party>,
    @InjectRepository(PartyMember)
    private memberRepository: Repository<PartyMember>,
    private cacheService: RedisCacheService,
    private gamerstakeService: GamerstakeService,
    private partyService: PartyService,
  ) {}

  async addMember(partyId: string, dto: AddMemberDto): Promise<PartyMember> {
    const party = await this.partyService.findById(partyId);

    if (party.status !== PartyStatus.ACTIVE) {
      throw new BadRequestException('Party is not active');
    }

    if (party.currentSize >= party.maxSize) {
      throw new BadRequestException('Party is full');
    }

    const existingMember = await this.memberRepository.findOne({
      where: { partyId, userId: dto.userId, leftAt: undefined },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this party');
    }

    const existingParty = await this.partyService.getUserActiveParty(dto.userId);
    if (existingParty) {
      throw new ConflictException('User is already in another party');
    }

    if (party.requiresWallet && party.minimumWalletBalance) {
      const hasBalance = await this.gamerstakeService.verifyWalletBalance(
        dto.userId,
        party.minimumWalletBalance,
        party.walletCurrency || 'USD',
      );
      if (!hasBalance) {
        throw new BadRequestException('Insufficient wallet balance to join this party');
      }
    }

    if (dto.rank !== undefined) {
      if (dto.rank < party.minRank || dto.rank > party.maxRank) {
        throw new BadRequestException('User rank does not meet party requirements');
      }
    }

    const wallet = party.requiresWallet ? await this.gamerstakeService.getWallet(dto.userId) : null;

    const member = this.memberRepository.create({
      id: uuidv4(),
      partyId,
      userId: dto.userId,
      username: dto.username,
      avatarUrl: dto.avatarUrl,
      role: dto.role || MemberRole.MEMBER,
      status: MemberStatus.ACTIVE,
      readyStatus: ReadyStatus.NOT_READY,
      rank: dto.rank,
      level: dto.level,
      preferredRole: dto.preferredRole,
      gameStats: dto.gameStats,
      walletVerified: wallet?.isVerified || false,
      walletBalance: wallet?.balance,
      canInvite: true,
      canKick: false,
      canChangeSettings: false,
      canStartMatchmaking: false,
    });

    const savedMember = await this.memberRepository.save(member);

    await this.partyService.updateCurrentSize(partyId);
    await this.cacheService.setUserParty(dto.userId, partyId);
    await this.cacheService.addPartyMember(partyId, {
      odId: savedMember.userId,
      username: savedMember.username,
      role: savedMember.role,
      status: savedMember.status,
      readyStatus: savedMember.readyStatus,
    } as Record<string, unknown>);

    this.logger.log(`User ${dto.userId} joined party ${partyId}`);

    return savedMember;
  }

  async removeMember(partyId: string, userId: string, reason: 'left' | 'kicked' = 'left'): Promise<void> {
    const party = await this.partyService.findById(partyId);
    const member = await this.memberRepository.findOne({
      where: { partyId, userId, leftAt: undefined },
    });

    if (!member) {
      throw new NotFoundException('Member not found in party');
    }

    if (member.role === MemberRole.LEADER) {
      throw new BadRequestException('Leader cannot leave. Transfer leadership first or disband the party.');
    }

    member.leftAt = new Date();
    await this.memberRepository.save(member);

    await this.partyService.updateCurrentSize(partyId);
    await this.cacheService.deleteUserParty(userId);
    await this.cacheService.removePartyMember(partyId, userId);

    this.logger.log(`User ${userId} ${reason} party ${partyId}`);
  }

  async kickMember(partyId: string, kickerId: string, dto: KickMemberDto): Promise<void> {
    const party = await this.partyService.findById(partyId);

    if (dto.userId === party.leaderId) {
      throw new ForbiddenException('Cannot kick the party leader');
    }

    if (dto.userId === kickerId) {
      throw new BadRequestException('Cannot kick yourself');
    }

    await this.partyService.verifyPermission(party, kickerId, 'canKick');

    const targetMember = await this.memberRepository.findOne({
      where: { partyId, userId: dto.userId, leftAt: undefined },
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found in party');
    }

    const kickerMember = await this.memberRepository.findOne({
      where: { partyId, userId: kickerId, leftAt: undefined },
    });

    if (kickerMember && targetMember.role === MemberRole.CO_LEADER && kickerMember.role !== MemberRole.LEADER) {
      throw new ForbiddenException('Only the leader can kick co-leaders');
    }

    await this.removeMember(partyId, dto.userId, 'kicked');

    await this.gamerstakeService.sendNotification(dto.userId, {
      type: 'party_kicked',
      title: 'Kicked from Party',
      message: dto.reason || `You were kicked from ${party.name}`,
      data: { partyId, reason: dto.reason },
    });
  }

  async updateMember(partyId: string, userId: string, dto: UpdateMemberDto): Promise<PartyMember> {
    const member = await this.memberRepository.findOne({
      where: { partyId, userId, leftAt: undefined },
    });

    if (!member) {
      throw new NotFoundException('Member not found in party');
    }

    Object.assign(member, {
      ...dto,
      updatedAt: new Date(),
    });

    const updated = await this.memberRepository.save(member);

    await this.cacheService.updatePartyMember(partyId, userId, {
      role: updated.role,
      status: updated.status,
      readyStatus: updated.readyStatus,
    });

    return updated;
  }

  async transferLeadership(partyId: string, currentLeaderId: string, dto: TransferLeadershipDto): Promise<void> {
    const party = await this.partyService.findById(partyId);

    if (party.leaderId !== currentLeaderId) {
      throw new ForbiddenException('Only the current leader can transfer leadership');
    }

    const newLeader = await this.memberRepository.findOne({
      where: { partyId, userId: dto.newLeaderId, leftAt: undefined },
    });

    if (!newLeader) {
      throw new NotFoundException('New leader is not a member of this party');
    }

    const currentLeader = await this.memberRepository.findOne({
      where: { partyId, userId: currentLeaderId, leftAt: undefined },
    });

    if (currentLeader) {
      currentLeader.role = MemberRole.CO_LEADER;
      currentLeader.canKick = true;
      currentLeader.canChangeSettings = true;
      currentLeader.canStartMatchmaking = true;
      await this.memberRepository.save(currentLeader);
    }

    newLeader.role = MemberRole.LEADER;
    newLeader.canInvite = true;
    newLeader.canKick = true;
    newLeader.canChangeSettings = true;
    newLeader.canStartMatchmaking = true;
    await this.memberRepository.save(newLeader);

    party.leaderId = dto.newLeaderId;
    party.leaderUsername = newLeader.username;
    await this.partyRepository.save(party);

    await this.cacheService.setParty(partyId, {
      ...party,
      leaderId: dto.newLeaderId,
      leaderUsername: newLeader.username,
    });

    this.logger.log(`Leadership transferred from ${currentLeaderId} to ${dto.newLeaderId} in party ${partyId}`);
  }

  async promoteToCoLeader(partyId: string, leaderId: string, userId: string): Promise<PartyMember> {
    const party = await this.partyService.findById(partyId);

    if (party.leaderId !== leaderId) {
      throw new ForbiddenException('Only the leader can promote members');
    }

    const member = await this.memberRepository.findOne({
      where: { partyId, userId, leftAt: undefined },
    });

    if (!member) {
      throw new NotFoundException('Member not found in party');
    }

    if (member.role === MemberRole.LEADER) {
      throw new BadRequestException('Cannot promote the leader');
    }

    member.role = MemberRole.CO_LEADER;
    member.canKick = true;
    member.canChangeSettings = true;
    member.canStartMatchmaking = true;

    const updated = await this.memberRepository.save(member);

    await this.cacheService.updatePartyMember(partyId, userId, { role: MemberRole.CO_LEADER });

    return updated;
  }

  async demoteFromCoLeader(partyId: string, leaderId: string, userId: string): Promise<PartyMember> {
    const party = await this.partyService.findById(partyId);

    if (party.leaderId !== leaderId) {
      throw new ForbiddenException('Only the leader can demote members');
    }

    const member = await this.memberRepository.findOne({
      where: { partyId, userId, leftAt: undefined },
    });

    if (!member) {
      throw new NotFoundException('Member not found in party');
    }

    if (member.role !== MemberRole.CO_LEADER) {
      throw new BadRequestException('Member is not a co-leader');
    }

    member.role = MemberRole.MEMBER;
    member.canKick = false;
    member.canChangeSettings = false;
    member.canStartMatchmaking = false;

    const updated = await this.memberRepository.save(member);

    await this.cacheService.updatePartyMember(partyId, userId, { role: MemberRole.MEMBER });

    return updated;
  }

  async setReadyStatus(partyId: string, userId: string, dto: SetReadyStatusDto): Promise<PartyMember> {
    const member = await this.memberRepository.findOne({
      where: { partyId, userId, leftAt: undefined },
    });

    if (!member) {
      throw new NotFoundException('Member not found in party');
    }

    member.readyStatus = dto.readyStatus;
    member.updatedAt = new Date();

    const updated = await this.memberRepository.save(member);

    await this.cacheService.updatePartyMember(partyId, userId, { readyStatus: dto.readyStatus });

    return updated;
  }

  async setMemberStatus(partyId: string, userId: string, status: MemberStatus): Promise<PartyMember> {
    const member = await this.memberRepository.findOne({
      where: { partyId, userId, leftAt: undefined },
    });

    if (!member) {
      throw new NotFoundException('Member not found in party');
    }

    member.status = status;
    member.lastActiveAt = new Date();
    member.updatedAt = new Date();

    const updated = await this.memberRepository.save(member);

    await this.cacheService.updatePartyMember(partyId, userId, { status });

    return updated;
  }

  async updatePermissions(partyId: string, leaderId: string, dto: UpdateMemberPermissionsDto): Promise<PartyMember> {
    const party = await this.partyService.findById(partyId);

    if (party.leaderId !== leaderId) {
      throw new ForbiddenException('Only the leader can update permissions');
    }

    if (dto.userId === leaderId) {
      throw new BadRequestException('Cannot modify leader permissions');
    }

    const member = await this.memberRepository.findOne({
      where: { partyId, userId: dto.userId, leftAt: undefined },
    });

    if (!member) {
      throw new NotFoundException('Member not found in party');
    }

    if (dto.canInvite !== undefined) member.canInvite = dto.canInvite;
    if (dto.canKick !== undefined) member.canKick = dto.canKick;
    if (dto.canChangeSettings !== undefined) member.canChangeSettings = dto.canChangeSettings;
    if (dto.canStartMatchmaking !== undefined) member.canStartMatchmaking = dto.canStartMatchmaking;

    member.updatedAt = new Date();

    return this.memberRepository.save(member);
  }

  async getMembers(partyId: string): Promise<PartyMember[]> {
    const cached = await this.cacheService.getPartyMembers(partyId);
    if (cached) {
      return cached as unknown as PartyMember[];
    }

    const members = await this.memberRepository.find({
      where: { partyId, leftAt: undefined },
      order: { role: 'ASC', joinedAt: 'ASC' },
    });

    await this.cacheService.setPartyMembers(
      partyId,
      members.map((m) => ({
        odId: m.userId,
        username: m.username,
        avatarUrl: m.avatarUrl,
        role: m.role,
        status: m.status,
        readyStatus: m.readyStatus,
        rank: m.rank,
      })) as unknown as Record<string, unknown>[],
    );

    return members;
  }

  async getMember(partyId: string, userId: string): Promise<PartyMember | null> {
    return this.memberRepository.findOne({
      where: { partyId, userId, leftAt: undefined },
    });
  }

  async isAllReady(partyId: string): Promise<boolean> {
    const members = await this.getMembers(partyId);
    return members.every((m) => m.readyStatus === ReadyStatus.READY);
  }

  async resetAllReadyStatus(partyId: string): Promise<void> {
    await this.memberRepository.update(
      { partyId, leftAt: undefined },
      { readyStatus: ReadyStatus.NOT_READY },
    );

    const members = await this.getMembers(partyId);
    await this.cacheService.setPartyMembers(
      partyId,
      members.map((m) => ({
        odId: m.userId,
        username: m.username,
        role: m.role,
        status: m.status,
        readyStatus: ReadyStatus.NOT_READY,
      })) as unknown as Record<string, unknown>[],
    );
  }

  async setMuted(partyId: string, userId: string, isMuted: boolean): Promise<PartyMember> {
    const member = await this.memberRepository.findOne({
      where: { partyId, userId, leftAt: undefined },
    });

    if (!member) {
      throw new NotFoundException('Member not found in party');
    }

    member.isMuted = isMuted;
    member.updatedAt = new Date();

    return this.memberRepository.save(member);
  }

  async setDeafened(partyId: string, userId: string, isDeafened: boolean): Promise<PartyMember> {
    const member = await this.memberRepository.findOne({
      where: { partyId, userId, leftAt: undefined },
    });

    if (!member) {
      throw new NotFoundException('Member not found in party');
    }

    member.isDeafened = isDeafened;
    member.updatedAt = new Date();

    return this.memberRepository.save(member);
  }

  async updateLastActive(partyId: string, userId: string): Promise<void> {
    await this.memberRepository.update(
      { partyId, userId, leftAt: undefined },
      { lastActiveAt: new Date() },
    );
  }

  async getMemberCount(partyId: string): Promise<number> {
    return this.memberRepository.count({
      where: { partyId, leftAt: undefined },
    });
  }

  async getReadyCount(partyId: string): Promise<number> {
    return this.memberRepository.count({
      where: { partyId, leftAt: undefined, readyStatus: ReadyStatus.READY },
    });
  }
}
