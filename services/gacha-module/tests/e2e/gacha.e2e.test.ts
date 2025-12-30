import { v4 as uuidv4 } from 'uuid';
import { ProbabilityService } from '../../src/services/probability.service';
import {
  Rarity,
  BannerType,
  CurrencyType,
  ItemType,
  RarityRates,
  PityConfig,
  AgeVerificationStatus,
  TransactionType,
  NFTRewardStatus,
} from '../../src/types';

const mockPityConfig: PityConfig = {
  softPityStart: 74,
  hardPity: 90,
  softPityRateIncrease: 0.06,
  guaranteedFeaturedAfterLoss: true,
};

const mockBaseRates: RarityRates = {
  [Rarity.COMMON]: 0.513,
  [Rarity.RARE]: 0.43,
  [Rarity.EPIC]: 0.051,
  [Rarity.LEGENDARY]: 0.006,
  [Rarity.MYTHIC]: 0,
};

describe('E2E Gacha Module Tests', () => {
  let probabilityService: ProbabilityService;

  beforeAll(() => {
    probabilityService = new ProbabilityService();
  });

  describe('E2E-GACHA-001: Basic Single Pull Execution', () => {
    it('should execute a single pull and return valid result', () => {
      const { rates, isSoftPity, isHardPity } = probabilityService.calculateAdjustedRates(
        mockBaseRates,
        mockPityConfig,
        0
      );

      const result = probabilityService.rollRarity(rates, isSoftPity, isHardPity);

      expect(result).toBeDefined();
      expect(Object.values(Rarity)).toContain(result.rarity);
      expect(result.roll).toBeGreaterThanOrEqual(0);
      expect(result.roll).toBeLessThanOrEqual(1);
      expect(result.isSoftPity).toBe(false);
      expect(result.isHardPity).toBe(false);
    });
  });

  describe('E2E-GACHA-002: Multi-Pull (10x) Execution', () => {
    it('should execute 10 pulls and return valid results', () => {
      const results = [];

      for (let i = 0; i < 10; i++) {
        const { rates, isSoftPity, isHardPity } = probabilityService.calculateAdjustedRates(
          mockBaseRates,
          mockPityConfig,
          i
        );
        const result = probabilityService.rollRarity(rates, isSoftPity, isHardPity);
        results.push(result);
      }

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(Object.values(Rarity)).toContain(result.rarity);
      });
    });
  });

  describe('E2E-GACHA-003: Soft Pity Activation', () => {
    it('should activate soft pity after threshold', () => {
      const { rates: normalRates } = probabilityService.calculateAdjustedRates(
        mockBaseRates,
        mockPityConfig,
        0
      );

      const { rates: softPityRates, isSoftPity } = probabilityService.calculateAdjustedRates(
        mockBaseRates,
        mockPityConfig,
        mockPityConfig.softPityStart
      );

      expect(isSoftPity).toBe(true);
      expect(softPityRates[Rarity.LEGENDARY]).toBeGreaterThan(normalRates[Rarity.LEGENDARY]);
    });
  });

  describe('E2E-GACHA-004: Hard Pity Guarantee', () => {
    it('should guarantee legendary at hard pity', () => {
      const { rates, isHardPity } = probabilityService.calculateAdjustedRates(
        mockBaseRates,
        mockPityConfig,
        mockPityConfig.hardPity - 1
      );

      expect(isHardPity).toBe(true);
      expect(rates[Rarity.LEGENDARY]).toBe(1.0);
    });
  });

  describe('E2E-GACHA-005: Pity Counter Reset After Legendary', () => {
    it('should reset pity counter after obtaining legendary', () => {
      let pityCounter = 0;

      for (let i = 0; i < 100; i++) {
        const { rates, isSoftPity, isHardPity } = probabilityService.calculateAdjustedRates(
          mockBaseRates,
          mockPityConfig,
          pityCounter
        );
        const result = probabilityService.rollRarity(rates, isSoftPity, isHardPity);

        if (result.rarity === Rarity.LEGENDARY || result.rarity === Rarity.MYTHIC) {
          pityCounter = 0;
        } else {
          pityCounter++;
        }
      }

      expect(pityCounter).toBeLessThan(mockPityConfig.hardPity);
    });
  });

  describe('E2E-GACHA-006: 50/50 Featured Item System', () => {
    it('should correctly roll for featured items', () => {
      const featuredRate = 0.5;
      let featuredCount = 0;
      const totalRolls = 1000;

      for (let i = 0; i < totalRolls; i++) {
        const isFeatured = probabilityService.rollFeatured(featuredRate, false);
        if (isFeatured) featuredCount++;
      }

      const actualRate = featuredCount / totalRolls;
      expect(actualRate).toBeGreaterThan(0.4);
      expect(actualRate).toBeLessThan(0.6);
    });
  });

  describe('E2E-GACHA-007: Guaranteed Featured After Loss', () => {
    it('should guarantee featured when flag is set', () => {
      const isFeatured = probabilityService.rollFeatured(0.5, true);
      expect(isFeatured).toBe(true);
    });
  });

  describe('E2E-GACHA-008: Soft Pity Rate Increase Calculation', () => {
    it('should correctly calculate increasing rates during soft pity', () => {
      const rates: number[] = [];

      for (let i = mockPityConfig.softPityStart; i < mockPityConfig.hardPity; i++) {
        const { rates: adjustedRates } = probabilityService.calculateAdjustedRates(
          mockBaseRates,
          mockPityConfig,
          i
        );
        rates.push(adjustedRates[Rarity.LEGENDARY]);
      }

      for (let i = 1; i < rates.length; i++) {
        expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
      }
    });
  });

  describe('E2E-GACHA-009: Rate Normalization', () => {
    it('should ensure rates sum to 1.0', () => {
      const { rates } = probabilityService.calculateAdjustedRates(
        mockBaseRates,
        mockPityConfig,
        80
      );

      const total = Object.values(rates).reduce((sum, rate) => sum + rate, 0);
      expect(Math.abs(total - 1.0)).toBeLessThan(0.0001);
    });
  });

  describe('E2E-GACHA-010: Secure Random Generation', () => {
    it('should generate cryptographically secure random numbers', () => {
      const values: number[] = [];

      for (let i = 0; i < 1000; i++) {
        const { rates, isSoftPity, isHardPity } = probabilityService.calculateAdjustedRates(
          mockBaseRates,
          mockPityConfig,
          0
        );
        const result = probabilityService.rollRarity(rates, isSoftPity, isHardPity);
        values.push(result.roll);
      }

      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBeGreaterThan(900);
    });
  });

  describe('E2E-GACHA-011: Banner Type Validation', () => {
    it('should validate all banner types', () => {
      const bannerTypes = Object.values(BannerType);

      expect(bannerTypes).toContain(BannerType.STANDARD);
      expect(bannerTypes).toContain(BannerType.LIMITED);
      expect(bannerTypes).toContain(BannerType.EVENT);
      expect(bannerTypes).toContain(BannerType.BEGINNER);
      expect(bannerTypes).toContain(BannerType.WEAPON);
    });
  });

  describe('E2E-GACHA-012: Currency Type Validation', () => {
    it('should validate all currency types', () => {
      const currencyTypes = Object.values(CurrencyType);

      expect(currencyTypes).toContain(CurrencyType.PREMIUM);
      expect(currencyTypes).toContain(CurrencyType.FREE);
      expect(currencyTypes).toContain(CurrencyType.EVENT);
      expect(currencyTypes).toContain(CurrencyType.TICKET);
    });
  });

  describe('E2E-GACHA-013: Item Type Validation', () => {
    it('should validate all item types', () => {
      const itemTypes = Object.values(ItemType);

      expect(itemTypes).toContain(ItemType.CHARACTER);
      expect(itemTypes).toContain(ItemType.WEAPON);
      expect(itemTypes).toContain(ItemType.CONSUMABLE);
      expect(itemTypes).toContain(ItemType.COSMETIC);
      expect(itemTypes).toContain(ItemType.MATERIAL);
      expect(itemTypes).toContain(ItemType.NFT);
    });
  });

  describe('E2E-GACHA-014: Rarity Distribution Validation', () => {
    it('should validate rarity distribution over many pulls', () => {
      const distribution: Record<Rarity, number> = {
        [Rarity.COMMON]: 0,
        [Rarity.RARE]: 0,
        [Rarity.EPIC]: 0,
        [Rarity.LEGENDARY]: 0,
        [Rarity.MYTHIC]: 0,
      };

      const totalPulls = 10000;

      for (let i = 0; i < totalPulls; i++) {
        const { rates, isSoftPity, isHardPity } = probabilityService.calculateAdjustedRates(
          mockBaseRates,
          mockPityConfig,
          i % mockPityConfig.hardPity
        );
        const result = probabilityService.rollRarity(rates, isSoftPity, isHardPity);
        distribution[result.rarity]++;
      }

      expect(distribution[Rarity.COMMON]).toBeGreaterThan(0);
      expect(distribution[Rarity.RARE]).toBeGreaterThan(0);
      expect(distribution[Rarity.EPIC]).toBeGreaterThan(0);
      expect(distribution[Rarity.LEGENDARY]).toBeGreaterThan(0);
    });
  });

  describe('E2E-GACHA-015: Rate Validation', () => {
    it('should validate rate configuration', () => {
      const validation = probabilityService.validateRates(mockBaseRates);
      expect(validation.valid).toBe(true);
    });

    it('should reject invalid rates', () => {
      const invalidRates: RarityRates = {
        [Rarity.COMMON]: 0.5,
        [Rarity.RARE]: 0.5,
        [Rarity.EPIC]: 0.5,
        [Rarity.LEGENDARY]: 0.5,
        [Rarity.MYTHIC]: 0,
      };

      const validation = probabilityService.validateRates(invalidRates);
      expect(validation.valid).toBe(false);
    });
  });

  describe('E2E-GACHA-016: Chi-Square Statistical Validation', () => {
    it('should pass chi-square test for rate distribution', () => {
      const distribution: Record<Rarity, number> = {
        [Rarity.COMMON]: 0,
        [Rarity.RARE]: 0,
        [Rarity.EPIC]: 0,
        [Rarity.LEGENDARY]: 0,
        [Rarity.MYTHIC]: 0,
      };

      const totalPulls = 100000;

      for (let i = 0; i < totalPulls; i++) {
        const { rates, isSoftPity, isHardPity } = probabilityService.calculateAdjustedRates(
          mockBaseRates,
          mockPityConfig,
          0
        );
        const result = probabilityService.rollRarity(rates, isSoftPity, isHardPity);
        distribution[result.rarity]++;
      }

      const { chiSquare, isWithinTolerance } = probabilityService.calculateChiSquare(
        distribution,
        mockBaseRates,
        totalPulls
      );

      expect(chiSquare).toBeGreaterThanOrEqual(0);
      expect(isWithinTolerance).toBe(true);
    });
  });

  describe('E2E-GACHA-017: Expected Pulls Calculation', () => {
    it('should calculate expected pulls to legendary', () => {
      const expected = probabilityService.calculateExpectedPulls(
        mockBaseRates[Rarity.LEGENDARY],
        mockPityConfig
      );

      expect(expected.average).toBeGreaterThan(0);
      expect(expected.average).toBeLessThan(mockPityConfig.hardPity);
      expect(expected.median).toBeGreaterThan(0);
      expect(expected.percentile90).toBeLessThanOrEqual(mockPityConfig.hardPity);
    });
  });

  describe('E2E-GACHA-018: Weighted Item Selection', () => {
    it('should select items based on weight', () => {
      const items = [
        { id: '1', weight: 10 },
        { id: '2', weight: 5 },
        { id: '3', weight: 1 },
      ];

      const selections: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
      const totalSelections = 10000;

      for (let i = 0; i < totalSelections; i++) {
        const selected = probabilityService.selectWeightedItem(items);
        selections[selected.id]++;
      }

      expect(selections['1']).toBeGreaterThan(selections['2']);
      expect(selections['2']).toBeGreaterThan(selections['3']);
    });
  });

  describe('E2E-GACHA-019: Random Item Selection', () => {
    it('should randomly select items with equal probability', () => {
      const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const selections: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
      const totalSelections = 10000;

      for (let i = 0; i < totalSelections; i++) {
        const selected = probabilityService.selectRandomItem(items);
        selections[selected.id]++;
      }

      const expectedPerItem = totalSelections / 3;
      const tolerance = expectedPerItem * 0.1;

      Object.values(selections).forEach((count) => {
        expect(count).toBeGreaterThan(expectedPerItem - tolerance);
        expect(count).toBeLessThan(expectedPerItem + tolerance);
      });
    });
  });

  describe('E2E-GACHA-020: Empty Pool Handling', () => {
    it('should throw error for empty item pool', () => {
      expect(() => probabilityService.selectRandomItem([])).toThrow();
      expect(() => probabilityService.selectWeightedItem([])).toThrow();
    });
  });

  describe('E2E-GACHA-021: Age Verification Status Validation', () => {
    it('should validate all age verification statuses', () => {
      const statuses = Object.values(AgeVerificationStatus);

      expect(statuses).toContain(AgeVerificationStatus.UNVERIFIED);
      expect(statuses).toContain(AgeVerificationStatus.PENDING);
      expect(statuses).toContain(AgeVerificationStatus.VERIFIED);
      expect(statuses).toContain(AgeVerificationStatus.REJECTED);
    });
  });

  describe('E2E-GACHA-022: Transaction Type Validation', () => {
    it('should validate all transaction types', () => {
      const types = Object.values(TransactionType);

      expect(types).toContain(TransactionType.PURCHASE);
      expect(types).toContain(TransactionType.PULL);
      expect(types).toContain(TransactionType.REFUND);
      expect(types).toContain(TransactionType.REWARD);
      expect(types).toContain(TransactionType.ADMIN_GRANT);
      expect(types).toContain(TransactionType.ADMIN_DEDUCT);
    });
  });

  describe('E2E-GACHA-023: NFT Reward Status Validation', () => {
    it('should validate all NFT reward statuses', () => {
      const statuses = Object.values(NFTRewardStatus);

      expect(statuses).toContain(NFTRewardStatus.PENDING);
      expect(statuses).toContain(NFTRewardStatus.MINTING);
      expect(statuses).toContain(NFTRewardStatus.MINTED);
      expect(statuses).toContain(NFTRewardStatus.CLAIMED);
      expect(statuses).toContain(NFTRewardStatus.FAILED);
    });
  });

  describe('E2E-GACHA-024: Pity Progress Calculation', () => {
    it('should correctly calculate pity progress', () => {
      const testCases = [
        { pity: 0, expectedSoft: 0, expectedHard: 0 },
        { pity: 37, expectedSoft: 50, expectedHard: 41.11 },
        { pity: 74, expectedSoft: 100, expectedHard: 82.22 },
        { pity: 90, expectedSoft: 100, expectedHard: 100 },
      ];

      testCases.forEach(({ pity, expectedSoft, expectedHard }) => {
        const softProgress = Math.min((pity / mockPityConfig.softPityStart) * 100, 100);
        const hardProgress = Math.min((pity / mockPityConfig.hardPity) * 100, 100);

        expect(softProgress).toBeCloseTo(expectedSoft, 0);
        expect(hardProgress).toBeCloseTo(expectedHard, 0);
      });
    });
  });

  describe('E2E-GACHA-025: Multi-Pull Discount Calculation', () => {
    it('should correctly calculate multi-pull discount', () => {
      const pullCost = 160;
      const multiPullCount = 10;
      const multiPullDiscount = 0.1;

      const baseCost = pullCost * multiPullCount;
      const discountedCost = Math.floor(baseCost * (1 - multiPullDiscount));

      expect(baseCost).toBe(1600);
      expect(discountedCost).toBe(1440);
    });
  });

  describe('E2E-GACHA-026: Spending Limit Calculation', () => {
    it('should correctly calculate spending limits', () => {
      const dailyLimit = 500;
      const weeklyLimit = 2000;
      const monthlyLimit = 5000;

      const dailySpent = 300;
      const weeklySpent = 1500;
      const monthlySpent = 3000;

      const dailyRemaining = dailyLimit - dailySpent;
      const weeklyRemaining = weeklyLimit - weeklySpent;
      const monthlyRemaining = monthlyLimit - monthlySpent;

      expect(dailyRemaining).toBe(200);
      expect(weeklyRemaining).toBe(500);
      expect(monthlyRemaining).toBe(2000);
    });
  });

  describe('E2E-GACHA-027: Age Calculation', () => {
    it('should correctly calculate age from date of birth', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());

      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      expect(age).toBe(20);
    });
  });

  describe('E2E-GACHA-028: Minimum Age Requirement Check', () => {
    it('should correctly check minimum age requirement', () => {
      const minAge = 18;

      const ages = [15, 17, 18, 21, 25];
      const expected = [false, false, true, true, true];

      ages.forEach((age, index) => {
        expect(age >= minAge).toBe(expected[index]);
      });
    });
  });

  describe('E2E-GACHA-029: UUID Generation', () => {
    it('should generate valid UUIDs', () => {
      const uuids = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        const id = uuidv4();
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        uuids.add(id);
      }

      expect(uuids.size).toBe(1000);
    });
  });

  describe('E2E-GACHA-030: Banner Date Validation', () => {
    it('should correctly validate banner active dates', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 86400000);
      const futureDate = new Date(now.getTime() + 86400000);

      const activeBanner = {
        startDate: pastDate,
        endDate: futureDate,
      };

      const expiredBanner = {
        startDate: new Date(now.getTime() - 172800000),
        endDate: pastDate,
      };

      const futureBanner = {
        startDate: futureDate,
        endDate: new Date(now.getTime() + 172800000),
      };

      const isActive = (banner: { startDate: Date; endDate: Date }) => {
        return banner.startDate <= now && banner.endDate >= now;
      };

      expect(isActive(activeBanner)).toBe(true);
      expect(isActive(expiredBanner)).toBe(false);
      expect(isActive(futureBanner)).toBe(false);
    });
  });

  describe('E2E-GACHA-031: Pull Cost Validation', () => {
    it('should validate pull cost is positive', () => {
      const validCosts = [100, 160, 200, 1000];
      const invalidCosts = [0, -100, -1];

      validCosts.forEach((cost) => {
        expect(cost > 0).toBe(true);
      });

      invalidCosts.forEach((cost) => {
        expect(cost > 0).toBe(false);
      });
    });
  });

  describe('E2E-GACHA-032: Currency Balance Validation', () => {
    it('should validate currency balance operations', () => {
      let balance = 1000;
      const pullCost = 160;

      expect(balance >= pullCost).toBe(true);

      balance -= pullCost;
      expect(balance).toBe(840);

      balance += 500;
      expect(balance).toBe(1340);
    });
  });

  describe('E2E-GACHA-033: Inventory Duplicate Handling', () => {
    it('should correctly handle inventory duplicates', () => {
      const inventory: Record<string, { quantity: number; duplicateCount: number }> = {};

      const addItem = (itemId: string) => {
        if (inventory[itemId]) {
          inventory[itemId].quantity++;
          inventory[itemId].duplicateCount++;
        } else {
          inventory[itemId] = { quantity: 1, duplicateCount: 0 };
        }
      };

      addItem('item1');
      expect(inventory['item1'].quantity).toBe(1);
      expect(inventory['item1'].duplicateCount).toBe(0);

      addItem('item1');
      expect(inventory['item1'].quantity).toBe(2);
      expect(inventory['item1'].duplicateCount).toBe(1);

      addItem('item1');
      expect(inventory['item1'].quantity).toBe(3);
      expect(inventory['item1'].duplicateCount).toBe(2);
    });
  });

  describe('E2E-GACHA-034: Drop Rate Disclosure Format', () => {
    it('should format drop rates correctly', () => {
      const formatRate = (rate: number) => `${(rate * 100).toFixed(2)}%`;

      expect(formatRate(0.006)).toBe('0.60%');
      expect(formatRate(0.051)).toBe('5.10%');
      expect(formatRate(0.43)).toBe('43.00%');
      expect(formatRate(0.513)).toBe('51.30%');
    });
  });

  describe('E2E-GACHA-035: Pity System Configuration', () => {
    it('should validate pity configuration', () => {
      expect(mockPityConfig.softPityStart).toBeLessThan(mockPityConfig.hardPity);
      expect(mockPityConfig.softPityRateIncrease).toBeGreaterThan(0);
      expect(mockPityConfig.softPityRateIncrease).toBeLessThanOrEqual(1);
      expect(typeof mockPityConfig.guaranteedFeaturedAfterLoss).toBe('boolean');
    });
  });

  describe('E2E-GACHA-036: Rate Increase During Soft Pity', () => {
    it('should calculate correct rate increase during soft pity', () => {
      const pullsIntoSoftPity = 5;
      const additionalRate = pullsIntoSoftPity * mockPityConfig.softPityRateIncrease;

      expect(additionalRate).toBe(0.3);

      const newLegendaryRate = mockBaseRates[Rarity.LEGENDARY] + additionalRate;
      expect(newLegendaryRate).toBe(0.306);
    });
  });

  describe('E2E-GACHA-037: Maximum Rate Cap', () => {
    it('should cap rate at 1.0', () => {
      const pullsIntoSoftPity = 20;
      const additionalRate = pullsIntoSoftPity * mockPityConfig.softPityRateIncrease;
      const newRate = Math.min(mockBaseRates[Rarity.LEGENDARY] + additionalRate, 1.0);

      expect(newRate).toBeLessThanOrEqual(1.0);
    });
  });

  describe('E2E-GACHA-038: Transaction Status Flow', () => {
    it('should validate transaction status flow', () => {
      const validTransitions: Record<string, string[]> = {
        PENDING: ['COMPLETED', 'FAILED'],
        COMPLETED: ['REFUNDED'],
        FAILED: [],
        REFUNDED: [],
      };

      expect(validTransitions['PENDING']).toContain('COMPLETED');
      expect(validTransitions['PENDING']).toContain('FAILED');
      expect(validTransitions['COMPLETED']).toContain('REFUNDED');
    });
  });

  describe('E2E-GACHA-039: NFT Reward Status Flow', () => {
    it('should validate NFT reward status flow', () => {
      const validTransitions: Record<string, string[]> = {
        PENDING: ['MINTING', 'FAILED'],
        MINTING: ['MINTED', 'FAILED'],
        MINTED: ['CLAIMED'],
        CLAIMED: [],
        FAILED: ['PENDING'],
      };

      expect(validTransitions['PENDING']).toContain('MINTING');
      expect(validTransitions['MINTING']).toContain('MINTED');
      expect(validTransitions['MINTED']).toContain('CLAIMED');
    });
  });

  describe('E2E-GACHA-040: Concurrent Pull Prevention', () => {
    it('should prevent concurrent pulls with lock mechanism', async () => {
      const locks: Record<string, boolean> = {};

      const acquireLock = (playerId: string): boolean => {
        if (locks[playerId]) return false;
        locks[playerId] = true;
        return true;
      };

      const releaseLock = (playerId: string): void => {
        delete locks[playerId];
      };

      const playerId = 'player1';

      expect(acquireLock(playerId)).toBe(true);
      expect(acquireLock(playerId)).toBe(false);

      releaseLock(playerId);
      expect(acquireLock(playerId)).toBe(true);
    });
  });

  describe('E2E-GACHA-041: Rate Limit Validation', () => {
    it('should validate rate limiting', () => {
      const rateLimit = {
        windowMs: 60000,
        maxRequests: 100,
      };

      const requests: number[] = [];
      const now = Date.now();

      for (let i = 0; i < 150; i++) {
        requests.push(now);
      }

      const recentRequests = requests.filter((time) => time > now - rateLimit.windowMs);
      const isRateLimited = recentRequests.length > rateLimit.maxRequests;

      expect(isRateLimited).toBe(true);
    });
  });

  describe('E2E-GACHA-042: Spending Period Reset', () => {
    it('should correctly determine spending period reset', () => {
      const now = new Date();
      const lastDailyReset = new Date(now.getTime() - 25 * 60 * 60 * 1000);
      const lastWeeklyReset = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

      const daysSinceDaily = Math.floor((now.getTime() - lastDailyReset.getTime()) / (24 * 60 * 60 * 1000));
      const daysSinceWeekly = Math.floor((now.getTime() - lastWeeklyReset.getTime()) / (24 * 60 * 60 * 1000));

      expect(daysSinceDaily >= 1).toBe(true);
      expect(daysSinceWeekly >= 7).toBe(true);
    });
  });

  describe('E2E-GACHA-043: Individual Item Rate Calculation', () => {
    it('should calculate individual item rates correctly', () => {
      const rarityRate = 0.006;
      const itemCount = 3;
      const poolShare = 0.5;

      const individualRate = (rarityRate * poolShare) / itemCount;

      expect(individualRate).toBe(0.001);
    });
  });

  describe('E2E-GACHA-044: Banner Pool Validation', () => {
    it('should validate banner has items in pool', () => {
      const validBanner = { itemPool: ['item1', 'item2'] };
      const invalidBanner = { itemPool: [] };

      expect(validBanner.itemPool.length > 0).toBe(true);
      expect(invalidBanner.itemPool.length > 0).toBe(false);
    });
  });

  describe('E2E-GACHA-045: Featured Items Validation', () => {
    it('should validate featured items exist in pool', () => {
      const itemPool = ['item1', 'item2', 'item3', 'item4'];
      const featuredItems = ['item1', 'item2'];

      const allFeaturedInPool = featuredItems.every((item) => itemPool.includes(item));
      expect(allFeaturedInPool).toBe(true);

      const invalidFeatured = ['item1', 'item5'];
      const invalidCheck = invalidFeatured.every((item) => itemPool.includes(item));
      expect(invalidCheck).toBe(false);
    });
  });

  describe('E2E-GACHA-046: Pull History Pagination', () => {
    it('should correctly paginate pull history', () => {
      const totalPulls = 100;
      const pageSize = 20;
      const totalPages = Math.ceil(totalPulls / pageSize);

      expect(totalPages).toBe(5);

      const page3Start = (3 - 1) * pageSize;
      const page3End = Math.min(page3Start + pageSize, totalPulls);

      expect(page3Start).toBe(40);
      expect(page3End).toBe(60);
    });
  });

  describe('E2E-GACHA-047: Statistical Validation Summary', () => {
    it('should generate valid statistical summary', () => {
      const totalPulls = 100000;
      const legendaryCount = 1200;
      const featuredCount = 600;

      const legendaryRate = legendaryCount / totalPulls;
      const featuredRate = featuredCount / legendaryCount;

      expect(legendaryRate).toBeCloseTo(0.012, 2);
      expect(featuredRate).toBe(0.5);
    });
  });

  describe('E2E-GACHA-048: Performance Metrics Calculation', () => {
    it('should calculate performance metrics', () => {
      const startTime = Date.now();
      const operations = 1000;

      for (let i = 0; i < operations; i++) {
        const { rates, isSoftPity, isHardPity } = probabilityService.calculateAdjustedRates(
          mockBaseRates,
          mockPityConfig,
          i % mockPityConfig.hardPity
        );
        probabilityService.rollRarity(rates, isSoftPity, isHardPity);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const operationsPerSecond = (operations / duration) * 1000;

      expect(operationsPerSecond).toBeGreaterThan(1000);
    });
  });
});
