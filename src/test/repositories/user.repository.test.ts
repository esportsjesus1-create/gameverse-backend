import { UserRepository } from '../../repositories/user.repository';
import { query, transaction } from '../../config/database';
import { KycStatus, DEFAULT_USER_PREFERENCES } from '../../types';

jest.mock('../../config/database');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

describe('UserRepository', () => {
  let userRepository: UserRepository;
  const mockQuery = query as jest.MockedFunction<typeof query>;
  const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;

  const mockUserRow = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    username: 'testuser',
    display_name: 'Test User',
    avatar_url: null,
    bio: 'Test bio',
    email_verified: false,
    email_verification_token: 'token123',
    email_verification_expires: new Date(Date.now() + 86400000),
    kyc_status: 'none' as KycStatus,
    kyc_verified_at: null,
    kyc_provider: null,
    kyc_reference: null,
    preferences: DEFAULT_USER_PREFERENCES,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    anonymized_at: null,
  };

  beforeEach(() => {
    userRepository = new UserRepository();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUserRow], rowCount: 1 } as never);

      const result = await userRepository.create({
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'Test User',
        bio: 'Test bio',
      });

      expect(result.email).toBe('test@example.com');
      expect(result.username).toBe('testuser');
      expect(mockQuery).toHaveBeenCalled();
    });

    it('should create user without optional fields', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUserRow], rowCount: 1 } as never);

      const result = await userRepository.create({
        email: 'test@example.com',
        username: 'testuser',
      });

      expect(result.email).toBe('test@example.com');
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUserRow], rowCount: 1 } as never);

      const result = await userRepository.findById(mockUserRow.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockUserRow.id);
    });

    it('should return null if user not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const result = await userRepository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUserRow], rowCount: 1 } as never);

      const result = await userRepository.findByEmail('test@example.com');

      expect(result).not.toBeNull();
      expect(result?.email).toBe('test@example.com');
    });

    it('should return null if user not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const result = await userRepository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should find user by username', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUserRow], rowCount: 1 } as never);

      const result = await userRepository.findByUsername('testuser');

      expect(result).not.toBeNull();
      expect(result?.username).toBe('testuser');
    });

    it('should return null if user not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const result = await userRepository.findByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByVerificationToken', () => {
    it('should find user by verification token', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUserRow], rowCount: 1 } as never);

      const result = await userRepository.findByVerificationToken('token123');

      expect(result).not.toBeNull();
    });

    it('should return null if token not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const result = await userRepository.findByVerificationToken('invalid');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user', async () => {
      const updatedRow = { ...mockUserRow, display_name: 'Updated Name' };
      mockQuery.mockResolvedValue({ rows: [updatedRow], rowCount: 1 } as never);

      const result = await userRepository.update(mockUserRow.id, {
        displayName: 'Updated Name',
      });

      expect(result?.displayName).toBe('Updated Name');
    });

    it('should update username', async () => {
      const updatedRow = { ...mockUserRow, username: 'newusername' };
      mockQuery.mockResolvedValue({ rows: [updatedRow], rowCount: 1 } as never);

      const result = await userRepository.update(mockUserRow.id, {
        username: 'newusername',
      });

      expect(result?.username).toBe('newusername');
    });

    it('should update bio', async () => {
      const updatedRow = { ...mockUserRow, bio: 'New bio' };
      mockQuery.mockResolvedValue({ rows: [updatedRow], rowCount: 1 } as never);

      const result = await userRepository.update(mockUserRow.id, {
        bio: 'New bio',
      });

      expect(result?.bio).toBe('New bio');
    });

    it('should update preferences', async () => {
      const updatedRow = { ...mockUserRow };
      mockQuery.mockResolvedValue({ rows: [updatedRow], rowCount: 1 } as never);

      const result = await userRepository.update(mockUserRow.id, {
        preferences: { locale: 'en-US' },
      });

      expect(result).not.toBeNull();
    });

    it('should return current user if no updates', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUserRow], rowCount: 1 } as never);

      const result = await userRepository.update(mockUserRow.id, {});

      expect(result).not.toBeNull();
    });

    it('should return null if user not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const result = await userRepository.update('nonexistent', {
        displayName: 'Updated Name',
      });

      expect(result).toBeNull();
    });
  });

  describe('updateAvatar', () => {
    it('should update avatar', async () => {
      const updatedRow = { ...mockUserRow, avatar_url: 'https://example.com/avatar.jpg' };
      mockQuery.mockResolvedValue({ rows: [updatedRow], rowCount: 1 } as never);

      const result = await userRepository.updateAvatar(
        mockUserRow.id,
        'https://example.com/avatar.jpg'
      );

      expect(result?.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should return null if user not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const result = await userRepository.updateAvatar('nonexistent', 'https://example.com/avatar.jpg');

      expect(result).toBeNull();
    });
  });

  describe('verifyEmail', () => {
    it('should verify email', async () => {
      const verifiedRow = { ...mockUserRow, email_verified: true };
      mockQuery.mockResolvedValue({ rows: [verifiedRow], rowCount: 1 } as never);

      const result = await userRepository.verifyEmail(mockUserRow.id);

      expect(result?.emailVerified).toBe(true);
    });

    it('should return null if user not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const result = await userRepository.verifyEmail('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('regenerateVerificationToken', () => {
    it('should regenerate verification token', async () => {
      mockQuery.mockResolvedValue({ rows: [mockUserRow], rowCount: 1 } as never);

      const result = await userRepository.regenerateVerificationToken(mockUserRow.id);

      expect(result).not.toBeNull();
    });

    it('should return null if user not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const result = await userRepository.regenerateVerificationToken('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateKycStatus', () => {
    it('should update KYC status', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [{ ...mockUserRow, kyc_status: 'verified' }], rowCount: 1 }),
      };
      mockTransaction.mockImplementation(async (callback) => callback(mockClient as never));

      const result = await userRepository.updateKycStatus(mockUserRow.id, {
        status: 'verified',
        provider: 'provider1',
        reference: 'ref123',
      });

      expect(result?.kycStatus).toBe('verified');
    });

    it('should return null if user not found', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      };
      mockTransaction.mockImplementation(async (callback) => callback(mockClient as never));

      const result = await userRepository.updateKycStatus('nonexistent', {
        status: 'verified',
      });

      expect(result).toBeNull();
    });
  });

  describe('getKycHistory', () => {
    it('should return KYC history', async () => {
      const historyRow = {
        id: '1',
        user_id: mockUserRow.id,
        status: 'pending' as KycStatus,
        provider: null,
        reference: null,
        created_at: new Date(),
      };
      mockQuery.mockResolvedValue({ rows: [historyRow], rowCount: 1 } as never);

      const result = await userRepository.getKycHistory(mockUserRow.id);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });
  });

  describe('softDelete', () => {
    it('should soft delete user', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never);

      const result = await userRepository.softDelete(mockUserRow.id);

      expect(result).toBe(true);
    });

    it('should return false if user not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const result = await userRepository.softDelete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('anonymize', () => {
    it('should anonymize user', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
      };
      mockTransaction.mockImplementation(async (callback) => callback(mockClient as never));

      const result = await userRepository.anonymize(mockUserRow.id);

      expect(result).toBe(true);
    });

    it('should return false if user not found', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 0 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      };
      mockTransaction.mockImplementation(async (callback) => callback(mockClient as never));

      const result = await userRepository.anonymize('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [mockUserRow], rowCount: 1 } as never);

      const result = await userRepository.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('exists', () => {
    it('should return true if user exists', async () => {
      mockQuery.mockResolvedValue({ rows: [{ exists: true }], rowCount: 1 } as never);

      const result = await userRepository.exists(mockUserRow.id);

      expect(result).toBe(true);
    });

    it('should return false if user does not exist', async () => {
      mockQuery.mockResolvedValue({ rows: [{ exists: false }], rowCount: 1 } as never);

      const result = await userRepository.exists('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('emailExists', () => {
    it('should return true if email exists', async () => {
      mockQuery.mockResolvedValue({ rows: [{ exists: true }], rowCount: 1 } as never);

      const result = await userRepository.emailExists('test@example.com');

      expect(result).toBe(true);
    });

    it('should return false if email does not exist', async () => {
      mockQuery.mockResolvedValue({ rows: [{ exists: false }], rowCount: 1 } as never);

      const result = await userRepository.emailExists('nonexistent@example.com');

      expect(result).toBe(false);
    });
  });

  describe('usernameExists', () => {
    it('should return true if username exists', async () => {
      mockQuery.mockResolvedValue({ rows: [{ exists: true }], rowCount: 1 } as never);

      const result = await userRepository.usernameExists('testuser');

      expect(result).toBe(true);
    });

    it('should return false if username does not exist', async () => {
      mockQuery.mockResolvedValue({ rows: [{ exists: false }], rowCount: 1 } as never);

      const result = await userRepository.usernameExists('nonexistent');

      expect(result).toBe(false);
    });
  });
});
