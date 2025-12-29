import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PartySettings } from '../entities/party-settings.entity';
import { UpdatePartySettingsDto } from '../dto';
import { RedisCacheService } from './redis-cache.service';
import { PartyService } from './party.service';

@Injectable()
export class PartySettingsService {
  private readonly logger = new Logger(PartySettingsService.name);

  constructor(
    @InjectRepository(PartySettings)
    private settingsRepository: Repository<PartySettings>,
    private cacheService: RedisCacheService,
    private partyService: PartyService,
  ) {}

  async getSettings(partyId: string): Promise<PartySettings> {
    const settings = await this.settingsRepository.findOne({
      where: { partyId },
    });

    if (!settings) {
      throw new NotFoundException('Party settings not found');
    }

    return settings;
  }

  async updateSettings(partyId: string, userId: string, dto: UpdatePartySettingsDto): Promise<PartySettings> {
    const party = await this.partyService.findById(partyId);
    await this.partyService.verifyPermission(party, userId, 'canChangeSettings');

    let settings = await this.settingsRepository.findOne({
      where: { partyId },
    });

    if (!settings) {
      settings = this.settingsRepository.create({
        id: uuidv4(),
        partyId,
      });
    }

    if (dto.allowInvites !== undefined) settings.allowInvites = dto.allowInvites;
    if (dto.membersCanInvite !== undefined) settings.membersCanInvite = dto.membersCanInvite;
    if (dto.autoAcceptFriends !== undefined) settings.autoAcceptFriends = dto.autoAcceptFriends;
    if (dto.requireApproval !== undefined) settings.requireApproval = dto.requireApproval;
    if (dto.chatEnabled !== undefined) settings.chatEnabled = dto.chatEnabled;
    if (dto.voiceChatEnabled !== undefined) settings.voiceChatEnabled = dto.voiceChatEnabled;
    if (dto.pushToTalk !== undefined) settings.pushToTalk = dto.pushToTalk;
    if (dto.notificationsEnabled !== undefined) settings.notificationsEnabled = dto.notificationsEnabled;
    if (dto.soundsEnabled !== undefined) settings.soundsEnabled = dto.soundsEnabled;
    if (dto.autoReadyCheck !== undefined) settings.autoReadyCheck = dto.autoReadyCheck;
    if (dto.readyCheckTimeout !== undefined) settings.readyCheckTimeout = dto.readyCheckTimeout;
    if (dto.showMemberStatus !== undefined) settings.showMemberStatus = dto.showMemberStatus;
    if (dto.showMemberRank !== undefined) settings.showMemberRank = dto.showMemberRank;
    if (dto.anonymousMode !== undefined) settings.anonymousMode = dto.anonymousMode;
    if (dto.strictRankMatching !== undefined) settings.strictRankMatching = dto.strictRankMatching;
    if (dto.rankTolerance !== undefined) settings.rankTolerance = dto.rankTolerance;
    if (dto.allowSpectators !== undefined) settings.allowSpectators = dto.allowSpectators;
    if (dto.maxSpectators !== undefined) settings.maxSpectators = dto.maxSpectators;
    if (dto.streamMode !== undefined) settings.streamMode = dto.streamMode;
    if (dto.streamDelay !== undefined) settings.streamDelay = dto.streamDelay;
    if (dto.tournamentMode !== undefined) settings.tournamentMode = dto.tournamentMode;
    if (dto.tournamentId !== undefined) settings.tournamentId = dto.tournamentId;
    if (dto.wagerEnabled !== undefined) settings.wagerEnabled = dto.wagerEnabled;
    if (dto.wagerAmount !== undefined) settings.wagerAmount = dto.wagerAmount?.toString();
    if (dto.wagerCurrency !== undefined) settings.wagerCurrency = dto.wagerCurrency;
    if (dto.requireWalletVerification !== undefined) settings.requireWalletVerification = dto.requireWalletVerification;
    if (dto.minimumBalance !== undefined) settings.minimumBalance = dto.minimumBalance?.toString();
    if (dto.preferredServers !== undefined) settings.preferredServers = dto.preferredServers;
    if (dto.blockedRegions !== undefined) settings.blockedRegions = dto.blockedRegions;
    if (dto.maxPing !== undefined) settings.maxPing = dto.maxPing;
    if (dto.gameSpecificSettings !== undefined) settings.gameSpecificSettings = dto.gameSpecificSettings;
    if (dto.customRoles !== undefined) settings.customRoles = dto.customRoles;
    if (dto.chatFilters !== undefined) settings.chatFilters = dto.chatFilters;
    if (dto.matchmakingPreferences !== undefined) settings.matchmakingPreferences = dto.matchmakingPreferences;
    if (dto.metadata !== undefined) settings.metadata = dto.metadata;

    settings.updatedAt = new Date();

    const saved = await this.settingsRepository.save(settings);

    this.logger.log(`Settings updated for party ${partyId} by user ${userId}`);

    return saved;
  }

