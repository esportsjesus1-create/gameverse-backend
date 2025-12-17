import { BlockchainAddressRepository } from '../../repositories/blockchain-address.repository';
import { query, transaction } from '../../config/database';
import { BlockchainChain } from '../../types';

jest.mock('../../config/database');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

describe('BlockchainAddressRepository', () => {
  let addressRepository: BlockchainAddressRepository;
  const mockQuery = query as jest.MockedFunction<typeof query>;
  const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;

  const mockAddressRow = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    chain: 'ethereum' as BlockchainChain,
    address: '0x742d35cc6634c0532925a3b844bc9e7595f0ab3c',
    is_primary: true,
    verified_at: new Date(),
    label: 'Main Wallet',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    addressRepository = new BlockchainAddressRepository();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create address as primary if first', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [mockAddressRow], rowCount: 1 }),
      };
      mockTransaction.mockImplementation(async (callback) => callback(mockClient as never));

      const result = await addressRepository.create(
        mockAddressRow.user_id,
        {
          chain: 'ethereum',
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
          signature: '0xsignature',
          message: 'Sign this message',
          label: 'Main Wallet',
        },
        true
      );

      expect(result.isPrimary).toBe(true);
    });

    it('should create address as non-primary if not first', async () => {
      const nonPrimaryRow = { ...mockAddressRow, is_primary: false };
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [nonPrimaryRow], rowCount: 1 }),
      };
      mockTransaction.mockImplementation(async (callback) => callback(mockClient as never));

      const result = await addressRepository.create(
        mockAddressRow.user_id,
        {
          chain: 'ethereum',
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
          signature: '0xsignature',
          message: 'Sign this message',
        },
        false
      );

      expect(result.isPrimary).toBe(false);
    });
  });

  describe('findById', () => {
    it('should find address by id', async () => {
      mockQuery.mockResolvedValue({ rows: [mockAddressRow], rowCount: 1 } as never);

      const result = await addressRepository.findById(mockAddressRow.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockAddressRow.id);
    });

    it('should return null if not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const result = await addressRepository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByUserIdAndAddress', () => {
    it('should find address by user id and address', async () => {
      mockQuery.mockResolvedValue({ rows: [mockAddressRow], rowCount: 1 } as never);

      const result = await addressRepository.findByUserIdAndAddress(
        mockAddressRow.user_id,
        'ethereum',
        mockAddressRow.address
      );

      expect(result).not.toBeNull();
    });

    it('should return null if not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const result = await addressRepository.findByUserIdAndAddress(
        mockAddressRow.user_id,
        'ethereum',
        'nonexistent'
      );

      expect(result).toBeNull();
    });
  });

  describe('findByAddress', () => {
    it('should find address by chain and address', async () => {
      mockQuery.mockResolvedValue({ rows: [mockAddressRow], rowCount: 1 } as never);

      const result = await addressRepository.findByAddress('ethereum', mockAddressRow.address);

      expect(result).not.toBeNull();
    });

    it('should return null if not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const result = await addressRepository.findByAddress('ethereum', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAllByUserId', () => {
    it('should find all addresses by user id', async () => {
      mockQuery.mockResolvedValue({ rows: [mockAddressRow], rowCount: 1 } as never);

      const result = await addressRepository.findAllByUserId(mockAddressRow.user_id);

      expect(result).toHaveLength(1);
    });
  });

  describe('findPrimaryByUserId', () => {
    it('should find primary address', async () => {
      mockQuery.mockResolvedValue({ rows: [mockAddressRow], rowCount: 1 } as never);

      const result = await addressRepository.findPrimaryByUserId(mockAddressRow.user_id);

      expect(result).not.toBeNull();
      expect(result?.isPrimary).toBe(true);
    });

    it('should return null if no primary', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const result = await addressRepository.findPrimaryByUserId(mockAddressRow.user_id);

      expect(result).toBeNull();
    });
  });

  describe('setPrimary', () => {
    it('should set address as primary', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [mockAddressRow], rowCount: 1 }),
      };
      mockTransaction.mockImplementation(async (callback) => callback(mockClient as never));

      const result = await addressRepository.setPrimary(mockAddressRow.user_id, mockAddressRow.id);

      expect(result).not.toBeNull();
    });

    it('should return null if address not found', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      };
      mockTransaction.mockImplementation(async (callback) => callback(mockClient as never));

      const result = await addressRepository.setPrimary(mockAddressRow.user_id, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateLabel', () => {
    it('should update label', async () => {
      const updatedRow = { ...mockAddressRow, label: 'New Label' };
      mockQuery.mockResolvedValue({ rows: [updatedRow], rowCount: 1 } as never);

      const result = await addressRepository.updateLabel(
        mockAddressRow.user_id,
        mockAddressRow.id,
        'New Label'
      );

      expect(result?.label).toBe('New Label');
    });

    it('should return null if not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const result = await addressRepository.updateLabel(
        mockAddressRow.user_id,
        'nonexistent',
        'New Label'
      );

      expect(result).toBeNull();
    });
  });

  describe('verify', () => {
    it('should verify address', async () => {
      mockQuery.mockResolvedValue({ rows: [mockAddressRow], rowCount: 1 } as never);

      const result = await addressRepository.verify(mockAddressRow.user_id, mockAddressRow.id);

      expect(result).not.toBeNull();
    });

    it('should return null if not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const result = await addressRepository.verify(mockAddressRow.user_id, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete address and reassign primary', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [mockAddressRow], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
      };
      mockTransaction.mockImplementation(async (callback) => callback(mockClient as never));

      const result = await addressRepository.delete(mockAddressRow.user_id, mockAddressRow.id);

      expect(result).toBe(true);
    });

    it('should delete non-primary address without reassigning', async () => {
      const nonPrimaryRow = { ...mockAddressRow, is_primary: false };
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [nonPrimaryRow], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
      };
      mockTransaction.mockImplementation(async (callback) => callback(mockClient as never));

      const result = await addressRepository.delete(mockAddressRow.user_id, mockAddressRow.id);

      expect(result).toBe(true);
    });

    it('should return false if not found', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      };
      mockTransaction.mockImplementation(async (callback) => callback(mockClient as never));

      const result = await addressRepository.delete(mockAddressRow.user_id, 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('deleteAllByUserId', () => {
    it('should delete all addresses', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 3 } as never);

      const result = await addressRepository.deleteAllByUserId(mockAddressRow.user_id);

      expect(result).toBe(3);
    });

    it('should return 0 if no addresses', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: null } as never);

      const result = await addressRepository.deleteAllByUserId('nonexistent');

      expect(result).toBe(0);
    });
  });

  describe('countByUserId', () => {
    it('should return count', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '3' }], rowCount: 1 } as never);

      const result = await addressRepository.countByUserId(mockAddressRow.user_id);

      expect(result).toBe(3);
    });
  });

  describe('addressExists', () => {
    it('should return true if exists', async () => {
      mockQuery.mockResolvedValue({ rows: [{ exists: true }], rowCount: 1 } as never);

      const result = await addressRepository.addressExists('ethereum', mockAddressRow.address);

      expect(result).toBe(true);
    });

    it('should return false if not exists', async () => {
      mockQuery.mockResolvedValue({ rows: [{ exists: false }], rowCount: 1 } as never);

      const result = await addressRepository.addressExists('ethereum', 'nonexistent');

      expect(result).toBe(false);
    });
  });
});
