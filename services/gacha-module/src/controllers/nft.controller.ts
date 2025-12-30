import { Request, Response } from 'express';
import { NFTService } from '../services/nft.service';
import { ApiResponse } from '../types';

export class NFTController {
  private nftService: NFTService;

  constructor() {
    this.nftService = new NFTService();
  }

  getPlayerNFTRewards = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;

      const rewards = await this.nftService.getPlayerNFTRewards(playerId);

      res.status(200).json({
        success: true,
        data: { rewards, total: rewards.length },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get NFT rewards',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getPlayerNFTStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;

      const stats = await this.nftService.getPlayerNFTStats(playerId);

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof stats>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get NFT stats',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getNFTRewardByPull = async (req: Request, res: Response): Promise<void> => {
    try {
      const { pullId } = req.params;

      const reward = await this.nftService.getNFTRewardByPull(pullId);

      if (!reward) {
        res.status(404).json({
          success: false,
          error: 'NFT reward not found for this pull',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        data: reward,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof reward>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get NFT reward',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  mintNFT = async (req: Request, res: Response): Promise<void> => {
    try {
      const { rewardId } = req.params;

      const result = await this.nftService.mintNFT(rewardId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error || 'Mint failed',
          data: { status: result.status },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
        message: 'NFT minted successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof result>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Mint failed',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  claimNFT = async (req: Request, res: Response): Promise<void> => {
    try {
      const { rewardId } = req.params;
      const { walletAddress } = req.body;

      if (!walletAddress) {
        res.status(400).json({
          success: false,
          error: 'walletAddress is required',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const result = await this.nftService.claimNFT(rewardId, walletAddress);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error || 'Claim failed',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'NFT claimed successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Claim failed',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getPendingRewards = async (req: Request, res: Response): Promise<void> => {
    try {
      const { limit } = req.query;

      const rewards = await this.nftService.getPendingRewards(
        limit ? parseInt(limit as string, 10) : 100
      );

      res.status(200).json({
        success: true,
        data: { rewards, total: rewards.length },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pending rewards',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  retryFailedMints = async (req: Request, res: Response): Promise<void> => {
    try {
      const { maxRetries } = req.query;

      const result = await this.nftService.retryFailedMints(
        maxRetries ? parseInt(maxRetries as string, 10) : 3
      );

      res.status(200).json({
        success: true,
        data: result,
        message: `Processed ${result.processed} failed mints: ${result.succeeded} succeeded, ${result.failed} failed`,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof result>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retry mints',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };
}
