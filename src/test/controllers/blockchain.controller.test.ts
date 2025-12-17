import { Request, Response, NextFunction } from 'express';
import { BlockchainController } from '../../controllers/blockchain.controller';
import { BlockchainService } from '../../services/blockchain.service';
import { UserService } from '../../services/user.service';
import { BlockchainAddress, BlockchainChain } from '../../types';

describe('BlockchainController', () => {
  let blockchainController: BlockchainController;
  let mockBlockchainService: jest.Mocked<BlockchainService>;
  let mockUserService: jest.Mocked<UserService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock<ReturnType<NextFunction>, Parameters<NextFunction>>;

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
    mockBlockchainService = {
      linkAddress: jest.fn(),
      verifySignature: jest.fn(),
      getAddresses: jest.fn(),
      getAddressById: jest.fn(),
      setPrimaryAddress: jest.fn(),
      updateAddressLabel: jest.fn(),
      unlinkAddress: jest.fn(),
      getAddressCount: jest.fn(),
      generateSigningMessage: jest.fn(),
      isValidAddress: jest.fn(),
    } as unknown as jest.Mocked<BlockchainService>;

    mockUserService = {
      userExists: jest.fn(),
    } as unknown as jest.Mocked<UserService>;

    blockchainController = new BlockchainController(mockBlockchainService, mockUserService);

    mockReq = {
      body: {},
      params: {},
      query: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  const waitForAsync = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

  describe('linkAddress', () => {
    it('should link address successfully', async () => {
      mockReq.params = { id: mockAddress.userId };
      mockReq.body = {
        chain: 'ethereum',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
      };
      mockUserService.userExists.mockResolvedValue(true);
      mockBlockchainService.isValidAddress.mockReturnValue(true);
      mockBlockchainService.linkAddress.mockResolvedValue(mockAddress);

      blockchainController.linkAddress(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockAddress,
        message: 'Address linked successfully',
      });
    });

    it('should call next with NotFoundError if user not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockReq.body = {
        chain: 'ethereum',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
      };
      mockUserService.userExists.mockResolvedValue(false);

      blockchainController.linkAddress(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('User not found');
    });

    it('should call next with BadRequestError for invalid address format', async () => {
      mockReq.params = { id: mockAddress.userId };
      mockReq.body = {
        chain: 'ethereum',
        address: 'invalid',
        signature: '0xsignature',
        message: 'Sign this message',
      };
      mockUserService.userExists.mockResolvedValue(true);
      mockBlockchainService.isValidAddress.mockReturnValue(false);

      blockchainController.linkAddress(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('Invalid blockchain address format');
    });

    it('should call next with ConflictError if address already linked', async () => {
      mockReq.params = { id: mockAddress.userId };
      mockReq.body = {
        chain: 'ethereum',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
      };
      mockUserService.userExists.mockResolvedValue(true);
      mockBlockchainService.isValidAddress.mockReturnValue(true);
      mockBlockchainService.linkAddress.mockRejectedValue(
        new Error('Address already linked to another account')
      );

      blockchainController.linkAddress(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next with BadRequestError for invalid signature', async () => {
      mockReq.params = { id: mockAddress.userId };
      mockReq.body = {
        chain: 'ethereum',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
      };
      mockUserService.userExists.mockResolvedValue(true);
      mockBlockchainService.isValidAddress.mockReturnValue(true);
      mockBlockchainService.linkAddress.mockRejectedValue(new Error('Invalid signature'));

      blockchainController.linkAddress(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
    });

    it('should rethrow other errors', async () => {
      mockReq.params = { id: mockAddress.userId };
      mockReq.body = {
        chain: 'ethereum',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
      };
      mockUserService.userExists.mockResolvedValue(true);
      mockBlockchainService.isValidAddress.mockReturnValue(true);
      mockBlockchainService.linkAddress.mockRejectedValue(new Error('Database error'));

      blockchainController.linkAddress(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('Database error');
    });
  });

  describe('getAddresses', () => {
    it('should return addresses', async () => {
      mockReq.params = { id: mockAddress.userId };
      mockUserService.userExists.mockResolvedValue(true);
      mockBlockchainService.getAddresses.mockResolvedValue([mockAddress]);

      blockchainController.getAddresses(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [mockAddress],
      });
    });

    it('should call next with NotFoundError if user not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockUserService.userExists.mockResolvedValue(false);

      blockchainController.getAddresses(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('User not found');
    });
  });

  describe('getAddress', () => {
    it('should return specific address', async () => {
      mockReq.params = { id: mockAddress.userId, addressId: mockAddress.id };
      mockBlockchainService.getAddressById.mockResolvedValue(mockAddress);

      blockchainController.getAddress(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockAddress,
      });
    });

    it('should call next with NotFoundError if address not found', async () => {
      mockReq.params = { id: mockAddress.userId, addressId: 'nonexistent' };
      mockBlockchainService.getAddressById.mockResolvedValue(null);

      blockchainController.getAddress(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('Address not found');
    });
  });

  describe('setPrimaryAddress', () => {
    it('should set primary address', async () => {
      mockReq.params = { id: mockAddress.userId, addressId: mockAddress.id };
      mockUserService.userExists.mockResolvedValue(true);
      mockBlockchainService.setPrimaryAddress.mockResolvedValue(mockAddress);

      blockchainController.setPrimaryAddress(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockAddress,
        message: 'Primary address updated',
      });
    });

    it('should call next with NotFoundError if user not found', async () => {
      mockReq.params = { id: 'nonexistent', addressId: mockAddress.id };
      mockUserService.userExists.mockResolvedValue(false);

      blockchainController.setPrimaryAddress(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('User not found');
    });

    it('should call next with NotFoundError if address not found', async () => {
      mockReq.params = { id: mockAddress.userId, addressId: 'nonexistent' };
      mockUserService.userExists.mockResolvedValue(true);
      mockBlockchainService.setPrimaryAddress.mockResolvedValue(null);

      blockchainController.setPrimaryAddress(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('Address not found');
    });
  });

  describe('updateAddressLabel', () => {
    it('should update address label', async () => {
      mockReq.params = { id: mockAddress.userId, addressId: mockAddress.id };
      mockReq.body = { label: 'New Label' };
      const updatedAddress = { ...mockAddress, label: 'New Label' };
      mockBlockchainService.updateAddressLabel.mockResolvedValue(updatedAddress);

      blockchainController.updateAddressLabel(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedAddress,
        message: 'Address label updated',
      });
    });

    it('should call next with NotFoundError if address not found', async () => {
      mockReq.params = { id: mockAddress.userId, addressId: 'nonexistent' };
      mockReq.body = { label: 'New Label' };
      mockBlockchainService.updateAddressLabel.mockResolvedValue(null);

      blockchainController.updateAddressLabel(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('Address not found');
    });
  });

  describe('unlinkAddress', () => {
    it('should unlink address', async () => {
      mockReq.params = { id: mockAddress.userId, addressId: mockAddress.id };
      mockBlockchainService.unlinkAddress.mockResolvedValue(true);

      blockchainController.unlinkAddress(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Address unlinked successfully',
      });
    });

    it('should call next with NotFoundError if address not found', async () => {
      mockReq.params = { id: mockAddress.userId, addressId: 'nonexistent' };
      mockBlockchainService.unlinkAddress.mockResolvedValue(false);

      blockchainController.unlinkAddress(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('Address not found');
    });
  });

  describe('getSigningMessage', () => {
    it('should return signing message', async () => {
      mockReq.params = { id: mockAddress.userId };
      mockReq.query = { chain: 'ethereum' };
      mockUserService.userExists.mockResolvedValue(true);
      mockBlockchainService.generateSigningMessage.mockReturnValue('Sign this message');

      blockchainController.getSigningMessage(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Sign this message', chain: 'ethereum' },
      });
    });

    it('should call next with BadRequestError if chain not provided', async () => {
      mockReq.params = { id: mockAddress.userId };
      mockReq.query = {};

      blockchainController.getSigningMessage(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('Chain is required');
    });

    it('should call next with NotFoundError if user not found', async () => {
      mockReq.params = { id: 'nonexistent' };
      mockReq.query = { chain: 'ethereum' };
      mockUserService.userExists.mockResolvedValue(false);

      blockchainController.getSigningMessage(mockReq as Request, mockRes as Response, mockNext);
      await waitForAsync();

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0] as Error;
      expect(error.message).toBe('User not found');
    });
  });
});
