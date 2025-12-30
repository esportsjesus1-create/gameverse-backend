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
import { Party, PartyStatus } from '../entities/party.entity';
import { PartyMember, ReadyStatus } from '../entities/party-member.entity';
import { PartySettings } from '../entities/party-settings.entity';
import {
  StartMatchmakingDto,
  CancelMatchmakingDto,
  ReadyCheckDto,
  ReadyCheckResponseDto,
  MatchmakingStatusDto,
} from '../dto';
import { RedisCacheService } from './redis-cache.service';
import { GamerstakeService } from './gamerstake.service';
import { PartyService } from './party.service';
import { PartyMemberService } from './party-member.service';
import { PartyChatService } from './party-chat.service';
import { MessageType } from '../entities/party-chat-message.entity';

export interface MatchmakingTicket {
  id: string;
  partyId: string;
  gameId: string;
  gameMode?: string;
  players: Array<{
    userId: string;
    username: string;
    rank: number;
  }>;
  averageRank: number;
  preferredRegions: string[];
  rankRangeMin: number;
  rankRangeMax: number;
  maxWaitTime: number;
  expandSearch: boolean;
  prioritizeSpeed: boolean;
  startedAt: Date;
  criteria?: Record<string, unknown>;
}

export interface ReadyCheckState {
  partyId: string;
  initiatorId: string;
  startedAt: Date;
  timeout: number;
  responses: Record<string, boolean | null>;
  completed: boolean;
}

@Injectable()
export class PartyMatchmakingService {
  private readonly logger = new Logger(PartyMatchmakingService.name);
  private readonly DEFAULT_READY_CHECK_TIMEOUT = 30;
  private readonly MAX_WAIT_TIME = 600;

  constructor(
    @InjectRepository(Party)
    private partyRepository: Repository<Party>,
    @InjectRepository(PartyMember)
    private memberRepository: Repository<PartyMember>,
    @InjectRepository(PartySettings)
    private settingsRepository: Repository<PartySettings>,
    private cacheService: RedisCacheService,
    private gamerstakeService: GamerstakeService,
    private partyService: PartyService,
    private memberService: PartyMemberService,
    private chatService: PartyChatService,
  ) {}

  async startMatchmaking(partyId: string, userId: string, dto: StartMatchmakingDto): Promise<MatchmakingTicket> {
    const party = await this.partyService.findById(partyId);
    await this.partyService.verifyPermission(party, userId, 'canStartMatchmaking');

    if (party.isMatchmaking) {
      throw new BadRequestException('Party is already in matchmaking');
    }

    if (party.status !== PartyStatus.ACTIVE) {
      throw new BadRequestException('Party is not active');
    }

    const members = await this.memberService.getMembers(partyId);
    if (members.length === 0) {
      throw new BadRequestException('Party has no members');
    }

    const allReady = await this.memberService.isAllReady(partyId);
    if (!allReady) {
      throw new BadRequestException('Not all party members are ready');
    }

    const settings = await this.settingsRepository.findOne({ where: { partyId } });

    if (settings?.wagerEnabled && settings.wagerAmount) {
      for (const member of members) {
        const hasBalance = await this.gamerstakeService.verifyWalletBalance(
          member.userId,
          settings.wagerAmount,
          settings.wagerCurrency || 'USD',
        );
        if (!hasBalance) {
          throw new BadRequestException(`Member ${member.username} has insufficient wallet balance for wager`);
        }
      }
    }

    const ranks = members.filter((m) => m.rank !== null).map((m) => m.rank as number);
    const averageRank = ranks.length > 0 ? Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length) : 1000;

