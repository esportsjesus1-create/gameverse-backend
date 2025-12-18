import { z } from 'zod';

// Enums
export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
  FEE = 'FEE',
  REWARD = 'REWARD',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum VaultAccessLevel {
  PUBLIC = 'PUBLIC',
  MEMBER = 'MEMBER',
  OFFICER = 'OFFICER',
  LEADER = 'LEADER',
}

export enum MemberRole {
  MEMBER = 'MEMBER',
  OFFICER = 'OFFICER',
  TREASURER = 'TREASURER',
  LEADER = 'LEADER',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// Zod Schemas for validation
export const CreateGuildBankSchema = z.object({
  guildId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  currency: z.string().min(1).max(10).default('GOLD'),
  approvalThreshold: z.number().int().min(1).max(10).default(2),
});

export const CreateVaultSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  accessLevel: z.nativeEnum(VaultAccessLevel).default(VaultAccessLevel.MEMBER),
  maxCapacity: z.number().positive().optional(),
});

export const DepositSchema = z.object({
  vaultId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().min(1).max(10),
  note: z.string().max(500).optional(),
});

export const WithdrawalRequestSchema = z.object({
  vaultId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().min(1).max(10),
  reason: z.string().min(1).max(500),
});

export const ApprovalDecisionSchema = z.object({
  approved: z.boolean(),
  comment: z.string().max(500).optional(),
});

export const WithdrawalPolicySchema = z.object({
  dailyLimit: z.number().positive(),
  singleTransactionLimit: z.number().positive(),
  cooldownMinutes: z.number().int().min(0).default(0),
  requiresApproval: z.boolean().default(true),
  minApprovals: z.number().int().min(1).default(2),
});

// TypeScript Interfaces
export interface GuildBank {
  id: string;
  guildId: string;
  name: string;
  description?: string;
  currency: string;
  totalBalance: number;
  approvalThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Vault {
  id: string;
  bankId: string;
  name: string;
  description?: string;
  balance: number;
  accessLevel: VaultAccessLevel;
  maxCapacity?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  bankId: string;
  vaultId?: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  initiatorId: string;
  recipientId?: string;
  note?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Approval {
  id: string;
  transactionId: string;
  approverId: string;
  status: ApprovalStatus;
  comment?: string;
  createdAt: Date;
}

export interface MemberContribution {
  id: string;
  bankId: string;
  memberId: string;
  totalDeposited: number;
  totalWithdrawn: number;
  contributionScore: number;
  lastContributionAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WithdrawalPolicy {
  id: string;
  bankId: string;
  vaultId?: string;
  dailyLimit: number;
  singleTransactionLimit: number;
  cooldownMinutes: number;
  requiresApproval: boolean;
  minApprovals: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuildMember {
  id: string;
  guildId: string;
  userId: string;
  role: MemberRole;
  canApprove: boolean;
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Request Context
export interface RequestContext {
  userId: string;
  guildId: string;
  memberRole: MemberRole;
}

// Type inference from Zod schemas
export type CreateGuildBankInput = z.infer<typeof CreateGuildBankSchema>;
export type CreateVaultInput = z.infer<typeof CreateVaultSchema>;
export type DepositInput = z.infer<typeof DepositSchema>;
export type WithdrawalRequestInput = z.infer<typeof WithdrawalRequestSchema>;
export type ApprovalDecisionInput = z.infer<typeof ApprovalDecisionSchema>;
export type WithdrawalPolicyInput = z.infer<typeof WithdrawalPolicySchema>;
