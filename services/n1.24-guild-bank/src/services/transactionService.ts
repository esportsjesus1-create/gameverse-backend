import {
  TransactionModel,
  VaultModel,
  ApprovalModel,
  MemberContributionModel,
  GuildMemberModel,
  TransactionType,
  TransactionStatus,
  ApprovalStatus,
  MemberRole,
} from '../models';
import {
  Transaction,
  Approval,
  DepositInput,
  WithdrawalRequestInput,
  ApprovalDecisionInput,
} from '../types';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  InsufficientFundsError,
  WithdrawalLimitExceededError,
  CooldownActiveError,
  DuplicateApprovalError,
  SelfApprovalError,
} from '../utils/errors';
import { logger, logTransaction, logApproval } from '../utils/logger';
import { guildBankService } from './guildBankService';

export class TransactionService {
  // Deposit funds into a vault
  deposit(bankId: string, input: DepositInput, userId: string): Transaction {
    guildBankService.getBank(bankId); // Verify bank exists
    const vault = guildBankService.getVault(input.vaultId);

    if (vault.bankId !== bankId) {
      throw new ValidationError('Vault does not belong to this bank');
    }

    // Check vault capacity
    if (vault.maxCapacity && vault.balance + input.amount > vault.maxCapacity) {
      throw new ValidationError('Deposit would exceed vault capacity');
    }

    // Create transaction
    const transaction = TransactionModel.create({
      bankId,
      vaultId: input.vaultId,
      type: TransactionType.DEPOSIT,
      amount: input.amount,
      currency: input.currency,
      status: TransactionStatus.COMPLETED,
      initiatorId: userId,
      note: input.note,
    });

    // Update vault balance
    VaultModel.update(input.vaultId, {
      balance: vault.balance + input.amount,
    });

    // Update bank total balance
    guildBankService.updateTotalBalance(bankId);

    // Update member contribution
    this.updateMemberContribution(bankId, userId, input.amount, 0);

    logTransaction('DEPOSIT', transaction.id, userId, {
      amount: input.amount,
      currency: input.currency,
      vaultId: input.vaultId,
    });

    return transaction;
  }

  // Request a withdrawal (may require approval)
  requestWithdrawal(bankId: string, input: WithdrawalRequestInput, userId: string): Transaction {
    const bank = guildBankService.getBank(bankId);
    const vault = guildBankService.getVault(input.vaultId);

    if (vault.bankId !== bankId) {
      throw new ValidationError('Vault does not belong to this bank');
    }

    // Check if user has access to vault
    const member = GuildMemberModel.findByGuildAndUser(bank.guildId, userId);
    if (!member) {
      throw new ForbiddenError('You are not a member of this guild');
    }

    this.checkVaultAccess(vault.accessLevel, member.role);

    // Check sufficient funds
    if (vault.balance < input.amount) {
      throw new InsufficientFundsError();
    }

    // Get withdrawal policy
    const policy = guildBankService.getWithdrawalPolicy(bankId, input.vaultId);

    // Check single transaction limit
    if (input.amount > policy.singleTransactionLimit) {
      throw new WithdrawalLimitExceededError('single');
    }

    // Check daily limit
    const dailyWithdrawals = TransactionModel.getDailyWithdrawals(bankId, userId);
    const dailyTotal = dailyWithdrawals.reduce((sum, tx) => sum + tx.amount, 0);
    if (dailyTotal + input.amount > policy.dailyLimit) {
      throw new WithdrawalLimitExceededError('daily');
    }

    // Check cooldown
    if (policy.cooldownMinutes > 0) {
      const lastWithdrawal = dailyWithdrawals[dailyWithdrawals.length - 1];
      if (lastWithdrawal) {
        const cooldownEnd = new Date(lastWithdrawal.createdAt.getTime() + policy.cooldownMinutes * 60000);
        if (new Date() < cooldownEnd) {
          const remainingMinutes = Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000);
          throw new CooldownActiveError(remainingMinutes);
        }
      }
    }

    // Determine if approval is required
    const requiresApproval = policy.requiresApproval && input.amount > 0;
    const status = requiresApproval ? TransactionStatus.PENDING : TransactionStatus.COMPLETED;

    // Create transaction
    const transaction = TransactionModel.create({
      bankId,
      vaultId: input.vaultId,
      type: TransactionType.WITHDRAWAL,
      amount: input.amount,
      currency: input.currency,
      status,
      initiatorId: userId,
      note: input.reason,
    });

    // If no approval required, complete immediately
    if (!requiresApproval) {
      this.completeWithdrawal(transaction.id);
    }

    logTransaction('WITHDRAWAL_REQUEST', transaction.id, userId, {
      amount: input.amount,
      currency: input.currency,
      vaultId: input.vaultId,
      requiresApproval,
    });

