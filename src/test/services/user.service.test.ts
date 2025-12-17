import { UserService } from '../../services/user.service';
import { UserRepository } from '../../repositories/user.repository';
import { BlockchainAddressRepository } from '../../repositories/blockchain-address.repository';
import { CacheService } from '../../config/redis';
import { UserProfile, CreateUserProfileInput, UpdateUserProfileInput, KycStatus, DEFAULT_USER_PREFERENCES } from '../../types';

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockAddressRepo: jest.Mocked<BlockchainAddressRepository>;
  let mockCache: jest.Mocked<CacheService>;

  const mockUser: UserProfile = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: null,
    bio: 'Test bio',
    emailVerified: false,
    emailVerificationToken: 'token123',
    emailVerificationExpires: new Date(Date.now() + 86400000),
    kycStatus: 'none' as KycStatus,
    kycVerifiedAt: null,
    kycProvider: null,
    kycReference: null,
    preferences: DEFAULT_USER_PREFERENCES,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    anonymizedAt: null,
  };

  beforeEach(() => {
    mockUserRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      findByVerificationToken: jest.fn(),
      update: jest.fn(),
      updateAvatar: jest.fn(),
      verifyEmail: jest.fn(),
      regenerateVerificationToken: jest.fn(),
      updateKycStatus: jest.fn(),
      getKycHistory: jest.fn(),
      softDelete: jest.fn(),
      anonymize: jest.fn(),
      findAll: jest.fn(),
      exists: jest.fn(),
      emailExists: jest.fn(),
      usernameExists: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    mockAddressRepo = {
      findAllByUserId: jest.fn(),
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

    userService = new UserService(mockUserRepo, mockAddressRepo, mockCache);
  });

  describe('createUser', () => {
    const createInput: CreateUserProfileInput = {
      email: 'test@example.com',
      username: 'testuser',
      displayName: 'Test User',
      bio: 'Test bio',
    };

    it('should create a new user successfully', async () => {
      mockUserRepo.emailExists.mockResolvedValue(false);
      mockUserRepo.usernameExists.mockResolvedValue(false);
      mockUserRepo.create.mockResolvedValue(mockUser);

      const result = await userService.createUser(createInput);

      expect(result).toEqual(mockUser);
      expect(mockUserRepo.emailExists).toHaveBeenCalledWith('test@example.com');
      expect(mockUserRepo.usernameExists).toHaveBeenCalledWith('testuser');
      expect(mockUserRepo.create).toHaveBeenCalledWith(createInput);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should throw error if email already exists', async () => {
      mockUserRepo.emailExists.mockResolvedValue(true);

      await expect(userService.createUser(createInput)).rejects.toThrow('Email already exists');
    });

    it('should throw error if username already exists', async () => {
      mockUserRepo.emailExists.mockResolvedValue(false);
      mockUserRepo.usernameExists.mockResolvedValue(true);

      await expect(userService.createUser(createInput)).rejects.toThrow('Username already exists');
    });
  });

  describe('getUserById', () => {
    it('should return cached user if available', async () => {
      mockCache.get.mockResolvedValue(mockUser);

      const result = await userService.getUserById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(mockCache.get).toHaveBeenCalled();
      expect(mockUserRepo.findById).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in cache', async () => {
      mockCache.get.mockResolvedValue(null);
      mockUserRepo.findById.mockResolvedValue(mockUser);

      const result = await userService.getUserById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(mockUserRepo.findById).toHaveBeenCalledWith(mockUser.id);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should return null if user not found', async () => {
      mockCache.get.mockResolvedValue(null);
      mockUserRepo.findById.mockResolvedValue(null);

      const result = await userService.getUserById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      const result = await userService.getUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('getUserByUsername', () => {
    it('should return user by username', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);

      const result = await userService.getUserByUsername('testuser');

      expect(result).toEqual(mockUser);
      expect(mockUserRepo.findByUsername).toHaveBeenCalledWith('testuser');
    });
  });

  describe('updateUser', () => {
    const updateInput: UpdateUserProfileInput = {
      displayName: 'Updated Name',
      bio: 'Updated bio',
    };

    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, ...updateInput };
      mockUserRepo.update.mockResolvedValue(updatedUser);

      const result = await userService.updateUser(mockUser.id, updateInput);

      expect(result).toEqual(updatedUser);
      expect(mockCache.invalidateUserCache).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw error if username already taken by another user', async () => {
      const existingUser = { ...mockUser, id: 'different-id' };
      mockUserRepo.findByUsername.mockResolvedValue(existingUser);

      await expect(
        userService.updateUser(mockUser.id, { username: 'takenusername' })
      ).rejects.toThrow('Username already exists');
    });

    it('should allow updating to same username', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      mockUserRepo.update.mockResolvedValue(mockUser);

      const result = await userService.updateUser(mockUser.id, { username: mockUser.username });

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockUserRepo.update.mockResolvedValue(null);

      const result = await userService.updateUser('nonexistent', updateInput);

      expect(result).toBeNull();
    });
  });

  describe('updateAvatar', () => {
    it('should update avatar successfully', async () => {
      const updatedUser = { ...mockUser, avatarUrl: 'https://example.com/avatar.jpg' };
      mockUserRepo.updateAvatar.mockResolvedValue(updatedUser);

      const result = await userService.updateAvatar(mockUser.id, 'https://example.com/avatar.jpg');

      expect(result).toEqual(updatedUser);
      expect(mockCache.invalidateUserCache).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const verifiedUser = { ...mockUser, emailVerified: true };
      mockUserRepo.findByVerificationToken.mockResolvedValue(mockUser);
      mockUserRepo.verifyEmail.mockResolvedValue(verifiedUser);

      const result = await userService.verifyEmail('valid-token');

      expect(result).toEqual(verifiedUser);
      expect(mockCache.invalidateUserCache).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return null for invalid token', async () => {
      mockUserRepo.findByVerificationToken.mockResolvedValue(null);

      const result = await userService.verifyEmail('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('resendVerificationEmail', () => {
    it('should regenerate verification token', async () => {
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockUserRepo.regenerateVerificationToken.mockResolvedValue(mockUser);

      const result = await userService.resendVerificationEmail(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(mockCache.invalidateUserCache).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return null if user not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      const result = await userService.resendVerificationEmail('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error if email already verified', async () => {
      const verifiedUser = { ...mockUser, emailVerified: true };
      mockUserRepo.findById.mockResolvedValue(verifiedUser);

      await expect(userService.resendVerificationEmail(mockUser.id)).rejects.toThrow(
        'Email already verified'
      );
    });
  });

  describe('updateKycStatus', () => {
    it('should update KYC status', async () => {
      const updatedUser = { ...mockUser, kycStatus: 'verified' as KycStatus };
      mockUserRepo.updateKycStatus.mockResolvedValue(updatedUser);

      const result = await userService.updateKycStatus(mockUser.id, {
        status: 'verified',
        provider: 'provider1',
      });

      expect(result).toEqual(updatedUser);
      expect(mockCache.invalidateUserCache).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('getKycHistory', () => {
    it('should return KYC history', async () => {
      const history = [
        { id: '1', userId: mockUser.id, status: 'pending' as KycStatus, provider: null, reference: null, createdAt: new Date() },
      ];
      mockUserRepo.getKycHistory.mockResolvedValue(history);

      const result = await userService.getKycHistory(mockUser.id);

      expect(result).toEqual(history);
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user', async () => {
      mockUserRepo.softDelete.mockResolvedValue(true);

      const result = await userService.deleteUser(mockUser.id);

      expect(result).toBe(true);
      expect(mockCache.invalidateUserCache).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return false if user not found', async () => {
      mockUserRepo.softDelete.mockResolvedValue(false);

      const result = await userService.deleteUser('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('anonymizeUser', () => {
    it('should anonymize user data', async () => {
      mockUserRepo.anonymize.mockResolvedValue(true);

      const result = await userService.anonymizeUser(mockUser.id);

      expect(result).toBe(true);
      expect(mockCache.invalidateUserCache).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('getAllUsers', () => {
    it('should return paginated users', async () => {
      const paginatedResult = {
        data: [mockUser],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockUserRepo.findAll.mockResolvedValue(paginatedResult);

      const result = await userService.getAllUsers({ page: 1, limit: 20 });

      expect(result).toEqual(paginatedResult);
    });
  });

  describe('exportUserData', () => {
    it('should export user data as JSON', async () => {
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockAddressRepo.findAllByUserId.mockResolvedValue([]);
      mockUserRepo.getKycHistory.mockResolvedValue([]);

      const result = await userService.exportUserData(mockUser.id, 'json');

      expect(result).toHaveProperty('profile');
      expect(result).toHaveProperty('blockchainAddresses');
      expect(result).toHaveProperty('kycHistory');
      expect(result).toHaveProperty('exportedAt');
    });

    it('should export user data as CSV', async () => {
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockAddressRepo.findAllByUserId.mockResolvedValue([]);
      mockUserRepo.getKycHistory.mockResolvedValue([]);

      const result = await userService.exportUserData(mockUser.id, 'csv');

      expect(typeof result).toBe('string');
      expect(result).toContain('USER PROFILE');
    });

    it('should throw error if user not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(userService.exportUserData('nonexistent', 'json')).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('userExists', () => {
    it('should return true if user exists', async () => {
      mockUserRepo.exists.mockResolvedValue(true);

      const result = await userService.userExists(mockUser.id);

      expect(result).toBe(true);
    });

    it('should return false if user does not exist', async () => {
      mockUserRepo.exists.mockResolvedValue(false);

      const result = await userService.userExists('nonexistent');

      expect(result).toBe(false);
    });
  });
});
