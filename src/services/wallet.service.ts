import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { WalletSignaturePayload, WalletVerificationError } from '../types';

interface NonceRecord {
  nonce: string;
  address: string;
  createdAt: number;
  expiresAt: number;
}

export class WalletService {
  private nonceStore: Map<string, NonceRecord> = new Map();
  private readonly messagePrefix: string;
  private readonly nonceExpiry: number;
  private readonly supportedChains: number[];

  constructor() {
    this.messagePrefix = config.web3.messagePrefix;
    this.nonceExpiry = config.web3.nonceExpiry;
    this.supportedChains = config.web3.supportedChains;
  }

  generateNonce(address: string): { nonce: string; message: string; expiresAt: number } {
    const normalizedAddress = address.toLowerCase();
    const nonce = uuidv4();
    const expiresAt = Date.now() + this.nonceExpiry * 1000;

    const record: NonceRecord = {
      nonce,
      address: normalizedAddress,
      createdAt: Date.now(),
      expiresAt,
    };

    this.nonceStore.set(normalizedAddress, record);

    const message = `${this.messagePrefix}${nonce}`;

    return { nonce, message, expiresAt };
  }

  async verifySignature(payload: WalletSignaturePayload): Promise<boolean> {
    const { address, message, signature, chainId } = payload;
    const normalizedAddress = address.toLowerCase();

    if (!this.supportedChains.includes(chainId)) {
      throw new WalletVerificationError(`Unsupported chain ID: ${chainId}`);
    }

    const nonceRecord = this.nonceStore.get(normalizedAddress);
    if (!nonceRecord) {
      throw new WalletVerificationError('No nonce found for this address. Please request a new nonce.');
    }

    if (Date.now() > nonceRecord.expiresAt) {
      this.nonceStore.delete(normalizedAddress);
      throw new WalletVerificationError('Nonce expired. Please request a new nonce.');
    }

    const expectedMessage = `${this.messagePrefix}${nonceRecord.nonce}`;
    if (message !== expectedMessage) {
      throw new WalletVerificationError('Invalid message');
    }

    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      
      if (recoveredAddress.toLowerCase() !== normalizedAddress) {
        throw new WalletVerificationError('Signature verification failed');
      }

      this.nonceStore.delete(normalizedAddress);

      return true;
    } catch (error) {
      if (error instanceof WalletVerificationError) {
        throw error;
      }
      throw new WalletVerificationError('Invalid signature format');
    }
  }

  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  normalizeAddress(address: string): string {
    return ethers.getAddress(address);
  }

  cleanupExpiredNonces(): void {
    const now = Date.now();
    for (const [address, record] of this.nonceStore.entries()) {
      if (now > record.expiresAt) {
        this.nonceStore.delete(address);
      }
    }
  }
}

export const walletService = new WalletService();
