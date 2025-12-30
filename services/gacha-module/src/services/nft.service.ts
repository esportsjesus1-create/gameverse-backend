import axios from 'axios';
import { NFTRewardRepository } from '../repositories';
import { NFTReward } from '../models';
import {
  NFTRewardStatus,
  NFTRewardInfo,
  NFTMintRequest,
  NFTMintResponse,
} from '../types';
import { config } from '../config';

export class NFTService {
  private nftRewardRepository: NFTRewardRepository;

  constructor() {
    this.nftRewardRepository = new NFTRewardRepository();
  }

  async createNFTReward(
    playerId: string,
    pullId: string,
    itemId: string,
    walletAddress?: string,
    metadata?: Record<string, unknown>
  ): Promise<NFTReward> {
    return this.nftRewardRepository.create({
      playerId,
      pullId,
      itemId,
      contractAddress: config.gamerstake.contractAddress,
      walletAddress,
      chainId: config.gamerstake.chainId,
      nftMetadata: metadata,
    });
  }

  async mintNFT(rewardId: string): Promise<NFTMintResponse> {
    if (!config.gamerstake.enabled) {
      return {
        success: false,
        status: NFTRewardStatus.FAILED,
        error: 'NFT rewards are not enabled',
      };
    }

    const reward = await this.nftRewardRepository.findById(rewardId);
    if (!reward) {
      return {
        success: false,
        status: NFTRewardStatus.FAILED,
        error: 'NFT reward not found',
      };
    }

    if (reward.status !== NFTRewardStatus.PENDING) {
      return {
        success: false,
        status: reward.status,
        error: `NFT reward is already in status: ${reward.status}`,
      };
    }

    await this.nftRewardRepository.setMinting(rewardId);

    try {
      const mintResult = await this.callGamerstakeMintAPI({
        playerId: reward.playerId,
        itemId: reward.itemId,
        pullId: reward.pullId,
        metadata: reward.nftMetadata || {},
      });

      if (mintResult.success && mintResult.tokenId && mintResult.transactionHash) {
        await this.nftRewardRepository.setMinted(
          rewardId,
          mintResult.tokenId,
          mintResult.transactionHash,
          mintResult.blockNumber
        );

        return {
          success: true,
          tokenId: mintResult.tokenId,
          transactionHash: mintResult.transactionHash,
          status: NFTRewardStatus.MINTED,
        };
      } else {
        await this.nftRewardRepository.setFailed(rewardId, mintResult.error || 'Mint failed');
        return {
          success: false,
          status: NFTRewardStatus.FAILED,
          error: mintResult.error || 'Mint failed',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.nftRewardRepository.setFailed(rewardId, errorMessage);
      return {
        success: false,
        status: NFTRewardStatus.FAILED,
        error: errorMessage,
      };
    }
  }

  private async callGamerstakeMintAPI(request: NFTMintRequest): Promise<{
    success: boolean;
    tokenId?: string;
    transactionHash?: string;
    blockNumber?: number;
    error?: string;
  }> {
    try {
      const response = await axios.post(
        `${config.gamerstake.apiUrl}/v1/nft/mint`,
        {
          playerId: request.playerId,
          itemId: request.itemId,
          pullId: request.pullId,
          contractAddress: config.gamerstake.contractAddress,
          chainId: config.gamerstake.chainId,
          metadata: request.metadata,
        },
        {
          headers: {
            'Authorization': `Bearer ${config.gamerstake.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      if (response.data.success) {
        return {
          success: true,
          tokenId: response.data.tokenId,
          transactionHash: response.data.transactionHash,
          blockNumber: response.data.blockNumber,
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Mint API returned failure',
        };
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.error || error.message,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async claimNFT(rewardId: string, _walletAddress: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const reward = await this.nftRewardRepository.findById(rewardId);
    if (!reward) {
      return { success: false, error: 'NFT reward not found' };
    }

    if (reward.status !== NFTRewardStatus.MINTED) {
      return { success: false, error: `NFT must be minted before claiming. Current status: ${reward.status}` };
    }

    try {
      await this.nftRewardRepository.setClaimed(rewardId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getPlayerNFTRewards(playerId: string): Promise<NFTRewardInfo[]> {
    const rewards = await this.nftRewardRepository.findByPlayer(playerId);
    return rewards.map((reward) => this.toNFTRewardInfo(reward));
  }

  async getNFTRewardByPull(pullId: string): Promise<NFTRewardInfo | null> {
    const reward = await this.nftRewardRepository.findByPullId(pullId);
    return reward ? this.toNFTRewardInfo(reward) : null;
  }

  async getPendingRewards(limit: number = 100): Promise<NFTReward[]> {
    return this.nftRewardRepository.findPendingRewards(limit);
  }

  async retryFailedMints(maxRetries: number = 3): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const failedRewards = await this.nftRewardRepository.findFailedRewards(maxRetries);
    let succeeded = 0;
    let failed = 0;

    for (const reward of failedRewards) {
      const result = await this.mintNFT(reward.id);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return {
      processed: failedRewards.length,
      succeeded,
      failed,
    };
  }

  async getPlayerNFTStats(playerId: string): Promise<{
    total: number;
    pending: number;
    minting: number;
    minted: number;
    claimed: number;
    failed: number;
  }> {
    return this.nftRewardRepository.getPlayerNFTStats(playerId);
  }

  private toNFTRewardInfo(reward: NFTReward): NFTRewardInfo {
    return {
      tokenId: reward.tokenId || undefined,
      contractAddress: reward.contractAddress,
      status: reward.status,
      transactionHash: reward.transactionHash || undefined,
      metadata: reward.nftMetadata || undefined,
    };
  }
}
