import { Request, Response } from 'express';
import { UserService, userService } from '../services/user.service';
import { AvatarService, avatarService } from '../services/avatar.service';
import { asyncHandler, NotFoundError, ConflictError, BadRequestError } from '../middleware/error.middleware';
import { ApiResponse, UserProfile, PaginatedResult, GdprExportData } from '../types';

export class UserController {
  constructor(
    private userSvc: UserService = userService,
    private avatarSvc: AvatarService = avatarService
  ) {}

  createUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await this.userSvc.createUser(req.body);
      const response: ApiResponse<UserProfile> = {
        success: true,
        data: user,
        message: 'User created successfully',
      };
      res.status(201).json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new ConflictError(error.message);
      }
      throw error;
    }
  });

  getUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = await this.userSvc.getUserById(req.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const response: ApiResponse<UserProfile> = {
      success: true,
      data: user,
    };
    res.json(response);
  });

  getUserByEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const email = req.query.email as string;
    if (!email) {
      throw new BadRequestError('Email is required');
    }
    const user = await this.userSvc.getUserByEmail(email);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const response: ApiResponse<UserProfile> = {
      success: true,
      data: user,
    };
    res.json(response);
  });

  updateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await this.userSvc.updateUser(req.params.id, req.body);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      const response: ApiResponse<UserProfile> = {
        success: true,
        data: user,
        message: 'User updated successfully',
      };
      res.json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new ConflictError(error.message);
      }
      throw error;
    }
  });

  deleteUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const deleted = await this.userSvc.deleteUser(req.params.id);
    if (!deleted) {
      throw new NotFoundError('User not found');
    }
    const response: ApiResponse<null> = {
      success: true,
      message: 'User deleted successfully',
    };
    res.json(response);
  });

  getAllUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await this.userSvc.getAllUsers({ page, limit });
    const response: ApiResponse<PaginatedResult<UserProfile>> = {
      success: true,
      data: result,
    };
    res.json(response);
  });

  uploadAvatar = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new BadRequestError('No file uploaded');
    }

    const userId = req.params.id;
    const exists = await this.userSvc.userExists(userId);
    if (!exists) {
      throw new NotFoundError('User not found');
    }

    const result = await this.avatarSvc.uploadAvatar(
      userId,
      req.file.buffer,
      req.file.mimetype
    );

    const user = await this.userSvc.updateAvatar(userId, result.url);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const response: ApiResponse<UserProfile> = {
      success: true,
      data: user,
      message: 'Avatar uploaded successfully',
    };
    res.json(response);
  });

  verifyEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const token = req.params.token;
    const user = await this.userSvc.verifyEmail(token);
    if (!user) {
      throw new BadRequestError('Invalid or expired verification token');
    }
    const response: ApiResponse<UserProfile> = {
      success: true,
      data: user,
      message: 'Email verified successfully',
    };
    res.json(response);
  });

  resendVerification = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await this.userSvc.resendVerificationEmail(req.params.id);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'Verification email sent' },
      };
      res.json(response);
    } catch (error) {
      if (error instanceof Error && error.message === 'Email already verified') {
        throw new BadRequestError(error.message);
      }
      throw error;
    }
  });

  updateKycStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = await this.userSvc.updateKycStatus(req.params.id, req.body);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const response: ApiResponse<UserProfile> = {
      success: true,
      data: user,
      message: 'KYC status updated successfully',
    };
    res.json(response);
  });

  getKycHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const exists = await this.userSvc.userExists(req.params.id);
    if (!exists) {
      throw new NotFoundError('User not found');
    }
    const history = await this.userSvc.getKycHistory(req.params.id);
    const response: ApiResponse<typeof history> = {
      success: true,
      data: history,
    };
    res.json(response);
  });

  exportData = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const format = (req.query.format as 'json' | 'csv') || 'json';
    try {
      const data = await this.userSvc.exportUserData(req.params.id, format);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="user_data_${req.params.id}.csv"`
        );
        res.send(data);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="user_data_${req.params.id}.json"`
        );
        const response: ApiResponse<GdprExportData> = {
          success: true,
          data: data as GdprExportData,
        };
        res.json(response);
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        throw new NotFoundError(error.message);
      }
      throw error;
    }
  });

  anonymizeUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const anonymized = await this.userSvc.anonymizeUser(req.params.id);
    if (!anonymized) {
      throw new NotFoundError('User not found or already anonymized');
    }
    const response: ApiResponse<null> = {
      success: true,
      message: 'User data anonymized successfully (right to be forgotten)',
    };
    res.json(response);
  });
}

export const userController = new UserController();
