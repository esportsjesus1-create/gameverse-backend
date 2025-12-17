import { MMRService } from '../../src/services/mmr.service';

describe('MMRService', () => {
  let mmrService: MMRService;

  beforeEach(() => {
    mmrService = new MMRService();
  });

  describe('calculateMMRChange', () => {
    it('should increase MMR on win against equal opponent', () => {
      const result = mmrService.calculateMMRChange({
        playerMmr: 1200,
        opponentMmr: 1200,
        isWin: true,
        kFactor: 32,
        gamesPlayed: 50,
        winStreak: 0,
        lossStreak: 0,
      });

      expect(result.newMmr).toBeGreaterThan(1200);
      expect(result.mmrChange).toBeGreaterThan(0);
      expect(result.expectedScore).toBeCloseTo(0.5, 2);
      expect(result.actualScore).toBe(1);
    });

    it('should decrease MMR on loss against equal opponent', () => {
      const result = mmrService.calculateMMRChange({
        playerMmr: 1200,
        opponentMmr: 1200,
        isWin: false,
        kFactor: 32,
        gamesPlayed: 50,
        winStreak: 0,
        lossStreak: 0,
      });

      expect(result.newMmr).toBeLessThan(1200);
      expect(result.mmrChange).toBeLessThan(0);
      expect(result.actualScore).toBe(0);
    });

    it('should give more MMR for beating higher rated opponent', () => {
      const resultVsHigher = mmrService.calculateMMRChange({
        playerMmr: 1200,
        opponentMmr: 1400,
        isWin: true,
        kFactor: 32,
        gamesPlayed: 50,
        winStreak: 0,
        lossStreak: 0,
      });

      const resultVsEqual = mmrService.calculateMMRChange({
        playerMmr: 1200,
        opponentMmr: 1200,
        isWin: true,
        kFactor: 32,
        gamesPlayed: 50,
        winStreak: 0,
        lossStreak: 0,
      });

      expect(resultVsHigher.mmrChange).toBeGreaterThan(resultVsEqual.mmrChange);
    });

    it('should lose less MMR when losing to higher rated opponent', () => {
      const resultVsHigher = mmrService.calculateMMRChange({
        playerMmr: 1200,
        opponentMmr: 1400,
        isWin: false,
        kFactor: 32,
        gamesPlayed: 50,
        winStreak: 0,
        lossStreak: 0,
      });

      const resultVsEqual = mmrService.calculateMMRChange({
        playerMmr: 1200,
        opponentMmr: 1200,
        isWin: false,
        kFactor: 32,
        gamesPlayed: 50,
        winStreak: 0,
        lossStreak: 0,
      });

      expect(Math.abs(resultVsHigher.mmrChange)).toBeLessThan(Math.abs(resultVsEqual.mmrChange));
    });

    it('should apply win streak bonus', () => {
      const resultNoStreak = mmrService.calculateMMRChange({
        playerMmr: 1200,
        opponentMmr: 1200,
        isWin: true,
        kFactor: 32,
        gamesPlayed: 50,
        winStreak: 0,
        lossStreak: 0,
      });

      const resultWithStreak = mmrService.calculateMMRChange({
        playerMmr: 1200,
        opponentMmr: 1200,
        isWin: true,
        kFactor: 32,
        gamesPlayed: 50,
        winStreak: 5,
        lossStreak: 0,
      });

      expect(resultWithStreak.mmrChange).toBeGreaterThan(resultNoStreak.mmrChange);
    });

    it('should apply loss streak penalty', () => {
      const resultNoStreak = mmrService.calculateMMRChange({
        playerMmr: 1200,
        opponentMmr: 1200,
        isWin: false,
        kFactor: 32,
        gamesPlayed: 50,
        winStreak: 0,
        lossStreak: 0,
      });

      const resultWithStreak = mmrService.calculateMMRChange({
        playerMmr: 1200,
        opponentMmr: 1200,
        isWin: false,
        kFactor: 32,
        gamesPlayed: 50,
        winStreak: 0,
        lossStreak: 5,
      });

      expect(Math.abs(resultWithStreak.mmrChange)).toBeGreaterThan(Math.abs(resultNoStreak.mmrChange));
    });

    it('should clamp MMR to min/max bounds', () => {
      const resultAtMin = mmrService.calculateMMRChange({
        playerMmr: 10,
        opponentMmr: 1200,
        isWin: false,
        kFactor: 32,
        gamesPlayed: 50,
        winStreak: 0,
        lossStreak: 0,
      });

      expect(resultAtMin.newMmr).toBeGreaterThanOrEqual(0);

      const resultAtMax = mmrService.calculateMMRChange({
        playerMmr: 4990,
        opponentMmr: 1200,
        isWin: true,
        kFactor: 32,
        gamesPlayed: 50,
        winStreak: 0,
        lossStreak: 0,
      });

      expect(resultAtMax.newMmr).toBeLessThanOrEqual(5000);
    });

    it('should ensure minimum gain of 1 on win', () => {
      const result = mmrService.calculateMMRChange({
        playerMmr: 2000,
        opponentMmr: 800,
        isWin: true,
        kFactor: 16,
        gamesPlayed: 100,
        winStreak: 0,
        lossStreak: 0,
      });

      expect(result.mmrChange).toBeGreaterThanOrEqual(1);
    });

    it('should ensure minimum loss of 1 on loss', () => {
      const result = mmrService.calculateMMRChange({
        playerMmr: 800,
        opponentMmr: 2000,
        isWin: false,
        kFactor: 16,
        gamesPlayed: 100,
        winStreak: 0,
        lossStreak: 0,
      });

      expect(result.mmrChange).toBeLessThanOrEqual(-1);
    });
  });

  describe('calculateSoftReset', () => {
    it('should apply soft reset with 0.5 factor', () => {
      const result = mmrService.calculateSoftReset({
        currentMmr: 2000,
        baseMmr: 1200,
        resetFactor: 0.5,
      });

      expect(result).toBe(1600);
    });

    it('should apply soft reset with 0.75 factor', () => {
      const result = mmrService.calculateSoftReset({
        currentMmr: 2000,
        baseMmr: 1200,
        resetFactor: 0.75,
      });

      expect(result).toBe(1800);
    });

    it('should apply soft reset with 0.25 factor', () => {
      const result = mmrService.calculateSoftReset({
        currentMmr: 2000,
        baseMmr: 1200,
        resetFactor: 0.25,
      });

      expect(result).toBe(1400);
    });

    it('should clamp result to min/max bounds', () => {
      const resultMin = mmrService.calculateSoftReset({
        currentMmr: 100,
        baseMmr: -500,
        resetFactor: 0.5,
      });

      expect(resultMin).toBeGreaterThanOrEqual(0);

      const resultMax = mmrService.calculateSoftReset({
        currentMmr: 6000,
        baseMmr: 5000,
        resetFactor: 0.5,
      });

      expect(resultMax).toBeLessThanOrEqual(5000);
    });

    it('should handle low MMR players', () => {
      const result = mmrService.calculateSoftReset({
        currentMmr: 600,
        baseMmr: 1200,
        resetFactor: 0.5,
      });

      expect(result).toBe(900);
    });
  });

  describe('calculatePlacementMMR', () => {
    it('should calculate placement MMR for new player with 50% win rate', () => {
      const result = mmrService.calculatePlacementMMR(5, 5, null);

      expect(result).toBe(1200);
    });

    it('should give higher MMR for better placement performance', () => {
      const result = mmrService.calculatePlacementMMR(8, 2, null);

      expect(result).toBeGreaterThan(1200);
    });

    it('should give lower MMR for worse placement performance', () => {
      const result = mmrService.calculatePlacementMMR(2, 8, null);

      expect(result).toBeLessThan(1200);
    });

    it('should factor in previous season MMR', () => {
      const resultWithPrevious = mmrService.calculatePlacementMMR(5, 5, 2000);
      const resultWithoutPrevious = mmrService.calculatePlacementMMR(5, 5, null);

      expect(resultWithPrevious).toBeGreaterThan(resultWithoutPrevious);
    });

    it('should clamp result to bounds', () => {
      const resultHigh = mmrService.calculatePlacementMMR(10, 0, 4500);
      expect(resultHigh).toBeLessThanOrEqual(5000);

      const resultLow = mmrService.calculatePlacementMMR(0, 10, 200);
      expect(resultLow).toBeGreaterThanOrEqual(0);
    });
  });
});
