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
import { PartySettings } from '../entities/party-settings.entity';
import { CreatePartyDto, UpdatePartyDto } from '../dto';
import { RedisCacheService } from './redis-cache.service';
import { GamerstakeService } from './gamerstake.service';

@Injectable()
export class PartyService {
  private readonly logger = new Logger(PartyService.name);

  constructor(
    @InjectRepository(Party)
    private partyRepository: Repository<Party>,
    @InjectRepository(PartyMember)
    private memberRepository: Repository<PartyMember>,
    @InjectRepository(PartySettings)
    private settingsRepository: Repository<PartySettings>,
    private cacheService: RedisCacheService,
    private gamerstakeService: GamerstakeService,
  ) {}

  private generateJoinCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async create(userId: string, dto: CreatePartyDto): Promise<Party> {
    const existingParty = await this.getUserActiveParty(userId);
    if (existingParty) {
      throw new ConflictException('User is already in a party');
    }

    const user = await this.gamerstakeService.getUser(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.requiresWallet && dto.minimumWalletBalance) {
      const hasBalance = await this.gamerstakeService.verifyWalletBalance(
        userId,
        dto.minimumWalletBalance.toString(),
        dto.walletCurrency || 'USD',
      );
      if (!hasBalance) {
        throw new BadRequestException('Insufficient wallet balance to create this party');
      }
    }

    const party = this.partyRepository.create({
      id: uuidv4(),
      name: dto.name,
      leaderId: userId,
      leaderUsername: user.username,
      gameId: dto.gameId,
      gameName: dto.gameName,
      gameMode: dto.gameMode,
      visibility: dto.visibility || PartyVisibility.FRIENDS_ONLY,
      maxSize: dto.maxSize || 4,
      currentSize: 1,
      minRank: dto.minRank || 0,
      maxRank: dto.maxRank || 10000,
      region: dto.region,
      language: dto.language,
      description: dto.description,
      joinCode: dto.generateJoinCode ? this.generateJoinCode() : undefined,
      requiresWallet: dto.requiresWallet || false,
      minimumWalletBalance: dto.minimumWalletBalance?.toString(),
      walletCurrency: dto.walletCurrency,
      metadata: dto.metadata,
      status: PartyStatus.ACTIVE,
    });

    const savedParty = await this.partyRepository.save(party);

    const settings = this.settingsRepository.create({
      id: uuidv4(),
      partyId: savedParty.id,
    });
    await this.settingsRepository.save(settings);

    const profile = await this.gamerstakeService.getProfile(userId);
    const wallet = dto.requiresWallet ? await this.gamerstakeService.getWallet(userId) : null;

    const leader = this.memberRepository.create({
      id: uuidv4(),
      partyId: savedParty.id,
      userId,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: MemberRole.LEADER,
      status: MemberStatus.ACTIVE,
      readyStatus: ReadyStatus.NOT_READY,
      rank: profile?.rank,
      level: profile?.level,
      canInvite: true,
      canKick: true,
      canChangeSettings: true,
      canStartMatchmaking: true,
      walletVerified: wallet?.isVerified || false,
      walletBalance: wallet?.balance,
    });
    await this.memberRepository.save(leader);

    await this.cacheParty(savedParty);
    await this.cacheService.setUserParty(userId, savedParty.id);

    this.logger.log(`Party ${savedParty.id} created by user ${userId}`);

    return savedParty;
  }

  async findById(partyId: string): Promise<Party> {
    const cached = await this.cacheService.getParty(partyId);
    if (cached) {
      return cached as unknown as Party;
    }

    const party = await this.partyRepository.findOne({
      where: { id: partyId },
      relations: ['members', 'settings'],
    });

    if (!party) {
      throw new NotFoundException('Party not found');
    }

    await this.cacheParty(party);
    return party;
  }

  async findByJoinCode(code: string): Promise<Party> {
    const party = await this.partyRepository.findOne({
      where: { joinCode: code.toUpperCase(), status: PartyStatus.ACTIVE },
      relations: ['members', 'settings'],
    });

    if (!party) {
      throw new NotFoundException('Party not found or invalid code');
    }

    return party;
  }

  async update(partyId: string, userId: string, dto: UpdatePartyDto): Promise<Party> {
    const party = await this.findById(partyId);
    await this.verifyPermission(party, userId, 'canChangeSettings');

    if (dto.maxSize && dto.maxSize < party.currentSize) {
      throw new BadRequestException('Cannot reduce max size below current member count');
    }

    Object.assign(party, {
      ...dto,
      minimumWalletBalance: dto.minimumWalletBalance?.toString(),
      updatedAt: new Date(),
    });

    const updated = await this.partyRepository.save(party);
    await this.cacheParty(updated);

    return updated;
  }

