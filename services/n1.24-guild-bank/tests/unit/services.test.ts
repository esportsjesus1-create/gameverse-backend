import { v4 as uuidv4 } from 'uuid';
import { guildBankService } from '../../src/services/guildBankService';
import { transactionService } from '../../src/services/transactionService';
import { contributionService } from '../../src/services/contributionService';
import {
  clearAllData,
  GuildMemberModel,
  VaultModel,
  MemberRole,
  VaultAccessLevel,
  TransactionStatus,
} from '../../src/models';
// Error classes are tested via string matching in toThrow assertions

describe('GuildBankService', () => {
  const guildId = uuidv4();
  const userId = uuidv4();

  beforeEach(() => {
    clearAllData();
  });

  describe('createBank', () => {
    it('should create a guild bank with default vault and policy', () => {
      const bank = guildBankService.createBank(
        {
          guildId,
          name: 'Test Guild Bank',
          description: 'A test bank',
          currency: 'GOLD',
          approvalThreshold: 2,
        },
        userId
      );

      expect(bank.name).toBe('Test Guild Bank');
      expect(bank.guildId).toBe(guildId);
      expect(bank.totalBalance).toBe(0);

      // Check default vault was created
      const vaults = guildBankService.getVaultsByBankId(bank.id);
      expect(vaults.length).toBe(1);
      expect(vaults[0].name).toBe('Main Vault');

      // Check default policy was created
      const policy = guildBankService.getWithdrawalPolicy(bank.id);
      expect(policy.requiresApproval).toBe(true);
    });

    it('should throw error if guild already has a bank', () => {
      guildBankService.createBank(
        { guildId, name: 'Bank 1', currency: 'GOLD', approvalThreshold: 2 },
        userId
      );

      expect(() =>
        guildBankService.createBank(
          { guildId, name: 'Bank 2', currency: 'GOLD', approvalThreshold: 2 },
          userId
        )
      ).toThrow('Guild already has a bank');
    });
  });

  describe('getBank', () => {
    it('should return bank by id', () => {
      const created = guildBankService.createBank(
        { guildId, name: 'Test Bank', currency: 'GOLD', approvalThreshold: 2 },
        userId
      );

      const found = guildBankService.getBank(created.id);
      expect(found.id).toBe(created.id);
    });

    it('should throw NotFoundError for non-existent bank', () => {
      expect(() => guildBankService.getBank('non-existent')).toThrow('not found');
    });
  });

  describe('getBankByGuildId', () => {
    it('should return bank by guild id', () => {
      const created = guildBankService.createBank(
        { guildId, name: 'Test Bank', currency: 'GOLD', approvalThreshold: 2 },
        userId
      );

      const found = guildBankService.getBankByGuildId(guildId);
      expect(found.id).toBe(created.id);
    });

    it('should throw NotFoundError for non-existent guild', () => {
      expect(() => guildBankService.getBankByGuildId('non-existent')).toThrow('not found');
    });
  });

  describe('updateBank', () => {
    it('should update bank settings', () => {
      const bank = guildBankService.createBank(
        { guildId, name: 'Test Bank', currency: 'GOLD', approvalThreshold: 2 },
        userId
      );

      const updated = guildBankService.updateBank(
        bank.id,
        { name: 'Updated Bank', description: 'New description' },
        userId
      );

      expect(updated.name).toBe('Updated Bank');
      expect(updated.description).toBe('New description');
    });

    it('should throw ForbiddenError for non-leader/treasurer', () => {
      const bank = guildBankService.createBank(
        { guildId, name: 'Test Bank', currency: 'GOLD', approvalThreshold: 2 },
        userId
      );

      const memberId = uuidv4();
      GuildMemberModel.create({
        guildId,
        userId: memberId,
        role: MemberRole.MEMBER,
        canApprove: false,
      });

      expect(() =>
        guildBankService.updateBank(bank.id, { name: 'New Name' }, memberId)
      ).toThrow('Only guild leaders or treasurers');
    });
  });

  describe('deleteBank', () => {
    it('should delete bank with zero balance', () => {
      const bank = guildBankService.createBank(
        { guildId, name: 'Test Bank', currency: 'GOLD', approvalThreshold: 2 },
        userId
      );

      guildBankService.deleteBank(bank.id, userId);
      expect(() => guildBankService.getBank(bank.id)).toThrow('not found');
    });

    it('should throw ValidationError if bank has balance', () => {
      const bank = guildBankService.createBank(
        { guildId, name: 'Test Bank', currency: 'GOLD', approvalThreshold: 2 },
        userId
      );

      // Add balance to vault
      const vaults = guildBankService.getVaultsByBankId(bank.id);
      VaultModel.update(vaults[0].id, { balance: 100 });
      guildBankService.updateTotalBalance(bank.id);

      expect(() => guildBankService.deleteBank(bank.id, userId)).toThrow('Cannot delete bank with remaining balance');
    });

    it('should throw ForbiddenError for non-leader', () => {
      const bank = guildBankService.createBank(
        { guildId, name: 'Test Bank', currency: 'GOLD', approvalThreshold: 2 },
        userId
      );

      const treasurerId = uuidv4();
      GuildMemberModel.create({
        guildId,
        userId: treasurerId,
        role: MemberRole.TREASURER,
        canApprove: true,
      });

      expect(() => guildBankService.deleteBank(bank.id, treasurerId)).toThrow('Only guild leaders can delete');
    });
  });

  describe('Vault Management', () => {
    let bankId: string;

    beforeEach(() => {
      const bank = guildBankService.createBank(
        { guildId, name: 'Test Bank', currency: 'GOLD', approvalThreshold: 2 },
        userId
      );
      bankId = bank.id;
    });

    it('should create a new vault', () => {
      const vault = guildBankService.createVault(
        bankId,
        { name: 'Officer Vault', accessLevel: VaultAccessLevel.OFFICER },
        userId
      );

      expect(vault.name).toBe('Officer Vault');
      expect(vault.accessLevel).toBe(VaultAccessLevel.OFFICER);
    });

    it('should get vault by id', () => {
      const created = guildBankService.createVault(
        bankId,
        { name: 'Test Vault', accessLevel: VaultAccessLevel.MEMBER },
        userId
      );

      const found = guildBankService.getVault(created.id);
      expect(found.id).toBe(created.id);
    });

    it('should throw NotFoundError for non-existent vault', () => {
      expect(() => guildBankService.getVault('non-existent')).toThrow('not found');
    });

    it('should update vault', () => {
      const vault = guildBankService.createVault(
        bankId,
        { name: 'Test Vault', accessLevel: VaultAccessLevel.MEMBER },
        userId
      );

      const updated = guildBankService.updateVault(
        vault.id,
        { name: 'Updated Vault', maxCapacity: 10000 },
        userId
      );

      expect(updated.name).toBe('Updated Vault');
      expect(updated.maxCapacity).toBe(10000);
    });

    it('should delete vault with zero balance', () => {
      const vault = guildBankService.createVault(
        bankId,
        { name: 'Test Vault', accessLevel: VaultAccessLevel.MEMBER },
        userId
      );

      guildBankService.deleteVault(vault.id, userId);
      expect(() => guildBankService.getVault(vault.id)).toThrow('not found');
    });

    it('should throw ValidationError when deleting vault with balance', () => {
      const vault = guildBankService.createVault(
        bankId,
        { name: 'Test Vault', accessLevel: VaultAccessLevel.MEMBER },
        userId
      );

      VaultModel.update(vault.id, { balance: 100 });

      expect(() => guildBankService.deleteVault(vault.id, userId)).toThrow('Cannot delete vault with remaining balance');
    });
  });

  describe('Withdrawal Policy', () => {
    let bankId: string;

    beforeEach(() => {
      const bank = guildBankService.createBank(
        { guildId, name: 'Test Bank', currency: 'GOLD', approvalThreshold: 2 },
        userId
      );
      bankId = bank.id;
    });

    it('should get withdrawal policy', () => {
      const policy = guildBankService.getWithdrawalPolicy(bankId);
      expect(policy.bankId).toBe(bankId);
      expect(policy.requiresApproval).toBe(true);
    });

    it('should update withdrawal policy', () => {
      const updated = guildBankService.updateWithdrawalPolicy(
        bankId,
        {
          dailyLimit: 50000,
          singleTransactionLimit: 25000,
          cooldownMinutes: 60,
          requiresApproval: true,
          minApprovals: 3,
        },
        userId
      );

      expect(updated.dailyLimit).toBe(50000);
      expect(updated.cooldownMinutes).toBe(60);
    });
  });
});

