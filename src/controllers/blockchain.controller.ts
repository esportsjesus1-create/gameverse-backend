import { Request, Response } from 'express';
import { BlockchainService, blockchainService } from '../services/blockchain.service';
import { UserService, userService } from '../services/user.service';
import {
  asyncHandler,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../middleware/error.middleware';
import { ApiResponse, BlockchainAddress, BlockchainChain } from '../types';

export class BlockchainController {
  constructor(
    private blockchainSvc: BlockchainService = blockchainService,
    private userSvc: UserService = userService
  ) {}

  linkAddress = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.params.id;

    const exists = await this.userSvc.userExists(userId);
    if (!exists) {
      throw new NotFoundError('User not found');
    }

    if (!this.blockchainSvc.isValidAddress(req.body.chain, req.body.address)) {
      throw new BadRequestError('Invalid blockchain address format');
    }

    try {
      const address = await this.blockchainSvc.linkAddress(userId, req.body);
      const response: ApiResponse<BlockchainAddress> = {
        success: true,
        data: address,
        message: 'Address linked successfully',
      };
      res.status(201).json(response);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already linked')) {
          throw new ConflictError(error.message);
        }
        if (error.message === 'Invalid signature') {
          throw new BadRequestError(error.message);
        }
      }
      throw error;
    }
  });

  getAddresses = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.params.id;

    const exists = await this.userSvc.userExists(userId);
    if (!exists) {
      throw new NotFoundError('User not found');
    }

    const addresses = await this.blockchainSvc.getAddresses(userId);
    const response: ApiResponse<BlockchainAddress[]> = {
      success: true,
      data: addresses,
    };
    res.json(response);
  });

  getAddress = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id: userId, addressId } = req.params;

    const address = await this.blockchainSvc.getAddressById(userId, addressId);
    if (!address) {
      throw new NotFoundError('Address not found');
    }

    const response: ApiResponse<BlockchainAddress> = {
      success: true,
      data: address,
    };
    res.json(response);
  });

  setPrimaryAddress = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id: userId, addressId } = req.params;

    const exists = await this.userSvc.userExists(userId);
    if (!exists) {
      throw new NotFoundError('User not found');
    }

    const address = await this.blockchainSvc.setPrimaryAddress(userId, addressId);
    if (!address) {
      throw new NotFoundError('Address not found');
    }

    const response: ApiResponse<BlockchainAddress> = {
      success: true,
      data: address,
      message: 'Primary address updated',
    };
    res.json(response);
  });

  updateAddressLabel = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id: userId, addressId } = req.params;
    const { label } = req.body;

    const address = await this.blockchainSvc.updateAddressLabel(userId, addressId, label);
    if (!address) {
      throw new NotFoundError('Address not found');
    }

    const response: ApiResponse<BlockchainAddress> = {
      success: true,
      data: address,
      message: 'Address label updated',
    };
    res.json(response);
  });

  unlinkAddress = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id: userId, addressId } = req.params;

    const deleted = await this.blockchainSvc.unlinkAddress(userId, addressId);
    if (!deleted) {
      throw new NotFoundError('Address not found');
    }

    const response: ApiResponse<null> = {
      success: true,
      message: 'Address unlinked successfully',
    };
    res.json(response);
  });

  getSigningMessage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.params.id;
    const chain = req.query.chain as BlockchainChain;

    if (!chain) {
      throw new BadRequestError('Chain is required');
    }

    const exists = await this.userSvc.userExists(userId);
    if (!exists) {
      throw new NotFoundError('User not found');
    }

    const message = this.blockchainSvc.generateSigningMessage(userId, chain);
    const response: ApiResponse<{ message: string; chain: BlockchainChain }> = {
      success: true,
      data: { message, chain },
    };
    res.json(response);
  });
}

export const blockchainController = new BlockchainController();
