import { PityService } from '../../src/services/pity.service';
import { BannerType, PityConfig, Rarity } from '../../src/types';

jest.mock('../../src/repositories', () => ({
  PlayerPityRepository: jest.fn().mockImplementation(() => ({
    findByPlayerAndBannerType: jest.fn(),
    findByPlayer: jest.fn(),
    incrementPity: jest.fn(),
    resetPity: jest.fn(),
    getPityState: jest.fn(),
  })),
}));

describe('PityService', () => {
  let pityService: PityService;

  const defaultPityConfig: PityConfig = {
    softPityStart: 74,
    hardPity: 90,
    softPityRateIncrease: 0.06,
    guaranteedFeaturedAfterLoss: true,
  };

  const mockPlayerId = '123e4567-e89b-12d3-a456-426614174000';
  const mockBannerType = BannerType.LIMITED;

  beforeEach(() => {
    jest.clearAllMocks();
    pityService = new PityService();
  });

  describe('checkPity', () => {
    it('should correctly identify when not in soft pity', async () => {
      const mockState = {
        playerId: mockPlayerId,
        bannerType: mockBannerType,
        pityCounter: 50,
        guaranteedFeatured: false,
        lastPullTimestamp: null,
      };

      jest
        .spyOn(pityService, 'getPityState')
        .mockResolvedValue(mockState);

      const result = await pityService.checkPity(
        mockPlayerId,
        mockBannerType,
        defaultPityConfig
      );

      expect(result.isSoftPity).toBe(false);
      expect(result.isHardPity).toBe(false);
      expect(result.currentPity).toBe(50);
      expect(result.pullsUntilSoftPity).toBe(24);
      expect(result.pullsUntilHardPity).toBe(39);
    });

    it('should correctly identify soft pity', async () => {
      const mockState = {
        playerId: mockPlayerId,
        bannerType: mockBannerType,
        pityCounter: 75,
        guaranteedFeatured: false,
        lastPullTimestamp: null,
      };

      jest
        .spyOn(pityService, 'getPityState')
        .mockResolvedValue(mockState);

      const result = await pityService.checkPity(
        mockPlayerId,
        mockBannerType,
        defaultPityConfig
      );

      expect(result.isSoftPity).toBe(true);
      expect(result.isHardPity).toBe(false);
      expect(result.pullsUntilSoftPity).toBe(0);
    });

    it('should correctly identify hard pity', async () => {
      const mockState = {
        playerId: mockPlayerId,
        bannerType: mockBannerType,
        pityCounter: 89,
        guaranteedFeatured: false,
        lastPullTimestamp: null,
      };

      jest
        .spyOn(pityService, 'getPityState')
        .mockResolvedValue(mockState);

      const result = await pityService.checkPity(
        mockPlayerId,
        mockBannerType,
        defaultPityConfig
      );

      expect(result.isHardPity).toBe(true);
      expect(result.isSoftPity).toBe(true);
      expect(result.pullsUntilHardPity).toBe(0);
    });

    it('should return guaranteed featured status', async () => {
      const mockState = {
        playerId: mockPlayerId,
        bannerType: mockBannerType,
        pityCounter: 0,
        guaranteedFeatured: true,
        lastPullTimestamp: null,
      };

      jest
        .spyOn(pityService, 'getPityState')
        .mockResolvedValue(mockState);

      const result = await pityService.checkPity(
        mockPlayerId,
        mockBannerType,
        defaultPityConfig
      );

      expect(result.guaranteedFeatured).toBe(true);
    });
  });

  describe('calculatePityProgress', () => {
    it('should calculate correct progress percentages', () => {
      const result = pityService.calculatePityProgress(37, defaultPityConfig);

      expect(result.softPityProgress).toBe(50);
      expect(result.hardPityProgress).toBeCloseTo(41.11, 1);
      expect(result.inSoftPity).toBe(false);
    });

    it('should cap progress at 100%', () => {
      const result = pityService.calculatePityProgress(100, defaultPityConfig);

      expect(result.softPityProgress).toBe(100);
      expect(result.hardPityProgress).toBe(100);
      expect(result.inSoftPity).toBe(true);
    });

    it('should correctly identify when in soft pity', () => {
      const result = pityService.calculatePityProgress(74, defaultPityConfig);

      expect(result.inSoftPity).toBe(true);
    });

    it('should correctly identify when not in soft pity', () => {
      const result = pityService.calculatePityProgress(73, defaultPityConfig);

      expect(result.inSoftPity).toBe(false);
    });
  });

  describe('processPullResult', () => {
    it('should reset pity on legendary pull', async () => {
      const mockResetState = {
        playerId: mockPlayerId,
        bannerType: mockBannerType,
        pityCounter: 0,
        guaranteedFeatured: false,
        lastPullTimestamp: new Date(),
      };

      jest
        .spyOn(pityService, 'getPityState')
        .mockResolvedValue({
          playerId: mockPlayerId,
          bannerType: mockBannerType,
          pityCounter: 50,
          guaranteedFeatured: false,
          lastPullTimestamp: null,
        });

      jest
        .spyOn(pityService, 'resetPity')
        .mockResolvedValue(mockResetState);

      const result = await pityService.processPullResult(
        mockPlayerId,
        mockBannerType,
        Rarity.LEGENDARY,
        true,
        defaultPityConfig
      );

      expect(result.pityCounter).toBe(0);
    });

    it('should set guaranteed featured when losing 50/50', async () => {
      const mockResetState = {
        playerId: mockPlayerId,
        bannerType: mockBannerType,
        pityCounter: 0,
        guaranteedFeatured: true,
        lastPullTimestamp: new Date(),
      };

      jest
        .spyOn(pityService, 'getPityState')
        .mockResolvedValue({
          playerId: mockPlayerId,
          bannerType: mockBannerType,
          pityCounter: 50,
          guaranteedFeatured: false,
          lastPullTimestamp: null,
        });

      jest
        .spyOn(pityService, 'resetPity')
        .mockResolvedValue(mockResetState);

      await pityService.processPullResult(
        mockPlayerId,
        mockBannerType,
        Rarity.LEGENDARY,
        false,
        defaultPityConfig
      );

      expect(pityService.resetPity).toHaveBeenCalledWith(
        mockPlayerId,
        mockBannerType,
        true
      );
    });

    it('should increment pity on non-legendary pull', async () => {
      const mockIncrementState = {
        playerId: mockPlayerId,
        bannerType: mockBannerType,
        pityCounter: 51,
        guaranteedFeatured: false,
        lastPullTimestamp: new Date(),
      };

      jest
        .spyOn(pityService, 'incrementPity')
        .mockResolvedValue(mockIncrementState);

      const result = await pityService.processPullResult(
        mockPlayerId,
        mockBannerType,
        Rarity.RARE,
        false,
        defaultPityConfig
      );

      expect(result.pityCounter).toBe(51);
    });
  });
});
