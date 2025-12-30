import {
  PlayerAgeVerificationRepository,
  PlayerSpendingRepository,
} from '../repositories';
import {
  AgeVerificationStatus,
  SpendingLimitStatus,
} from '../types';
import { config } from '../config';

export interface ComplianceCheckResult {
  canProceed: boolean;
  requiresAgeVerification: boolean;
  ageVerified: boolean;
  spendingLimitReached: boolean;
  errors: string[];
  warnings: string[];
}

export class ComplianceService {
  private ageVerificationRepository: PlayerAgeVerificationRepository;
  private spendingRepository: PlayerSpendingRepository;

  constructor() {
    this.ageVerificationRepository = new PlayerAgeVerificationRepository();
    this.spendingRepository = new PlayerSpendingRepository();
  }

  async checkCompliance(
    playerId: string,
    amount: number,
    requiresAgeVerification: boolean = true
  ): Promise<ComplianceCheckResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let canProceed = true;
    let ageVerified = false;

    if (config.regulatory.requireAgeVerification && requiresAgeVerification) {
      const ageCheck = await this.ageVerificationRepository.canPurchase(playerId);
      ageVerified = ageCheck.canPurchase;

      if (!ageVerified) {
        canProceed = false;
        errors.push(ageCheck.reason || 'Age verification required');
      }
    } else {
      ageVerified = true;
    }

    const spendingCheck = await this.spendingRepository.checkSpendingLimit(playerId, amount);
    const spendingLimitReached = !spendingCheck.canSpend;

    if (spendingLimitReached) {
      canProceed = false;
      errors.push(`${spendingCheck.limitType} spending limit reached. Remaining: ${spendingCheck.remaining}`);
    }

    const spendingStatus = await this.spendingRepository.getSpendingStatus(playerId);
    
    if (spendingStatus.dailyRemaining < spendingStatus.dailyLimit * 0.2) {
      warnings.push(`Approaching daily spending limit (${spendingStatus.dailyRemaining} remaining)`);
    }
    if (spendingStatus.weeklyRemaining < spendingStatus.weeklyLimit * 0.2) {
      warnings.push(`Approaching weekly spending limit (${spendingStatus.weeklyRemaining} remaining)`);
    }
    if (spendingStatus.monthlyRemaining < spendingStatus.monthlyLimit * 0.2) {
      warnings.push(`Approaching monthly spending limit (${spendingStatus.monthlyRemaining} remaining)`);
    }