    const ticket: MatchmakingTicket = {
      id: uuidv4(),
      partyId,
      gameId: dto.gameId,
      gameMode: dto.gameMode,
      players: members.map((m) => ({
        userId: m.userId,
        username: m.username,
        rank: m.rank || 1000,
      })),
      averageRank,
      preferredRegions: dto.preferredRegions || (party.region ? [party.region] : []),
      rankRangeMin: dto.rankRangeMin ?? (averageRank - 500),
      rankRangeMax: dto.rankRangeMax ?? (averageRank + 500),
      maxWaitTime: Math.min(dto.maxWaitTime || 300, this.MAX_WAIT_TIME),
      expandSearch: dto.expandSearch ?? true,
      prioritizeSpeed: dto.prioritizeSpeed ?? false,
      startedAt: new Date(),
      criteria: dto.criteria,
    };

    party.isMatchmaking = true;
    party.matchmakingTicketId = ticket.id;
    party.matchmakingStartedAt = new Date();
    party.gameId = dto.gameId;
    party.gameMode = dto.gameMode || party.gameMode;
    party.status = PartyStatus.IN_QUEUE;
    await this.partyRepository.save(party);

    await this.cacheService.setMatchmakingTicket(partyId, ticket as unknown as Record<string, unknown>);

    await this.chatService.sendSystemMessage(partyId, {
      content: `Matchmaking started for ${dto.gameMode || 'default'} mode`,
      type: MessageType.MATCHMAKING_UPDATE,
      metadata: { ticketId: ticket.id, gameId: dto.gameId },
    });

    this.logger.log(`Matchmaking started for party ${partyId}, ticket ${ticket.id}`);