describe('TransactionService', () => {
  const guildId = uuidv4();
  const userId = uuidv4();
  let bankId: string;
  let vaultId: string;

  beforeEach(() => {
    clearAllData();
    const bank = guildBankService.createBank(
      { guildId, name: 'Test Bank', currency: 'GOLD', approvalThreshold: 2 },
      userId
    );
    bankId = bank.id;
    const vaults = guildBankService.getVaultsByBankId(bankId);
    vaultId = vaults[0].id;
  });

  describe('deposit', () => {
    it('should deposit funds into vault', () => {
      const transaction = transactionService.deposit(
        bankId,
        { vaultId, amount: 1000, currency: 'GOLD', note: 'Test deposit' },
        userId
      );

      expect(transaction.amount).toBe(1000);
      expect(transaction.status).toBe(TransactionStatus.COMPLETED);

      const vault = guildBankService.getVault(vaultId);
      expect(vault.balance).toBe(1000);
    });

    it('should update member contribution on deposit', () => {
      transactionService.deposit(
        bankId,
        { vaultId, amount: 500, currency: 'GOLD' },
        userId
      );

      const contribution = contributionService.getMemberContribution(bankId, userId);
      expect(contribution.totalDeposited).toBe(500);
      expect(contribution.contributionScore).toBe(500);
    });

    it('should throw ValidationError if vault does not belong to bank', () => {
      const otherGuildId = uuidv4();
      const otherUserId = uuidv4();
      const otherBank = guildBankService.createBank(
        { guildId: otherGuildId, name: 'Other Bank', currency: 'GOLD', approvalThreshold: 2 },
        otherUserId
      );
      const otherVaults = guildBankService.getVaultsByBankId(otherBank.id);

      expect(() =>
        transactionService.deposit(
          bankId,
          { vaultId: otherVaults[0].id, amount: 100, currency: 'GOLD' },
          userId
        )
      ).toThrow('Vault does not belong to this bank');
    });

    it('should throw ValidationError if deposit exceeds vault capacity', () => {
      const limitedVault = guildBankService.createVault(
        bankId,
        { name: 'Limited Vault', accessLevel: VaultAccessLevel.MEMBER, maxCapacity: 500 },
        userId
      );

      expect(() =>
        transactionService.deposit(
          bankId,
          { vaultId: limitedVault.id, amount: 1000, currency: 'GOLD' },
          userId
        )
      ).toThrow('Deposit would exceed vault capacity');
    });
  });

  describe('requestWithdrawal', () => {
    beforeEach(() => {
      // Add funds to vault
      transactionService.deposit(
        bankId,
        { vaultId, amount: 10000, currency: 'GOLD' },
        userId
      );
    });

    it('should create pending withdrawal request', () => {
      const transaction = transactionService.requestWithdrawal(
        bankId,
        { vaultId, amount: 1000, currency: 'GOLD', reason: 'Guild event' },
        userId
      );

      expect(transaction.status).toBe(TransactionStatus.PENDING);
      expect(transaction.amount).toBe(1000);
    });

    it('should throw InsufficientFundsError when balance is too low', () => {
      expect(() =>
        transactionService.requestWithdrawal(
          bankId,
          { vaultId, amount: 50000, currency: 'GOLD', reason: 'Too much' },
          userId
        )
      ).toThrow('Insufficient funds');
    });

    it('should throw WithdrawalLimitExceededError for single transaction limit', () => {
      expect(() =>
        transactionService.requestWithdrawal(
          bankId,
          { vaultId, amount: 6000, currency: 'GOLD', reason: 'Over limit' },
          userId
        )
      ).toThrow('withdrawal limit exceeded');
    });

    it('should throw ForbiddenError for non-member', () => {
      const nonMemberId = uuidv4();

      expect(() =>
        transactionService.requestWithdrawal(
          bankId,
          { vaultId, amount: 100, currency: 'GOLD', reason: 'Test' },
          nonMemberId
        )
      ).toThrow('not a member');
    });
  });

  describe('submitApproval', () => {
    let transactionId: string;
    let approverId: string;

    beforeEach(() => {
      // Add funds
      transactionService.deposit(
        bankId,
        { vaultId, amount: 10000, currency: 'GOLD' },
        userId
      );

      // Create withdrawal request
      const transaction = transactionService.requestWithdrawal(
        bankId,
        { vaultId, amount: 1000, currency: 'GOLD', reason: 'Test' },
        userId
      );
      transactionId = transaction.id;

      // Add approver
      approverId = uuidv4();
      GuildMemberModel.create({
        guildId,
        userId: approverId,
        role: MemberRole.OFFICER,
        canApprove: true,
      });
    });

    it('should submit approval', () => {
      const approval = transactionService.submitApproval(
        transactionId,
        { approved: true, comment: 'Looks good' },
        approverId
      );

      expect(approval.approverId).toBe(approverId);
    });

    it('should throw SelfApprovalError when approving own transaction', () => {
      expect(() =>
        transactionService.submitApproval(
          transactionId,
          { approved: true },
          userId
        )
      ).toThrow('cannot approve your own');
    });

    it('should throw DuplicateApprovalError when approving twice', () => {
      transactionService.submitApproval(
        transactionId,
        { approved: true },
        approverId
      );

      expect(() =>
        transactionService.submitApproval(
          transactionId,
          { approved: true },
          approverId
        )
      ).toThrow('already submitted an approval');
    });

    it('should complete withdrawal when enough approvals received', () => {
      // Add second approver
      const approver2Id = uuidv4();
      GuildMemberModel.create({
        guildId,
        userId: approver2Id,
        role: MemberRole.TREASURER,
        canApprove: true,
      });

      transactionService.submitApproval(transactionId, { approved: true }, approverId);
      transactionService.submitApproval(transactionId, { approved: true }, approver2Id);

      const transaction = transactionService.getTransaction(transactionId);
      expect(transaction.status).toBe(TransactionStatus.COMPLETED);

      const vault = guildBankService.getVault(vaultId);
      expect(vault.balance).toBe(9000); // 10000 - 1000
    });

    it('should reject transaction on rejection', () => {
      transactionService.submitApproval(
        transactionId,
        { approved: false, comment: 'Not approved' },
        approverId
      );

      const transaction = transactionService.getTransaction(transactionId);
      expect(transaction.status).toBe(TransactionStatus.REJECTED);
    });
  });

  describe('cancelTransaction', () => {
    it('should cancel pending transaction', () => {
      transactionService.deposit(
        bankId,
        { vaultId, amount: 10000, currency: 'GOLD' },
        userId
      );

      const transaction = transactionService.requestWithdrawal(
        bankId,
        { vaultId, amount: 1000, currency: 'GOLD', reason: 'Test' },
        userId
      );

      const cancelled = transactionService.cancelTransaction(transaction.id, userId);
      expect(cancelled.status).toBe(TransactionStatus.CANCELLED);
    });

    it('should throw ValidationError for non-pending transaction', () => {
      const deposit = transactionService.deposit(
        bankId,
        { vaultId, amount: 1000, currency: 'GOLD' },
        userId
      );

      expect(() =>
        transactionService.cancelTransaction(deposit.id, userId)
      ).toThrow('Only pending transactions');
    });
  });

  describe('getTransactions', () => {
    it('should return transactions with filters', () => {
      transactionService.deposit(
        bankId,
        { vaultId, amount: 1000, currency: 'GOLD' },
        userId
      );
      transactionService.deposit(
        bankId,
        { vaultId, amount: 500, currency: 'GOLD' },
        userId
      );

      const transactions = transactionService.getTransactionsByBankId(bankId);
      expect(transactions.length).toBe(2);
    });
  });
});

