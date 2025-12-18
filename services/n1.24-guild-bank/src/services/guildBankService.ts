import {
  GuildBankModel,
  VaultModel,
  WithdrawalPolicyModel,
  GuildMemberModel,
  MemberRole,
  VaultAccessLevel,
} from '../models';
import {
  GuildBank,
  Vault,
  WithdrawalPolicy,
  CreateGuildBankInput,
  CreateVaultInput,
  WithdrawalPolicyInput,
} from '../types';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';

export class GuildBankService {
  createBank(input: CreateGuildBankInput, creatorId: string): GuildBank {
    // Check if guild already has a bank
    const existingBank = GuildBankModel.findByGuildId(input.guildId);
    if (existingBank) {
      throw new ValidationError('Guild already has a bank');
    }

    const bank = GuildBankModel.create({
      guildId: input.guildId,
      name: input.name,
      description: input.description,
      currency: input.currency || 'GOLD',
      approvalThreshold: input.approvalThreshold || config.multiSignature.defaultApprovalThreshold,
    });

    // Create default withdrawal policy
    WithdrawalPolicyModel.create({
      bankId: bank.id,
      dailyLimit: config.withdrawalLimits.defaultDailyLimit,
      singleTransactionLimit: config.withdrawalLimits.defaultSingleLimit,
      cooldownMinutes: 0,
      requiresApproval: true,
      minApprovals: bank.approvalThreshold,
    });

    // Create default vault
    VaultModel.create({
      bankId: bank.id,
      name: 'Main Vault',
      description: 'Default guild vault',
      accessLevel: VaultAccessLevel.MEMBER,
    });

    // Set creator as guild leader with approval rights
    GuildMemberModel.create({
      guildId: input.guildId,
      userId: creatorId,
      role: MemberRole.LEADER,
      canApprove: true,
    });

    logger.info('Guild bank created', { bankId: bank.id, guildId: input.guildId });
    return bank;
  }

  getBank(bankId: string): GuildBank {
    const bank = GuildBankModel.findById(bankId);
    if (!bank) {
      throw new NotFoundError('Guild bank');
    }
    return bank;
  }

  getBankByGuildId(guildId: string): GuildBank {
    const bank = GuildBankModel.findByGuildId(guildId);
    if (!bank) {
      throw new NotFoundError('Guild bank');
    }
    return bank;
  }

  updateBank(bankId: string, data: Partial<GuildBank>, userId: string): GuildBank {
    const bank = this.getBank(bankId);
    
    // Check if user has permission (must be leader or treasurer)
    const member = GuildMemberModel.findByGuildAndUser(bank.guildId, userId);
    if (!member || (member.role !== MemberRole.LEADER && member.role !== MemberRole.TREASURER)) {
      throw new ForbiddenError('Only guild leaders or treasurers can update bank settings');
    }

    const updated = GuildBankModel.update(bankId, {
      name: data.name,
      description: data.description,
      approvalThreshold: data.approvalThreshold,
    });

    if (!updated) {
      throw new NotFoundError('Guild bank');
    }

    logger.info('Guild bank updated', { bankId, userId });
    return updated;
  }

  deleteBank(bankId: string, userId: string): void {
    const bank = this.getBank(bankId);
    
    // Check if user has permission (must be leader)
    const member = GuildMemberModel.findByGuildAndUser(bank.guildId, userId);
    if (!member || member.role !== MemberRole.LEADER) {
      throw new ForbiddenError('Only guild leaders can delete the bank');
    }

    // Check if bank has balance
    if (bank.totalBalance > 0) {
      throw new ValidationError('Cannot delete bank with remaining balance');
    }

    GuildBankModel.delete(bankId);
    logger.info('Guild bank deleted', { bankId, userId });
  }

  // Vault Management
  createVault(bankId: string, input: CreateVaultInput, userId: string): Vault {
    const bank = this.getBank(bankId);
    
    // Check if user has permission
    const member = GuildMemberModel.findByGuildAndUser(bank.guildId, userId);
    if (!member || (member.role !== MemberRole.LEADER && member.role !== MemberRole.TREASURER)) {
      throw new ForbiddenError('Only guild leaders or treasurers can create vaults');
    }

    const vault = VaultModel.create({
      bankId,
      name: input.name,
      description: input.description,
      accessLevel: input.accessLevel || VaultAccessLevel.MEMBER,
      maxCapacity: input.maxCapacity,
    });

    logger.info('Vault created', { vaultId: vault.id, bankId, userId });
    return vault;
  }

