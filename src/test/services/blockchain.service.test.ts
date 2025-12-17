import { BlockchainService } from '../../services/blockchain.service';
import { BlockchainAddressRepository } from '../../repositories/blockchain-address.repository';
import { CacheService } from '../../config/redis';
import { BlockchainAddress, BlockchainChain, LinkBlockchainAddressInput } from '../../types';
import { ethers } from 'ethers';

jest.mock('ethers', () => ({
  verifyMessage: jest.fn(),
  isAddress: jest.fn(),
}));

describe('BlockchainService', () => {
  let blockchainService: BlockchainService;
  let mockAddressRepo: jest.Mocked<BlockchainAddressRepository>;
  let mockCache: jest.Mocked<CacheService>;

  const mockAddress: BlockchainAddress = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    chain: 'ethereum' as BlockchainChain,
    address: '0x742d35cc6634c0532925a3b844bc9e7595f0ab3c',
    isPrimary: true,
    verifiedAt: new Date(),
    label: 'Main Wallet',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockAddressRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserIdAndAddress: jest.fn(),
      findByAddress: jest.fn(),
      findAllByUserId: jest.fn(),
      findPrimaryByUserId: jest.fn(),
      setPrimary: jest.fn(),
      updateLabel: jest.fn(),
      verify: jest.fn(),
      delete: jest.fn(),
      deleteAllByUserId: jest.fn(),
      countByUserId: jest.fn(),
      addressExists: jest.fn(),
    } as unknown as jest.Mocked<BlockchainAddressRepository>;

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      deletePattern: jest.fn(),
      exists: jest.fn(),
      invalidateUserCache: jest.fn(),
      generateUserKey: jest.fn((id: string) => `user:${id}`),
      generateUserAddressesKey: jest.fn((id: string) => `user:${id}:addresses`),
    } as unknown as jest.Mocked<CacheService>;

    blockchainService = new BlockchainService(mockAddressRepo, mockCache);
  });

  describe('linkAddress', () => {
    const linkInput: LinkBlockchainAddressInput = {
      chain: 'ethereum',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
      signature: '0xsignature',
      message: 'Sign this message',
      label: 'Main Wallet',
    };

    it('should link address successfully', async () => {
      mockAddressRepo.findByAddress.mockResolvedValue(null);
      mockAddressRepo.findByUserIdAndAddress.mockResolvedValue(null);
      (ethers.verifyMessage as jest.Mock).mockReturnValue(linkInput.address);
      mockAddressRepo.create.mockResolvedValue(mockAddress);

      const result = await blockchainService.linkAddress(mockAddress.userId, linkInput);

      expect(result).toEqual(mockAddress);
      expect(mockCache.delete).toHaveBeenCalled();
    });

    it('should throw error if address already linked to another account', async () => {
      mockAddressRepo.findByAddress.mockResolvedValue(mockAddress);

      await expect(
        blockchainService.linkAddress('different-user', linkInput)
      ).rejects.toThrow('Address already linked to another account');
    });

    it('should throw error if address already linked to same account', async () => {
      mockAddressRepo.findByAddress.mockResolvedValue(null);
      mockAddressRepo.findByUserIdAndAddress.mockResolvedValue(mockAddress);

      await expect(
        blockchainService.linkAddress(mockAddress.userId, linkInput)
      ).rejects.toThrow('Address already linked to your account');
    });

    it('should throw error if signature is invalid', async () => {
      mockAddressRepo.findByAddress.mockResolvedValue(null);
      mockAddressRepo.findByUserIdAndAddress.mockResolvedValue(null);
      (ethers.verifyMessage as jest.Mock).mockReturnValue('0xdifferentaddress');

      await expect(
        blockchainService.linkAddress(mockAddress.userId, linkInput)
      ).rejects.toThrow('Invalid signature');
    });
  });

  describe('verifySignature', () => {
    it('should verify EVM signature correctly', async () => {
      const input: LinkBlockchainAddressInput = {
        chain: 'ethereum',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
      };
      (ethers.verifyMessage as jest.Mock).mockReturnValue(input.address);

      const result = await blockchainService.verifySignature(input);

      expect(result).toBe(true);
    });

    it('should return false for invalid EVM signature', async () => {
      const input: LinkBlockchainAddressInput = {
        chain: 'ethereum',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
      };
      (ethers.verifyMessage as jest.Mock).mockReturnValue('0xdifferent');

      const result = await blockchainService.verifySignature(input);

      expect(result).toBe(false);
    });

    it('should handle EVM signature verification error', async () => {
      const input: LinkBlockchainAddressInput = {
        chain: 'ethereum',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
      };
      (ethers.verifyMessage as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const result = await blockchainService.verifySignature(input);

      expect(result).toBe(false);
    });

    it('should verify Solana signature (placeholder)', async () => {
      const input: LinkBlockchainAddressInput = {
        chain: 'solana',
        address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        signature: 'signature',
        message: 'Sign this message',
      };

      const result = await blockchainService.verifySignature(input);

      expect(result).toBe(true);
    });

    it('should verify polygon signature', async () => {
      const input: LinkBlockchainAddressInput = {
        chain: 'polygon',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
      };
      (ethers.verifyMessage as jest.Mock).mockReturnValue(input.address);

      const result = await blockchainService.verifySignature(input);

      expect(result).toBe(true);
    });

    it('should verify avalanche signature', async () => {
      const input: LinkBlockchainAddressInput = {
        chain: 'avalanche',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
      };
      (ethers.verifyMessage as jest.Mock).mockReturnValue(input.address);

      const result = await blockchainService.verifySignature(input);

      expect(result).toBe(true);
    });

    it('should verify binance signature', async () => {
      const input: LinkBlockchainAddressInput = {
        chain: 'binance',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
      };
      (ethers.verifyMessage as jest.Mock).mockReturnValue(input.address);

      const result = await blockchainService.verifySignature(input);

      expect(result).toBe(true);
    });

    it('should verify arbitrum signature', async () => {
      const input: LinkBlockchainAddressInput = {
        chain: 'arbitrum',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
      };
      (ethers.verifyMessage as jest.Mock).mockReturnValue(input.address);

      const result = await blockchainService.verifySignature(input);

      expect(result).toBe(true);
    });

    it('should verify optimism signature', async () => {
      const input: LinkBlockchainAddressInput = {
        chain: 'optimism',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
      };
      (ethers.verifyMessage as jest.Mock).mockReturnValue(input.address);

      const result = await blockchainService.verifySignature(input);

      expect(result).toBe(true);
    });

    it('should verify base signature', async () => {
      const input: LinkBlockchainAddressInput = {
        chain: 'base',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
      };
      (ethers.verifyMessage as jest.Mock).mockReturnValue(input.address);

      const result = await blockchainService.verifySignature(input);

      expect(result).toBe(true);
    });
  });

  describe('getAddresses', () => {
    it('should return cached addresses if available', async () => {
      mockCache.get.mockResolvedValue([mockAddress]);

      const result = await blockchainService.getAddresses(mockAddress.userId);

      expect(result).toEqual([mockAddress]);
      expect(mockAddressRepo.findAllByUserId).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in cache', async () => {
      mockCache.get.mockResolvedValue(null);
      mockAddressRepo.findAllByUserId.mockResolvedValue([mockAddress]);

      const result = await blockchainService.getAddresses(mockAddress.userId);

      expect(result).toEqual([mockAddress]);
      expect(mockCache.set).toHaveBeenCalled();
    });
  });

  describe('getAddressById', () => {
    it('should return address if belongs to user', async () => {
      mockAddressRepo.findById.mockResolvedValue(mockAddress);

      const result = await blockchainService.getAddressById(mockAddress.userId, mockAddress.id);

      expect(result).toEqual(mockAddress);
    });

    it('should return null if address does not belong to user', async () => {
      mockAddressRepo.findById.mockResolvedValue(mockAddress);

      const result = await blockchainService.getAddressById('different-user', mockAddress.id);

      expect(result).toBeNull();
    });

    it('should return null if address not found', async () => {
      mockAddressRepo.findById.mockResolvedValue(null);

      const result = await blockchainService.getAddressById(mockAddress.userId, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('setPrimaryAddress', () => {
    it('should set primary address', async () => {
      mockAddressRepo.setPrimary.mockResolvedValue(mockAddress);

      const result = await blockchainService.setPrimaryAddress(mockAddress.userId, mockAddress.id);

      expect(result).toEqual(mockAddress);
      expect(mockCache.delete).toHaveBeenCalled();
    });

    it('should return null if address not found', async () => {
      mockAddressRepo.setPrimary.mockResolvedValue(null);

      const result = await blockchainService.setPrimaryAddress(mockAddress.userId, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateAddressLabel', () => {
    it('should update address label', async () => {
      const updatedAddress = { ...mockAddress, label: 'New Label' };
      mockAddressRepo.updateLabel.mockResolvedValue(updatedAddress);

      const result = await blockchainService.updateAddressLabel(
        mockAddress.userId,
        mockAddress.id,
        'New Label'
      );

      expect(result).toEqual(updatedAddress);
      expect(mockCache.delete).toHaveBeenCalled();
    });

    it('should return null if address not found', async () => {
      mockAddressRepo.updateLabel.mockResolvedValue(null);

      const result = await blockchainService.updateAddressLabel(
        mockAddress.userId,
        'nonexistent',
        'New Label'
      );

      expect(result).toBeNull();
    });
  });

  describe('unlinkAddress', () => {
    it('should unlink address', async () => {
      mockAddressRepo.delete.mockResolvedValue(true);

      const result = await blockchainService.unlinkAddress(mockAddress.userId, mockAddress.id);

      expect(result).toBe(true);
      expect(mockCache.delete).toHaveBeenCalled();
    });

    it('should return false if address not found', async () => {
      mockAddressRepo.delete.mockResolvedValue(false);

      const result = await blockchainService.unlinkAddress(mockAddress.userId, 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getAddressCount', () => {
    it('should return address count', async () => {
      mockAddressRepo.countByUserId.mockResolvedValue(3);

      const result = await blockchainService.getAddressCount(mockAddress.userId);

      expect(result).toBe(3);
    });
  });

  describe('generateSigningMessage', () => {
    it('should generate signing message', () => {
      const message = blockchainService.generateSigningMessage(mockAddress.userId, 'ethereum');

      expect(message).toContain('GameVerse Address Verification');
      expect(message).toContain(mockAddress.userId);
      expect(message).toContain('ethereum');
    });
  });

  describe('isValidAddress', () => {
    it('should validate EVM address', () => {
      (ethers.isAddress as jest.Mock).mockReturnValue(true);

      const result = blockchainService.isValidAddress('ethereum', '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c');

      expect(result).toBe(true);
    });

    it('should invalidate bad EVM address', () => {
      (ethers.isAddress as jest.Mock).mockReturnValue(false);

      const result = blockchainService.isValidAddress('ethereum', 'invalid');

      expect(result).toBe(false);
    });

    it('should validate Solana address', () => {
      const result = blockchainService.isValidAddress('solana', 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK');

      expect(result).toBe(true);
    });

    it('should invalidate bad Solana address', () => {
      const result = blockchainService.isValidAddress('solana', 'invalid!@#');

      expect(result).toBe(false);
    });

    it('should validate polygon address', () => {
      (ethers.isAddress as jest.Mock).mockReturnValue(true);

      const result = blockchainService.isValidAddress('polygon', '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c');

      expect(result).toBe(true);
    });
  });
});