    return transaction;
  }

  // Submit approval decision for a pending transaction
  submitApproval(
    transactionId: string,
    input: ApprovalDecisionInput,
    approverId: string
  ): Approval {
    const transaction = this.getTransaction(transactionId);

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new ValidationError('Transaction is not pending approval');
    }

    // Check if approver is the initiator
    if (transaction.initiatorId === approverId) {
      throw new SelfApprovalError();
    }

    // Check if approver has already submitted
    if (ApprovalModel.hasApproved(transactionId, approverId)) {
      throw new DuplicateApprovalError();
    }

    // Check if approver has permission
    const bank = guildBankService.getBank(transaction.bankId);
    const member = GuildMemberModel.findByGuildAndUser(bank.guildId, approverId);
    if (!member || !member.canApprove) {
      throw new ForbiddenError('You do not have approval permissions');
    }

    // Create approval record
    const approval = ApprovalModel.create({
      transactionId,
      approverId,
      status: input.approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
      comment: input.comment,
    });

    logApproval(transactionId, approverId, input.approved);

    // Check if transaction should be completed or rejected
    if (input.approved) {
      const policy = guildBankService.getWithdrawalPolicy(transaction.bankId, transaction.vaultId);
      const approvalCount = ApprovalModel.getApprovalCount(transactionId);

      if (approvalCount >= policy.minApprovals) {
        this.completeWithdrawal(transactionId);
      }
    } else {
      // Single rejection cancels the transaction
      TransactionModel.update(transactionId, { status: TransactionStatus.REJECTED });
      logger.info('Transaction rejected', { transactionId, approverId });
    }

    return approval;
  }

  // Complete a withdrawal transaction
  private completeWithdrawal(transactionId: string): void {
    const transaction = this.getTransaction(transactionId);
    const vault = guildBankService.getVault(transaction.vaultId!);

    // Double-check funds
    if (vault.balance < transaction.amount) {
      TransactionModel.update(transactionId, { status: TransactionStatus.CANCELLED });
      throw new InsufficientFundsError();
    }

    // Update vault balance
    VaultModel.update(vault.id, {
      balance: vault.balance - transaction.amount,
    });

    // Update bank total balance
    guildBankService.updateTotalBalance(transaction.bankId);

    // Update member contribution
    this.updateMemberContribution(transaction.bankId, transaction.initiatorId, 0, transaction.amount);

    // Mark transaction as completed
    TransactionModel.update(transactionId, { status: TransactionStatus.COMPLETED });

    logTransaction('WITHDRAWAL_COMPLETED', transactionId, transaction.initiatorId, {
      amount: transaction.amount,
    });
  }

  // Cancel a pending transaction
  cancelTransaction(transactionId: string, userId: string): Transaction {
    const transaction = this.getTransaction(transactionId);

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new ValidationError('Only pending transactions can be cancelled');
    }

    // Only initiator or leaders can cancel
    const bank = guildBankService.getBank(transaction.bankId);
    const member = GuildMemberModel.findByGuildAndUser(bank.guildId, userId);

    if (transaction.initiatorId !== userId && (!member || member.role !== MemberRole.LEADER)) {
      throw new ForbiddenError('Only the initiator or guild leader can cancel this transaction');
    }

    const updated = TransactionModel.update(transactionId, { status: TransactionStatus.CANCELLED });
    if (!updated) {
      throw new NotFoundError('Transaction');
    }

    logTransaction('CANCELLED', transactionId, userId, {});
    return updated;
  }

  // Get transaction by ID
  getTransaction(transactionId: string): Transaction {
    const transaction = TransactionModel.findById(transactionId);
    if (!transaction) {
      throw new NotFoundError('Transaction');
    }
    return transaction;
  }

  // Get transactions for a bank
  getTransactionsByBankId(bankId: string, filters?: {
    type?: TransactionType;
    status?: TransactionStatus;
    initiatorId?: string;
  }): Transaction[] {
    guildBankService.getBank(bankId); // Verify bank exists
    let transactions = TransactionModel.findByBankId(bankId);

    if (filters?.type) {
      transactions = transactions.filter(tx => tx.type === filters.type);
    }
    if (filters?.status) {
      transactions = transactions.filter(tx => tx.status === filters.status);
    }
    if (filters?.initiatorId) {
      transactions = transactions.filter(tx => tx.initiatorId === filters.initiatorId);
    }

    return transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Get pending transactions requiring approval
  getPendingApprovals(bankId: string): Transaction[] {
    return TransactionModel.findPendingByBankId(bankId);
  }

  // Get approvals for a transaction
  getApprovals(transactionId: string): Approval[] {
    this.getTransaction(transactionId); // Verify transaction exists
    return ApprovalModel.findByTransactionId(transactionId);
  }

  // Update member contribution tracking
  private updateMemberContribution(
    bankId: string,
    memberId: string,
    depositAmount: number,
    withdrawalAmount: number
  ): void {
    const contribution = MemberContributionModel.getOrCreate(bankId, memberId);

    const newTotalDeposited = contribution.totalDeposited + depositAmount;
    const newTotalWithdrawn = contribution.totalWithdrawn + withdrawalAmount;
    const contributionScore = newTotalDeposited - newTotalWithdrawn;

    MemberContributionModel.update(contribution.id, {
      totalDeposited: newTotalDeposited,
      totalWithdrawn: newTotalWithdrawn,
      contributionScore,
      lastContributionAt: depositAmount > 0 ? new Date() : contribution.lastContributionAt,
    });
  }

  // Check vault access based on role
  private checkVaultAccess(accessLevel: string, memberRole: MemberRole): void {
    const roleHierarchy: Record<MemberRole, number> = {
      [MemberRole.MEMBER]: 1,
      [MemberRole.OFFICER]: 2,
      [MemberRole.TREASURER]: 3,
      [MemberRole.LEADER]: 4,
    };

    const accessHierarchy: Record<string, number> = {
      PUBLIC: 0,
      MEMBER: 1,
      OFFICER: 2,
      LEADER: 4,
    };

    if (roleHierarchy[memberRole] < accessHierarchy[accessLevel]) {
      throw new ForbiddenError('You do not have access to this vault');
    }
  }
}

export const transactionService = new TransactionService();
