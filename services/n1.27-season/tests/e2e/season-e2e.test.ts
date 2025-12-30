import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { SeasonService } from '../../src/services/season.service';
import { LifecycleService } from '../../src/services/lifecycle.service';
import { ProgressionService } from '../../src/services/progression.service';
import { RulesService } from '../../src/services/rules.service';
import { RewardsService } from '../../src/services/rewards.service';
import { AdminService } from '../../src/services/admin.service';
import { GamerstakeService } from '../../src/services/gamerstake.service';
import {
  SeasonState,
  SeasonType,
  ResetType,
  ModifierType,
  ChallengeType,
  RankedTier,
  TierDivision,
  RewardType,
  MilestoneType,
} from '../../src/types';

const mockPrismaClient = {
  season: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  seasonMetadata: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  seasonTemplate: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  seasonRule: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  seasonModifier: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  seasonChallenge: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  playerChallengeProgress: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
  },
  seasonEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  seasonAuditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  seasonAnalytics: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  playerSeason: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  playerSeasonHistory: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  playerLifetimeStats: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  playerInventoryCarryover: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  playerMilestone: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  playerReward: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  seasonReward: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  playerStats: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  playerProgression: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrismaClient)),
} as unknown as PrismaClient;

describe('E2E Season Module Tests - 52 FR Requirements', () => {
  let seasonService: SeasonService;
  let lifecycleService: LifecycleService;
  let progressionService: ProgressionService;
  let rulesService: RulesService;
  let rewardsService: RewardsService;
  let adminService: AdminService;
  let gamerstakeService: GamerstakeService;

  beforeEach(() => {
    jest.clearAllMocks();
    seasonService = new SeasonService(mockPrismaClient);
    lifecycleService = new LifecycleService(mockPrismaClient);
    progressionService = new ProgressionService(mockPrismaClient);
    rulesService = new RulesService(mockPrismaClient);
    rewardsService = new RewardsService(mockPrismaClient);
    adminService = new AdminService(mockPrismaClient);
    gamerstakeService = new GamerstakeService(mockPrismaClient);
  });

  describe('Season Definition (FR-001 to FR-010)', () => {
    const seasonId = uuidv4();
    const mockSeason = {
      id: seasonId,
      number: 1,
      name: 'Season 1',
      description: 'First season',
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      isActive: false,
      state: 'DRAFT',
      type: 'RANKED',
      version: 1,
      gameIds: ['game1'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    test('E2E-SEASON-001: Season creation with metadata', async () => {
      (mockPrismaClient.season.create as jest.Mock).mockResolvedValue(mockSeason);
      (mockPrismaClient.seasonMetadata.create as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        seasonId,
        theme: 'Winter',
        bannerUrl: 'https://example.com/banner.png',
      });

      const result = await seasonService.createSeasonWithMetadata({
        number: 1,
        name: 'Season 1',
        startDate: new Date(),
      });

      expect(result).toBeDefined();
      expect(result.number).toBe(1);
      expect(mockPrismaClient.season.create).toHaveBeenCalled();
    });

    test('E2E-SEASON-002: Season metadata management', async () => {
      (mockPrismaClient.seasonMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        seasonId,
        theme: 'Winter',
        bannerUrl: 'https://example.com/banner.png',
      });

      const metadata = await seasonService.getSeasonMetadata(seasonId);

      expect(metadata).toBeDefined();
      expect(metadata?.theme).toBe('Winter');
    });

    test('E2E-SEASON-003: Season duration configuration', async () => {
      const startDate = new Date();
      const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      (mockPrismaClient.season.create as jest.Mock).mockResolvedValue({
        ...mockSeason,
        startDate,
        endDate,
      });

      const result = await seasonService.createSeasonWithMetadata({
        number: 1,
        name: 'Season 1',
        startDate,
        endDate,
      });

      expect(result.startDate).toEqual(startDate);
      expect(result.endDate).toEqual(endDate);
    });

    test('E2E-SEASON-004: Season type configuration (Ranked/Casual/Event)', async () => {
      (mockPrismaClient.season.create as jest.Mock).mockResolvedValue({
        ...mockSeason,
        type: 'RANKED',
      });

      const result = await seasonService.createSeasonWithMetadata({
        number: 1,
        name: 'Season 1',
        startDate: new Date(),
        type: SeasonType.RANKED,
      });

      expect(result.type).toBe('RANKED');
    });

    test('E2E-SEASON-005: Season versioning', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({
        ...mockSeason,
        version: 1,
      });
      (mockPrismaClient.season.update as jest.Mock).mockResolvedValue({
        ...mockSeason,
        version: 2,
      });

      const result = await seasonService.updateSeasonVersion(seasonId);

      expect(result.version).toBe(2);
    });

    test('E2E-SEASON-006: Multi-game support', async () => {
      (mockPrismaClient.season.findMany as jest.Mock).mockResolvedValue([mockSeason]);

      const seasons = await seasonService.getSeasonsByGame('game1');

      expect(seasons).toHaveLength(1);
      expect(seasons[0].gameIds).toContain('game1');
    });

    test('E2E-SEASON-007: Season templates', async () => {
      const templateId = uuidv4();
      (mockPrismaClient.seasonTemplate.create as jest.Mock).mockResolvedValue({
        id: templateId,
        name: 'Standard Template',
        description: 'Standard season template',
        config: {},
      });

      const template = await seasonService.createSeasonTemplate({
        name: 'Standard Template',
        description: 'Standard season template',
        config: {},
      });

      expect(template).toBeDefined();
      expect(template.name).toBe('Standard Template');
    });

    test('E2E-SEASON-008: Season cloning', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue(mockSeason);
      (mockPrismaClient.seasonRule.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaClient.seasonModifier.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaClient.seasonReward.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaClient.season.create as jest.Mock).mockResolvedValue({
        ...mockSeason,
        id: uuidv4(),
        number: 2,
        name: 'Season 2',
      });

      const clonedSeason = await seasonService.cloneSeason(
        seasonId,
        2,
        'Season 2',
        new Date()
      );

      expect(clonedSeason).toBeDefined();
      expect(clonedSeason.number).toBe(2);
    });

    test('E2E-SEASON-009: Season preview', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue(mockSeason);
      (mockPrismaClient.seasonRule.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaClient.seasonModifier.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaClient.seasonReward.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaClient.seasonChallenge.findMany as jest.Mock).mockResolvedValue([]);

      const preview = await seasonService.getSeasonPreview(seasonId);

      expect(preview).toBeDefined();
      expect(preview.season).toBeDefined();
      expect(preview.isValid).toBeDefined();
    });

    test('E2E-SEASON-010: Season localization', async () => {
      (mockPrismaClient.seasonMetadata.findUnique as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        seasonId,
        localizations: { en: { name: 'Season 1', description: 'First season' } },
      });

      const content = await seasonService.getLocalizedSeasonContent(seasonId, 'en');

      expect(content).toBeDefined();
      expect(content?.name).toBe('Season 1');
    });
  });

  describe('Lifecycle Management (FR-011 to FR-020)', () => {
    const seasonId = uuidv4();
    const actorId = uuidv4();
    const mockSeason = {
      id: seasonId,
      number: 1,
      name: 'Season 1',
      state: 'DRAFT',
      isActive: false,
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    };

    test('E2E-SEASON-011: Season state machine', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({
        ...mockSeason,
        state: 'DRAFT',
      });
      (mockPrismaClient.season.update as jest.Mock).mockResolvedValue({
        ...mockSeason,
        state: 'SCHEDULED',
      });
      (mockPrismaClient.seasonAuditLog.create as jest.Mock).mockResolvedValue({});

      const result = await lifecycleService.transitionState(
        seasonId,
        SeasonState.SCHEDULED,
        actorId
      );

      expect(result.state).toBe('SCHEDULED');
    });

    test('E2E-SEASON-012: Season activation', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({
        ...mockSeason,
        state: 'SCHEDULED',
      });
      (mockPrismaClient.season.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaClient.season.update as jest.Mock).mockResolvedValue({
        ...mockSeason,
        state: 'ACTIVE',
        isActive: true,
      });
      (mockPrismaClient.seasonAuditLog.create as jest.Mock).mockResolvedValue({});

      const result = await lifecycleService.activateSeason(seasonId, actorId);

      expect(result.state).toBe('ACTIVE');
      expect(result.isActive).toBe(true);
    });

    test('E2E-SEASON-013: Season pause/resume', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({
        ...mockSeason,
        state: 'ACTIVE',
        isActive: true,
      });
      (mockPrismaClient.season.update as jest.Mock).mockResolvedValue({
        ...mockSeason,
        state: 'PAUSED',
        isActive: false,
      });
      (mockPrismaClient.seasonAuditLog.create as jest.Mock).mockResolvedValue({});

      const result = await lifecycleService.pauseSeason(seasonId, actorId, 'Maintenance');

      expect(result.state).toBe('PAUSED');
    });

    test('E2E-SEASON-014: Season extension', async () => {
      const newEndDate = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({
        ...mockSeason,
        state: 'ACTIVE',
      });
      (mockPrismaClient.season.update as jest.Mock).mockResolvedValue({
        ...mockSeason,
        endDate: newEndDate,
      });
      (mockPrismaClient.seasonAuditLog.create as jest.Mock).mockResolvedValue({});

      const result = await lifecycleService.extendSeason(
        seasonId,
        newEndDate,
        actorId,
        'Extended due to popular demand'
      );

      expect(result.endDate).toEqual(newEndDate);
    });

    test('E2E-SEASON-015: Early termination', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({
        ...mockSeason,
        state: 'ACTIVE',
      });
      (mockPrismaClient.season.update as jest.Mock).mockResolvedValue({
        ...mockSeason,
        state: 'ENDING',
      });
      (mockPrismaClient.seasonAuditLog.create as jest.Mock).mockResolvedValue({});

      const result = await lifecycleService.terminateSeason(
        seasonId,
        actorId,
        'Emergency termination',
        24
      );

      expect(result.state).toBe('ENDING');
    });

    test('E2E-SEASON-016: Season transition', async () => {
      const newSeasonId = uuidv4();
      (mockPrismaClient.season.findUnique as jest.Mock)
        .mockResolvedValueOnce({ ...mockSeason, state: 'ENDING' })
        .mockResolvedValueOnce({ ...mockSeason, id: newSeasonId, state: 'SCHEDULED' });
      (mockPrismaClient.season.update as jest.Mock).mockResolvedValue({});
      (mockPrismaClient.playerSeason.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaClient.seasonAuditLog.create as jest.Mock).mockResolvedValue({});

      const result = await lifecycleService.transitionToNextSeason(
        seasonId,
        newSeasonId,
        actorId
      );

      expect(result).toBeDefined();
      expect(result.previousSeasonId).toBe(seasonId);
      expect(result.newSeasonId).toBe(newSeasonId);
    });

    test('E2E-SEASON-017: Overlap prevention', async () => {
      (mockPrismaClient.season.findMany as jest.Mock).mockResolvedValue([mockSeason]);

      const hasOverlap = await lifecycleService.checkSeasonOverlap(
        SeasonType.RANKED,
        new Date(),
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      );

      expect(hasOverlap).toBe(true);
    });

    test('E2E-SEASON-018: Event hooks', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue(mockSeason);
      (mockPrismaClient.seasonEvent.create as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        seasonId,
        eventType: 'SEASON_START',
        eventData: {},
      });

      const event = await lifecycleService.createSeasonEvent(
        seasonId,
        'SEASON_START' as any,
        { message: 'Season started' }
      );

      expect(event).toBeDefined();
      expect(event.eventType).toBe('SEASON_START');
    });

    test('E2E-SEASON-019: Health monitoring', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({
        ...mockSeason,
        state: 'ACTIVE',
      });
      (mockPrismaClient.playerSeason.count as jest.Mock).mockResolvedValue(100);
      (mockPrismaClient.playerSeason.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaClient.seasonAuditLog.count as jest.Mock).mockResolvedValue(10);

      const health = await lifecycleService.getSeasonHealth(seasonId);

      expect(health).toBeDefined();
      expect(health.isHealthy).toBeDefined();
      expect(health.activePlayers).toBeDefined();
    });

    test('E2E-SEASON-020: Audit trail', async () => {
      (mockPrismaClient.seasonAuditLog.findMany as jest.Mock).mockResolvedValue([
        { id: uuidv4(), seasonId, action: 'STATE_CHANGE', actorId },
      ]);
      (mockPrismaClient.seasonAuditLog.count as jest.Mock).mockResolvedValue(1);

      const logs = await lifecycleService.getAuditLogs(seasonId);

      expect(logs.data).toHaveLength(1);
      expect(logs.total).toBe(1);
    });
  });

  describe('Reset & Carryover (FR-021 to FR-030)', () => {
    const playerId = uuidv4();
    const fromSeasonId = uuidv4();
    const toSeasonId = uuidv4();
    const mockPlayerSeason = {
      id: uuidv4(),
      playerId,
      seasonId: fromSeasonId,
      mmr: 1500,
      peakMmr: 1600,
      tier: 'GOLD',
      division: 2,
      wins: 50,
      losses: 30,
      isPlacementComplete: true,
      gamerstakePlayerId: null,
    };

    test('E2E-SEASON-021: Soft reset', async () => {
      (mockPrismaClient.playerSeason.findUnique as jest.Mock).mockResolvedValue(mockPlayerSeason);
      (mockPrismaClient.playerSeason.create as jest.Mock).mockResolvedValue({
        ...mockPlayerSeason,
        seasonId: toSeasonId,
        mmr: 1350,
      });

      const result = await progressionService.performSoftReset(
        playerId,
        fromSeasonId,
        toSeasonId,
        0.5
      );

      expect(result).toBeDefined();
      expect(result.previousMmr).toBe(1500);
      expect(result.newMmr).toBeLessThan(1500);
    });

    test('E2E-SEASON-022: Hard reset', async () => {
      (mockPrismaClient.playerSeason.findUnique as jest.Mock).mockResolvedValue(mockPlayerSeason);
      (mockPrismaClient.playerSeason.create as jest.Mock).mockResolvedValue({
        ...mockPlayerSeason,
        seasonId: toSeasonId,
        mmr: 1200,
      });

      const result = await progressionService.performHardReset(
        playerId,
        fromSeasonId,
        toSeasonId
      );

      expect(result).toBeDefined();
      expect(result.newMmr).toBe(1200);
    });

    test('E2E-SEASON-023: Placement matches', async () => {
      (mockPrismaClient.playerSeason.findUnique as jest.Mock).mockResolvedValue({
        ...mockPlayerSeason,
        isPlacementComplete: false,
        placementMatchesPlayed: 5,
        placementMatchesWon: 3,
      });
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({
        id: fromSeasonId,
        placementMatchesRequired: 10,
      });

      const status = await progressionService.getPlacementMatchStatus(playerId, fromSeasonId);

      expect(status.isComplete).toBe(false);
      expect(status.matchesPlayed).toBe(5);
      expect(status.matchesRequired).toBe(10);
    });

    test('E2E-SEASON-024: Rank decay prevention', async () => {
      (mockPrismaClient.playerSeason.findUnique as jest.Mock).mockResolvedValue(mockPlayerSeason);
      (mockPrismaClient.playerSeason.update as jest.Mock).mockResolvedValue({
        ...mockPlayerSeason,
        isDecayProtected: true,
      });

      const result = await progressionService.preventRankDecay(playerId, fromSeasonId, 7);

      expect(result.success).toBe(true);
      expect(result.protectedUntil).toBeDefined();
    });

    test('E2E-SEASON-025: MMR floor/ceiling', async () => {
      (mockPrismaClient.playerSeason.findUnique as jest.Mock).mockResolvedValue({
        ...mockPlayerSeason,
        mmr: 100,
      });
      (mockPrismaClient.playerSeason.update as jest.Mock).mockResolvedValue({
        ...mockPlayerSeason,
        mmr: 500,
      });

      const result = await progressionService.applyMMRFloorCeiling(
        playerId,
        fromSeasonId,
        500,
        3000
      );

      expect(result.adjusted).toBe(true);
      expect(result.newMmr).toBe(500);
    });

    test('E2E-SEASON-026: Tier demotion protection', async () => {
      (mockPrismaClient.playerSeason.findUnique as jest.Mock).mockResolvedValue({
        ...mockPlayerSeason,
        demotionShieldGames: 3,
      });
      (mockPrismaClient.playerSeason.update as jest.Mock).mockResolvedValue({
        ...mockPlayerSeason,
        demotionShieldGames: 2,
      });

      const protected_ = await progressionService.applyTierDemotionProtection(
        playerId,
        fromSeasonId,
        3
      );

      expect(protected_).toBe(true);
    });

    test('E2E-SEASON-027: Carryover statistics', async () => {
      (mockPrismaClient.playerSeason.findUnique as jest.Mock).mockResolvedValue(mockPlayerSeason);
      (mockPrismaClient.playerLifetimeStats.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrismaClient.playerLifetimeStats.create as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        playerId,
        totalSeasons: 1,
        totalWins: 50,
        totalLosses: 30,
      });
      (mockPrismaClient.playerReward.count as jest.Mock).mockResolvedValue(5);
      (mockPrismaClient.playerMilestone.count as jest.Mock).mockResolvedValue(10);
      (mockPrismaClient.playerChallengeProgress.count as jest.Mock).mockResolvedValue(3);
      (mockPrismaClient.playerSeason.count as jest.Mock).mockResolvedValue(1);

      const stats = await progressionService.updateLifetimeStats(playerId, fromSeasonId);

      expect(stats).toBeDefined();
      expect(stats.totalWins).toBe(50);
    });

    test('E2E-SEASON-028: Achievement persistence', async () => {
      (mockPrismaClient.playerSeasonHistory.findMany as jest.Mock).mockResolvedValue([
        {
          id: uuidv4(),
          playerId,
          seasonId: fromSeasonId,
          achievements: ['FIRST_WIN', 'WIN_STREAK_5'],
        },
      ]);

      const history = await progressionService.getPlayerSeasonHistory(playerId);

      expect(history).toHaveLength(1);
      expect(history[0].achievements).toContain('FIRST_WIN');
    });

    test('E2E-SEASON-029: Inventory carryover', async () => {
      (mockPrismaClient.playerInventoryCarryover.create as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        playerId,
        fromSeasonId,
        toSeasonId,
        itemType: 'SKIN',
        itemId: 'skin_1',
        quantity: 1,
      });

      const carryovers = await progressionService.carryoverInventory(
        playerId,
        fromSeasonId,
        toSeasonId,
        [{ itemType: 'SKIN', itemId: 'skin_1', quantity: 1 }]
      );

      expect(carryovers).toHaveLength(1);
      expect(carryovers[0].itemType).toBe('SKIN');
    });

    test('E2E-SEASON-030: Season history archive', async () => {
      (mockPrismaClient.playerSeason.findUnique as jest.Mock).mockResolvedValue(mockPlayerSeason);
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({
        id: fromSeasonId,
        number: 1,
        name: 'Season 1',
      });
      (mockPrismaClient.playerSeason.count as jest.Mock).mockResolvedValue(10);
      (mockPrismaClient.playerMilestone.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaClient.playerReward.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaClient.playerChallengeProgress.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaClient.playerSeasonHistory.create as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        playerId,
        seasonId: fromSeasonId,
        seasonNumber: 1,
        finalMmr: 1500,
        finalTier: 'GOLD',
      });

      const history = await progressionService.archivePlayerSeasonHistory(playerId, fromSeasonId);

      expect(history).toBeDefined();
      expect(history.finalMmr).toBe(1500);
    });
  });

  describe('Rules & Modifiers (FR-031 to FR-040)', () => {
    const seasonId = uuidv4();
    const playerId = uuidv4();

    test('E2E-SEASON-031: Season-specific rules', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({ id: seasonId });
      (mockPrismaClient.seasonRule.create as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        seasonId,
        name: 'Double XP',
        ruleType: 'XP_MULTIPLIER',
        value: { multiplier: 2 },
        isActive: true,
      });

      const rule = await rulesService.createRule({
        seasonId,
        name: 'Double XP',
        ruleType: 'XP_MULTIPLIER',
        value: { multiplier: 2 },
        isActive: true,
      });

      expect(rule).toBeDefined();
      expect(rule.name).toBe('Double XP');
    });

    test('E2E-SEASON-032: MMR multipliers', async () => {
      (mockPrismaClient.seasonModifier.findMany as jest.Mock).mockResolvedValue([
        {
          id: uuidv4(),
          seasonId,
          modifierType: 'MMR_MULTIPLIER',
          value: 1.5,
          isActive: true,
          startDate: new Date(Date.now() - 1000),
          endDate: new Date(Date.now() + 86400000),
        },
      ]);

      const adjustedMMR = await rulesService.applyMMRMultiplier(seasonId, 100);

      expect(adjustedMMR).toBe(150);
    });

    test('E2E-SEASON-033: Bonus events', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({ id: seasonId });
      (mockPrismaClient.seasonModifier.create as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        seasonId,
        modifierType: 'BONUS_EVENT',
        name: 'Weekend Bonus',
        value: 2,
        isActive: true,
      });

      const modifier = await rulesService.createModifier({
        seasonId,
        modifierType: ModifierType.BONUS_EVENT,
        name: 'Weekend Bonus',
        value: 2,
        isActive: true,
      });

      expect(modifier).toBeDefined();
      expect(modifier.modifierType).toBe('BONUS_EVENT');
    });

    test('E2E-SEASON-034: Decay rules', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({
        id: seasonId,
        decayDaysThreshold: 14,
        decayPointsPerDay: 25,
      });
      (mockPrismaClient.playerSeason.findMany as jest.Mock).mockResolvedValue([
        {
          id: uuidv4(),
          playerId,
          seasonId,
          mmr: 2000,
          tier: 'DIAMOND',
          lastActivityAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          isDecayProtected: false,
        },
      ]);
      (mockPrismaClient.playerSeason.update as jest.Mock).mockResolvedValue({});

      const results = await rulesService.processDecay(seasonId);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    test('E2E-SEASON-035: Promotion series', async () => {
      (mockPrismaClient.playerSeason.findUnique as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        playerId,
        seasonId,
        tier: 'GOLD',
        division: 1,
        mmr: 1600,
        isInPromotionSeries: false,
      });
      (mockPrismaClient.playerSeason.update as jest.Mock).mockResolvedValue({
        isInPromotionSeries: true,
        promotionSeriesWins: 0,
        promotionSeriesLosses: 0,
      });

      const result = await rulesService.startPromotionSeries(playerId, seasonId);

      expect(result.success).toBe(true);
    });

    test('E2E-SEASON-036: Demotion shield', async () => {
      (mockPrismaClient.playerSeason.findUnique as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        playerId,
        seasonId,
        tier: 'PLATINUM',
        division: 4,
        demotionShieldGames: 3,
      });
      (mockPrismaClient.playerSeason.update as jest.Mock).mockResolvedValue({
        demotionShieldGames: 2,
      });

      const protected_ = await rulesService.applyDemotionProtection(playerId, seasonId);

      expect(protected_).toBe(true);
    });

    test('E2E-SEASON-037: Streak bonuses', async () => {
      (mockPrismaClient.playerSeason.findUnique as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        playerId,
        seasonId,
        winStreak: 5,
      });
      (mockPrismaClient.seasonModifier.findMany as jest.Mock).mockResolvedValue([
        {
          id: uuidv4(),
          seasonId,
          modifierType: 'STREAK_BONUS',
          value: 0.1,
          isActive: true,
          startDate: new Date(Date.now() - 1000),
          endDate: new Date(Date.now() + 86400000),
        },
      ]);

      const adjustedMMR = await rulesService.applyStreakBonus(seasonId, playerId, 100, true);

      expect(adjustedMMR).toBeGreaterThan(100);
    });

    test('E2E-SEASON-038: Time-based modifiers', async () => {
      const now = new Date();
      (mockPrismaClient.seasonModifier.findMany as jest.Mock).mockResolvedValue([
        {
          id: uuidv4(),
          seasonId,
          modifierType: 'TIME_BASED',
          value: 1.5,
          isActive: true,
          startDate: new Date(now.getTime() - 1000),
          endDate: new Date(now.getTime() + 86400000),
        },
      ]);

      const activeModifiers = await rulesService.getActiveModifiers(seasonId);

      expect(activeModifiers.length).toBeGreaterThan(0);
    });

    test('E2E-SEASON-039: Skill group restrictions', async () => {
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({
        id: seasonId,
        skillGroupRestriction: 2,
      });
      (mockPrismaClient.playerSeason.findUnique as jest.Mock)
        .mockResolvedValueOnce({ playerId: player1Id, tier: 'GOLD' })
        .mockResolvedValueOnce({ playerId: player2Id, tier: 'DIAMOND' });

      const canMatch = await rulesService.checkSkillGroupRestriction(
        seasonId,
        player1Id,
        player2Id
      );

      expect(canMatch).toBe(false);
    });

    test('E2E-SEASON-040: Season challenges', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({ id: seasonId });
      (mockPrismaClient.seasonChallenge.create as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        seasonId,
        name: 'Win 10 Games',
        challengeType: 'WINS',
        targetValue: 10,
        rewardId: 'reward_1',
        isActive: true,
      });

      const challenge = await rulesService.createChallenge({
        seasonId,
        name: 'Win 10 Games',
        challengeType: ChallengeType.WINS,
        targetValue: 10,
        rewardId: 'reward_1',
        isActive: true,
      });

      expect(challenge).toBeDefined();
      expect(challenge.name).toBe('Win 10 Games');
    });
  });

  describe('Rewards & Entitlements (FR-041 to FR-048)', () => {
    const seasonId = uuidv4();
    const playerId = uuidv4();

    test('E2E-SEASON-041: Tier-based rewards', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({ id: seasonId });
      (mockPrismaClient.seasonReward.create as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        seasonId,
        tier: 'GOLD',
        rewardType: 'ICON',
        rewardId: 'icon_gold',
        rewardName: 'Gold Icon',
        quantity: 1,
      });

      const reward = await rewardsService.createSeasonReward({
        seasonId,
        tier: RankedTier.GOLD,
        rewardType: RewardType.ICON,
        rewardId: 'icon_gold',
        rewardName: 'Gold Icon',
        rewardDescription: 'Gold tier icon',
        quantity: 1,
      });

      expect(reward).toBeDefined();
      expect(reward.tier).toBe('GOLD');
    });

    test('E2E-SEASON-042: Milestone rewards', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({ id: seasonId });
      (mockPrismaClient.seasonReward.create as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        seasonId,
        tier: 'BRONZE',
        rewardType: 'CURRENCY',
        rewardId: 'milestone_100_games',
        rewardName: '100 Games Reward',
        isMilestoneReward: true,
        milestoneType: 'GAMES_PLAYED',
        milestoneValue: 100,
      });

      const reward = await rewardsService.createMilestoneReward(
        seasonId,
        MilestoneType.GAMES_PLAYED,
        100,
        {
          rewardType: RewardType.CURRENCY,
          rewardId: 'milestone_100_games',
          rewardName: '100 Games Reward',
          rewardDescription: 'Reward for playing 100 games',
          quantity: 500,
        }
      );

      expect(reward).toBeDefined();
      expect(reward.isMilestoneReward).toBe(true);
    });

    test('E2E-SEASON-043: Participation rewards', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({ id: seasonId });
      (mockPrismaClient.seasonReward.create as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        seasonId,
        tier: 'BRONZE',
        rewardType: 'ICON',
        rewardId: 'participation_icon',
        rewardName: 'Participation Icon',
        isParticipationReward: true,
        minGamesRequired: 10,
      });

      const reward = await rewardsService.createParticipationReward(
        seasonId,
        10,
        {
          rewardType: RewardType.ICON,
          rewardId: 'participation_icon',
          rewardName: 'Participation Icon',
          rewardDescription: 'Icon for participating',
          quantity: 1,
        }
      );

      expect(reward).toBeDefined();
      expect(reward.isParticipationReward).toBe(true);
    });

    test('E2E-SEASON-044: Exclusive season items', async () => {
      (mockPrismaClient.seasonReward.findMany as jest.Mock).mockResolvedValue([
        {
          id: uuidv4(),
          seasonId,
          tier: 'CHALLENGER',
          rewardType: 'SKIN',
          rewardId: 'exclusive_skin',
          rewardName: 'Exclusive Skin',
          isExclusive: true,
        },
      ]);

      const exclusiveItems = await rewardsService.getExclusiveSeasonItems(seasonId);

      expect(exclusiveItems).toHaveLength(1);
      expect(exclusiveItems[0].isExclusive).toBe(true);
    });

    test('E2E-SEASON-045: Reward claiming system', async () => {
      (mockPrismaClient.playerReward.findFirst as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        playerId,
        seasonId,
        rewardId: 'reward_1',
        rewardName: 'Test Reward',
        rewardType: 'ICON',
        earnedTier: 'GOLD',
        claimedAt: null,
      });
      (mockPrismaClient.playerReward.update as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        playerId,
        seasonId,
        rewardId: 'reward_1',
        rewardName: 'Test Reward',
        rewardType: 'ICON',
        earnedTier: 'GOLD',
        claimedAt: new Date(),
      });

      const claimed = await rewardsService.claimReward(playerId, 'reward_1');

      expect(claimed).toBeDefined();
      expect(claimed.claimedAt).toBeDefined();
    });

    test('E2E-SEASON-046: Reward preview', async () => {
      (mockPrismaClient.playerSeason.findUnique as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        playerId,
        seasonId,
        tier: 'GOLD',
        wins: 50,
        losses: 30,
      });
      (mockPrismaClient.seasonReward.findMany as jest.Mock).mockResolvedValue([
        {
          id: uuidv4(),
          seasonId,
          tier: 'GOLD',
          rewardType: 'ICON',
          rewardId: 'icon_gold',
          rewardName: 'Gold Icon',
          quantity: 1,
        },
      ]);
      (mockPrismaClient.playerMilestone.findMany as jest.Mock).mockResolvedValue([]);

      const preview = await rewardsService.getRewardPreview(playerId, seasonId);

      expect(preview).toBeDefined();
      expect(preview.eligibleRewards).toBeDefined();
      expect(preview.currentTier).toBe('GOLD');
    });

    test('E2E-SEASON-047: Retroactive rewards', async () => {
      (mockPrismaClient.seasonReward.findFirst as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        seasonId,
        tier: 'GOLD',
        rewardType: 'ICON',
        rewardId: 'new_reward',
        rewardName: 'New Reward',
      });
      (mockPrismaClient.playerSeason.findMany as jest.Mock).mockResolvedValue([
        { playerId, tier: 'GOLD', isPlacementComplete: true },
      ]);
      (mockPrismaClient.playerReward.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaClient.playerReward.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await rewardsService.distributeRetroactiveRewards(seasonId, 'new_reward');

      expect(result.distributed).toBe(1);
      expect(result.players).toContain(playerId);
    });

    test('E2E-SEASON-048: Reward notification', async () => {
      (mockPrismaClient.playerReward.findFirst as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        playerId,
        seasonId,
        rewardId: 'reward_1',
        rewardName: 'Test Reward',
        rewardType: 'ICON',
      });

      const notification = await rewardsService.createRewardNotification(
        playerId,
        'reward_1',
        'EARNED'
      );

      expect(notification).toBeDefined();
      expect(notification.notificationType).toBe('EARNED');
      expect(notification.message).toContain('Test Reward');
    });
  });

  describe('Admin & Governance (FR-049 to FR-052)', () => {
    const seasonId = uuidv4();
    const actorId = uuidv4();

    test('E2E-SEASON-049: Admin dashboard', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({
        id: seasonId,
        number: 1,
        name: 'Season 1',
        state: 'ACTIVE',
      });
      (mockPrismaClient.seasonAnalytics.findUnique as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        seasonId,
        totalPlayers: 1000,
        activePlayers: 500,
      });
      (mockPrismaClient.seasonAuditLog.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrismaClient.playerSeason.count as jest.Mock).mockResolvedValue(1000);
      (mockPrismaClient.playerSeason.findMany as jest.Mock).mockResolvedValue([]);

      const dashboard = await adminService.getDashboardStats(seasonId);

      expect(dashboard).toBeDefined();
      expect(dashboard.season).toBeDefined();
      expect(dashboard.analytics).toBeDefined();
    });

    test('E2E-SEASON-050: Bulk operations', async () => {
      const playerIds = [uuidv4(), uuidv4(), uuidv4()];
      (mockPrismaClient.playerSeason.findMany as jest.Mock).mockResolvedValue(
        playerIds.map((id) => ({
          id: uuidv4(),
          playerId: id,
          seasonId,
          mmr: 1500,
          tier: 'GOLD',
        }))
      );
      (mockPrismaClient.playerSeason.update as jest.Mock).mockResolvedValue({});
      (mockPrismaClient.seasonAuditLog.create as jest.Mock).mockResolvedValue({});

      const result = await adminService.bulkResetPlayers(seasonId, playerIds, actorId);

      expect(result).toBeDefined();
      expect(result.success).toBe(playerIds.length);
    });

    test('E2E-SEASON-051: Season analytics', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({
        id: seasonId,
        number: 1,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });
      (mockPrismaClient.playerSeason.count as jest.Mock).mockResolvedValue(1000);
      (mockPrismaClient.playerSeason.findMany as jest.Mock).mockResolvedValue([
        { tier: 'GOLD', mmr: 1500, wins: 50, losses: 30 },
        { tier: 'SILVER', mmr: 1200, wins: 30, losses: 40 },
      ]);
      (mockPrismaClient.seasonAnalytics.upsert as jest.Mock).mockResolvedValue({
        id: uuidv4(),
        seasonId,
        totalPlayers: 1000,
        activePlayers: 500,
        averageMmr: 1350,
      });

      const analytics = await adminService.calculateSeasonAnalytics(seasonId);

      expect(analytics).toBeDefined();
      expect(analytics.totalPlayers).toBe(1000);
    });

    test('E2E-SEASON-052: Emergency controls', async () => {
      (mockPrismaClient.season.findUnique as jest.Mock).mockResolvedValue({
        id: seasonId,
        state: 'ACTIVE',
        isActive: true,
      });
      (mockPrismaClient.season.update as jest.Mock).mockResolvedValue({
        id: seasonId,
        state: 'PAUSED',
        isActive: false,
      });
      (mockPrismaClient.seasonAuditLog.create as jest.Mock).mockResolvedValue({});

      const result = await adminService.executeEmergencyAction(
        {
          type: 'FREEZE_SEASON',
          seasonId,
          reason: 'Emergency maintenance',
        },
        actorId
      );

      expect(result.success).toBe(true);
    });
  });
});
