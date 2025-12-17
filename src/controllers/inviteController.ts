import { Request, Response } from 'express';
import { inviteService } from '../services/inviteService';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { ApiResponse, PartyInvite, SendInviteRequest, BulkInviteRequest } from '../types';

export const sendInvite = asyncHandler(async (req: Request, res: Response<ApiResponse<PartyInvite>>) => {
  const userId = req.userId!;
  const { partyId } = req.params;
  const request: SendInviteRequest = req.body;

  if (!request.recipientId) {
    throw new AppError('Recipient ID is required', 400);
  }

  if (request.recipientId === userId) {
    throw new AppError('Cannot invite yourself', 400);
  }

  const invite = await inviteService.sendInvite(partyId, userId, request);

  res.status(201).json({
    success: true,
    data: invite,
    message: 'Invite sent successfully',
  });
});

export const sendBulkInvites = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { partyId } = req.params;
  const request: BulkInviteRequest = req.body;

  if (!request.recipientIds || !Array.isArray(request.recipientIds) || request.recipientIds.length === 0) {
    throw new AppError('Recipient IDs array is required', 400);
  }

  if (request.recipientIds.length > 50) {
    throw new AppError('Cannot send more than 50 invites at once', 400);
  }

  const filteredRecipients = request.recipientIds.filter(id => id !== userId);
  if (filteredRecipients.length === 0) {
    throw new AppError('No valid recipients provided', 400);
  }

  const result = await inviteService.sendBulkInvites(partyId, userId, {
    ...request,
    recipientIds: filteredRecipients,
  });

  res.status(201).json({
    success: true,
    data: result,
    message: `Sent ${result.sent.length} invites, ${result.failed.length} failed`,
  });
});

export const acceptInvite = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { inviteId } = req.params;

  await inviteService.acceptInvite(inviteId, userId);

  res.json({
    success: true,
    message: 'Invite accepted successfully',
  });
});

export const declineInvite = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { inviteId } = req.params;

  await inviteService.declineInvite(inviteId, userId);

  res.json({
    success: true,
    message: 'Invite declined',
  });
});

export const cancelInvite = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { inviteId } = req.params;

  await inviteService.cancelInvite(inviteId, userId);

  res.json({
    success: true,
    message: 'Invite cancelled',
  });
});

export const getInvite = asyncHandler(async (req: Request, res: Response<ApiResponse<PartyInvite>>) => {
  const { inviteId } = req.params;

  const invite = await inviteService.getInvite(inviteId);
  if (!invite) {
    throw new AppError('Invite not found', 404);
  }

  res.json({
    success: true,
    data: invite,
  });
});

export const getUserInvites = asyncHandler(async (req: Request, res: Response<ApiResponse<PartyInvite[]>>) => {
  const userId = req.userId!;

  const invites = await inviteService.getUserInvites(userId);

  res.json({
    success: true,
    data: invites,
  });
});

export const getPartyInvites = asyncHandler(async (req: Request, res: Response<ApiResponse<PartyInvite[]>>) => {
  const { partyId } = req.params;

  const invites = await inviteService.getPartyInvites(partyId);

  res.json({
    success: true,
    data: invites,
  });
});

export const getSentInvites = asyncHandler(async (req: Request, res: Response<ApiResponse<PartyInvite[]>>) => {
  const userId = req.userId!;

  const invites = await inviteService.getSentInvites(userId);

  res.json({
    success: true,
    data: invites,
  });
});
