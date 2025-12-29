import { TierService } from '../../src/services/tier.service';
import { RankedTier, TierDivision } from '../../src/types';

describe('TierService', () => {
  let tierService: TierService;

  beforeEach(() => {
    tierService = new TierService();
  });

  describe('getTierFromMMR', () => {
    it('should return Bronze IV for lowest MMR', () => {
      const result = tierService.getTierFromMMR(0);
      expect(result.tier).toBe(RankedTier.BRONZE);
      expect(result.division).toBe(TierDivision.IV);
    });

    it('should return Bronze I for high Bronze MMR', () => {
      const result = tierService.getTierFromMMR(750);
      expect(result.tier).toBe(RankedTier.BRONZE);
      expect(result.division).toBe(TierDivision.I);
    });

    it('should return Silver for 800-1199 MMR', () => {
      const result = tierService.getTierFromMMR(1000);
      expect(result.tier).toBe(RankedTier.SILVER);
      expect(result.division).not.toBeNull();
    });

    it('should return Gold for 1200-1599 MMR', () => {
      const result = tierService.getTierFromMMR(1400);
      expect(result.tier).toBe(RankedTier.GOLD);
      expect(result.division).not.toBeNull();
    });

    it('should return Platinum for 1600-1999 MMR', () => {
      const result = tierService.getTierFromMMR(1800);
      expect(result.tier).toBe(RankedTier.PLATINUM);
      expect(result.division).not.toBeNull();
    });

    it('should return Diamond for 2000-2399 MMR', () => {
      const result = tierService.getTierFromMMR(2200);
      expect(result.tier).toBe(RankedTier.DIAMOND);
      expect(result.division).not.toBeNull();
    });

    it('should return Master without division for 2400-2799 MMR', () => {
      const result = tierService.getTierFromMMR(2600);
      expect(result.tier).toBe(RankedTier.MASTER);
      expect(result.division).toBeNull();
    });

    it('should return Grandmaster without division for 2800-3199 MMR', () => {
      const result = tierService.getTierFromMMR(3000);
      expect(result.tier).toBe(RankedTier.GRANDMASTER);
      expect(result.division).toBeNull();
    });

    it('should return Challenger without division for 3200+ MMR', () => {
      const result = tierService.getTierFromMMR(3500);
      expect(result.tier).toBe(RankedTier.CHALLENGER);
      expect(result.division).toBeNull();
    });
  });

  describe('getTierThreshold', () => {
    it('should return correct threshold for Bronze', () => {
      const threshold = tierService.getTierThreshold(RankedTier.BRONZE);
      expect(threshold).toBeDefined();
      expect(threshold?.minMMR).toBe(0);
      expect(threshold?.maxMMR).toBe(799);
      expect(threshold?.hasDivisions).toBe(true);
    });

    it('should return correct threshold for Challenger', () => {
      const threshold = tierService.getTierThreshold(RankedTier.CHALLENGER);
      expect(threshold).toBeDefined();
      expect(threshold?.minMMR).toBe(3200);
      expect(threshold?.maxMMR).toBe(5000);
      expect(threshold?.hasDivisions).toBe(false);
    });
  });

  describe('getDivisionMMRRange', () => {
    it('should return correct range for Gold IV', () => {
      const range = tierService.getDivisionMMRRange(RankedTier.GOLD, TierDivision.IV);
      expect(range).toBeDefined();
      expect(range?.minMMR).toBe(1200);
    });

    it('should return null for tiers without divisions', () => {
      const range = tierService.getDivisionMMRRange(RankedTier.MASTER, TierDivision.I);
      expect(range).toBeNull();
    });
  });

  describe('calculateLeaguePoints', () => {
    it('should return 0 LP at division floor', () => {
      const lp = tierService.calculateLeaguePoints(1200, RankedTier.GOLD, TierDivision.IV);
      expect(lp).toBe(0);
    });

    it('should return LP based on position in division', () => {
      const lp = tierService.calculateLeaguePoints(1250, RankedTier.GOLD, TierDivision.IV);
      expect(lp).toBeGreaterThan(0);
      expect(lp).toBeLessThanOrEqual(100);
    });

    it('should handle tiers without divisions', () => {
      const lp = tierService.calculateLeaguePoints(2500, RankedTier.MASTER, null);
      expect(lp).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getNextTierDivision', () => {
    it('should return next division in same tier', () => {
      const next = tierService.getNextTierDivision(RankedTier.GOLD, TierDivision.IV);
      expect(next?.tier).toBe(RankedTier.GOLD);
      expect(next?.division).toBe(TierDivision.III);
    });

    it('should return next tier when at division I', () => {
      const next = tierService.getNextTierDivision(RankedTier.GOLD, TierDivision.I);
      expect(next?.tier).toBe(RankedTier.PLATINUM);
      expect(next?.division).toBe(TierDivision.IV);
    });

    it('should return next tier without division for Master', () => {
      const next = tierService.getNextTierDivision(RankedTier.MASTER, null);
      expect(next?.tier).toBe(RankedTier.GRANDMASTER);
      expect(next?.division).toBeNull();
    });

    it('should return null at Challenger', () => {
      const next = tierService.getNextTierDivision(RankedTier.CHALLENGER, null);
      expect(next).toBeNull();
    });
  });

  describe('getPreviousTierDivision', () => {
    it('should return previous division in same tier', () => {
      const prev = tierService.getPreviousTierDivision(RankedTier.GOLD, TierDivision.III);
      expect(prev?.tier).toBe(RankedTier.GOLD);
      expect(prev?.division).toBe(TierDivision.IV);
    });

    it('should return previous tier when at division IV', () => {
      const prev = tierService.getPreviousTierDivision(RankedTier.GOLD, TierDivision.IV);
      expect(prev?.tier).toBe(RankedTier.SILVER);
      expect(prev?.division).toBe(TierDivision.I);
    });

    it('should return null at Bronze IV', () => {
      const prev = tierService.getPreviousTierDivision(RankedTier.BRONZE, TierDivision.IV);
      expect(prev).toBeNull();
    });
  });

  describe('compareTiers', () => {
    it('should return positive when first tier is higher', () => {
      const result = tierService.compareTiers(
        RankedTier.GOLD, TierDivision.I,
        RankedTier.SILVER, TierDivision.I
      );
      expect(result).toBeGreaterThan(0);
    });

    it('should return negative when first tier is lower', () => {
      const result = tierService.compareTiers(
        RankedTier.SILVER, TierDivision.I,
        RankedTier.GOLD, TierDivision.I
      );
      expect(result).toBeLessThan(0);
    });

    it('should compare divisions within same tier', () => {
      const result = tierService.compareTiers(
        RankedTier.GOLD, TierDivision.I,
        RankedTier.GOLD, TierDivision.IV
      );
      expect(result).toBeGreaterThan(0);
    });

    it('should return 0 for equal ranks', () => {
      const result = tierService.compareTiers(
        RankedTier.GOLD, TierDivision.II,
        RankedTier.GOLD, TierDivision.II
      );
      expect(result).toBe(0);
    });
  });

  describe('formatRank', () => {
    it('should format tier with division', () => {
      const formatted = tierService.formatRank(RankedTier.GOLD, TierDivision.II);
      expect(formatted).toBe('GOLD II');
    });

    it('should format tier without division', () => {
      const formatted = tierService.formatRank(RankedTier.MASTER, null);
      expect(formatted).toBe('MASTER');
    });
  });

  describe('shouldPromote', () => {
    it('should return true when LP reaches threshold', () => {
      const result = tierService.shouldPromote(100, false, 0);
      expect(result).toBe(true);
    });

    it('should return true when promo wins are sufficient', () => {
      const result = tierService.shouldPromote(0, true, 3);
      expect(result).toBe(true);
    });

    it('should return false when LP is below threshold', () => {
      const result = tierService.shouldPromote(50, false, 0);
      expect(result).toBe(false);
    });
  });

  describe('shouldDemote', () => {
    it('should return true when LP is 0', () => {
      const result = tierService.shouldDemote(0, RankedTier.GOLD, TierDivision.IV);
      expect(result).toBe(true);
    });

    it('should return false at Bronze IV', () => {
      const result = tierService.shouldDemote(0, RankedTier.BRONZE, TierDivision.IV);
      expect(result).toBe(false);
    });

    it('should return false when LP is positive', () => {
      const result = tierService.shouldDemote(50, RankedTier.GOLD, TierDivision.IV);
      expect(result).toBe(false);
    });
  });
});