  async resetSettings(partyId: string, userId: string): Promise<PartySettings> {
    const party = await this.partyService.findById(partyId);

    if (party.leaderId !== userId) {
      throw new ForbiddenException('Only the party leader can reset settings');
    }

    let settings = await this.settingsRepository.findOne({
      where: { partyId },
    });

    if (!settings) {
      settings = this.settingsRepository.create({
        id: uuidv4(),
        partyId,
      });
    } else {
      settings.allowInvites = true;
      settings.membersCanInvite = false;
      settings.autoAcceptFriends = true;
      settings.requireApproval = false;
      settings.chatEnabled = true;
      settings.voiceChatEnabled = true;
      settings.pushToTalk = false;
      settings.notificationsEnabled = true;
      settings.soundsEnabled = true;
      settings.autoReadyCheck = false;
      settings.readyCheckTimeout = 30;
      settings.showMemberStatus = true;
      settings.showMemberRank = true;
      settings.anonymousMode = false;
      settings.strictRankMatching = false;
      settings.rankTolerance = 500;
      settings.allowSpectators = true;
      settings.maxSpectators = 0;
      settings.streamMode = false;
      settings.streamDelay = 0;
      settings.tournamentMode = false;
      settings.tournamentId = null as unknown as string;
      settings.wagerEnabled = false;
      settings.wagerAmount = null as unknown as string;
      settings.wagerCurrency = null as unknown as string;
      settings.requireWalletVerification = false;
      settings.minimumBalance = null as unknown as string;
      settings.preferredServers = null as unknown as string[];
      settings.blockedRegions = null as unknown as string[];
      settings.maxPing = 100;
      settings.gameSpecificSettings = null as unknown as Record<string, unknown>;
      settings.customRoles = null as unknown as { name: string; permissions: string[]; color: string }[];
      settings.chatFilters = null as unknown as { profanityFilter: boolean; linkFilter: boolean; spamFilter: boolean; customBlockedWords: string[] };
      settings.matchmakingPreferences = null as unknown as { preferSimilarRank: boolean; preferSameRegion: boolean; preferSameLanguage: boolean; avoidRecentOpponents: boolean; prioritizeSpeed: boolean };
      settings.metadata = null as unknown as Record<string, unknown>;
    }

    settings.updatedAt = new Date();

    const saved = await this.settingsRepository.save(settings);

    this.logger.log(`Settings reset for party ${partyId} by user ${userId}`);

    return saved;
  }

  async enableWager(
    partyId: string,
    userId: string,
    amount: number,
    currency: string,
  ): Promise<PartySettings> {
    return this.updateSettings(partyId, userId, {
      wagerEnabled: true,
      wagerAmount: amount,
      wagerCurrency: currency,
      requireWalletVerification: true,
    });
  }

  async disableWager(partyId: string, userId: string): Promise<PartySettings> {
    return this.updateSettings(partyId, userId, {
      wagerEnabled: false,
      wagerAmount: undefined,
      wagerCurrency: undefined,
    });
  }

  async enableTournamentMode(partyId: string, userId: string, tournamentId: string): Promise<PartySettings> {
    return this.updateSettings(partyId, userId, {
      tournamentMode: true,
      tournamentId,
    });
  }

  async disableTournamentMode(partyId: string, userId: string): Promise<PartySettings> {
    return this.updateSettings(partyId, userId, {
      tournamentMode: false,
      tournamentId: undefined,
    });
  }

  async enableStreamMode(partyId: string, userId: string, delay = 30): Promise<PartySettings> {
    return this.updateSettings(partyId, userId, {
      streamMode: true,
      streamDelay: delay,
    });
  }