  async disband(partyId: string, userId: string): Promise<void> {
    const party = await this.findById(partyId);

    if (party.leaderId !== userId) {
      throw new ForbiddenException('Only the party leader can disband the party');
    }

    if (party.isMatchmaking) {
      await this.cacheService.deleteMatchmakingTicket(partyId);
    }

    party.status = PartyStatus.DISBANDED;
    party.disbandedAt = new Date();
    await this.partyRepository.save(party);

    const members = await this.memberRepository.find({ where: { partyId } });
    for (const member of members) {
      member.leftAt = new Date();
      await this.memberRepository.save(member);
      await this.cacheService.deleteUserParty(member.userId);
    }

    await this.cacheService.deleteParty(partyId);

    this.logger.log(`Party ${partyId} disbanded by leader ${userId}`);
  }

  async getUserActiveParty(userId: string): Promise<Party | null> {
    const cachedPartyId = await this.cacheService.getUserParty(userId);
    if (cachedPartyId) {
      try {
        return await this.findById(cachedPartyId);
      } catch {
        await this.cacheService.deleteUserParty(userId);
      }
    }

    const member = await this.memberRepository.findOne({
      where: { userId, leftAt: undefined },
      relations: ['party'],
    });

    if (member && member.party && member.party.status === PartyStatus.ACTIVE) {
      await this.cacheService.setUserParty(userId, member.party.id);
      return member.party;
    }

    return null;
  }

