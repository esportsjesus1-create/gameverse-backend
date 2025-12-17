import { Request, Response } from 'express';
import { userService } from '../services/userService';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { ApiResponse, User, UserStatus } from '../types';

export const createUser = asyncHandler(async (req: Request, res: Response<ApiResponse<User>>) => {
  const { username, displayName, avatarUrl } = req.body;

  if (!username || username.trim().length === 0) {
    throw new AppError('Username is required', 400);
  }

  if (!displayName || displayName.trim().length === 0) {
    throw new AppError('Display name is required', 400);
  }

  if (username.length < 3 || username.length > 50) {
    throw new AppError('Username must be between 3 and 50 characters', 400);
  }

  const user = await userService.createUser(username, displayName, avatarUrl);

  res.status(201).json({
    success: true,
    data: user,
    message: 'User created successfully',
  });
});

export const getUser = asyncHandler(async (req: Request, res: Response<ApiResponse<User>>) => {
  const { userId } = req.params;

  const user = await userService.getUser(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    data: user,
  });
});

export const getCurrentUser = asyncHandler(async (req: Request, res: Response<ApiResponse<User>>) => {
  const userId = req.userId!;

  const user = await userService.getUser(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    data: user,
  });
});

export const updateUser = asyncHandler(async (req: Request, res: Response<ApiResponse<User>>) => {
  const userId = req.userId!;
  const { displayName, avatarUrl } = req.body;

  const user = await userService.updateUser(userId, { displayName, avatarUrl });

  res.json({
    success: true,
    data: user,
    message: 'User updated successfully',
  });
});

export const setUserStatus = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { status } = req.body;

  const validStatuses = Object.values(UserStatus);
  if (!validStatuses.includes(status)) {
    throw new AppError(`Status must be one of: ${validStatuses.join(', ')}`, 400);
  }

  await userService.setUserStatus(userId, status);

  res.json({
    success: true,
    message: `Status set to ${status}`,
  });
});

export const searchUsers = asyncHandler(async (req: Request, res: Response<ApiResponse<User[]>>) => {
  const query = req.query.q as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  if (!query || query.trim().length === 0) {
    throw new AppError('Search query is required', 400);
  }

  const users = await userService.searchUsers(query, limit);

  res.json({
    success: true,
    data: users,
  });
});

export const getOnlineUsers = asyncHandler(async (req: Request, res: Response<ApiResponse<string[]>>) => {
  const onlineUserIds = await userService.getOnlineUsers();

  res.json({
    success: true,
    data: onlineUserIds,
  });
});
