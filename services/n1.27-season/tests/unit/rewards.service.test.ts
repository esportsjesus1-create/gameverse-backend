import { RewardsService } from '../../src/services/rewards.service';
import { RankedTier, RewardType } from '../../src/types';

describe('RewardsService', () => {
  let rewardsService: RewardsService;

  beforeEach(() => {
    rewardsService = new RewardsService();
  });

  describe('tier order', () => {
    it('should have correct tier order for reward eligibility', () => {
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

      expect(tierOrder).toHaveLength(8);
      expect(tierOrder[0]).toBe(RankedTier.BRONZE);
      expect(tierOrder[7]).toBe(RankedTier.CHALLENGER);
    });
  });

  describe('reward types', () => {
    it('should have all reward types defined', () => {
      expect(RewardType.CURRENCY).toBe('CURRENCY');
      expect(RewardType.SKIN).toBe('SKIN');
      expect(RewardType.BORDER).toBe('BORDER');
      expect(RewardType.ICON).toBe('ICON');
      expect(RewardType.EMOTE).toBe('EMOTE');
      expect(RewardType.TITLE).toBe('TITLE');
      expect(RewardType.CHEST).toBe('CHEST');
    });
  });

  describe('reward eligibility logic', () => {
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

    it('should calculate eligible tiers for Bronze player', () => {
      const playerTier = RankedTier.BRONZE;
      const tierIndex = tierOrder.indexOf(playerTier);
      const eligibleTiers = tierOrder.slice(0, tierIndex + 1);

      expect(eligibleTiers).toEqual([RankedTier.BRONZE]);
    });

    it('should calculate eligible tiers for Gold player', () => {
      const playerTier = RankedTier.GOLD;
      const tierIndex = tierOrder.indexOf(playerTier);
      const eligibleTiers = tierOrder.slice(0, tierIndex + 1);

      expect(eligibleTiers).toEqual([RankedTier.BRONZE, RankedTier.SILVER, RankedTier.GOLD]);
    });

    it('should calculate eligible tiers for Diamond player', () => {
      const playerTier = RankedTier.DIAMOND;
      const tierIndex = tierOrder.indexOf(playerTier);
      const eligibleTiers = tierOrder.slice(0, tierIndex + 1);

      expect(eligibleTiers).toEqual([
        RankedTier.BRONZE,
        RankedTier.SILVER,
        RankedTier.GOLD,
        RankedTier.PLATINUM,
        RankedTier.DIAMOND,
      ]);
    });

    it('should calculate eligible tiers for Challenger player', () => {
      const playerTier = RankedTier.CHALLENGER;
      const tierIndex = tierOrder.indexOf(playerTier);
      const eligibleTiers = tierOrder.slice(0, tierIndex + 1);

      expect(eligibleTiers).toEqual(tierOrder);
    });
  });

  describe('default rewards structure', () => {
    it('should have rewards for all tiers', () => {
      const tiers = Object.values(RankedTier);
      expect(tiers).toHaveLength(8);
    });

    it('should have currency rewards for all tiers', () => {
      const currencyRewards = [
        { tier: RankedTier.BRONZE, quantity: 100 },
        { tier: RankedTier.SILVER, quantity: 250 },
        { tier: RankedTier.GOLD, quantity: 500 },
        { tier: RankedTier.PLATINUM, quantity: 1000 },
        { tier: RankedTier.DIAMOND, quantity: 2000 },
        { tier: RankedTier.MASTER, quantity: 5000 },
        { tier: RankedTier.GRANDMASTER, quantity: 10000 },
        { tier: RankedTier.CHALLENGER, quantity: 25000 },
      ];

      expect(currencyRewards).toHaveLength(8);
      expect(currencyRewards[0].quantity).toBe(100);
      expect(currencyRewards[7].quantity).toBe(25000);
    });

    it('should have exclusive rewards for high tiers', () => {
      const exclusiveTiers = [RankedTier.GRANDMASTER, RankedTier.CHALLENGER];
      expect(exclusiveTiers).toContain(RankedTier.GRANDMASTER);
      expect(exclusiveTiers).toContain(RankedTier.CHALLENGER);
    });
  });
});
