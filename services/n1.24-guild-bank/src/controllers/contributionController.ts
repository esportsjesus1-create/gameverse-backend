import { Response, NextFunction } from 'express';
import { contributionService, ContributionSummary, LeaderboardEntry } from '../services';
import { AuthenticatedRequest } from '../middleware';
import { ApiResponse, MemberContribution, GuildMember, MemberRole } from '../types';

export class ContributionController {
  async getMemberContribution(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<MemberContribution>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const contribution = contributionService.getMemberContribution(
        req.params.bankId,
        req.params.memberId
      );
      res.json({
        success: true,
        data: contribution,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyContribution(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<MemberContribution>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const contribution = contributionService.getMemberContribution(
        req.params.bankId,
        req.user!.userId
      );
      res.json({
        success: true,
        data: contribution,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllContributions(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<MemberContribution[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const contributions = contributionService.getAllContributions(req.params.bankId);
      res.json({
        success: true,
        data: contributions,
      });
    } catch (error) {
      next(error);
    }
  }

  async getContributionSummary(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<ContributionSummary>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const summary = contributionService.getContributionSummary(
        req.params.bankId,
        req.params.memberId || req.user!.userId
      );
      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLeaderboard(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<LeaderboardEntry[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = contributionService.getLeaderboard(req.params.bankId, limit);
      res.json({
        success: true,
        data: leaderboard,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTotalContributions(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<{
      totalDeposited: number;
      totalWithdrawn: number;
      netContribution: number;
      contributorCount: number;
    }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const totals = contributionService.getTotalContributions(req.params.bankId);
      res.json({
        success: true,
        data: totals,
      });
    } catch (error) {
      next(error);
    }
  }

  async resetContributions(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<null>>,
    next: NextFunction
  ): Promise<void> {
    try {
      contributionService.resetContributions(req.params.bankId, req.user!.userId);
      res.json({
        success: true,
        message: 'Contributions reset successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Guild member management
  async addGuildMember(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<GuildMember>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const member = contributionService.addGuildMember(
        req.params.guildId,
        req.body.userId,
        req.body.role as MemberRole,
        req.body.canApprove ?? false,
        req.user!.userId
      );
      res.status(201).json({
        success: true,
        data: member,
        message: 'Guild member added successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMemberRole(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<GuildMember>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const member = contributionService.updateMemberRole(
        req.params.guildId,
        req.params.memberId,
        req.body.role as MemberRole,
        req.body.canApprove ?? false,
        req.user!.userId
      );
      res.json({
        success: true,
        data: member,
        message: 'Member role updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async removeGuildMember(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<null>>,
    next: NextFunction
  ): Promise<void> {
    try {
      contributionService.removeGuildMember(
        req.params.guildId,
        req.params.memberId,
        req.user!.userId
      );
      res.json({
        success: true,
        message: 'Guild member removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getGuildMembers(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<GuildMember[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const members = contributionService.getGuildMembers(req.params.guildId);
      res.json({
        success: true,
        data: members,
      });
    } catch (error) {
      next(error);
    }
  }

  async getApprovers(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<GuildMember[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const approvers = contributionService.getApprovers(req.params.guildId);
      res.json({
        success: true,
        data: approvers,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const contributionController = new ContributionController();
