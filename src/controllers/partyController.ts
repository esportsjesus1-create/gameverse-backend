import { Request, Response } from 'express';
import { partyService } from '../services/partyService';
import { benefitsService } from '../services/benefitsService';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { ApiResponse, Party, PartyMember, CreatePartyRequest, UpdatePartyRequest, PartyStatus } from '../types';

export const createParty = asyncHandler(async (req: Request, res: Response<ApiResponse<Party>>) => {
  const userId = req.userId!;
  const request: CreatePartyRequest = req.body;

  if (!request.name || request.name.trim().length === 0) {
    throw new AppError('Party name is required', 400);
  }

  if (request.maxSize !== undefined && (request.maxSize < 2 || request.maxSize > 100)) {
    throw new AppError('Max size must be between 2 and 100', 400);
  }

  const party = await partyService.createParty(userId, request);

  res.status(201).json({
    success: true,
    data: party,
    message: 'Party created successfully',
  });
});

export const getParty = asyncHandler(async (req: Request, res: Response<ApiResponse<Party>>) => {
  const { partyId } = req.params;

  const party = await partyService.getParty(partyId);
  if (!party) {
    throw new AppError('Party not found', 404);
  }

  res.json({
    success: true,
    data: party,
  });
});

export const getUserParty = asyncHandler(async (req: Request, res: Response<ApiResponse<Party | null>>) => {
  const userId = req.userId!;

  const party = await partyService.getUserParty(userId);

  res.json({
    success: true,
    data: party,
  });
});

export const updateParty = asyncHandler(async (req: Request, res: Response<ApiResponse<Party>>) => {
  const userId = req.userId!;
  const { partyId } = req.params;
  const request: UpdatePartyRequest = req.body;

  const party = await partyService.updateParty(partyId, userId, request);

  res.json({
    success: true,
    data: party,
    message: 'Party updated successfully',
  });
});

export const joinParty = asyncHandler(async (req: Request, res: Response<ApiResponse<PartyMember>>) => {
  const userId = req.userId!;
  const { partyId } = req.params;

  const member = await partyService.joinParty(partyId, userId);
  await benefitsService.invalidatePartyBenefitsCache(partyId);

  res.status(201).json({
    success: true,
    data: member,
    message: 'Joined party successfully',
  });
});

export const leaveParty = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { partyId } = req.params;

  await partyService.leaveParty(partyId, userId);
  await benefitsService.invalidatePartyBenefitsCache(partyId);

  res.json({
    success: true,
    message: 'Left party successfully',
  });
});

export const disbandParty = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { partyId } = req.params;

  await partyService.disbandParty(partyId, userId);

  res.json({
    success: true,
    message: 'Party disbanded successfully',
  });
});

export const transferLeadership = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { partyId } = req.params;
  const { newLeaderId } = req.body;

  if (!newLeaderId) {
    throw new AppError('New leader ID is required', 400);
  }

  await partyService.transferLeadership(partyId, userId, newLeaderId);

  res.json({
    success: true,
    message: 'Leadership transferred successfully',
  });
});

export const promoteToOfficer = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { partyId, memberId } = req.params;

  await partyService.promoteToOfficer(partyId, userId, memberId);

  res.json({
    success: true,
    message: 'Member promoted to officer',
  });
});

export const demoteToMember = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { partyId, memberId } = req.params;

  await partyService.demoteToMember(partyId, userId, memberId);

  res.json({
    success: true,
    message: 'Officer demoted to member',
  });
});

export const kickMember = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { partyId, memberId } = req.params;

  await partyService.kickMember(partyId, userId, memberId);
  await benefitsService.invalidatePartyBenefitsCache(partyId);

  res.json({
    success: true,
    message: 'Member kicked from party',
  });
});

export const setReadyStatus = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { partyId } = req.params;
  const { isReady } = req.body;

  if (typeof isReady !== 'boolean') {
    throw new AppError('isReady must be a boolean', 400);
  }

  await partyService.setReadyStatus(partyId, userId, isReady);

  res.json({
    success: true,
    message: `Ready status set to ${isReady}`,
  });
});

export const updatePartyStatus = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { partyId } = req.params;
  const { status } = req.body;

  const validStatuses = [PartyStatus.ACTIVE, PartyStatus.IN_GAME, PartyStatus.IDLE];
  if (!validStatuses.includes(status)) {
    throw new AppError(`Status must be one of: ${validStatuses.join(', ')}`, 400);
  }

  await partyService.updatePartyStatus(partyId, userId, status);

  res.json({
    success: true,
    message: `Party status updated to ${status}`,
  });
});

export const getPartyMembers = asyncHandler(async (req: Request, res: Response<ApiResponse<PartyMember[]>>) => {
  const { partyId } = req.params;

  const members = await partyService.getPartyMembers(partyId);

  res.json({
    success: true,
    data: members,
  });
});

export const getPublicParties = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const offset = (page - 1) * limit;

  const { parties, total } = await partyService.getPublicParties(limit, offset);

  res.json({
    success: true,
    data: parties,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
