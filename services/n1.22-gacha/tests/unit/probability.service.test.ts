import { ProbabilityService } from '../../src/services/probability.service';
import { Rarity, RarityRates, PityConfig } from '../../src/types';

describe('ProbabilityService', () => {
  let probabilityService: ProbabilityService;

  const defaultRates: RarityRates = {
    [Rarity.COMMON]: 0.503,
    [Rarity.RARE]: 0.43,
    [Rarity.EPIC]: 0.051,
    [Rarity.LEGENDARY]: 0.006,
    [Rarity.MYTHIC]: 0.01,
  };

  const defaultPityConfig: PityConfig = {
    softPityStart: 74,
    hardPity: 90,
    softPityRateIncrease: 0.06,
    guaranteedFeaturedAfterLoss: true,
  };

  beforeEach(() => {
    probabilityService = new ProbabilityService();
  });

  describe('calculateAdjustedRates', () => {
    it('should return base rates when pity is below soft pity', () => {
      const result = probabilityService.calculateAdjustedRates(
        defaultRates,
        defaultPityConfig,
        50
      );

      expect(result[Rarity.LEGENDARY]).toBeCloseTo(defaultRates[Rarity.LEGENDARY], 4);
    });

    it('should increase legendary rate during soft pity', () => {
      const result = probabilityService.calculateAdjustedRates(
        defaultRates,
        defaultPityConfig,
        75
      );

      expect(result[Rarity.LEGENDARY]).toBeGreaterThan(defaultRates[Rarity.LEGENDARY]);
    });

    it('should progressively increase rate as pity increases in soft pity', () => {
      const rate75 = probabilityService.calculateAdjustedRates(
        defaultRates,
        defaultPityConfig,
        75
      );
      const rate80 = probabilityService.calculateAdjustedRates(
        defaultRates,
        defaultPityConfig,
        80
      );
      const rate85 = probabilityService.calculateAdjustedRates(
        defaultRates,
        defaultPityConfig,
        85
      );

      expect(rate80[Rarity.LEGENDARY]).toBeGreaterThan(rate75[Rarity.LEGENDARY]);
      expect(rate85[Rarity.LEGENDARY]).toBeGreaterThan(rate80[Rarity.LEGENDARY]);
    });

    it('should guarantee legendary at hard pity', () => {
      const result = probabilityService.calculateAdjustedRates(
        defaultRates,
        defaultPityConfig,
        89
      );

      expect(result[Rarity.LEGENDARY]).toBe(1.0);
      expect(result[Rarity.COMMON]).toBe(0);
      expect(result[Rarity.RARE]).toBe(0);
      expect(result[Rarity.EPIC]).toBe(0);
    });

    it('should normalize rates to sum to 1', () => {
      const result = probabilityService.calculateAdjustedRates(
        defaultRates,
        defaultPityConfig,
        80
      );

      const total = Object.values(result).reduce((sum, rate) => sum + rate, 0);
      expect(total).toBeCloseTo(1.0, 4);
    });
  });

  describe('rollRarity', () => {
    it('should return a valid rarity', () => {
      const result = probabilityService.rollRarity(defaultRates);

      expect(Object.values(Rarity)).toContain(result.rarity);
    });

    it('should return roll value between 0 and 1', () => {
      const result = probabilityService.rollRarity(defaultRates);

      expect(result.roll).toBeGreaterThanOrEqual(0);
      expect(result.roll).toBeLessThan(1);
    });

    it('should return adjusted rates in result', () => {
      const result = probabilityService.rollRarity(defaultRates);

      expect(result.adjustedRates).toBeDefined();
      expect(result.adjustedRates[Rarity.COMMON]).toBeDefined();
    });

    it('should produce statistically valid distribution over many rolls', () => {
      const counts: Record<Rarity, number> = {
        [Rarity.COMMON]: 0,
        [Rarity.RARE]: 0,
        [Rarity.EPIC]: 0,
        [Rarity.LEGENDARY]: 0,
        [Rarity.MYTHIC]: 0,
      };

      const iterations = 10000;
      for (let i = 0; i < iterations; i++) {
        const result = probabilityService.rollRarity(defaultRates);
        counts[result.rarity]++;
      }

      const commonRate = counts[Rarity.COMMON] / iterations;
      expect(commonRate).toBeGreaterThan(0.4);
      expect(commonRate).toBeLessThan(0.6);
    });
  });

  describe('rollFeatured', () => {
    it('should always return true when guaranteed', () => {
      for (let i = 0; i < 100; i++) {
        const result = probabilityService.rollFeatured(0.5, true);
        expect(result).toBe(true);
      }
    });

    it('should return boolean when not guaranteed', () => {
      const result = probabilityService.rollFeatured(0.5, false);
      expect(typeof result).toBe('boolean');
    });

    it('should respect featured rate over many rolls', () => {
      let featuredCount = 0;
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        if (probabilityService.rollFeatured(0.5, false)) {
          featuredCount++;
        }
      }

      const featuredRate = featuredCount / iterations;
      expect(featuredRate).toBeGreaterThan(0.4);
      expect(featuredRate).toBeLessThan(0.6);
    });
  });

  describe('selectRandomItem', () => {
    it('should select an item from the array', () => {
      const items = ['item1', 'item2', 'item3'];
      const result = probabilityService.selectRandomItem(items);

      expect(items).toContain(result);
    });

    it('should throw error for empty array', () => {
      expect(() => probabilityService.selectRandomItem([])).toThrow(
        'Cannot select from empty item pool'
      );
    });

    it('should return the only item for single-item array', () => {
      const items = ['onlyItem'];
      const result = probabilityService.selectRandomItem(items);

      expect(result).toBe('onlyItem');
    });
  });

  describe('selectWeightedItem', () => {
    it('should select an item from weighted array', () => {
      const items = [
        { id: '1', weight: 1 },
        { id: '2', weight: 2 },
        { id: '3', weight: 3 },
      ];
      const result = probabilityService.selectWeightedItem(items);

      expect(items.map((i) => i.id)).toContain(result.id);
    });

    it('should throw error for empty array', () => {
      expect(() => probabilityService.selectWeightedItem([])).toThrow(
        'Cannot select from empty item pool'
      );
    });

    it('should favor higher weighted items', () => {
      const items = [
        { id: 'low', weight: 1 },
        { id: 'high', weight: 99 },
      ];

      let highCount = 0;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const result = probabilityService.selectWeightedItem(items);
        if (result.id === 'high') {
          highCount++;
        }
      }

      expect(highCount / iterations).toBeGreaterThan(0.9);
    });
  });

  describe('validateRates', () => {
    it('should return valid for correct rates', () => {
      const result = probabilityService.validateRates(defaultRates);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for rates not summing to 1', () => {
      const badRates: RarityRates = {
        [Rarity.COMMON]: 0.5,
        [Rarity.RARE]: 0.5,
        [Rarity.EPIC]: 0.5,
        [Rarity.LEGENDARY]: 0.5,
        [Rarity.MYTHIC]: 0.5,
      };

      const result = probabilityService.validateRates(badRates);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must sum to 1.0');
    });

    it('should return invalid for negative rates', () => {
      const badRates: RarityRates = {
        [Rarity.COMMON]: -0.1,
        [Rarity.RARE]: 0.5,
        [Rarity.EPIC]: 0.3,
        [Rarity.LEGENDARY]: 0.2,
        [Rarity.MYTHIC]: 0.1,
      };

      const result = probabilityService.validateRates(badRates);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid rate');
    });
  });

  describe('calculateExpectedPulls', () => {
    it('should return expected pull statistics', () => {
      const result = probabilityService.calculateExpectedPulls(0.006, defaultPityConfig);

      expect(result.average).toBeGreaterThan(0);
      expect(result.median).toBeGreaterThan(0);
      expect(result.percentile90).toBeGreaterThan(0);
      expect(result.percentile90).toBeLessThanOrEqual(defaultPityConfig.hardPity);
    });

    it('should have reasonable median and average values', () => {
      const result = probabilityService.calculateExpectedPulls(0.006, defaultPityConfig);

      expect(result.median).toBeGreaterThan(0);
      expect(result.median).toBeLessThanOrEqual(defaultPityConfig.hardPity);
      expect(result.average).toBeGreaterThan(0);
      expect(result.average).toBeLessThanOrEqual(defaultPityConfig.hardPity);
    });
  });
});