  async disableStreamMode(partyId: string, userId: string): Promise<PartySettings> {
    return this.updateSettings(partyId, userId, {
      streamMode: false,
      streamDelay: 0,
    });
  }

  async setChatFilters(
    partyId: string,
    userId: string,
    filters: {
      profanityFilter?: boolean;
      linkFilter?: boolean;
      spamFilter?: boolean;
      customBlockedWords?: string[];
    },
  ): Promise<PartySettings> {
    const settings = await this.getSettings(partyId);
    const currentFilters = settings.chatFilters || {
      profanityFilter: false,
      linkFilter: false,
      spamFilter: false,
      customBlockedWords: [],
    };
    return this.updateSettings(partyId, userId, {
      chatFilters: {
        profanityFilter: filters.profanityFilter ?? currentFilters.profanityFilter,
        linkFilter: filters.linkFilter ?? currentFilters.linkFilter,
        spamFilter: filters.spamFilter ?? currentFilters.spamFilter,
        customBlockedWords: filters.customBlockedWords ?? currentFilters.customBlockedWords,
      },
    });
  }

  async setMatchmakingPreferences(
    partyId: string,
    userId: string,
    preferences: {
      preferSimilarRank?: boolean;
      preferSameRegion?: boolean;
      preferSameLanguage?: boolean;
      avoidRecentOpponents?: boolean;
      prioritizeSpeed?: boolean;
    },
  ): Promise<PartySettings> {
    const settings = await this.getSettings(partyId);
    const currentPrefs = settings.matchmakingPreferences || {
      preferSimilarRank: false,
      preferSameRegion: false,
      preferSameLanguage: false,
      avoidRecentOpponents: false,
      prioritizeSpeed: false,
    };
    return this.updateSettings(partyId, userId, {
      matchmakingPreferences: {
        preferSimilarRank: preferences.preferSimilarRank ?? currentPrefs.preferSimilarRank,
        preferSameRegion: preferences.preferSameRegion ?? currentPrefs.preferSameRegion,
        preferSameLanguage: preferences.preferSameLanguage ?? currentPrefs.preferSameLanguage,
        avoidRecentOpponents: preferences.avoidRecentOpponents ?? currentPrefs.avoidRecentOpponents,
        prioritizeSpeed: preferences.prioritizeSpeed ?? currentPrefs.prioritizeSpeed,
      },
    });
  }

  async addCustomRole(
    partyId: string,
    userId: string,
    role: { name: string; permissions: string[]; color: string },
  ): Promise<PartySettings> {
    const settings = await this.getSettings(partyId);
    const party = await this.partyService.findById(partyId);
    await this.partyService.verifyPermission(party, userId, 'canChangeSettings');

    const customRoles = settings.customRoles || [];
    const existingIndex = customRoles.findIndex((r) => r.name === role.name);

    if (existingIndex >= 0) {
      customRoles[existingIndex] = role;
    } else {
      customRoles.push(role);
    }

    return this.updateSettings(partyId, userId, { customRoles });
  }

  async removeCustomRole(partyId: string, userId: string, roleName: string): Promise<PartySettings> {
    const settings = await this.getSettings(partyId);
    const party = await this.partyService.findById(partyId);
    await this.partyService.verifyPermission(party, userId, 'canChangeSettings');

    const customRoles = (settings.customRoles || []).filter((r) => r.name !== roleName);

    return this.updateSettings(partyId, userId, { customRoles });
  }

  async setPreferredServers(partyId: string, userId: string, servers: string[]): Promise<PartySettings> {
    return this.updateSettings(partyId, userId, { preferredServers: servers });
  }

  async setBlockedRegions(partyId: string, userId: string, regions: string[]): Promise<PartySettings> {
    return this.updateSettings(partyId, userId, { blockedRegions: regions });
  }

  async setGameSpecificSettings(
    partyId: string,
    userId: string,
    settings: Record<string, unknown>,
  ): Promise<PartySettings> {
    return this.updateSettings(partyId, userId, { gameSpecificSettings: settings });
  }

  async getSettingsForGame(partyId: string, gameId: string): Promise<Record<string, unknown> | null> {
    const settings = await this.getSettings(partyId);
    return settings.gameSpecificSettings || null;
  }
}
