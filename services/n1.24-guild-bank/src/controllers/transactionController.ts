import { Response, NextFunction } from 'express';
import { transactionService } from '../services';
import { AuthenticatedRequest } from '../middleware';
import { ApiResponse, Transaction, Approval, TransactionType, TransactionStatus } from '../types';

export class TransactionController {
  async deposit(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<Transaction>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const transaction = transactionService.deposit(
        req.params.bankId,
        req.body,
        req.user!.userId
      );
      res.status(201).json({
        success: true,
        data: transaction,
        message: 'Deposit completed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async requestWithdrawal(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<Transaction>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const transaction = transactionService.requestWithdrawal(
        req.params.bankId,
        req.body,
        req.user!.userId
      );
      res.status(201).json({
        success: true,
        data: transaction,
        message: transaction.status === TransactionStatus.PENDING
          ? 'Withdrawal request submitted for approval'
          : 'Withdrawal completed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async submitApproval(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<Approval>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const approval = transactionService.submitApproval(
        req.params.transactionId,
        req.body,
        req.user!.userId
      );
      res.status(201).json({
        success: true,
        data: approval,
        message: `Approval ${req.body.approved ? 'granted' : 'denied'}`,
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelTransaction(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<Transaction>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const transaction = transactionService.cancelTransaction(
        req.params.transactionId,
        req.user!.userId
      );
      res.json({
        success: true,
        data: transaction,
        message: 'Transaction cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getTransaction(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<Transaction>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const transaction = transactionService.getTransaction(req.params.transactionId);
      res.json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<Transaction[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const filters = {
        type: req.query.type as TransactionType | undefined,
        status: req.query.status as TransactionStatus | undefined,
        initiatorId: req.query.initiatorId as string | undefined,
      };
      const transactions = transactionService.getTransactionsByBankId(
        req.params.bankId,
        filters
      );
      res.json({
        success: true,
        data: transactions,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPendingApprovals(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<Transaction[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const transactions = transactionService.getPendingApprovals(req.params.bankId);
      res.json({
        success: true,
        data: transactions,
      });
    } catch (error) {
      next(error);
    }
  }

  async getApprovals(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<Approval[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const approvals = transactionService.getApprovals(req.params.transactionId);
      res.json({
        success: true,
        data: approvals,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const transactionController = new TransactionController();
