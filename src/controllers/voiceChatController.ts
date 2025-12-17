import { Request, Response } from 'express';
import { voiceChatService } from '../services/voiceChatService';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { ApiResponse, VoiceChannel, VoiceParticipant, UpdateVoiceStatusRequest } from '../types';

export const createVoiceChannel = asyncHandler(async (req: Request, res: Response<ApiResponse<VoiceChannel>>) => {
  const userId = req.userId!;
  const { partyId } = req.params;
  const { name } = req.body;

  const channel = await voiceChatService.createVoiceChannel(partyId, userId, name);

  res.status(201).json({
    success: true,
    data: channel,
    message: 'Voice channel created successfully',
  });
});

export const getVoiceChannel = asyncHandler(async (req: Request, res: Response<ApiResponse<VoiceChannel>>) => {
  const { channelId } = req.params;

  const channel = await voiceChatService.getVoiceChannel(channelId);
  if (!channel) {
    throw new AppError('Voice channel not found', 404);
  }

  res.json({
    success: true,
    data: channel,
  });
});

export const getPartyVoiceChannel = asyncHandler(async (req: Request, res: Response<ApiResponse<VoiceChannel | null>>) => {
  const { partyId } = req.params;

  const channel = await voiceChatService.getPartyVoiceChannel(partyId);

  res.json({
    success: true,
    data: channel,
  });
});

export const joinVoiceChannel = asyncHandler(async (req: Request, res: Response<ApiResponse<VoiceParticipant>>) => {
  const userId = req.userId!;
  const { channelId } = req.params;

  const participant = await voiceChatService.joinVoiceChannel(channelId, userId);

  res.status(201).json({
    success: true,
    data: participant,
    message: 'Joined voice channel successfully',
  });
});

export const leaveVoiceChannel = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { channelId } = req.params;

  await voiceChatService.leaveVoiceChannel(channelId, userId);

  res.json({
    success: true,
    message: 'Left voice channel successfully',
  });
});

export const updateVoiceStatus = asyncHandler(async (req: Request, res: Response<ApiResponse<VoiceParticipant>>) => {
  const userId = req.userId!;
  const { channelId } = req.params;
  const request: UpdateVoiceStatusRequest = req.body;

  const participant = await voiceChatService.updateVoiceStatus(channelId, userId, request);

  res.json({
    success: true,
    data: participant,
    message: 'Voice status updated',
  });
});

export const setSpeakingStatus = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { channelId } = req.params;
  const { isSpeaking } = req.body;

  if (typeof isSpeaking !== 'boolean') {
    throw new AppError('isSpeaking must be a boolean', 400);
  }

  await voiceChatService.setSpeakingStatus(channelId, userId, isSpeaking);

  res.json({
    success: true,
    message: `Speaking status set to ${isSpeaking}`,
  });
});

export const getChannelParticipants = asyncHandler(async (req: Request, res: Response<ApiResponse<VoiceParticipant[]>>) => {
  const { channelId } = req.params;

  const participants = await voiceChatService.getChannelParticipants(channelId);

  res.json({
    success: true,
    data: participants,
  });
});

export const muteParticipant = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { channelId, targetUserId } = req.params;

  await voiceChatService.muteParticipant(channelId, userId, targetUserId);

  res.json({
    success: true,
    message: 'Participant muted',
  });
});

export const unmuteParticipant = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { channelId, targetUserId } = req.params;

  await voiceChatService.unmuteParticipant(channelId, userId, targetUserId);

  res.json({
    success: true,
    message: 'Participant unmuted',
  });
});

export const deleteVoiceChannel = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const userId = req.userId!;
  const { channelId } = req.params;

  await voiceChatService.deleteVoiceChannel(channelId, userId);

  res.json({
    success: true,
    message: 'Voice channel deleted',
  });
});

export const getUserVoiceStatus = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;

  const status = await voiceChatService.getUserVoiceStatus(userId);

  res.json({
    success: true,
    data: status,
  });
});
