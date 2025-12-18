import { Router } from 'express';
import { transactionController } from '../controllers';
import { authenticate } from '../middleware';
import { validateBody } from '../middleware';
import { DepositSchema, WithdrawalRequestSchema, ApprovalDecisionSchema } from '../types';

const router = Router();

// Deposit
router.post(
  '/banks/:bankId/deposit',
  authenticate,
  validateBody(DepositSchema),
  transactionController.deposit.bind(transactionController)
);

// Withdrawal request
router.post(
  '/banks/:bankId/withdraw',
  authenticate,
  validateBody(WithdrawalRequestSchema),
  transactionController.requestWithdrawal.bind(transactionController)
);

// Get transactions for a bank
router.get(
  '/banks/:bankId/transactions',
  authenticate,
  transactionController.getTransactions.bind(transactionController)
);

// Get pending approvals for a bank
router.get(
  '/banks/:bankId/pending',
  authenticate,
  transactionController.getPendingApprovals.bind(transactionController)
);

// Get single transaction
router.get(
  '/:transactionId',
  authenticate,
  transactionController.getTransaction.bind(transactionController)
);

// Submit approval
router.post(
  '/:transactionId/approve',
  authenticate,
  validateBody(ApprovalDecisionSchema),
  transactionController.submitApproval.bind(transactionController)
);

// Cancel transaction
router.post(
  '/:transactionId/cancel',
  authenticate,
  transactionController.cancelTransaction.bind(transactionController)
);

// Get approvals for a transaction
router.get(
  '/:transactionId/approvals',
  authenticate,
  transactionController.getApprovals.bind(transactionController)
);

export default router;
