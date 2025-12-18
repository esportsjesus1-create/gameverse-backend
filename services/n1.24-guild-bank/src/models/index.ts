import { v4 as uuidv4 } from 'uuid';
import {
  GuildBank,
  Vault,
  Transaction,
  Approval,
  MemberContribution,
  WithdrawalPolicy,
  GuildMember,
  TransactionType,
  TransactionStatus,
  VaultAccessLevel,
  MemberRole,
  ApprovalStatus,
} from '../types';

// In-memory storage for demonstration (would be replaced with Prisma in production)
const guildBanks: Map<string, GuildBank> = new Map();
const vaults: Map<string, Vault> = new Map();
const transactions: Map<string, Transaction> = new Map();
const approvals: Map<string, Approval> = new Map();
const memberContributions: Map<string, MemberContribution> = new Map();
const withdrawalPolicies: Map<string, WithdrawalPolicy> = new Map();
const guildMembers: Map<string, GuildMember> = new Map();

// Guild Bank Model
export const GuildBankModel = {
  create(data: Omit<GuildBank, 'id' | 'totalBalance' | 'createdAt' | 'updatedAt'>): GuildBank {
    const bank: GuildBank = {
      id: uuidv4(),
      ...data,
      totalBalance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    guildBanks.set(bank.id, bank);
    return bank;
  },

  findById(id: string): GuildBank | undefined {
    return guildBanks.get(id);
  },

  findByGuildId(guildId: string): GuildBank | undefined {
    return Array.from(guildBanks.values()).find(bank => bank.guildId === guildId);
  },

  update(id: string, data: Partial<GuildBank>): GuildBank | undefined {
    const bank = guildBanks.get(id);
    if (!bank) return undefined;
    const updated = { ...bank, ...data, updatedAt: new Date() };
    guildBanks.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return guildBanks.delete(id);
  },

  findAll(): GuildBank[] {
    return Array.from(guildBanks.values());
  },

  clear(): void {
    guildBanks.clear();
  },
};

// Vault Model
export const VaultModel = {
  create(data: Omit<Vault, 'id' | 'balance' | 'createdAt' | 'updatedAt'>): Vault {
    const vault: Vault = {
      id: uuidv4(),
      ...data,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vaults.set(vault.id, vault);
    return vault;
  },

  findById(id: string): Vault | undefined {
    return vaults.get(id);
  },

  findByBankId(bankId: string): Vault[] {
    return Array.from(vaults.values()).filter(vault => vault.bankId === bankId);
  },

  update(id: string, data: Partial<Vault>): Vault | undefined {
    const vault = vaults.get(id);
    if (!vault) return undefined;
    const updated = { ...vault, ...data, updatedAt: new Date() };
    vaults.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return vaults.delete(id);
  },

  clear(): void {
    vaults.clear();
  },
};

// Transaction Model
export const TransactionModel = {
  create(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Transaction {
    const transaction: Transaction = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    transactions.set(transaction.id, transaction);
    return transaction;
  },

  findById(id: string): Transaction | undefined {
    return transactions.get(id);
  },

  findByBankId(bankId: string): Transaction[] {
    return Array.from(transactions.values()).filter(tx => tx.bankId === bankId);
  },

  findByVaultId(vaultId: string): Transaction[] {
    return Array.from(transactions.values()).filter(tx => tx.vaultId === vaultId);
  },

  findByInitiator(initiatorId: string): Transaction[] {
    return Array.from(transactions.values()).filter(tx => tx.initiatorId === initiatorId);
  },

  findPendingByBankId(bankId: string): Transaction[] {
    return Array.from(transactions.values()).filter(
      tx => tx.bankId === bankId && tx.status === TransactionStatus.PENDING
    );
  },

  update(id: string, data: Partial<Transaction>): Transaction | undefined {
    const transaction = transactions.get(id);
    if (!transaction) return undefined;
    const updated = { ...transaction, ...data, updatedAt: new Date() };
    transactions.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return transactions.delete(id);
  },

  clear(): void {
    transactions.clear();
  },

  getDailyWithdrawals(bankId: string, userId: string): Transaction[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from(transactions.values()).filter(
      tx =>
        tx.bankId === bankId &&
        tx.initiatorId === userId &&
        tx.type === TransactionType.WITHDRAWAL &&
        tx.status === TransactionStatus.COMPLETED &&
        tx.createdAt >= today
    );
  },
};

// Approval Model
export const ApprovalModel = {
  create(data: Omit<Approval, 'id' | 'createdAt'>): Approval {
    const approval: Approval = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
    };
    approvals.set(approval.id, approval);
    return approval;
  },

  findById(id: string): Approval | undefined {
    return approvals.get(id);
  },

  findByTransactionId(transactionId: string): Approval[] {
    return Array.from(approvals.values()).filter(a => a.transactionId === transactionId);
  },

  findByApprover(approverId: string): Approval[] {
    return Array.from(approvals.values()).filter(a => a.approverId === approverId);
  },

  hasApproved(transactionId: string, approverId: string): boolean {
    return Array.from(approvals.values()).some(
      a => a.transactionId === transactionId && a.approverId === approverId
    );
  },

  getApprovalCount(transactionId: string): number {
    return Array.from(approvals.values()).filter(
      a => a.transactionId === transactionId && a.status === ApprovalStatus.APPROVED
    ).length;
  },

  clear(): void {
    approvals.clear();
  },
};

// Member Contribution Model
export const MemberContributionModel = {
  create(data: Omit<MemberContribution, 'id' | 'createdAt' | 'updatedAt'>): MemberContribution {
    const contribution: MemberContribution = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memberContributions.set(contribution.id, contribution);
    return contribution;
  },

  findById(id: string): MemberContribution | undefined {
    return memberContributions.get(id);
  },

  findByBankAndMember(bankId: string, memberId: string): MemberContribution | undefined {
    return Array.from(memberContributions.values()).find(
      c => c.bankId === bankId && c.memberId === memberId
    );
  },

  findByBankId(bankId: string): MemberContribution[] {
    return Array.from(memberContributions.values()).filter(c => c.bankId === bankId);
  },

  update(id: string, data: Partial<MemberContribution>): MemberContribution | undefined {
    const contribution = memberContributions.get(id);
    if (!contribution) return undefined;
    const updated = { ...contribution, ...data, updatedAt: new Date() };
    memberContributions.set(id, updated);
    return updated;
  },

  getOrCreate(bankId: string, memberId: string): MemberContribution {
    let contribution = this.findByBankAndMember(bankId, memberId);
    if (!contribution) {
      contribution = this.create({
        bankId,
        memberId,
        totalDeposited: 0,
        totalWithdrawn: 0,
        contributionScore: 0,
      });
    }
    return contribution;
  },

  clear(): void {
    memberContributions.clear();
  },
};

// Withdrawal Policy Model
export const WithdrawalPolicyModel = {
  create(data: Omit<WithdrawalPolicy, 'id' | 'createdAt' | 'updatedAt'>): WithdrawalPolicy {
    const policy: WithdrawalPolicy = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    withdrawalPolicies.set(policy.id, policy);
    return policy;
  },

  findById(id: string): WithdrawalPolicy | undefined {
    return withdrawalPolicies.get(id);
  },

  findByBankId(bankId: string): WithdrawalPolicy | undefined {
    return Array.from(withdrawalPolicies.values()).find(
      p => p.bankId === bankId && !p.vaultId
    );
  },

  findByVaultId(vaultId: string): WithdrawalPolicy | undefined {
    return Array.from(withdrawalPolicies.values()).find(p => p.vaultId === vaultId);
  },

  update(id: string, data: Partial<WithdrawalPolicy>): WithdrawalPolicy | undefined {
    const policy = withdrawalPolicies.get(id);
    if (!policy) return undefined;
    const updated = { ...policy, ...data, updatedAt: new Date() };
    withdrawalPolicies.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return withdrawalPolicies.delete(id);
  },

  clear(): void {
    withdrawalPolicies.clear();
  },
};

// Guild Member Model
export const GuildMemberModel = {
  create(data: Omit<GuildMember, 'id' | 'createdAt'>): GuildMember {
    const member: GuildMember = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
    };
    guildMembers.set(member.id, member);
    return member;
  },

  findById(id: string): GuildMember | undefined {
    return guildMembers.get(id);
  },

  findByGuildAndUser(guildId: string, userId: string): GuildMember | undefined {
    return Array.from(guildMembers.values()).find(
      m => m.guildId === guildId && m.userId === userId
    );
  },

  findByGuildId(guildId: string): GuildMember[] {
    return Array.from(guildMembers.values()).filter(m => m.guildId === guildId);
  },

  getApprovers(guildId: string): GuildMember[] {
    return Array.from(guildMembers.values()).filter(
      m => m.guildId === guildId && m.canApprove
    );
  },

  update(id: string, data: Partial<GuildMember>): GuildMember | undefined {
    const member = guildMembers.get(id);
    if (!member) return undefined;
    const updated = { ...member, ...data };
    guildMembers.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return guildMembers.delete(id);
  },

  clear(): void {
    guildMembers.clear();
  },
};

// Clear all data (useful for testing)
export function clearAllData(): void {
  GuildBankModel.clear();
  VaultModel.clear();
  TransactionModel.clear();
  ApprovalModel.clear();
  MemberContributionModel.clear();
  WithdrawalPolicyModel.clear();
  GuildMemberModel.clear();
}

export {
  TransactionType,
  TransactionStatus,
  VaultAccessLevel,
  MemberRole,
  ApprovalStatus,
};
