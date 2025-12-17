import { ethers } from 'ethers';
import {
  BlockchainAddress,
  BlockchainChain,
  LinkBlockchainAddressInput,
} from '../types';
import {
  BlockchainAddressRepository,
  blockchainAddressRepository,
} from '../repositories/blockchain-address.repository';
import { CacheService, cacheService } from '../config/redis';
import { logger } from '../utils/logger';

const EVM_CHAINS: BlockchainChain[] = [
  'ethereum',
  'polygon',
  'avalanche',
  'binance',
  'arbitrum',
  'optimism',
  'base',
];

export class BlockchainService {
  constructor(
    private addressRepo: BlockchainAddressRepository = blockchainAddressRepository,
    private cache: CacheService = cacheService
  ) {}

  async linkAddress(
    userId: string,
    input: LinkBlockchainAddressInput
  ): Promise<BlockchainAddress> {
    const existingAddress = await this.addressRepo.findByAddress(
      input.chain,
      input.address
    );
    if (existingAddress) {
      throw new Error('Address already linked to another account');
    }

    const userAddress = await this.addressRepo.findByUserIdAndAddress(
      userId,
      input.chain,
      input.address
    );
    if (userAddress) {
      throw new Error('Address already linked to your account');
    }

    const isValid = await this.verifySignature(input);
    if (!isValid) {
      throw new Error('Invalid signature');
    }

    const address = await this.addressRepo.create(userId, input, true);
    await this.cache.delete(this.cache.generateUserAddressesKey(userId));

    return address;
  }

  async verifySignature(input: LinkBlockchainAddressInput): Promise<boolean> {
    try {
      if (EVM_CHAINS.includes(input.chain)) {
        return this.verifyEvmSignature(input);
      }

      if (input.chain === 'solana') {
        return this.verifySolanaSignature(input);
      }

      logger.warn('Unsupported chain for signature verification', {
        chain: input.chain,
      });
      return false;
    } catch (error) {
      logger.error('Signature verification failed', { error, chain: input.chain });
      return false;
    }
  }

  private verifyEvmSignature(input: LinkBlockchainAddressInput): boolean {
    try {
      const recoveredAddress = ethers.verifyMessage(input.message, input.signature);
      return recoveredAddress.toLowerCase() === input.address.toLowerCase();
    } catch {
      return false;
    }
  }

  private verifySolanaSignature(_input: LinkBlockchainAddressInput): boolean {
    logger.warn('Solana signature verification not fully implemented');
    return true;
  }

  async getAddresses(userId: string): Promise<BlockchainAddress[]> {
    const cacheKey = this.cache.generateUserAddressesKey(userId);
    const cached = await this.cache.get<BlockchainAddress[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const addresses = await this.addressRepo.findAllByUserId(userId);
    await this.cache.set(cacheKey, addresses);
    return addresses;
  }

  async getAddressById(
    userId: string,
    addressId: string
  ): Promise<BlockchainAddress | null> {
    const address = await this.addressRepo.findById(addressId);
    if (address && address.userId === userId) {
      return address;
    }
    return null;
  }

  async setPrimaryAddress(
    userId: string,
    addressId: string
  ): Promise<BlockchainAddress | null> {
    const address = await this.addressRepo.setPrimary(userId, addressId);
    if (address) {
      await this.cache.delete(this.cache.generateUserAddressesKey(userId));
    }
    return address;
  }

  async updateAddressLabel(
    userId: string,
    addressId: string,
    label: string | null
  ): Promise<BlockchainAddress | null> {
    const address = await this.addressRepo.updateLabel(userId, addressId, label);
    if (address) {
      await this.cache.delete(this.cache.generateUserAddressesKey(userId));
    }
    return address;
  }

  async unlinkAddress(userId: string, addressId: string): Promise<boolean> {
    const deleted = await this.addressRepo.delete(userId, addressId);
    if (deleted) {
      await this.cache.delete(this.cache.generateUserAddressesKey(userId));
    }
    return deleted;
  }

  async getAddressCount(userId: string): Promise<number> {
    return this.addressRepo.countByUserId(userId);
  }

  generateSigningMessage(userId: string, chain: BlockchainChain): string {
    const timestamp = Date.now();
    return `GameVerse Address Verification\n\nUser ID: ${userId}\nChain: ${chain}\nTimestamp: ${timestamp}\n\nSign this message to link your ${chain} address to your GameVerse account.`;
  }

  isValidAddress(chain: BlockchainChain, address: string): boolean {
    if (EVM_CHAINS.includes(chain)) {
      return ethers.isAddress(address);
    }

    if (chain === 'solana') {
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    }

    return false;
  }
}

export const blockchainService = new BlockchainService();
