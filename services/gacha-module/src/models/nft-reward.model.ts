import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { NFTRewardStatus } from '../types';

@Entity('gacha_nft_rewards')
@Index(['playerId'])
@Index(['status'])
@Index(['tokenId'])
@Index(['pullId'])
export class NFTReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  playerId: string;

  @Column({ type: 'uuid' })
  pullId: string;

  @Column({ type: 'uuid' })
  itemId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tokenId: string | null;

  @Column({ type: 'varchar', length: 255 })
  contractAddress: string;

  @Column({ type: 'enum', enum: NFTRewardStatus, default: NFTRewardStatus.PENDING })
  status: NFTRewardStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  transactionHash: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  walletAddress: string | null;

  @Column({ type: 'integer', nullable: true })
  chainId: number | null;

  @Column({ type: 'bigint', nullable: true })
  blockNumber: number | null;

  @Column({ type: 'jsonb', nullable: true })
  nftMetadata: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  mintedAt: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  claimedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
