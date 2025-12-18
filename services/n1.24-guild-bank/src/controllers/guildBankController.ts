import { Response, NextFunction } from 'express';
import { guildBankService } from '../services';
import { AuthenticatedRequest } from '../middleware';
import { ApiResponse, GuildBank, Vault, WithdrawalPolicy } from '../types';

export class GuildBankController {
  async createBank(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<GuildBank>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const bank = guildBankService.createBank(req.body, req.user!.userId);
      res.status(201).json({
        success: true,
        data: bank,
        message: 'Guild bank created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getBank(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<GuildBank>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const bank = guildBankService.getBank(req.params.bankId);
      res.json({
        success: true,
        data: bank,
      });
    } catch (error) {
      next(error);
    }
  }

  async getBankByGuildId(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<GuildBank>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const bank = guildBankService.getBankByGuildId(req.params.guildId);
      res.json({
        success: true,
        data: bank,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateBank(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<GuildBank>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const bank = guildBankService.updateBank(
        req.params.bankId,
        req.body,
        req.user!.userId
      );
      res.json({
        success: true,
        data: bank,
        message: 'Guild bank updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteBank(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<null>>,
    next: NextFunction
  ): Promise<void> {
    try {
      guildBankService.deleteBank(req.params.bankId, req.user!.userId);
      res.json({
        success: true,
        message: 'Guild bank deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Vault endpoints
  async createVault(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<Vault>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const vault = guildBankService.createVault(
        req.params.bankId,
        req.body,
        req.user!.userId
      );
      res.status(201).json({
        success: true,
        data: vault,
        message: 'Vault created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getVaults(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<Vault[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const vaults = guildBankService.getVaultsByBankId(req.params.bankId);
      res.json({
        success: true,
        data: vaults,
      });
    } catch (error) {
      next(error);
    }
  }

  async getVault(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<Vault>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const vault = guildBankService.getVault(req.params.vaultId);
      res.json({
        success: true,
        data: vault,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateVault(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<Vault>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const vault = guildBankService.updateVault(
        req.params.vaultId,
        req.body,
        req.user!.userId
      );
      res.json({
        success: true,
        data: vault,
        message: 'Vault updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteVault(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<null>>,
    next: NextFunction
  ): Promise<void> {
    try {
      guildBankService.deleteVault(req.params.vaultId, req.user!.userId);
      res.json({
        success: true,
        message: 'Vault deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Withdrawal policy endpoints
  async getWithdrawalPolicy(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<WithdrawalPolicy>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const policy = guildBankService.getWithdrawalPolicy(
        req.params.bankId,
        req.query.vaultId as string | undefined
      );
      res.json({
        success: true,
        data: policy,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateWithdrawalPolicy(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<WithdrawalPolicy>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const policy = guildBankService.updateWithdrawalPolicy(
        req.params.bankId,
        req.body,
        req.user!.userId,
        req.query.vaultId as string | undefined
      );
      res.json({
        success: true,
        data: policy,
        message: 'Withdrawal policy updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const guildBankController = new GuildBankController();