    return ticket;
  }

  async cancelMatchmaking(partyId: string, userId: string, dto?: CancelMatchmakingDto): Promise<void> {
    const party = await this.partyService.findById(partyId);
    await this.partyService.verifyPermission(party, userId, 'canStartMatchmaking');

    if (!party.isMatchmaking) {
      throw new BadRequestException('Party is not in matchmaking');
    }

    party.isMatchmaking = false;
    party.matchmakingTicketId = null as unknown as string;
    party.matchmakingStartedAt = null as unknown as Date;
    party.status = PartyStatus.ACTIVE;
    await this.partyRepository.save(party);

    await this.cacheService.deleteMatchmakingTicket(partyId);

    await this.chatService.sendSystemMessage(partyId, {
      content: dto?.reason || 'Matchmaking cancelled',
      type: MessageType.MATCHMAKING_UPDATE,
    });

    this.logger.log(`Matchmaking cancelled for party ${partyId}`);
  }

  async getMatchmakingStatus(partyId: string): Promise<MatchmakingStatusDto> {
    const party = await this.partyService.findById(partyId);

    if (!party.isMatchmaking) {
      return {
        isMatchmaking: false,
      };
    }

    const ticket = await this.cacheService.getMatchmakingTicket(partyId) as MatchmakingTicket | null;

    if (!ticket) {
      return {
        isMatchmaking: true,
        ticketId: party.matchmakingTicketId || undefined,
      };
    }

    const timeInQueue = Math.floor((Date.now() - new Date(ticket.startedAt).getTime()) / 1000);
    const estimatedWaitTime = this.estimateWaitTime(ticket);

    return {
      isMatchmaking: true,
      ticketId: ticket.id,
      timeInQueue,
      estimatedWaitTime,
      searchParameters: {
        gameId: ticket.gameId,
        gameMode: ticket.gameMode || 'default',
        rankRange: { min: ticket.rankRangeMin, max: ticket.rankRangeMax },
        regions: ticket.preferredRegions,
      },
      playersFound: ticket.players.length,
      playersNeeded: this.getPlayersNeeded(ticket.gameMode),
    };
  }

  async startReadyCheck(partyId: string, userId: string, dto?: ReadyCheckDto): Promise<ReadyCheckState> {
    const party = await this.partyService.findById(partyId);
    await this.partyService.verifyPermission(party, userId, 'canStartMatchmaking');

    const existingCheck = await this.cacheService.getReadyCheck(partyId);
    if (existingCheck) {
      throw new BadRequestException('A ready check is already in progress');
    }

    const members = await this.memberService.getMembers(partyId);
    const timeout = dto?.timeout || this.DEFAULT_READY_CHECK_TIMEOUT;

    const responses: Record<string, boolean | null> = {};
    for (const member of members) {
      responses[member.userId] = null;
    }

    const readyCheck: ReadyCheckState = {
      partyId,
      initiatorId: userId,
      startedAt: new Date(),
      timeout,
      responses,
      completed: false,
    };

    await this.cacheService.setReadyCheck(partyId, readyCheck as unknown as Record<string, unknown>, timeout + 5);

    await this.memberRepository.update(
      { partyId, leftAt: undefined },
      { readyStatus: ReadyStatus.PENDING },
    );

    await this.chatService.sendSystemMessage(partyId, {
      content: `Ready check started! You have ${timeout} seconds to respond.`,
      type: MessageType.READY_CHECK,
      metadata: { timeout, initiatorId: userId },
    });

    this.logger.log(`Ready check started for party ${partyId} by user ${userId}`);

    return readyCheck;
  }

  async respondToReadyCheck(partyId: string, userId: string, dto: ReadyCheckResponseDto): Promise<ReadyCheckState> {
    const readyCheck = await this.cacheService.getReadyCheck(partyId) as ReadyCheckState | null;

    if (!readyCheck) {
      throw new NotFoundException('No active ready check');
    }

    if (readyCheck.completed) {
      throw new BadRequestException('Ready check has already completed');
    }

    if (!(userId in readyCheck.responses)) {
      throw new ForbiddenException('You are not part of this ready check');
    }

    readyCheck.responses[userId] = dto.ready;
    await this.cacheService.updateReadyCheckResponse(partyId, userId, dto.ready);

    await this.memberRepository.update(
      { partyId, userId, leftAt: undefined },
      { readyStatus: dto.ready ? ReadyStatus.READY : ReadyStatus.NOT_READY },
    );

    const allResponded = Object.values(readyCheck.responses).every((r) => r !== null);
    const allReady = Object.values(readyCheck.responses).every((r) => r === true);

    if (allResponded) {
      readyCheck.completed = true;
      await this.cacheService.deleteReadyCheck(partyId);

      if (allReady) {
        await this.chatService.sendSystemMessage(partyId, {
          content: 'All players are ready!',
          type: MessageType.READY_CHECK,
          metadata: { result: 'success' },
        });
      } else {
        await this.chatService.sendSystemMessage(partyId, {
          content: 'Ready check failed. Not all players are ready.',
          type: MessageType.READY_CHECK,
          metadata: { result: 'failed' },
        });

        await this.memberService.resetAllReadyStatus(partyId);
      }
    }

    return readyCheck;
  }

  async getReadyCheckStatus(partyId: string): Promise<ReadyCheckState | null> {
    return this.cacheService.getReadyCheck(partyId) as Promise<ReadyCheckState | null>;
  }

  async cancelReadyCheck(partyId: string, userId: string): Promise<void> {
    const party = await this.partyService.findById(partyId);
    await this.partyService.verifyPermission(party, userId, 'canStartMatchmaking');

    const readyCheck = await this.cacheService.getReadyCheck(partyId);
    if (!readyCheck) {
      throw new NotFoundException('No active ready check');
    }

    await this.cacheService.deleteReadyCheck(partyId);
    await this.memberService.resetAllReadyStatus(partyId);

    await this.chatService.sendSystemMessage(partyId, {
      content: 'Ready check cancelled',
      type: MessageType.READY_CHECK,
      metadata: { result: 'cancelled' },
    });

    this.logger.log(`Ready check cancelled for party ${partyId} by user ${userId}`);
  }

  async handleMatchFound(partyId: string, matchData: {
    matchId: string;
    serverInfo: {
      ip: string;
      port: number;
      region: string;
      connectionToken: string;
    };
    teams: Array<{
      teamId: string;
      players: Array<{ odId: string; username: string }>;
    }>;
  }): Promise<void> {
    const party = await this.partyService.findById(partyId);

    party.isMatchmaking = false;
    party.matchmakingTicketId = null as unknown as string;
    party.matchmakingStartedAt = null as unknown as Date;
    party.currentMatchId = matchData.matchId;
    party.status = PartyStatus.IN_GAME;
    await this.partyRepository.save(party);

    await this.cacheService.deleteMatchmakingTicket(partyId);

    await this.chatService.sendSystemMessage(partyId, {
      content: `Match found! Connecting to server in ${matchData.serverInfo.region}...`,
      type: MessageType.MATCHMAKING_UPDATE,
      metadata: {
        matchId: matchData.matchId,
        serverInfo: matchData.serverInfo,
      },
    });

    const members = await this.memberService.getMembers(partyId);
    for (const member of members) {
      await this.gamerstakeService.sendNotification(member.userId, {
        type: 'match_found',
        title: 'Match Found!',
        message: 'Your match is ready. Click to connect.',
        data: {
          matchId: matchData.matchId,
          serverInfo: matchData.serverInfo,
        },
      });
    }

    this.logger.log(`Match ${matchData.matchId} found for party ${partyId}`);
  }

  async handleMatchEnded(partyId: string, result: {
    matchId: string;
    outcome: 'win' | 'loss' | 'draw';
    stats?: Record<string, unknown>;
  }): Promise<void> {
    const party = await this.partyService.findById(partyId);

    party.currentMatchId = null as unknown as string;
    party.status = PartyStatus.ACTIVE;
    await this.partyRepository.save(party);

    await this.memberService.resetAllReadyStatus(partyId);

    await this.chatService.sendSystemMessage(partyId, {
      content: `Match ended: ${result.outcome.toUpperCase()}`,
      type: MessageType.GAME_EVENT,
      metadata: result,
    });

    this.logger.log(`Match ${result.matchId} ended for party ${partyId} with outcome ${result.outcome}`);
  }

  async expandSearchRange(partyId: string): Promise<void> {
    const ticket = await this.cacheService.getMatchmakingTicket(partyId) as MatchmakingTicket | null;

    if (!ticket || !ticket.expandSearch) {
      return;
    }

    const timeInQueue = (Date.now() - new Date(ticket.startedAt).getTime()) / 1000;
    const expansionFactor = Math.floor(timeInQueue / 60);

    ticket.rankRangeMin = Math.max(0, ticket.rankRangeMin - (expansionFactor * 100));
    ticket.rankRangeMax = ticket.rankRangeMax + (expansionFactor * 100);

    await this.cacheService.setMatchmakingTicket(partyId, ticket as unknown as Record<string, unknown>);

    this.logger.log(`Search range expanded for party ${partyId}: ${ticket.rankRangeMin}-${ticket.rankRangeMax}`);
  }

  private estimateWaitTime(ticket: MatchmakingTicket): number {
    const baseWaitTime = 30;
    const rankFactor = Math.abs(ticket.averageRank - 1500) / 500;
    const regionFactor = ticket.preferredRegions.length === 0 ? 0 : 0.5;

    return Math.round(baseWaitTime * (1 + rankFactor + regionFactor));
  }

  private getPlayersNeeded(gameMode?: string): number {
    const modePlayerCounts: Record<string, number> = {
      '1v1': 2,
      '2v2': 4,
      '3v3': 6,
      '5v5': 10,
      'battle_royale': 100,
      'default': 10,
    };

    return modePlayerCounts[gameMode || 'default'] || 10;
  }

  async getQueuePosition(partyId: string): Promise<number | null> {
    const ticket = await this.cacheService.getMatchmakingTicket(partyId);
    if (!ticket) {
      return null;
    }

    return Math.floor(Math.random() * 50) + 1;
  }

  async forceStartMatch(partyId: string, userId: string): Promise<void> {
    const party = await this.partyService.findById(partyId);

    if (party.leaderId !== userId) {
      throw new ForbiddenException('Only the party leader can force start');
    }

    if (!party.isMatchmaking) {
      throw new BadRequestException('Party is not in matchmaking');
    }

    this.logger.log(`Force start requested for party ${partyId} by user ${userId}`);
  }
}