    return {
      canProceed,
      requiresAgeVerification: config.regulatory.requireAgeVerification && requiresAgeVerification,
      ageVerified,
      spendingLimitReached,
      errors,
      warnings,
    };
  }

  async submitAgeVerification(
    playerId: string,
    dateOfBirth: Date,
    verificationMethod: string,
    documentId?: string,
    countryCode?: string
  ): Promise<{ success: boolean; meetsMinimumAge: boolean; error?: string }> {
    try {
      const result = await this.ageVerificationRepository.submitVerification(
        playerId,
        dateOfBirth,
        verificationMethod,
        documentId,
        countryCode
      );

      return {
        success: true,
        meetsMinimumAge: result.meetsMinimumAge,
      };
    } catch (error) {
      return {
        success: false,
        meetsMinimumAge: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  async getAgeVerificationStatus(playerId: string): Promise<{
    status: AgeVerificationStatus;
    meetsMinimumAge: boolean;
    verifiedAt?: Date;
    minimumAgeRequired: number;
  }> {
    const verification = await this.ageVerificationRepository.getVerification(playerId);

    return {
      status: verification.status,
      meetsMinimumAge: verification.meetsMinimumAge,
      verifiedAt: verification.verifiedAt || undefined,
      minimumAgeRequired: config.regulatory.minAgeRequirement,
    };
  }

  async isAgeVerified(playerId: string): Promise<boolean> {
    return this.ageVerificationRepository.isVerified(playerId);
  }

  async getSpendingLimitStatus(playerId: string): Promise<SpendingLimitStatus> {
    const status = await this.spendingRepository.getSpendingStatus(playerId);

    return {
      playerId,
      dailyLimit: status.dailyLimit,
      dailySpent: status.dailySpent,
      dailyRemaining: status.dailyRemaining,
      weeklyLimit: status.weeklyLimit,
      weeklySpent: status.weeklySpent,
      weeklyRemaining: status.weeklyRemaining,
      monthlyLimit: status.monthlyLimit,
      monthlySpent: status.monthlySpent,
      monthlyRemaining: status.monthlyRemaining,
      isLimitReached: status.isLimitReached,
      nextResetTime: status.nextResetTime,
    };
  }

  async setCustomSpendingLimits(
    playerId: string,
    dailyLimit?: number,
    weeklyLimit?: number,
    monthlyLimit?: number
  ): Promise<SpendingLimitStatus> {
    if (dailyLimit !== undefined && dailyLimit > config.regulatory.spendingLimits.daily) {
      throw new Error(`Daily limit cannot exceed ${config.regulatory.spendingLimits.daily}`);
    }
    if (weeklyLimit !== undefined && weeklyLimit > config.regulatory.spendingLimits.weekly) {
      throw new Error(`Weekly limit cannot exceed ${config.regulatory.spendingLimits.weekly}`);
    }
    if (monthlyLimit !== undefined && monthlyLimit > config.regulatory.spendingLimits.monthly) {
      throw new Error(`Monthly limit cannot exceed ${config.regulatory.spendingLimits.monthly}`);
    }

    await this.spendingRepository.setCustomLimits(playerId, dailyLimit, weeklyLimit, monthlyLimit);
    return this.getSpendingLimitStatus(playerId);
  }

  async resetSpendingLimits(playerId: string): Promise<SpendingLimitStatus> {
    await this.spendingRepository.resetLimits(playerId);
    return this.getSpendingLimitStatus(playerId);
  }

  async getComplianceReport(playerId: string): Promise<{
    ageVerification: {
      status: AgeVerificationStatus;
      meetsMinimumAge: boolean;
      verifiedAt?: Date;
    };
    spendingLimits: SpendingLimitStatus;
    complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING_VERIFICATION';
    issues: string[];
  }> {
    const ageStatus = await this.getAgeVerificationStatus(playerId);
    const spendingStatus = await this.getSpendingLimitStatus(playerId);
    const issues: string[] = [];

    let complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING_VERIFICATION' = 'COMPLIANT';

    if (config.regulatory.requireAgeVerification) {
      if (ageStatus.status === AgeVerificationStatus.UNVERIFIED) {
        complianceStatus = 'PENDING_VERIFICATION';
        issues.push('Age verification required');
      } else if (ageStatus.status === AgeVerificationStatus.PENDING) {
        complianceStatus = 'PENDING_VERIFICATION';
        issues.push('Age verification pending');
      } else if (ageStatus.status === AgeVerificationStatus.REJECTED || !ageStatus.meetsMinimumAge) {
        complianceStatus = 'NON_COMPLIANT';
        issues.push('Age verification failed or does not meet minimum age requirement');
      }
    }

    if (spendingStatus.isLimitReached) {
      if (complianceStatus === 'COMPLIANT') {
        complianceStatus = 'NON_COMPLIANT';
      }
      issues.push('Spending limit reached');
    }

    return {
      ageVerification: {
        status: ageStatus.status,
        meetsMinimumAge: ageStatus.meetsMinimumAge,
        verifiedAt: ageStatus.verifiedAt,
      },
      spendingLimits: spendingStatus,
      complianceStatus,
      issues,
    };
  }

  getMinimumAgeRequirement(): number {
    return config.regulatory.minAgeRequirement;
  }

  getDefaultSpendingLimits(): {
    daily: number;
    weekly: number;
    monthly: number;
  } {
    return {
      daily: config.regulatory.spendingLimits.daily,
      weekly: config.regulatory.spendingLimits.weekly,
      monthly: config.regulatory.spendingLimits.monthly,
    };
  }
}
