import { Request, Response } from 'express';
import { CurrencyService } from '../services/currency.service';
import { ApiResponse, CurrencyType, CurrencyPurchaseRequest, TransactionType } from '../types';

export class CurrencyController {
  private currencyService: CurrencyService;

  constructor() {
    this.currencyService = new CurrencyService();
  }

  getBalance = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;
      const { currencyType } = req.query;

      if (currencyType) {
        if (!Object.values(CurrencyType).includes(currencyType as CurrencyType)) {
          res.status(400).json({
            success: false,
            error: `Invalid currency type. Must be one of: ${Object.values(CurrencyType).join(', ')}`,
            timestamp: new Date().toISOString(),
          } as ApiResponse<null>);
          return;
        }

        const balance = await this.currencyService.getBalance(playerId, currencyType as CurrencyType);

        res.status(200).json({
          success: true,
          data: balance,
          timestamp: new Date().toISOString(),
        } as ApiResponse<typeof balance>);
      } else {
        const balances = await this.currencyService.getAllBalances(playerId);

        res.status(200).json({
          success: true,
          data: balances,
          timestamp: new Date().toISOString(),
        } as ApiResponse<typeof balances>);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get balance',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  purchaseCurrency = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId, currencyType, amount, paymentMethod, paymentToken } = req.body;

      if (!playerId || !currencyType || !amount || !paymentMethod) {
        res.status(400).json({
          success: false,
          error: 'playerId, currencyType, amount, and paymentMethod are required',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      if (!Object.values(CurrencyType).includes(currencyType as CurrencyType)) {
        res.status(400).json({
          success: false,
          error: `Invalid currency type. Must be one of: ${Object.values(CurrencyType).join(', ')}`,
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      if (amount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Amount must be greater than 0',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const purchaseRequest: CurrencyPurchaseRequest = {
        playerId,
        currencyType: currencyType as CurrencyType,
        amount,
        paymentMethod,
        paymentToken,
      };

      const result = await this.currencyService.purchaseCurrency(purchaseRequest);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: 'Purchase failed',
          data: result,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
        message: 'Currency purchased successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof result>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Purchase failed',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  addCurrency = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId, currencyType, amount, reason } = req.body;

      if (!playerId || !currencyType || !amount) {
        res.status(400).json({
          success: false,
          error: 'playerId, currencyType, and amount are required',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      if (!Object.values(CurrencyType).includes(currencyType as CurrencyType)) {
        res.status(400).json({
          success: false,
          error: `Invalid currency type. Must be one of: ${Object.values(CurrencyType).join(', ')}`,
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const result = await this.currencyService.addCurrency(
        playerId,
        currencyType as CurrencyType,
        amount,
        TransactionType.ADMIN_GRANT,
        reason || 'Admin grant'
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Currency added successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof result>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add currency',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  deductCurrency = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId, currencyType, amount, reason } = req.body;

      if (!playerId || !currencyType || !amount) {
        res.status(400).json({
          success: false,
          error: 'playerId, currencyType, and amount are required',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      if (!Object.values(CurrencyType).includes(currencyType as CurrencyType)) {
        res.status(400).json({
          success: false,
          error: `Invalid currency type. Must be one of: ${Object.values(CurrencyType).join(', ')}`,
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const result = await this.currencyService.deductCurrency(
        playerId,
        currencyType as CurrencyType,
        amount,
        TransactionType.ADMIN_DEDUCT,
        undefined,
        reason || 'Admin deduction'
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to deduct currency',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
        message: 'Currency deducted successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof result>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deduct currency',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  refundTransaction = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId, transactionId, reason } = req.body;

      if (!playerId || !transactionId) {
        res.status(400).json({
          success: false,
          error: 'playerId and transactionId are required',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const result = await this.currencyService.refundCurrency(playerId, transactionId, reason);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error || 'Refund failed',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Transaction refunded successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Refund failed',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getTransactionHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;
      const { currencyType, page, pageSize } = req.query;

      const history = await this.currencyService.getTransactionHistory(
        playerId,
        currencyType as CurrencyType | undefined,
        page ? parseInt(page as string, 10) : 1,
        pageSize ? parseInt(pageSize as string, 10) : 20
      );

      res.status(200).json({
        success: true,
        data: history,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof history>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get transaction history',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getSpendingLimits = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;

      const status = await this.currencyService.getSpendingLimitStatus(playerId);

      res.status(200).json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof status>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get spending limits',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  setSpendingLimits = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;
      const { dailyLimit, weeklyLimit, monthlyLimit } = req.body;

      const status = await this.currencyService.setCustomSpendingLimits(
        playerId,
        dailyLimit,
        weeklyLimit,
        monthlyLimit
      );

      res.status(200).json({
        success: true,
        data: status,
        message: 'Spending limits updated successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof status>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set spending limits',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };
}
