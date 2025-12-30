import { Request, Response } from 'express';
import { ComplianceService } from '../services/compliance.service';
import { ApiResponse } from '../types';

export class ComplianceController {
  private complianceService: ComplianceService;

  constructor() {
    this.complianceService = new ComplianceService();
  }

  checkCompliance = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId, amount, requiresAgeVerification } = req.body;

      if (!playerId) {
        res.status(400).json({
          success: false,
          error: 'playerId is required',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const result = await this.complianceService.checkCompliance(
        playerId,
        amount || 0,
        requiresAgeVerification !== false
      );

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof result>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Compliance check failed',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  submitAgeVerification = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId, dateOfBirth, verificationMethod, documentId, countryCode } = req.body;

      if (!playerId || !dateOfBirth || !verificationMethod) {
        res.status(400).json({
          success: false,
          error: 'playerId, dateOfBirth, and verificationMethod are required',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const dob = new Date(dateOfBirth);
      if (isNaN(dob.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid dateOfBirth format',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const result = await this.complianceService.submitAgeVerification(
        playerId,
        dob,
        verificationMethod,
        documentId,
        countryCode
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error || 'Age verification failed',
          data: { meetsMinimumAge: result.meetsMinimumAge },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          meetsMinimumAge: result.meetsMinimumAge,
          message: result.meetsMinimumAge
            ? 'Age verification successful'
            : 'Age verification failed - does not meet minimum age requirement',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Age verification failed',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getAgeVerificationStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;

      const status = await this.complianceService.getAgeVerificationStatus(playerId);

      res.status(200).json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof status>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get age verification status',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getSpendingLimitStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;

      const status = await this.complianceService.getSpendingLimitStatus(playerId);

      res.status(200).json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof status>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get spending limit status',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  setCustomSpendingLimits = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;
      const { dailyLimit, weeklyLimit, monthlyLimit } = req.body;

      const status = await this.complianceService.setCustomSpendingLimits(
        playerId,
        dailyLimit,
        weeklyLimit,
        monthlyLimit
      );

      res.status(200).json({
        success: true,
        data: status,
        message: 'Custom spending limits set successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof status>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set custom spending limits',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  resetSpendingLimits = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;

      const status = await this.complianceService.resetSpendingLimits(playerId);

      res.status(200).json({
        success: true,
        data: status,
        message: 'Spending limits reset to defaults',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof status>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reset spending limits',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getComplianceReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;

      const report = await this.complianceService.getComplianceReport(playerId);

      res.status(200).json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof report>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get compliance report',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getRegulationInfo = async (_req: Request, res: Response): Promise<void> => {
    try {
      const minimumAge = this.complianceService.getMinimumAgeRequirement();
      const defaultLimits = this.complianceService.getDefaultSpendingLimits();

      res.status(200).json({
        success: true,
        data: {
          minimumAgeRequirement: minimumAge,
          defaultSpendingLimits: defaultLimits,
          dropRateDisclosureEnabled: true,
          ageVerificationRequired: true,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get regulation info',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };
}
