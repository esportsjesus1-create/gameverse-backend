import {
  GuildBankModel,
  VaultModel,
  TransactionModel,
  ApprovalModel,
  MemberContributionModel,
  WithdrawalPolicyModel,
  GuildMemberModel,
  clearAllData,
  TransactionType,
  TransactionStatus,
  VaultAccessLevel,
  MemberRole,
  ApprovalStatus,
} from '../../src/models';

describe('Models', () => {
  beforeEach(() => {
    clearAllData();
  });

  describe('GuildBankModel', () => {
    it('should create a guild bank', () => {
      const bank = GuildBankModel.create({
        guildId: 'guild-123',
        name: 'Test Bank',
        description: 'Test description',
        currency: 'GOLD',
        approvalThreshold: 2,
      });

      expect(bank.id).toBeDefined();
      expect(bank.guildId).toBe('guild-123');
      expect(bank.name).toBe('Test Bank');
      expect(bank.totalBalance).toBe(0);
      expect(bank.createdAt).toBeInstanceOf(Date);
    });

    it('should find bank by id', () => {
      const created = GuildBankModel.create({
        guildId: 'guild-123',
        name: 'Test Bank',
        currency: 'GOLD',
        approvalThreshold: 2,
      });

      const found = GuildBankModel.findById(created.id);
      expect(found).toEqual(created);
    });

    it('should find bank by guild id', () => {
      const created = GuildBankModel.create({
        guildId: 'guild-456',
        name: 'Test Bank',
        currency: 'GOLD',
        approvalThreshold: 2,
      });

      const found = GuildBankModel.findByGuildId('guild-456');
      expect(found).toEqual(created);
    });

    it('should update a guild bank', () => {
      const created = GuildBankModel.create({
        guildId: 'guild-123',
        name: 'Test Bank',
        currency: 'GOLD',
        approvalThreshold: 2,
      });

      const updated = GuildBankModel.update(created.id, { name: 'Updated Bank' });
      expect(updated?.name).toBe('Updated Bank');
    });

    it('should delete a guild bank', () => {
      const created = GuildBankModel.create({
        guildId: 'guild-123',
        name: 'Test Bank',
        currency: 'GOLD',
        approvalThreshold: 2,
      });

      const deleted = GuildBankModel.delete(created.id);
      expect(deleted).toBe(true);
      expect(GuildBankModel.findById(created.id)).toBeUndefined();
    });

    it('should find all banks', () => {
      GuildBankModel.create({
        guildId: 'guild-1',
        name: 'Bank 1',
        currency: 'GOLD',
        approvalThreshold: 2,
      });
      GuildBankModel.create({
        guildId: 'guild-2',
        name: 'Bank 2',
        currency: 'GOLD',
        approvalThreshold: 2,
      });

      const banks = GuildBankModel.findAll();
      expect(banks.length).toBe(2);
    });

    it('should return undefined when updating non-existent bank', () => {
      const result = GuildBankModel.update('non-existent', { name: 'Test' });
      expect(result).toBeUndefined();
    });
  });

  describe('VaultModel', () => {
    it('should create a vault', () => {
      const vault = VaultModel.create({
        bankId: 'bank-123',
        name: 'Main Vault',
        description: 'Main vault',
        accessLevel: VaultAccessLevel.MEMBER,
      });

      expect(vault.id).toBeDefined();
      expect(vault.bankId).toBe('bank-123');
      expect(vault.balance).toBe(0);
    });

    it('should find vaults by bank id', () => {
      VaultModel.create({
        bankId: 'bank-123',
        name: 'Vault 1',
        accessLevel: VaultAccessLevel.MEMBER,
      });
      VaultModel.create({
        bankId: 'bank-123',
        name: 'Vault 2',
        accessLevel: VaultAccessLevel.OFFICER,
      });
      VaultModel.create({
        bankId: 'bank-456',
        name: 'Vault 3',
        accessLevel: VaultAccessLevel.MEMBER,
      });

      const vaults = VaultModel.findByBankId('bank-123');
      expect(vaults.length).toBe(2);
    });

    it('should update vault balance', () => {
      const vault = VaultModel.create({
        bankId: 'bank-123',
        name: 'Main Vault',
        accessLevel: VaultAccessLevel.MEMBER,
      });

      const updated = VaultModel.update(vault.id, { balance: 1000 });
      expect(updated?.balance).toBe(1000);
    });

    it('should delete a vault', () => {
      const vault = VaultModel.create({
        bankId: 'bank-123',
        name: 'Main Vault',
        accessLevel: VaultAccessLevel.MEMBER,
      });

      const deleted = VaultModel.delete(vault.id);
      expect(deleted).toBe(true);
    });

    it('should return undefined when updating non-existent vault', () => {
      const result = VaultModel.update('non-existent', { balance: 100 });
      expect(result).toBeUndefined();
    });
  });

  describe('TransactionModel', () => {
    it('should create a transaction', () => {
      const transaction = TransactionModel.create({
        bankId: 'bank-123',
        vaultId: 'vault-123',
        type: TransactionType.DEPOSIT,
        amount: 100,
        currency: 'GOLD',
        status: TransactionStatus.COMPLETED,
        initiatorId: 'user-123',
      });

      expect(transaction.id).toBeDefined();
      expect(transaction.amount).toBe(100);
      expect(transaction.type).toBe(TransactionType.DEPOSIT);
    });

    it('should find transactions by bank id', () => {
      TransactionModel.create({
        bankId: 'bank-123',
        type: TransactionType.DEPOSIT,
        amount: 100,
        currency: 'GOLD',
        status: TransactionStatus.COMPLETED,
        initiatorId: 'user-123',
      });

      const transactions = TransactionModel.findByBankId('bank-123');
      expect(transactions.length).toBe(1);
    });

    it('should find transactions by vault id', () => {
      TransactionModel.create({
        bankId: 'bank-123',
        vaultId: 'vault-123',
        type: TransactionType.DEPOSIT,
        amount: 100,
        currency: 'GOLD',
        status: TransactionStatus.COMPLETED,
        initiatorId: 'user-123',
      });

      const transactions = TransactionModel.findByVaultId('vault-123');
      expect(transactions.length).toBe(1);
    });

    it('should find transactions by initiator', () => {
      TransactionModel.create({
        bankId: 'bank-123',
        type: TransactionType.DEPOSIT,
        amount: 100,
        currency: 'GOLD',
        status: TransactionStatus.COMPLETED,
        initiatorId: 'user-456',
      });

      const transactions = TransactionModel.findByInitiator('user-456');
      expect(transactions.length).toBe(1);
    });

    it('should find pending transactions', () => {
      TransactionModel.create({
        bankId: 'bank-123',
        type: TransactionType.WITHDRAWAL,
        amount: 100,
        currency: 'GOLD',
        status: TransactionStatus.PENDING,
        initiatorId: 'user-123',
      });
      TransactionModel.create({
        bankId: 'bank-123',
        type: TransactionType.DEPOSIT,
        amount: 50,
        currency: 'GOLD',
        status: TransactionStatus.COMPLETED,
        initiatorId: 'user-123',
      });

      const pending = TransactionModel.findPendingByBankId('bank-123');
      expect(pending.length).toBe(1);
      expect(pending[0].status).toBe(TransactionStatus.PENDING);
    });

    it('should get daily withdrawals', () => {
      TransactionModel.create({
        bankId: 'bank-123',
        type: TransactionType.WITHDRAWAL,
        amount: 100,
        currency: 'GOLD',
        status: TransactionStatus.COMPLETED,
        initiatorId: 'user-123',
      });

      const dailyWithdrawals = TransactionModel.getDailyWithdrawals('bank-123', 'user-123');
      expect(dailyWithdrawals.length).toBe(1);
    });

    it('should update transaction status', () => {
      const transaction = TransactionModel.create({
        bankId: 'bank-123',
        type: TransactionType.WITHDRAWAL,
        amount: 100,
        currency: 'GOLD',
        status: TransactionStatus.PENDING,
        initiatorId: 'user-123',
      });

      const updated = TransactionModel.update(transaction.id, {
        status: TransactionStatus.COMPLETED,
      });
      expect(updated?.status).toBe(TransactionStatus.COMPLETED);
    });
  });

  describe('ApprovalModel', () => {
    it('should create an approval', () => {
      const approval = ApprovalModel.create({
        transactionId: 'tx-123',
        approverId: 'user-456',
        status: ApprovalStatus.APPROVED,
      });

      expect(approval.id).toBeDefined();
      expect(approval.status).toBe(ApprovalStatus.APPROVED);
    });

    it('should find approvals by transaction id', () => {
      ApprovalModel.create({
        transactionId: 'tx-123',
        approverId: 'user-1',
        status: ApprovalStatus.APPROVED,
      });
      ApprovalModel.create({
        transactionId: 'tx-123',
        approverId: 'user-2',
        status: ApprovalStatus.APPROVED,
      });

      const approvals = ApprovalModel.findByTransactionId('tx-123');
      expect(approvals.length).toBe(2);
    });

    it('should check if user has approved', () => {
      ApprovalModel.create({
        transactionId: 'tx-123',
        approverId: 'user-456',
        status: ApprovalStatus.APPROVED,
      });

      expect(ApprovalModel.hasApproved('tx-123', 'user-456')).toBe(true);
      expect(ApprovalModel.hasApproved('tx-123', 'user-789')).toBe(false);
    });

    it('should get approval count', () => {
      ApprovalModel.create({
        transactionId: 'tx-123',
        approverId: 'user-1',
        status: ApprovalStatus.APPROVED,
      });
      ApprovalModel.create({
        transactionId: 'tx-123',
        approverId: 'user-2',
        status: ApprovalStatus.APPROVED,
      });
      ApprovalModel.create({
        transactionId: 'tx-123',
        approverId: 'user-3',
        status: ApprovalStatus.REJECTED,
      });

      const count = ApprovalModel.getApprovalCount('tx-123');
      expect(count).toBe(2);
    });

    it('should find approvals by approver', () => {
      ApprovalModel.create({
        transactionId: 'tx-1',
        approverId: 'user-456',
        status: ApprovalStatus.APPROVED,
      });
      ApprovalModel.create({
        transactionId: 'tx-2',
        approverId: 'user-456',
        status: ApprovalStatus.APPROVED,
      });

      const approvals = ApprovalModel.findByApprover('user-456');
      expect(approvals.length).toBe(2);
    });
  });

  describe('MemberContributionModel', () => {
    it('should create a contribution record', () => {
      const contribution = MemberContributionModel.create({
        bankId: 'bank-123',
        memberId: 'user-123',
        totalDeposited: 0,
        totalWithdrawn: 0,
        contributionScore: 0,
      });

      expect(contribution.id).toBeDefined();
      expect(contribution.totalDeposited).toBe(0);
    });

    it('should find contribution by bank and member', () => {
      MemberContributionModel.create({
        bankId: 'bank-123',
        memberId: 'user-456',
        totalDeposited: 100,
        totalWithdrawn: 0,
        contributionScore: 100,
      });

      const found = MemberContributionModel.findByBankAndMember('bank-123', 'user-456');
      expect(found?.totalDeposited).toBe(100);
    });

    it('should get or create contribution', () => {
      const contribution1 = MemberContributionModel.getOrCreate('bank-123', 'user-789');
      expect(contribution1.totalDeposited).toBe(0);

      const contribution2 = MemberContributionModel.getOrCreate('bank-123', 'user-789');
      expect(contribution2.id).toBe(contribution1.id);
    });

    it('should update contribution', () => {
      const contribution = MemberContributionModel.create({
        bankId: 'bank-123',
        memberId: 'user-123',
        totalDeposited: 0,
        totalWithdrawn: 0,
        contributionScore: 0,
      });

      const updated = MemberContributionModel.update(contribution.id, {
        totalDeposited: 500,
        contributionScore: 500,
      });
      expect(updated?.totalDeposited).toBe(500);
    });

    it('should find contributions by bank id', () => {
      MemberContributionModel.create({
        bankId: 'bank-123',
        memberId: 'user-1',
        totalDeposited: 100,
        totalWithdrawn: 0,
        contributionScore: 100,
      });
      MemberContributionModel.create({
        bankId: 'bank-123',
        memberId: 'user-2',
        totalDeposited: 200,
        totalWithdrawn: 0,
        contributionScore: 200,
      });

      const contributions = MemberContributionModel.findByBankId('bank-123');
      expect(contributions.length).toBe(2);
    });
  });

  describe('WithdrawalPolicyModel', () => {
    it('should create a withdrawal policy', () => {
      const policy = WithdrawalPolicyModel.create({
        bankId: 'bank-123',
        dailyLimit: 10000,
        singleTransactionLimit: 5000,
        cooldownMinutes: 0,
        requiresApproval: true,
        minApprovals: 2,
      });

      expect(policy.id).toBeDefined();
      expect(policy.dailyLimit).toBe(10000);
    });

    it('should find policy by bank id', () => {
      WithdrawalPolicyModel.create({
        bankId: 'bank-456',
        dailyLimit: 10000,
        singleTransactionLimit: 5000,
        cooldownMinutes: 0,
        requiresApproval: true,
        minApprovals: 2,
      });

      const found = WithdrawalPolicyModel.findByBankId('bank-456');
      expect(found?.dailyLimit).toBe(10000);
    });

    it('should find policy by vault id', () => {
      WithdrawalPolicyModel.create({
        bankId: 'bank-123',
        vaultId: 'vault-789',
        dailyLimit: 5000,
        singleTransactionLimit: 2000,
        cooldownMinutes: 30,
        requiresApproval: true,
        minApprovals: 3,
      });

      const found = WithdrawalPolicyModel.findByVaultId('vault-789');
      expect(found?.dailyLimit).toBe(5000);
    });

    it('should update policy', () => {
      const policy = WithdrawalPolicyModel.create({
        bankId: 'bank-123',
        dailyLimit: 10000,
        singleTransactionLimit: 5000,
        cooldownMinutes: 0,
        requiresApproval: true,
        minApprovals: 2,
      });

      const updated = WithdrawalPolicyModel.update(policy.id, { dailyLimit: 20000 });
      expect(updated?.dailyLimit).toBe(20000);
    });

    it('should delete policy', () => {
      const policy = WithdrawalPolicyModel.create({
        bankId: 'bank-123',
        dailyLimit: 10000,
        singleTransactionLimit: 5000,
        cooldownMinutes: 0,
        requiresApproval: true,
        minApprovals: 2,
      });

      const deleted = WithdrawalPolicyModel.delete(policy.id);
      expect(deleted).toBe(true);
    });
  });

  describe('GuildMemberModel', () => {
    it('should create a guild member', () => {
      const member = GuildMemberModel.create({
        guildId: 'guild-123',
        userId: 'user-456',
        role: MemberRole.MEMBER,
        canApprove: false,
      });

      expect(member.id).toBeDefined();
      expect(member.role).toBe(MemberRole.MEMBER);
    });

    it('should find member by guild and user', () => {
      GuildMemberModel.create({
        guildId: 'guild-123',
        userId: 'user-789',
        role: MemberRole.OFFICER,
        canApprove: true,
      });

      const found = GuildMemberModel.findByGuildAndUser('guild-123', 'user-789');
      expect(found?.role).toBe(MemberRole.OFFICER);
    });

    it('should find members by guild id', () => {
      GuildMemberModel.create({
        guildId: 'guild-123',
        userId: 'user-1',
        role: MemberRole.LEADER,
        canApprove: true,
      });
      GuildMemberModel.create({
        guildId: 'guild-123',
        userId: 'user-2',
        role: MemberRole.MEMBER,
        canApprove: false,
      });

      const members = GuildMemberModel.findByGuildId('guild-123');
      expect(members.length).toBe(2);
    });

    it('should get approvers', () => {
      GuildMemberModel.create({
        guildId: 'guild-123',
        userId: 'user-1',
        role: MemberRole.LEADER,
        canApprove: true,
      });
      GuildMemberModel.create({
        guildId: 'guild-123',
        userId: 'user-2',
        role: MemberRole.OFFICER,
        canApprove: true,
      });
      GuildMemberModel.create({
        guildId: 'guild-123',
        userId: 'user-3',
        role: MemberRole.MEMBER,
        canApprove: false,
      });

      const approvers = GuildMemberModel.getApprovers('guild-123');
      expect(approvers.length).toBe(2);
    });

    it('should update member role', () => {
      const member = GuildMemberModel.create({
        guildId: 'guild-123',
        userId: 'user-456',
        role: MemberRole.MEMBER,
        canApprove: false,
      });

      const updated = GuildMemberModel.update(member.id, {
        role: MemberRole.OFFICER,
        canApprove: true,
      });
      expect(updated?.role).toBe(MemberRole.OFFICER);
      expect(updated?.canApprove).toBe(true);
    });

    it('should delete member', () => {
      const member = GuildMemberModel.create({
        guildId: 'guild-123',
        userId: 'user-456',
        role: MemberRole.MEMBER,
        canApprove: false,
      });

      const deleted = GuildMemberModel.delete(member.id);
      expect(deleted).toBe(true);
    });
  });
});
