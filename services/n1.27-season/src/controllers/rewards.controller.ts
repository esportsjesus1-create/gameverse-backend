import { Request, Response } from 'express';
import { rewardsService } from '../services';
import { RankedTier, RewardType } from '../types';

export class RewardsController {
  public async createSeasonReward(req: Request, res: Response): Promise<void> {
    const { seasonId, tier, rewardType, rewardId, rewardName, rewardDescription, quantity, isExclusive } = req.body as {
      seasonId: string;
      tier: RankedTier;
      rewardType: RewardType;
      rewardId: string;
      rewardName: string;
      rewardDescription: string;
      quantity: number;
      isExclusive?: boolean;
    };

    const reward = await rewardsService.createSeasonReward({
      seasonId,
      tier,
      rewardType,
      rewardId,
      rewardName,
      rewardDescription,
      quantity,
      isExclusive,
    });

    res.status(201).json({
      success: true,
      data: reward,
    });
  }

  public async getSeasonRewards(req: Request, res: Response): Promise<void> {
    const { seasonId } = req.params;

    const rewards = await rewardsService.getSeasonRewards(seasonId);

    res.json({
      success: true,
      data: rewards,
    });
  }

  public async getRewardsForTier(req: Request, res: Response): Promise<void> {
    const { seasonId, tier } = req.params;

    const rewards = await rewardsService.getRewardsForTier(seasonId, tier as RankedTier);

    res.json({
      success: true,
      data: rewards,
    });
  }

  public async distributeSeasonRewards(req: Request, res: Response): Promise<void> {
    const { seasonId } = req.params;

    const result = await rewardsService.distributeSeasonRewards(seasonId);

    res.json({
      success: true,
      data: result,
      message: `Distributed ${result.distributed} rewards to ${result.players.length} players`,
    });
  }

  public async getPlayerRewards(req: Request, res: Response): Promise<void> {
    const { playerId } = req.params;
    const { seasonId } = req.query as { seasonId?: string };

    const rewards = await rewardsService.getPlayerRewards(playerId, seasonId);

    res.json({
      success: true,
      data: rewards,
    });
  }

  public async claimReward(req: Request, res: Response): Promise<void> {
    const { playerId, rewardId } = req.params;

    const reward = await rewardsService.claimReward(playerId, rewardId);

    res.json({
      success: true,
      data: reward,
      message: 'Reward claimed successfully',
    });
  }

  public async getUnclaimedRewards(req: Request, res: Response): Promise<void> {
    const { playerId } = req.params;

    const rewards = await rewardsService.getUnclaimedRewards(playerId);

    res.json({
      success: true,
      data: rewards,
    });
  }

  public async setupDefaultRewards(req: Request, res: Response): Promise<void> {
    const { seasonId } = req.params;

    const rewards = await rewardsService.setupDefaultSeasonRewards(seasonId);

    res.status(201).json({
      success: true,
      data: rewards,
      message: `Created ${rewards.length} default rewards for the season`,
    });
  }
}

export const rewardsController = new RewardsController();