  getVault(vaultId: string): Vault {
    const vault = VaultModel.findById(vaultId);
    if (!vault) {
      throw new NotFoundError('Vault');
    }
    return vault;
  }

  getVaultsByBankId(bankId: string): Vault[] {
    this.getBank(bankId); // Verify bank exists
    return VaultModel.findByBankId(bankId);
  }

  updateVault(vaultId: string, data: Partial<Vault>, userId: string): Vault {
    const vault = this.getVault(vaultId);
    const bank = this.getBank(vault.bankId);
    
    // Check if user has permission
    const member = GuildMemberModel.findByGuildAndUser(bank.guildId, userId);
    if (!member || (member.role !== MemberRole.LEADER && member.role !== MemberRole.TREASURER)) {
      throw new ForbiddenError('Only guild leaders or treasurers can update vaults');
    }

    const updated = VaultModel.update(vaultId, {
      name: data.name,
      description: data.description,
      accessLevel: data.accessLevel,
      maxCapacity: data.maxCapacity,
    });

    if (!updated) {
      throw new NotFoundError('Vault');
    }

    logger.info('Vault updated', { vaultId, userId });
    return updated;
  }

  deleteVault(vaultId: string, userId: string): void {
    const vault = this.getVault(vaultId);
    const bank = this.getBank(vault.bankId);
    
    // Check if user has permission
    const member = GuildMemberModel.findByGuildAndUser(bank.guildId, userId);
    if (!member || member.role !== MemberRole.LEADER) {
      throw new ForbiddenError('Only guild leaders can delete vaults');
    }

    // Check if vault has balance
    if (vault.balance > 0) {
      throw new ValidationError('Cannot delete vault with remaining balance');
    }

    VaultModel.delete(vaultId);
    logger.info('Vault deleted', { vaultId, userId });
  }

  // Withdrawal Policy Management
  getWithdrawalPolicy(bankId: string, vaultId?: string): WithdrawalPolicy {
    let policy: WithdrawalPolicy | undefined;
    
    if (vaultId) {
      policy = WithdrawalPolicyModel.findByVaultId(vaultId);
    }
    
    if (!policy) {
      policy = WithdrawalPolicyModel.findByBankId(bankId);
    }
    
    if (!policy) {
      throw new NotFoundError('Withdrawal policy');
    }
    
    return policy;
  }

  updateWithdrawalPolicy(
    bankId: string,
    input: WithdrawalPolicyInput,
    userId: string,
    vaultId?: string
  ): WithdrawalPolicy {
    const bank = this.getBank(bankId);
    
    // Check if user has permission
    const member = GuildMemberModel.findByGuildAndUser(bank.guildId, userId);
    if (!member || (member.role !== MemberRole.LEADER && member.role !== MemberRole.TREASURER)) {
      throw new ForbiddenError('Only guild leaders or treasurers can update withdrawal policies');
    }

    let policy: WithdrawalPolicy | undefined;
    
    if (vaultId) {
      policy = WithdrawalPolicyModel.findByVaultId(vaultId);
      if (!policy) {
        // Create vault-specific policy
        policy = WithdrawalPolicyModel.create({
          bankId,
          vaultId,
          ...input,
        });
      } else {
        policy = WithdrawalPolicyModel.update(policy.id, input);
      }
    } else {
      policy = WithdrawalPolicyModel.findByBankId(bankId);
      if (policy) {
        policy = WithdrawalPolicyModel.update(policy.id, input);
      }
    }

    if (!policy) {
      throw new NotFoundError('Withdrawal policy');
    }

    logger.info('Withdrawal policy updated', { bankId, vaultId, userId });
    return policy;
  }

  // Calculate total balance across all vaults
  calculateTotalBalance(bankId: string): number {
    const vaults = VaultModel.findByBankId(bankId);
    return vaults.reduce((total, vault) => total + vault.balance, 0);
  }

  // Update bank total balance
  updateTotalBalance(bankId: string): GuildBank {
    const totalBalance = this.calculateTotalBalance(bankId);
    const updated = GuildBankModel.update(bankId, { totalBalance });
    if (!updated) {
      throw new NotFoundError('Guild bank');
    }
    return updated;
  }
}

export const guildBankService = new GuildBankService();
