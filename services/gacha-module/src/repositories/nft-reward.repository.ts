import { Repository } from 'typeorm';
import { NFTReward } from '../models';
import { getDataSource } from '../config/database';
import { NFTRewardStatus } from '../types';

export interface CreateNFTRewardRecord {
  playerId: string;
  pullId: string;
  itemId: string;
  contractAddress: string;
  walletAddress?: string;
  chainId?: number;
  nftMetadata?: Record<string, unknown>;
}

export class NFTRewardRepository {
  private repository: Repository<NFTReward>;

  constructor() {
    this.repository = getDataSource().getRepository(NFTReward);
  }

  async create(data: CreateNFTRewardRecord): Promise<NFTReward> {
    const reward = this.repository.create({
      ...data,
      status: NFTRewardStatus.PENDING,
      retryCount: 0,
    });
    return this.repository.save(reward);
  }

  async findById(id: string): Promise<NFTReward | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByPullId(pullId: string): Promise<NFTReward | null> {
    return this.repository.findOne({ where: { pullId } });
  }

  async findByTokenId(tokenId: string): Promise<NFTReward | null> {
    return this.repository.findOne({ where: { tokenId } });
  }

  async findByPlayer(playerId: string): Promise<NFTReward[]> {
    return this.repository.find({
      where: { playerId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(status: NFTRewardStatus): Promise<NFTReward[]> {
    return this.repository.find({
      where: { status },
      order: { createdAt: 'ASC' },
    });
  }

  async findPendingRewards(limit: number = 100): Promise<NFTReward[]> {
    return this.repository.find({
      where: { status: NFTRewardStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async findFailedRewards(maxRetries: number = 3): Promise<NFTReward[]> {
    return this.repository
      .createQueryBuilder('reward')
      .where('reward.status = :status', { status: NFTRewardStatus.FAILED })
      .andWhere('reward.retryCount < :maxRetries', { maxRetries })
      .orderBy('reward.createdAt', 'ASC')
      .getMany();
  }

  async updateStatus(
    id: string,
    status: NFTRewardStatus,
    tokenId?: string,
    transactionHash?: string,
    blockNumber?: number,
    errorMessage?: string
  ): Promise<NFTReward | null> {
    const reward = await this.findById(id);
    if (!reward) return null;

    reward.status = status;
    if (tokenId) reward.tokenId = tokenId;
    if (transactionHash) reward.transactionHash = transactionHash;
    if (blockNumber) reward.blockNumber = blockNumber;
    if (errorMessage) reward.errorMessage = errorMessage;

    if (status === NFTRewardStatus.MINTED) {
      reward.mintedAt = new Date();
    } else if (status === NFTRewardStatus.CLAIMED) {
      reward.claimedAt = new Date();
    } else if (status === NFTRewardStatus.FAILED) {
      reward.retryCount += 1;
    }

    return this.repository.save(reward);
  }

  async setMinting(id: string): Promise<NFTReward | null> {
    return this.updateStatus(id, NFTRewardStatus.MINTING);
  }

  async setMinted(
    id: string,
    tokenId: string,
    transactionHash: string,
    blockNumber?: number
  ): Promise<NFTReward | null> {
    return this.updateStatus(id, NFTRewardStatus.MINTED, tokenId, transactionHash, blockNumber);
  }

  async setClaimed(id: string): Promise<NFTReward | null> {
    return this.updateStatus(id, NFTRewardStatus.CLAIMED);
  }

  async setFailed(id: string, errorMessage: string): Promise<NFTReward | null> {
    return this.updateStatus(id, NFTRewardStatus.FAILED, undefined, undefined, undefined, errorMessage);
  }

  async countByPlayer(playerId: string): Promise<number> {
    return this.repository.count({ where: { playerId } });
  }

  async countByStatus(status: NFTRewardStatus): Promise<number> {
    return this.repository.count({ where: { status } });
  }

  async getPlayerNFTStats(playerId: string): Promise<{
    total: number;
    pending: number;
    minting: number;
    minted: number;
    claimed: number;
    failed: number;
  }> {
    const rewards = await this.findByPlayer(playerId);

    return {
      total: rewards.length,
      pending: rewards.filter((r) => r.status === NFTRewardStatus.PENDING).length,
      minting: rewards.filter((r) => r.status === NFTRewardStatus.MINTING).length,
      minted: rewards.filter((r) => r.status === NFTRewardStatus.MINTED).length,
      claimed: rewards.filter((r) => r.status === NFTRewardStatus.CLAIMED).length,
      failed: rewards.filter((r) => r.status === NFTRewardStatus.FAILED).length,
    };
  }
}
