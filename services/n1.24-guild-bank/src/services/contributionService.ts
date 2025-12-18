import {
  MemberContributionModel,
  GuildMemberModel,
  MemberRole,
} from '../models';
import { MemberContribution, GuildMember } from '../types';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { guildBankService } from './guildBankService';
import { logger } from '../utils/logger';

export interface ContributionSummary {
  memberId: string;
  memberRole: MemberRole;
  totalDeposited: number;
  totalWithdrawn: number;
  contributionScore: number;
  lastContributionAt?: Date;
  rank: number;
}

export interface LeaderboardEntry {
  rank: number;
  memberId: string;
  contributionScore: number;
  totalDeposited: number;
}

export class ContributionService {
  // Get contribution for a specific member
  getMemberContribution(bankId: string, memberId: string): MemberContribution {
    guildBankService.getBank(bankId); // Verify bank exists
    
    const contribution = MemberContributionModel.findByBankAndMember(bankId, memberId);
    if (!contribution) {
      throw new NotFoundError('Member contribution');
    }
    return contribution;
  }

  // Get all contributions for a bank
  getAllContributions(bankId: string): MemberContribution[] {
    guildBankService.getBank(bankId); // Verify bank exists
    return MemberContributionModel.findByBankId(bankId);
  }

  // Get contribution summary with ranking
  getContributionSummary(bankId: string, memberId: string): ContributionSummary {
    const bank = guildBankService.getBank(bankId);
    const contribution = this.getMemberContribution(bankId, memberId);
    const member = GuildMemberModel.findByGuildAndUser(bank.guildId, memberId);

    if (!member) {
      throw new NotFoundError('Guild member');
    }

    // Calculate rank
    const allContributions = this.getAllContributions(bankId);
    const sortedContributions = allContributions.sort(
      (a, b) => b.contributionScore - a.contributionScore
    );
    const rank = sortedContributions.findIndex(c => c.memberId === memberId) + 1;

    return {
      memberId,
      memberRole: member.role,
      totalDeposited: contribution.totalDeposited,
      totalWithdrawn: contribution.totalWithdrawn,
      contributionScore: contribution.contributionScore,
      lastContributionAt: contribution.lastContributionAt,
      rank,
    };
  }

  // Get contribution leaderboard
  getLeaderboard(bankId: string, limit = 10): LeaderboardEntry[] {
    guildBankService.getBank(bankId); // Verify bank exists
    
    const contributions = this.getAllContributions(bankId);
    const sorted = contributions.sort((a, b) => b.contributionScore - a.contributionScore);
    
    return sorted.slice(0, limit).map((contribution, index) => ({
      rank: index + 1,
      memberId: contribution.memberId,
      contributionScore: contribution.contributionScore,
      totalDeposited: contribution.totalDeposited,
    }));
  }

  // Get total contributions for a bank
  getTotalContributions(bankId: string): {
    totalDeposited: number;
    totalWithdrawn: number;
    netContribution: number;
    contributorCount: number;
  } {
    guildBankService.getBank(bankId); // Verify bank exists
    
    const contributions = this.getAllContributions(bankId);
    
    const totalDeposited = contributions.reduce((sum, c) => sum + c.totalDeposited, 0);
    const totalWithdrawn = contributions.reduce((sum, c) => sum + c.totalWithdrawn, 0);
    
    return {
      totalDeposited,
      totalWithdrawn,
      netContribution: totalDeposited - totalWithdrawn,
      contributorCount: contributions.filter(c => c.totalDeposited > 0).length,
    };
  }

  // Reset contribution tracking (admin only)
  resetContributions(bankId: string, userId: string): void {
    const bank = guildBankService.getBank(bankId);
    
    // Check if user has permission (must be leader)
    const member = GuildMemberModel.findByGuildAndUser(bank.guildId, userId);
    if (!member || member.role !== MemberRole.LEADER) {
      throw new ForbiddenError('Only guild leaders can reset contributions');
    }

    const contributions = this.getAllContributions(bankId);
    contributions.forEach(contribution => {
      MemberContributionModel.update(contribution.id, {
        totalDeposited: 0,
        totalWithdrawn: 0,
        contributionScore: 0,
        lastContributionAt: undefined,
      });
    });

    logger.info('Contributions reset', { bankId, userId });
  }

  // Add guild member
  addGuildMember(
    guildId: string,
    userId: string,
    role: MemberRole,
    canApprove: boolean,
    addedBy: string
  ): GuildMember {
    // Check if adder has permission
    const adder = GuildMemberModel.findByGuildAndUser(guildId, addedBy);
    if (!adder || (adder.role !== MemberRole.LEADER && adder.role !== MemberRole.OFFICER)) {
      throw new ForbiddenError('Only leaders and officers can add members');
    }

    // Check if member already exists
    const existing = GuildMemberModel.findByGuildAndUser(guildId, userId);
    if (existing) {
      throw new ForbiddenError('Member already exists in guild');
    }

    const member = GuildMemberModel.create({
      guildId,
      userId,
      role,
      canApprove,
    });

    logger.info('Guild member added', { guildId, userId, role, addedBy });
    return member;
  }

  // Update guild member role
  updateMemberRole(
    guildId: string,
    userId: string,
    newRole: MemberRole,
    canApprove: boolean,
    updatedBy: string
  ): GuildMember {
    // Check if updater has permission
    const updater = GuildMemberModel.findByGuildAndUser(guildId, updatedBy);
    if (!updater || updater.role !== MemberRole.LEADER) {
      throw new ForbiddenError('Only leaders can update member roles');
    }

    const member = GuildMemberModel.findByGuildAndUser(guildId, userId);
    if (!member) {
      throw new NotFoundError('Guild member');
    }

    const updated = GuildMemberModel.update(member.id, { role: newRole, canApprove });
    if (!updated) {
      throw new NotFoundError('Guild member');
    }

    logger.info('Guild member role updated', { guildId, userId, newRole, updatedBy });
    return updated;
  }

  // Remove guild member
  removeGuildMember(guildId: string, userId: string, removedBy: string): void {
    // Check if remover has permission
    const remover = GuildMemberModel.findByGuildAndUser(guildId, removedBy);
    if (!remover || remover.role !== MemberRole.LEADER) {
      throw new ForbiddenError('Only leaders can remove members');
    }

    const member = GuildMemberModel.findByGuildAndUser(guildId, userId);
    if (!member) {
      throw new NotFoundError('Guild member');
    }

    // Cannot remove self if leader
    if (userId === removedBy) {
      throw new ForbiddenError('Leaders cannot remove themselves');
    }

    GuildMemberModel.delete(member.id);
    logger.info('Guild member removed', { guildId, userId, removedBy });
  }

  // Get all guild members
  getGuildMembers(guildId: string): GuildMember[] {
    return GuildMemberModel.findByGuildId(guildId);
  }

  // Get approvers for a guild
  getApprovers(guildId: string): GuildMember[] {
    return GuildMemberModel.getApprovers(guildId);
  }
}

export const contributionService = new ContributionService();