  async getPublicParties(options: {
    gameId?: string;
    region?: string;
    minRank?: number;
    maxRank?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ parties: Party[]; total: number }> {
    const query = this.partyRepository
      .createQueryBuilder('party')
      .leftJoinAndSelect('party.members', 'members')
      .where('party.status = :status', { status: PartyStatus.ACTIVE })
      .andWhere('party.visibility = :visibility', { visibility: PartyVisibility.PUBLIC })
      .andWhere('party.currentSize < party.maxSize');

    if (options.gameId) {
      query.andWhere('party.gameId = :gameId', { gameId: options.gameId });
    }

    if (options.region) {
      query.andWhere('party.region = :region', { region: options.region });
    }

    if (options.minRank !== undefined) {
      query.andWhere('party.minRank <= :minRank', { minRank: options.minRank });
    }

    if (options.maxRank !== undefined) {
      query.andWhere('party.maxRank >= :maxRank', { maxRank: options.maxRank });
    }

    const [parties, total] = await query
      .orderBy('party.createdAt', 'DESC')
      .skip(options.offset || 0)
      .take(options.limit || 20)
      .getManyAndCount();

    return { parties, total };
  }

  async regenerateJoinCode(partyId: string, userId: string): Promise<string> {
    const party = await this.findById(partyId);
    await this.verifyPermission(party, userId, 'canChangeSettings');

    const newCode = this.generateJoinCode();
    party.joinCode = newCode;
    await this.partyRepository.save(party);
    await this.cacheParty(party);

    return newCode;
  }

  async removeJoinCode(partyId: string, userId: string): Promise<void> {
    const party = await this.findById(partyId);
    await this.verifyPermission(party, userId, 'canChangeSettings');

    party.joinCode = null as unknown as string;
    await this.partyRepository.save(party);
    await this.cacheParty(party);
  }

  async setGame(partyId: string, userId: string, gameId: string, gameName: string, gameMode?: string): Promise<Party> {
    const party = await this.findById(partyId);
    await this.verifyPermission(party, userId, 'canChangeSettings');

    if (party.isMatchmaking) {
      throw new BadRequestException('Cannot change game while matchmaking');
    }

    party.gameId = gameId;
    party.gameName = gameName;
    party.gameMode = gameMode || party.gameMode;
    party.updatedAt = new Date();

    const updated = await this.partyRepository.save(party);
    await this.cacheParty(updated);

    await this.resetAllReadyStatus(partyId);

    return updated;
  }

  async setVisibility(partyId: string, userId: string, visibility: PartyVisibility): Promise<Party> {
    const party = await this.findById(partyId);

    if (party.leaderId !== userId) {
      throw new ForbiddenException('Only the party leader can change visibility');
    }

    party.visibility = visibility;
    party.updatedAt = new Date();

    const updated = await this.partyRepository.save(party);
    await this.cacheParty(updated);

    return updated;
  }

  async getPartyStats(partyId: string): Promise<Record<string, unknown>> {
    const party = await this.findById(partyId);
    const members = await this.memberRepository.find({ where: { partyId } });

    const ranks = members.filter((m) => m.rank !== null).map((m) => m.rank as number);
    const avgRank = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 0;

    const readyCount = members.filter((m) => m.readyStatus === ReadyStatus.READY).length;

    return {
      partyId: party.id,
      name: party.name,
      currentSize: party.currentSize,
      maxSize: party.maxSize,
      averageRank: Math.round(avgRank),
      readyCount,
      allReady: readyCount === party.currentSize,
      isMatchmaking: party.isMatchmaking,
      gameId: party.gameId,
      gameName: party.gameName,
      createdAt: party.createdAt,
      uptime: Date.now() - party.createdAt.getTime(),
    };
  }

  async verifyPermission(party: Party, userId: string, permission: string): Promise<void> {
    if (party.leaderId === userId) {
      return;
    }

    const member = await this.memberRepository.findOne({
      where: { partyId: party.id, userId, leftAt: undefined },
    });

    if (!member) {
      throw new ForbiddenException('User is not a member of this party');
    }

    if (member.role === MemberRole.CO_LEADER) {
      return;
    }

    const hasPermission = member[permission as keyof PartyMember];
    if (!hasPermission) {
      throw new ForbiddenException(`User does not have permission: ${permission}`);
    }
  }

  async isMember(partyId: string, userId: string): Promise<boolean> {
    const member = await this.memberRepository.findOne({
      where: { partyId, userId, leftAt: undefined },
    });
    return !!member;
  }

  async getMember(partyId: string, userId: string): Promise<PartyMember | null> {
    return this.memberRepository.findOne({
      where: { partyId, userId, leftAt: undefined },
    });
  }

  async updateCurrentSize(partyId: string): Promise<void> {
    const count = await this.memberRepository.count({
      where: { partyId, leftAt: undefined },
    });

    await this.partyRepository.update(partyId, { currentSize: count });

    const party = await this.findById(partyId);
    await this.cacheParty(party);
  }

  private async resetAllReadyStatus(partyId: string): Promise<void> {
    await this.memberRepository.update(
      { partyId, leftAt: undefined },
      { readyStatus: ReadyStatus.NOT_READY },
    );
  }

  private async cacheParty(party: Party): Promise<void> {
    await this.cacheService.setParty(party.id, {
      id: party.id,
      name: party.name,
      leaderId: party.leaderId,
      leaderUsername: party.leaderUsername,
      gameId: party.gameId,
      gameName: party.gameName,
      gameMode: party.gameMode,
      status: party.status,
      visibility: party.visibility,
      maxSize: party.maxSize,
      currentSize: party.currentSize,
      minRank: party.minRank,
      maxRank: party.maxRank,
      region: party.region,
      language: party.language,
      joinCode: party.joinCode,
      isMatchmaking: party.isMatchmaking,
      requiresWallet: party.requiresWallet,
      minimumWalletBalance: party.minimumWalletBalance,
      walletCurrency: party.walletCurrency,
      createdAt: party.createdAt,
      updatedAt: party.updatedAt,
    });
  }

  async findPartiesByGameId(gameId: string, limit = 50): Promise<Party[]> {
    return this.partyRepository.find({
      where: { gameId, status: PartyStatus.ACTIVE },
      relations: ['members'],
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async getPartyHistory(userId: string, limit = 20): Promise<PartyMember[]> {
    return this.memberRepository.find({
      where: { userId },
      relations: ['party'],
      take: limit,
      order: { joinedAt: 'DESC' },
    });
  }

  async searchParties(query: string, options: {
    gameId?: string;
    visibility?: PartyVisibility;
    limit?: number;
  }): Promise<Party[]> {
    const qb = this.partyRepository
      .createQueryBuilder('party')
      .where('party.status = :status', { status: PartyStatus.ACTIVE })
      .andWhere('(party.name ILIKE :query OR party.description ILIKE :query)', {
        query: `%${query}%`,
      });

    if (options.gameId) {
      qb.andWhere('party.gameId = :gameId', { gameId: options.gameId });
    }

    if (options.visibility) {
      qb.andWhere('party.visibility = :visibility', { visibility: options.visibility });
    }

    return qb
      .orderBy('party.currentSize', 'DESC')
      .take(options.limit || 20)
      .getMany();
  }
}
