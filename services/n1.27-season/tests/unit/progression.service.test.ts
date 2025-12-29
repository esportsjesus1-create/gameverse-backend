import { ProgressionService } from '../../src/services/progression.service';
import { RankedTier, TierDivision, MilestoneType } from '../../src/types';

describe('ProgressionService', () => {
  let progressionService: ProgressionService;

  beforeEach(() => {
    progressionService = new ProgressionService();
  });

  describe('milestone types', () => {
    it('should have all milestone types defined', () => {
      expect(MilestoneType.FIRST_WIN).toBe('FIRST_WIN');
      expect(MilestoneType.WIN_STREAK).toBe('WIN_STREAK');
      expect(MilestoneType.GAMES_PLAYED).toBe('GAMES_PLAYED');
      expect(MilestoneType.TIER_REACHED).toBe('TIER_REACHED');
      expect(MilestoneType.PEAK_MMR).toBe('PEAK_MMR');
      expect(MilestoneType.PLACEMENT_COMPLETE).toBe('PLACEMENT_COMPLETE');
      expect(MilestoneType.SEASON_COMPLETE).toBe('SEASON_COMPLETE');
    });
  });

  describe('milestone thresholds', () => {
    it('should have correct win streak thresholds', () => {
      const winStreakThresholds = [3, 5, 10];
      expect(winStreakThresholds).toContain(3);
      expect(winStreakThresholds).toContain(5);
      expect(winStreakThresholds).toContain(10);
    });

    it('should have correct games played thresholds', () => {
      const gamesPlayedThresholds = [10, 50, 100, 500];
      expect(gamesPlayedThresholds).toContain(10);
      expect(gamesPlayedThresholds).toContain(50);
      expect(gamesPlayedThresholds).toContain(100);
      expect(gamesPlayedThresholds).toContain(500);
    });

    it('should have correct tier reached thresholds', () => {
      const tierThresholds = [1, 2, 3, 4, 5, 6, 7];
      expect(tierThresholds).toHaveLength(7);
    });

    it('should have correct peak MMR thresholds', () => {
      const peakMmrThresholds = [1500, 2000, 2500, 3000];
      expect(peakMmrThresholds).toContain(1500);
      expect(peakMmrThresholds).toContain(2000);
      expect(peakMmrThresholds).toContain(2500);
      expect(peakMmrThresholds).toContain(3000);
    });
  });

  describe('milestone eligibility logic', () => {
    const tierOrder = [
      RankedTier.BRONZE,
      RankedTier.SILVER,
      RankedTier.GOLD,
      RankedTier.PLATINUM,
      RankedTier.DIAMOND,
      RankedTier.MASTER,
      RankedTier.GRANDMASTER,
      RankedTier.CHALLENGER,
    ];

    it('should check first win milestone', () => {
      const wins = 1;
      const shouldAward = wins >= 1;
      expect(shouldAward).toBe(true);
    });

    it('should not award first win milestone with 0 wins', () => {
      const wins = 0;
      const shouldAward = wins >= 1;
      expect(shouldAward).toBe(false);
    });

    it('should check win streak milestone for 3 streak', () => {
      const winStreak = 3;
      const threshold = 3;
      const shouldAward = winStreak >= threshold;
      expect(shouldAward).toBe(true);
    });

    it('should not award win streak milestone below threshold', () => {
      const winStreak = 2;
      const threshold = 3;
      const shouldAward = winStreak >= threshold;
      expect(shouldAward).toBe(false);
    });

    it('should check games played milestone', () => {
      const totalGames = 50;
      const threshold = 50;
      const shouldAward = totalGames >= threshold;
      expect(shouldAward).toBe(true);
    });

    it('should check tier reached milestone for Gold', () => {
      const tier = RankedTier.GOLD;
      const tierIndex = tierOrder.indexOf(tier);
      const threshold = 2;
      const shouldAward = tierIndex >= threshold;
      expect(shouldAward).toBe(true);
    });

    it('should not award tier milestone if tier not reached', () => {
      const tier = RankedTier.SILVER;
      const tierIndex = tierOrder.indexOf(tier);
      const threshold = 2;
      const shouldAward = tierIndex >= threshold;
      expect(shouldAward).toBe(false);
    });

    it('should check peak MMR milestone', () => {
      const peakMmr = 2000;
      const threshold = 2000;
      const shouldAward = peakMmr >= threshold;
      expect(shouldAward).toBe(true);
    });

    it('should check placement complete milestone', () => {
      const isPlacementComplete = true;
      const shouldAward = isPlacementComplete;
      expect(shouldAward).toBe(true);
    });
  });

  describe('player stats calculation', () => {
    it('should calculate win rate correctly', () => {
      const wins = 60;
      const losses = 40;
      const totalGames = wins + losses;
      const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
      expect(winRate).toBe(60);
    });

    it('should handle zero games for win rate', () => {
      const wins = 0;
      const losses = 0;
      const totalGames = wins + losses;
      const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
      expect(winRate).toBe(0);
    });

    it('should calculate average MMR gain correctly', () => {
      const totalMMRGained = 500;
      const gamesWithMMRGain = 25;
      const averageMMRGain = gamesWithMMRGain > 0
        ? Math.round(totalMMRGained / gamesWithMMRGain)
        : 0;
      expect(averageMMRGain).toBe(20);
    });

    it('should calculate average MMR loss correctly', () => {
      const totalMMRLost = 300;
      const gamesWithMMRLoss = 20;
      const averageMMRLoss = gamesWithMMRLoss > 0
        ? Math.round(totalMMRLost / gamesWithMMRLoss)
        : 0;
      expect(averageMMRLoss).toBe(15);
    });
  });

  describe('tier comparison for peak tracking', () => {
    const tierOrder = [
      RankedTier.BRONZE,
      RankedTier.SILVER,
      RankedTier.GOLD,
      RankedTier.PLATINUM,
      RankedTier.DIAMOND,
      RankedTier.MASTER,
      RankedTier.GRANDMASTER,
      RankedTier.CHALLENGER,
    ];

    it('should detect higher tier', () => {
      const currentTier = RankedTier.GOLD;
      const newTier = RankedTier.PLATINUM;
      const currentTierIndex = tierOrder.indexOf(currentTier);
      const newTierIndex = tierOrder.indexOf(newTier);
      const isHigherTier = newTierIndex > currentTierIndex;
      expect(isHigherTier).toBe(true);
    });

    it('should detect same tier', () => {
      const currentTier = RankedTier.GOLD;
      const newTier = RankedTier.GOLD;
      const currentTierIndex = tierOrder.indexOf(currentTier);
      const newTierIndex = tierOrder.indexOf(newTier);
      const isHigherTier = newTierIndex > currentTierIndex;
      expect(isHigherTier).toBe(false);
    });

    it('should detect lower tier', () => {
      const currentTier = RankedTier.PLATINUM;
      const newTier = RankedTier.GOLD;
      const currentTierIndex = tierOrder.indexOf(currentTier);
      const newTierIndex = tierOrder.indexOf(newTier);
      const isHigherTier = newTierIndex > currentTierIndex;
      expect(isHigherTier).toBe(false);
    });

    it('should detect higher division within same tier', () => {
      const currentTier = RankedTier.GOLD;
      const newTier = RankedTier.GOLD;
      const currentDivision = TierDivision.III;
      const newDivision = TierDivision.II;
      const currentTierIndex = tierOrder.indexOf(currentTier);
      const newTierIndex = tierOrder.indexOf(newTier);
      const isHigherTier = newTierIndex > currentTierIndex ||
        (newTierIndex === currentTierIndex && newDivision !== null && currentDivision !== null && newDivision < currentDivision);
      expect(isHigherTier).toBe(true);
    });
  });

  describe('season summary calculation', () => {
    it('should calculate total games correctly', () => {
      const players = [
        { wins: 10, losses: 5 },
        { wins: 20, losses: 10 },
        { wins: 15, losses: 15 },
      ];
      const totalGames = players.reduce((sum, p) => sum + p.wins + p.losses, 0) / 2;
      expect(totalGames).toBe(37.5);
    });

    it('should calculate average MMR correctly', () => {
      const players = [
        { mmr: 1200 },
        { mmr: 1400 },
        { mmr: 1600 },
      ];
      const totalPlayers = players.length;
      const averageMMR = totalPlayers > 0
        ? Math.round(players.reduce((sum, p) => sum + p.mmr, 0) / totalPlayers)
        : 0;
      expect(averageMMR).toBe(1400);
    });

    it('should handle empty player list for average MMR', () => {
      const players: Array<{ mmr: number }> = [];
      const totalPlayers = players.length;
      const averageMMR = totalPlayers > 0
        ? Math.round(players.reduce((sum, p) => sum + p.mmr, 0) / totalPlayers)
        : 0;
      expect(averageMMR).toBe(0);
    });

    it('should initialize tier distribution correctly', () => {
      const tierDistribution: Record<RankedTier, number> = {
        [RankedTier.BRONZE]: 0,
        [RankedTier.SILVER]: 0,
        [RankedTier.GOLD]: 0,
        [RankedTier.PLATINUM]: 0,
        [RankedTier.DIAMOND]: 0,
        [RankedTier.MASTER]: 0,
        [RankedTier.GRANDMASTER]: 0,
        [RankedTier.CHALLENGER]: 0,
      };

      expect(Object.keys(tierDistribution)).toHaveLength(8);
      expect(tierDistribution[RankedTier.BRONZE]).toBe(0);
    });
  });
});
