import { Request, Response } from 'express';
import { benefitsService } from '../services/benefitsService';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { ApiResponse, PartyBenefit, CalculatedBenefits } from '../types';

export const getAllBenefits = asyncHandler(async (req: Request, res: Response<ApiResponse<PartyBenefit[]>>) => {
  const benefits = await benefitsService.getAllBenefits();

  res.json({
    success: true,
    data: benefits,
  });
});

export const getBenefit = asyncHandler(async (req: Request, res: Response<ApiResponse<PartyBenefit>>) => {
  const { benefitId } = req.params;

  const benefit = await benefitsService.getBenefit(benefitId);
  if (!benefit) {
    throw new AppError('Benefit not found', 404);
  }

  res.json({
    success: true,
    data: benefit,
  });
});

export const getApplicableBenefits = asyncHandler(async (req: Request, res: Response<ApiResponse<PartyBenefit[]>>) => {
  const partySize = parseInt(req.query.partySize as string);

  if (isNaN(partySize) || partySize < 1) {
    throw new AppError('Valid party size is required', 400);
  }

  const benefits = await benefitsService.getApplicableBenefits(partySize);

  res.json({
    success: true,
    data: benefits,
  });
});

export const calculatePartyBenefits = asyncHandler(async (req: Request, res: Response<ApiResponse<CalculatedBenefits>>) => {
  const { partyId } = req.params;

  const benefits = await benefitsService.calculatePartyBenefits(partyId);

  res.json({
    success: true,
    data: benefits,
  });
});

export const getPartyBenefitsSummary = asyncHandler(async (req: Request, res: Response) => {
  const { partyId } = req.params;

  const summary = await benefitsService.getPartyBenefitsSummary(partyId);

  res.json({
    success: true,
    data: summary,
  });
});

export const applyXPBonus = asyncHandler(async (req: Request, res: Response) => {
  const { partyId } = req.params;
  const { baseXP } = req.body;

  if (typeof baseXP !== 'number' || baseXP < 0) {
    throw new AppError('Valid baseXP is required', 400);
  }

  const result = await benefitsService.applyXPBonus(partyId, baseXP);

  res.json({
    success: true,
    data: result,
  });
});

export const applyLootBonus = asyncHandler(async (req: Request, res: Response) => {
  const { partyId } = req.params;
  const { baseLootChance } = req.body;

  if (typeof baseLootChance !== 'number' || baseLootChance < 0 || baseLootChance > 1) {
    throw new AppError('Valid baseLootChance (0-1) is required', 400);
  }

  const result = await benefitsService.applyLootBonus(partyId, baseLootChance);

  res.json({
    success: true,
    data: result,
  });
});

export const applyDropRateBonus = asyncHandler(async (req: Request, res: Response) => {
  const { partyId } = req.params;
  const { baseDropRate } = req.body;

  if (typeof baseDropRate !== 'number' || baseDropRate < 0 || baseDropRate > 1) {
    throw new AppError('Valid baseDropRate (0-1) is required', 400);
  }

  const result = await benefitsService.applyDropRateBonus(partyId, baseDropRate);

  res.json({
    success: true,
    data: result,
  });
});

export const applyAchievementBonus = asyncHandler(async (req: Request, res: Response) => {
  const { partyId } = req.params;
  const { baseProgress } = req.body;

  if (typeof baseProgress !== 'number' || baseProgress < 0) {
    throw new AppError('Valid baseProgress is required', 400);
  }

  const result = await benefitsService.applyAchievementBonus(partyId, baseProgress);

  res.json({
    success: true,
    data: result,
  });
});

export const getExclusiveRewards = asyncHandler(async (req: Request, res: Response<ApiResponse<string[]>>) => {
  const { partyId } = req.params;

  const rewards = await benefitsService.getExclusiveRewards(partyId);

  res.json({
    success: true,
    data: rewards,
  });
});

export const getNextTierBenefits = asyncHandler(async (req: Request, res: Response<ApiResponse<PartyBenefit[]>>) => {
  const currentSize = parseInt(req.query.currentSize as string);

  if (isNaN(currentSize) || currentSize < 1) {
    throw new AppError('Valid current size is required', 400);
  }

  const benefits = await benefitsService.getNextTierBenefits(currentSize);

  res.json({
    success: true,
    data: benefits,
  });
});
