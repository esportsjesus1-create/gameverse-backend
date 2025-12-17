import { BenefitsService } from '../../src/services/benefitsService';
import { pool } from '../../src/config/database';
import { cacheGet, cacheSet, cacheDelete } from '../../src/config/redis';
import { BenefitType, PartyStatus } from '../../src/types';

jest.mock('../../src/services/partyService', () => ({
  partyService: {
    getParty: jest.fn(),
    getPartyMemberCount: jest.fn(),
  },
}));

import { partyService } from '../../src/services/partyService';

describe('BenefitsService', () => {
  let benefitsService: BenefitsService;
  const mockPartyId = '123e4567-e89b-12d3-a456-426614174000';
  const mockBenefitId = '123e4567-e89b-12d3-a456-426614174001';

  beforeEach(() => {
    benefitsService = new BenefitsService();
    jest.clearAllMocks();
  });

  describe('getAllBenefits', () => {
    it('should return all active benefits', async () => {
      const mockBenefits = [
        { id: '1', name: 'XP Boost', description: 'Bonus XP', type: BenefitType.XP_MULTIPLIER, value: '1.25', min_party_size: 2, max_party_size: null, is_active: true },
        { id: '2', name: 'Loot Bonus', description: 'More loot', type: BenefitType.LOOT_BONUS, value: '0.15', min_party_size: 3, max_party_size: null, is_active: true },
      ];

      (pool.query as jest.Mock).mockResolvedValue({ rows: mockBenefits });

      const result = await benefitsService.getAllBenefits();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('XP Boost');
      expect(result[1].name).toBe('Loot Bonus');
    });
  });

  describe('getBenefit', () => {
    it('should return a specific benefit', async () => {
      const mockBenefit = {
        id: mockBenefitId,
        name: 'XP Boost',
        description: 'Bonus XP',
        type: BenefitType.XP_MULTIPLIER,
        value: '1.25',
        min_party_size: 2,
        max_party_size: null,
        is_active: true,
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockBenefit] });

      const result = await benefitsService.getBenefit(mockBenefitId);

      expect(result).toBeDefined();
      expect(result?.name).toBe('XP Boost');
      expect(result?.value).toBe(1.25);
    });

    it('should return null if benefit not found', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await benefitsService.getBenefit(mockBenefitId);

      expect(result).toBeNull();
    });
  });

  describe('getApplicableBenefits', () => {
    it('should return benefits applicable for party size', async () => {
      const mockBenefits = [
        { id: '1', name: 'Duo XP Boost', description: 'Bonus XP for 2 players', type: BenefitType.XP_MULTIPLIER, value: '1.1', min_party_size: 2, max_party_size: 2, is_active: true },
        { id: '2', name: 'Party Loot', description: 'More loot', type: BenefitType.LOOT_BONUS, value: '0.15', min_party_size: 2, max_party_size: null, is_active: true },
      ];

      (pool.query as jest.Mock).mockResolvedValue({ rows: mockBenefits });

      const result = await benefitsService.getApplicableBenefits(2);

      expect(result).toHaveLength(2);
    });
  });

  describe('calculatePartyBenefits', () => {
    it('should calculate benefits from cache if available', async () => {
      const cachedBenefits = {
        xpMultiplier: 1.25,
        lootBonus: 0.15,
        achievementBonus: 0.2,
        dropRateBonus: 0.1,
        exclusiveRewards: ['Party Skin'],
        totalBonusPercentage: 70,
      };

      (cacheGet as jest.Mock).mockResolvedValue(cachedBenefits);

      const result = await benefitsService.calculatePartyBenefits(mockPartyId);

      expect(result).toEqual(cachedBenefits);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should calculate benefits from database if not cached', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leaderId: '123e4567-e89b-12d3-a456-426614174002',
        maxSize: 4,
        status: PartyStatus.ACTIVE,
      };

      const mockBenefits = [
        { id: '1', name: 'XP Boost', description: 'Bonus XP', type: BenefitType.XP_MULTIPLIER, value: '1.25', min_party_size: 2, max_party_size: null, is_active: true },
        { id: '2', name: 'Loot Bonus', description: 'More loot', type: BenefitType.LOOT_BONUS, value: '0.15', min_party_size: 2, max_party_size: null, is_active: true },
      ];

      (cacheGet as jest.Mock).mockResolvedValue(null);
      (partyService.getParty as jest.Mock).mockResolvedValue(mockParty);
      (partyService.getPartyMemberCount as jest.Mock).mockResolvedValue(3);
      (pool.query as jest.Mock).mockResolvedValue({ rows: mockBenefits });

      const result = await benefitsService.calculatePartyBenefits(mockPartyId);

      expect(result.xpMultiplier).toBe(1.25);
      expect(result.lootBonus).toBe(0.15);
      expect(cacheSet).toHaveBeenCalled();
    });

    it('should throw error if party not found', async () => {
      (cacheGet as jest.Mock).mockResolvedValue(null);
      (partyService.getParty as jest.Mock).mockResolvedValue(null);

      await expect(
        benefitsService.calculatePartyBenefits(mockPartyId)
      ).rejects.toThrow('Party not found');
    });
  });

  describe('applyXPBonus', () => {
    it('should calculate XP bonus correctly', async () => {
      const cachedBenefits = {
        xpMultiplier: 1.25,
        lootBonus: 0.15,
        achievementBonus: 0.2,
        dropRateBonus: 0.1,
        exclusiveRewards: [],
        totalBonusPercentage: 70,
      };

      (cacheGet as jest.Mock).mockResolvedValue(cachedBenefits);

      const result = await benefitsService.applyXPBonus(mockPartyId, 1000);

      expect(result.baseXP).toBe(1000);
      expect(result.bonusXP).toBe(250);
      expect(result.totalXP).toBe(1250);
      expect(result.multiplier).toBe(1.25);
    });
  });

  describe('applyLootBonus', () => {
    it('should calculate loot bonus correctly', async () => {
      const cachedBenefits = {
        xpMultiplier: 1.25,
        lootBonus: 0.15,
        achievementBonus: 0.2,
        dropRateBonus: 0.1,
        exclusiveRewards: [],
        totalBonusPercentage: 70,
      };

      (cacheGet as jest.Mock).mockResolvedValue(cachedBenefits);

      const result = await benefitsService.applyLootBonus(mockPartyId, 0.5);

      expect(result.baseChance).toBe(0.5);
      expect(result.bonusChance).toBe(0.075);
      expect(result.totalChance).toBe(0.575);
    });

    it('should cap total chance at 1.0', async () => {
      const cachedBenefits = {
        xpMultiplier: 1.25,
        lootBonus: 0.5,
        achievementBonus: 0.2,
        dropRateBonus: 0.1,
        exclusiveRewards: [],
        totalBonusPercentage: 105,
      };

      (cacheGet as jest.Mock).mockResolvedValue(cachedBenefits);

      const result = await benefitsService.applyLootBonus(mockPartyId, 0.9);

      expect(result.totalChance).toBe(1.0);
    });
  });

  describe('applyDropRateBonus', () => {
    it('should calculate drop rate bonus correctly', async () => {
      const cachedBenefits = {
        xpMultiplier: 1.25,
        lootBonus: 0.15,
        achievementBonus: 0.2,
        dropRateBonus: 0.1,
        exclusiveRewards: [],
        totalBonusPercentage: 70,
      };

      (cacheGet as jest.Mock).mockResolvedValue(cachedBenefits);

      const result = await benefitsService.applyDropRateBonus(mockPartyId, 0.05);

      expect(result.baseRate).toBe(0.05);
      expect(result.bonusRate).toBe(0.005);
      expect(result.totalRate).toBe(0.055);
    });
  });

  describe('applyAchievementBonus', () => {
    it('should calculate achievement bonus correctly', async () => {
      const cachedBenefits = {
        xpMultiplier: 1.25,
        lootBonus: 0.15,
        achievementBonus: 0.2,
        dropRateBonus: 0.1,
        exclusiveRewards: [],
        totalBonusPercentage: 70,
      };

      (cacheGet as jest.Mock).mockResolvedValue(cachedBenefits);

      const result = await benefitsService.applyAchievementBonus(mockPartyId, 100);

      expect(result.baseProgress).toBe(100);
      expect(result.bonusProgress).toBe(20);
      expect(result.totalProgress).toBe(120);
    });
  });

  describe('getExclusiveRewards', () => {
    it('should return exclusive rewards', async () => {
      const cachedBenefits = {
        xpMultiplier: 1.25,
        lootBonus: 0.15,
        achievementBonus: 0.2,
        dropRateBonus: 0.1,
        exclusiveRewards: ['Party Skin', 'Special Badge'],
        totalBonusPercentage: 70,
      };

      (cacheGet as jest.Mock).mockResolvedValue(cachedBenefits);

      const result = await benefitsService.getExclusiveRewards(mockPartyId);

      expect(result).toEqual(['Party Skin', 'Special Badge']);
    });
  });

  describe('getNextTierBenefits', () => {
    it('should return benefits for next tier', async () => {
      const mockBenefits = [
        { id: '1', name: 'Squad XP Boost', description: 'Bonus XP for 3+ players', type: BenefitType.XP_MULTIPLIER, value: '1.25', min_party_size: 3, max_party_size: null, is_active: true },
      ];

      (pool.query as jest.Mock).mockResolvedValue({ rows: mockBenefits });

      const result = await benefitsService.getNextTierBenefits(2);

      expect(result).toHaveLength(1);
      expect(result[0].minPartySize).toBe(3);
    });

    it('should return empty array if no next tier', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await benefitsService.getNextTierBenefits(10);

      expect(result).toHaveLength(0);
    });
  });

  describe('getPartyBenefitsSummary', () => {
    it('should return complete benefits summary', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leaderId: '123e4567-e89b-12d3-a456-426614174002',
        maxSize: 4,
        status: PartyStatus.ACTIVE,
      };

      const cachedBenefits = {
        xpMultiplier: 1.25,
        lootBonus: 0.15,
        achievementBonus: 0.2,
        dropRateBonus: 0.1,
        exclusiveRewards: [],
        totalBonusPercentage: 70,
      };

      const mockApplicableBenefits = [
        { id: '1', name: 'XP Boost', description: 'Bonus XP', type: BenefitType.XP_MULTIPLIER, value: '1.25', min_party_size: 2, max_party_size: null, is_active: true },
      ];

      const mockNextTierBenefits = [
        { id: '2', name: 'Raid XP Boost', description: 'Bonus XP for 5+ players', type: BenefitType.XP_MULTIPLIER, value: '1.5', min_party_size: 5, max_party_size: null, is_active: true },
      ];

      (partyService.getParty as jest.Mock).mockResolvedValue(mockParty);
      (partyService.getPartyMemberCount as jest.Mock).mockResolvedValue(3);
      (cacheGet as jest.Mock).mockResolvedValue(cachedBenefits);
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: mockApplicableBenefits })
        .mockResolvedValueOnce({ rows: mockNextTierBenefits });

      const result = await benefitsService.getPartyBenefitsSummary(mockPartyId);

      expect(result.partySize).toBe(3);
      expect(result.benefits).toEqual(cachedBenefits);
      expect(result.applicableBenefits).toHaveLength(1);
      expect(result.nextTierBenefits).toHaveLength(1);
    });
  });

  describe('invalidatePartyBenefitsCache', () => {
    it('should delete cached benefits', async () => {
      await benefitsService.invalidatePartyBenefitsCache(mockPartyId);

      expect(cacheDelete).toHaveBeenCalledWith(`party:${mockPartyId}:benefits`);
    });
  });

  describe('createBenefit', () => {
    it('should create a new benefit', async () => {
      const newBenefit = {
        name: 'New Benefit',
        description: 'A new benefit',
        type: BenefitType.XP_MULTIPLIER,
        value: 1.5,
        minPartySize: 4,
        maxPartySize: undefined,
        isActive: true,
      };

      const createdBenefit = {
        id: mockBenefitId,
        name: 'New Benefit',
        description: 'A new benefit',
        type: BenefitType.XP_MULTIPLIER,
        value: '1.5',
        min_party_size: 4,
        max_party_size: null,
        is_active: true,
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [createdBenefit] });

      const result = await benefitsService.createBenefit(newBenefit);

      expect(result.name).toBe('New Benefit');
      expect(result.value).toBe(1.5);
    });
  });

  describe('updateBenefit', () => {
    it('should update an existing benefit', async () => {
      const existingBenefit = {
        id: mockBenefitId,
        name: 'Old Name',
        description: 'Old description',
        type: BenefitType.XP_MULTIPLIER,
        value: '1.25',
        min_party_size: 2,
        max_party_size: null,
        is_active: true,
      };

      const updatedBenefit = {
        ...existingBenefit,
        name: 'New Name',
        value: '1.5',
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [existingBenefit] })
        .mockResolvedValueOnce({ rows: [updatedBenefit] });

      const result = await benefitsService.updateBenefit(mockBenefitId, { name: 'New Name', value: 1.5 });

      expect(result.name).toBe('New Name');
      expect(result.value).toBe(1.5);
    });

    it('should throw error if benefit not found', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(
        benefitsService.updateBenefit(mockBenefitId, { name: 'New Name' })
      ).rejects.toThrow('Benefit not found');
    });
  });

  describe('toggleBenefitActive', () => {
    it('should toggle benefit active status', async () => {
      const updatedBenefit = {
        id: mockBenefitId,
        name: 'Test Benefit',
        description: 'Test',
        type: BenefitType.XP_MULTIPLIER,
        value: '1.25',
        min_party_size: 2,
        max_party_size: null,
        is_active: false,
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [updatedBenefit] });

      const result = await benefitsService.toggleBenefitActive(mockBenefitId, false);

      expect(result.isActive).toBe(false);
    });

    it('should throw error if benefit not found', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(
        benefitsService.toggleBenefitActive(mockBenefitId, false)
      ).rejects.toThrow('Benefit not found');
    });
  });
});