describe('ContributionService', () => {
  const guildId = uuidv4();
  const userId = uuidv4();
  let bankId: string;
  let vaultId: string;

  beforeEach(() => {
    clearAllData();
    const bank = guildBankService.createBank(
      { guildId, name: 'Test Bank', currency: 'GOLD', approvalThreshold: 2 },
      userId
    );
    bankId = bank.id;
    const vaults = guildBankService.getVaultsByBankId(bankId);
    vaultId = vaults[0].id;
  });

  describe('getMemberContribution', () => {
    it('should return member contribution', () => {
      transactionService.deposit(
        bankId,
        { vaultId, amount: 1000, currency: 'GOLD' },
        userId
      );

      const contribution = contributionService.getMemberContribution(bankId, userId);
      expect(contribution.totalDeposited).toBe(1000);
    });

    it('should throw NotFoundError for non-existent contribution', () => {
      expect(() =>
        contributionService.getMemberContribution(bankId, 'non-existent')
      ).toThrow('not found');
    });
  });

  describe('getLeaderboard', () => {
    it('should return sorted leaderboard', () => {
      // Add multiple members with contributions
      const member2Id = uuidv4();
      GuildMemberModel.create({
        guildId,
        userId: member2Id,
        role: MemberRole.MEMBER,
        canApprove: false,
      });

      transactionService.deposit(
        bankId,
        { vaultId, amount: 500, currency: 'GOLD' },
        userId
      );
      transactionService.deposit(
        bankId,
        { vaultId, amount: 1000, currency: 'GOLD' },
        member2Id
      );

      const leaderboard = contributionService.getLeaderboard(bankId);
      expect(leaderboard[0].memberId).toBe(member2Id);
      expect(leaderboard[0].rank).toBe(1);
    });
  });

  describe('getTotalContributions', () => {
    it('should return total contributions', () => {
      transactionService.deposit(
        bankId,
        { vaultId, amount: 1000, currency: 'GOLD' },
        userId
      );

      const totals = contributionService.getTotalContributions(bankId);
      expect(totals.totalDeposited).toBe(1000);
      expect(totals.contributorCount).toBe(1);
    });
  });

  describe('Guild Member Management', () => {
    it('should add guild member', () => {
      const newMemberId = uuidv4();
      const member = contributionService.addGuildMember(
        guildId,
        newMemberId,
        MemberRole.MEMBER,
        false,
        userId
      );

      expect(member.userId).toBe(newMemberId);
      expect(member.role).toBe(MemberRole.MEMBER);
    });

    it('should update member role', () => {
      const memberId = uuidv4();
      contributionService.addGuildMember(guildId, memberId, MemberRole.MEMBER, false, userId);

      const updated = contributionService.updateMemberRole(
        guildId,
        memberId,
        MemberRole.OFFICER,
        true,
        userId
      );

      expect(updated.role).toBe(MemberRole.OFFICER);
      expect(updated.canApprove).toBe(true);
    });

    it('should remove guild member', () => {
      const memberId = uuidv4();
      contributionService.addGuildMember(guildId, memberId, MemberRole.MEMBER, false, userId);

      contributionService.removeGuildMember(guildId, memberId, userId);

      const members = contributionService.getGuildMembers(guildId);
      expect(members.find(m => m.userId === memberId)).toBeUndefined();
    });

    it('should throw ForbiddenError when leader tries to remove self', () => {
      expect(() =>
        contributionService.removeGuildMember(guildId, userId, userId)
      ).toThrow('cannot remove themselves');
    });

    it('should get approvers', () => {
      const officerId = uuidv4();
      contributionService.addGuildMember(guildId, officerId, MemberRole.OFFICER, true, userId);

      const approvers = contributionService.getApprovers(guildId);
      expect(approvers.length).toBe(2); // Leader + Officer
    });
  });
});
