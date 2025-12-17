import { Request, Response, NextFunction } from 'express';
import { UserController } from '../../controllers/user.controller';
import { UserService } from '../../services/user.service';
import { AvatarService } from '../../services/avatar.service';
import { UserProfile, KycStatus, DEFAULT_USER_PREFERENCES } from '../../types';

describe('UserController', () => {
  let userController: UserController;
  let mockUserService: jest.Mocked<UserService>;
  let mockAvatarService: jest.Mocked<AvatarService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock<ReturnType<NextFunction>, Parameters<NextFunction>>;

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
    mockUserService = {
      createUser: jest.fn(),
      getUserById: jest.fn(),
      getUserByEmail: jest.fn(),
      getUserByUsername: jest.fn(),
      updateUser: jest.fn(),
      updateAvatar: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerificationEmail: jest.fn(),
      updateKycStatus: jest.fn(),
      getKycHistory: jest.fn(),
      deleteUser: jest.fn(),
      anonymizeUser: jest.fn(),
      getAllUsers: jest.fn(),
      exportUserData: jest.fn(),
      userExists: jest.fn(),
    } as unknown as jest.Mocked<UserService>;

    mockAvatarService = {
      uploadAvatar: jest.fn(),
      deleteAvatar: jest.fn(),
      getPresignedUploadUrl: jest.fn(),
      getPresignedDownloadUrl: jest.fn(),
    } as unknown as jest.Mocked<AvatarService>;

    userController = new UserController(mockUserService, mockAvatarService);

    mockReq = {
      body: {},
      params: {},
      query: {},
      file: undefined,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  const waitForAsync = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

  describe('createUser', () => {
    it('should create user successfully', async () => {
      mockReq.body = { email: 'test@example.com', username: 'testuser' };
      mockUserService.createUser.mockResolvedValue(mockUser);

      userController.createUser(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser,
        message: 'User created successfully',
      });
    });

    it('should call next with error for email already exists', async () => {
      mockReq.body = { email: 'test@example.com', username: 'testuser' };
      mockUserService.createUser.mockRejectedValue(new Error('Email already exists'));

      userController.createUser(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next with error for username already exists', async () => {
      mockReq.body = { email: 'test@example.com', username: 'testuser' };
      mockUserService.createUser.mockRejectedValue(new Error('Username already exists'));

      userController.createUser(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
    });

    it('should rethrow non-conflict errors', async () => {
      mockReq.body = { email: 'test@example.com', username: 'testuser' };
      mockUserService.createUser.mockRejectedValue(new Error('Database error'));

      userController.createUser(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('Database error');
    });
  });

  describe('getUser', () => {
    it('should return user by id', async () => {
      mockReq.params = { id: mockUser.id };
      mockUserService.getUserById.mockResolvedValue(mockUser);

      userController.getUser(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser,
      });
    });

    it('should call next with NotFoundError if user not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockUserService.getUserById.mockResolvedValue(null);

      userController.getUser(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('User not found');
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      mockReq.query = { email: 'test@example.com' };
      mockUserService.getUserByEmail.mockResolvedValue(mockUser);

      userController.getUserByEmail(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser,
      });
    });

    it('should call next with BadRequestError if email not provided', async () => {
      mockReq.query = {};

      userController.getUserByEmail(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('Email is required');
    });

    it('should call next with NotFoundError if user not found', async () => {
      mockReq.query = { email: 'nonexistent@example.com' };
      mockUserService.getUserByEmail.mockResolvedValue(null);

      userController.getUserByEmail(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('User not found');
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      mockReq.params = { id: mockUser.id };
      mockReq.body = { displayName: 'Updated Name' };
      const updatedUser = { ...mockUser, displayName: 'Updated Name' };
      mockUserService.updateUser.mockResolvedValue(updatedUser);

      userController.updateUser(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedUser,
        message: 'User updated successfully',
      });
    });

    it('should call next with NotFoundError if user not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockReq.body = { displayName: 'Updated Name' };
      mockUserService.updateUser.mockResolvedValue(null);

      userController.updateUser(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('User not found');
    });

    it('should handle username conflict', async () => {
      mockReq.params = { id: mockUser.id };
      mockReq.body = { username: 'takenusername' };
      mockUserService.updateUser.mockRejectedValue(new Error('Username already exists'));

      userController.updateUser(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
    });

    it('should rethrow non-conflict errors', async () => {
      mockReq.params = { id: mockUser.id };
      mockReq.body = { displayName: 'Updated Name' };
      mockUserService.updateUser.mockRejectedValue(new Error('Database error'));

      userController.updateUser(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('Database error');
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockReq.params = { id: mockUser.id };
      mockUserService.deleteUser.mockResolvedValue(true);

      userController.deleteUser(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User deleted successfully',
      });
    });

    it('should call next with NotFoundError if user not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockUserService.deleteUser.mockResolvedValue(false);

      userController.deleteUser(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('User not found');
    });
  });

  describe('getAllUsers', () => {
    it('should return paginated users', async () => {
      mockReq.query = { page: '1', limit: '20' };
      const paginatedResult = {
        data: [mockUser],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockUserService.getAllUsers.mockResolvedValue(paginatedResult);

      userController.getAllUsers(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: paginatedResult,
      });
    });

    it('should use default pagination', async () => {
      mockReq.query = {};
      const paginatedResult = {
        data: [mockUser],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockUserService.getAllUsers.mockResolvedValue(paginatedResult);

      userController.getAllUsers(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockUserService.getAllUsers).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });
  });

  describe('uploadAvatar', () => {
    it('should upload avatar successfully', async () => {
      mockReq.params = { id: mockUser.id };
      mockReq.file = {
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
      } as Express.Multer.File;
      mockUserService.userExists.mockResolvedValue(true);
      mockAvatarService.uploadAvatar.mockResolvedValue({
        url: 'https://example.com/avatar.jpg',
        thumbnailUrl: 'https://example.com/avatar_thumb.jpg',
        key: 'avatars/user/avatar.jpg',
      });
      const updatedUser = { ...mockUser, avatarUrl: 'https://example.com/avatar.jpg' };
      mockUserService.updateAvatar.mockResolvedValue(updatedUser);

      userController.uploadAvatar(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedUser,
        message: 'Avatar uploaded successfully',
      });
    });

    it('should call next with BadRequestError if no file uploaded', async () => {
      mockReq.params = { id: mockUser.id };

      userController.uploadAvatar(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('No file uploaded');
    });

    it('should call next with NotFoundError if user not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockReq.file = {
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
      } as Express.Multer.File;
      mockUserService.userExists.mockResolvedValue(false);

      userController.uploadAvatar(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('User not found');
    });

    it('should call next with NotFoundError if updateAvatar returns null', async () => {
      mockReq.params = { id: mockUser.id };
      mockReq.file = {
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
      } as Express.Multer.File;
      mockUserService.userExists.mockResolvedValue(true);
      mockAvatarService.uploadAvatar.mockResolvedValue({
        url: 'https://example.com/avatar.jpg',
        thumbnailUrl: 'https://example.com/avatar_thumb.jpg',
        key: 'avatars/user/avatar.jpg',
      });
      mockUserService.updateAvatar.mockResolvedValue(null);

      userController.uploadAvatar(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('User not found');
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      mockReq.params = { token: 'valid-token' };
      const verifiedUser = { ...mockUser, emailVerified: true };
      mockUserService.verifyEmail.mockResolvedValue(verifiedUser);

      userController.verifyEmail(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: verifiedUser,
        message: 'Email verified successfully',
      });
    });

    it('should call next with BadRequestError for invalid token', async () => {
      mockReq.params = { token: 'invalid-token' };
      mockUserService.verifyEmail.mockResolvedValue(null);

      userController.verifyEmail(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('Invalid or expired verification token');
    });
  });

  describe('resendVerification', () => {
    it('should resend verification email', async () => {
      mockReq.params = { id: mockUser.id };
      mockUserService.resendVerificationEmail.mockResolvedValue(mockUser);

      userController.resendVerification(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Verification email sent' },
      });
    });

    it('should call next with NotFoundError if user not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockUserService.resendVerificationEmail.mockResolvedValue(null);

      userController.resendVerification(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('User not found');
    });

    it('should call next with BadRequestError if email already verified', async () => {
      mockReq.params = { id: mockUser.id };
      mockUserService.resendVerificationEmail.mockRejectedValue(
        new Error('Email already verified')
      );

      userController.resendVerification(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
    });

    it('should rethrow non-verification errors', async () => {
      mockReq.params = { id: mockUser.id };
      mockUserService.resendVerificationEmail.mockRejectedValue(new Error('Database error'));

      userController.resendVerification(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('Database error');
    });
  });

  describe('updateKycStatus', () => {
    it('should update KYC status', async () => {
      mockReq.params = { id: mockUser.id };
      mockReq.body = { status: 'verified', provider: 'provider1' };
      const updatedUser = { ...mockUser, kycStatus: 'verified' as KycStatus };
      mockUserService.updateKycStatus.mockResolvedValue(updatedUser);

      userController.updateKycStatus(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedUser,
        message: 'KYC status updated successfully',
      });
    });

    it('should call next with NotFoundError if user not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockReq.body = { status: 'verified' };
      mockUserService.updateKycStatus.mockResolvedValue(null);

      userController.updateKycStatus(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('User not found');
    });
  });

  describe('getKycHistory', () => {
    it('should return KYC history', async () => {
      mockReq.params = { id: mockUser.id };
      const history = [
        { id: '1', userId: mockUser.id, status: 'pending' as KycStatus, provider: null, reference: null, createdAt: new Date() },
      ];
      mockUserService.userExists.mockResolvedValue(true);
      mockUserService.getKycHistory.mockResolvedValue(history);

      userController.getKycHistory(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: history,
      });
    });

    it('should call next with NotFoundError if user not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockUserService.userExists.mockResolvedValue(false);

      userController.getKycHistory(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('User not found');
    });
  });

  describe('exportData', () => {
    it('should export data as JSON', async () => {
      mockReq.params = { id: mockUser.id };
      mockReq.query = { format: 'json' };
      const exportData = {
        profile: mockUser,
        blockchainAddresses: [],
        kycHistory: [],
        exportedAt: new Date(),
        format: 'json' as const,
      };
      mockUserService.exportUserData.mockResolvedValue(exportData);

      userController.exportData(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should export data as CSV', async () => {
      mockReq.params = { id: mockUser.id };
      mockReq.query = { format: 'csv' };
      mockUserService.exportUserData.mockResolvedValue('csv,data');

      userController.exportData(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockRes.send).toHaveBeenCalledWith('csv,data');
    });

    it('should default to JSON format', async () => {
      mockReq.params = { id: mockUser.id };
      mockReq.query = {};
      const exportData = {
        profile: mockUser,
        blockchainAddresses: [],
        kycHistory: [],
        exportedAt: new Date(),
        format: 'json' as const,
      };
      mockUserService.exportUserData.mockResolvedValue(exportData);

      userController.exportData(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockUserService.exportUserData).toHaveBeenCalledWith(mockUser.id, 'json');
    });

    it('should call next with NotFoundError if user not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockReq.query = { format: 'json' };
      mockUserService.exportUserData.mockRejectedValue(new Error('User not found'));

      userController.exportData(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
    });

    it('should rethrow non-not-found errors', async () => {
      mockReq.params = { id: mockUser.id };
      mockReq.query = { format: 'json' };
      mockUserService.exportUserData.mockRejectedValue(new Error('Database error'));

      userController.exportData(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('Database error');
    });
  });

  describe('anonymizeUser', () => {
    it('should anonymize user successfully', async () => {
      mockReq.params = { id: mockUser.id };
      const anonymizedUser = { ...mockUser, anonymizedAt: new Date() };
      mockUserService.anonymizeUser.mockResolvedValue(anonymizedUser);

      userController.anonymizeUser(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User data anonymized successfully (right to be forgotten)',
      });
    });

    it('should call next with NotFoundError if user not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockUserService.anonymizeUser.mockResolvedValue(null);

      userController.anonymizeUser(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('User not found');
    });
  });
});
