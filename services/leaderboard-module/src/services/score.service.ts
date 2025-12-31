import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { cacheService } from '../config/redis';
import { logger, EventType } from '../utils/logger';
import {
  ScoreSubmissionNotFoundError,
  InvalidScoreError,
  ScoreValidationFailedError,
  ScoreChecksumMismatchError,
  ScoreAlreadySubmittedError,
  ScoreDisputeAlreadyExistsError,
  ScoreDisputeNotAllowedError,
  ScoreRollbackNotAllowedError,
  AntiCheatViolationError,
  PlayerBannedError,
  BatchOperationError,
  BatchSizeLimitError,
} from '../utils/errors';
import {
  ScoreSubmission,
  ScoreSubmissionRequest,
  BatchScoreSubmission,
  ScoreSubmissionStatus,
  ScoreDispute,
  AdminScoreAction,
  RankHistory,
  RankChangeType,
} from '../types';
import { config } from '../config';
import { leaderboardService } from './leaderboard.service';
import { seasonalRankingService } from './seasonal.service';
import { regionalRankingService } from './regional.service';
import { friendRankingService } from './friend.service';

interface AntiCheatResult {
  isValid: boolean;
  score: number;
  violations: string[];
  details: Record<string, unknown>;
}

interface ScoreDisputeRecord {
  id: string;
  submissionId: string;
  playerId: string;
  reason: string;
  evidence: string[];
  status: 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED';
  adminNotes?: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

interface BannedPlayer {
  playerId: string;
  reason: string;
  bannedAt: Date;
  bannedUntil?: Date;
  isPermanent: boolean;
}

class ScoreSubmissionService {
  private submissions: Map<string, ScoreSubmission> = new Map();
  private disputes: Map<string, ScoreDisputeRecord> = new Map();
  private rankHistory: Map<string, RankHistory[]> = new Map();
  private bannedPlayers: Map<string, BannedPlayer> = new Map();
  private processedMatches: Set<string> = new Set();

  constructor() {
    logger.info(EventType.SERVICE_STARTED, 'Score submission service initialized');
  }

  public async submitScore(request: ScoreSubmissionRequest): Promise<ScoreSubmission> {
    await this.checkPlayerBan(request.playerId);

    if (request.matchId && this.processedMatches.has(request.matchId)) {
      throw new ScoreAlreadySubmittedError(request.matchId);
    }

    if (request.score < 0) {
      throw new InvalidScoreError('Score cannot be negative');
    }

    const antiCheatResult = await this.runAntiCheatValidation(request);
    if (!antiCheatResult.isValid) {
      logger.logAntiCheatTriggered(request.playerId, 'SCORE_VALIDATION_FAILED', {
        violations: antiCheatResult.violations,
        score: request.score,
      });

      if (antiCheatResult.score < 50) {
        throw new AntiCheatViolationError(
          request.playerId,
          antiCheatResult.violations.join(', '),
          antiCheatResult.details
        );
      }
    }

    if (request.validationChecksum) {
      const expectedChecksum = this.generateChecksum(request);
      if (request.validationChecksum !== expectedChecksum) {
        throw new ScoreChecksumMismatchError();
      }
    }

    const now = new Date();
    const submission: ScoreSubmission = {
      id: uuidv4(),
      playerId: request.playerId,
      leaderboardId: request.leaderboardId || leaderboardService.getGlobalLeaderboardId() || '',
      score: request.score,
      previousScore: undefined,
      scoreDelta: undefined,
      gameId: request.gameId,
      matchId: request.matchId,
      sessionId: request.sessionId,
      status: antiCheatResult.isValid ? ScoreSubmissionStatus.VALIDATED : ScoreSubmissionStatus.PENDING,
      validationChecksum: request.validationChecksum,
      validationData: request.validationData,
      antiCheatScore: antiCheatResult.score,
      submittedAt: now,
      validatedAt: antiCheatResult.isValid ? now : undefined,
      metadata: request.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.submissions.set(submission.id, submission);

    if (request.matchId) {
      this.processedMatches.add(request.matchId);
    }

    logger.logScoreSubmitted(request.playerId, submission.leaderboardId, request.score);

    if (submission.status === ScoreSubmissionStatus.VALIDATED) {
      await this.processValidatedSubmission(submission, request);
    }

    return submission;
  }

  public async submitBatchScores(batch: BatchScoreSubmission): Promise<{
    successful: ScoreSubmission[];
    failed: { index: number; error: string }[];
  }> {
    if (batch.submissions.length > 100) {
      throw new BatchSizeLimitError(batch.submissions.length, 100);
    }

    const successful: ScoreSubmission[] = [];
    const failed: { index: number; error: string }[] = [];

    for (let i = 0; i < batch.submissions.length; i++) {
      try {
        const submission = await this.submitScore(batch.submissions[i]);
        successful.push(submission);
      } catch (error) {
        failed.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info(EventType.BATCH_SCORE_SUBMITTED, `Batch score submission: ${successful.length} successful, ${failed.length} failed`, {
      batchId: batch.batchId,
    });

    if (failed.length > 0 && successful.length === 0) {
      throw new BatchOperationError('All submissions in batch failed', failed);
    }

    return { successful, failed };
  }

  public async getSubmission(submissionId: string): Promise<ScoreSubmission> {
    const submission = this.submissions.get(submissionId);
    if (!submission) {
      throw new ScoreSubmissionNotFoundError(submissionId);
    }
    return submission;
  }

  public async getPlayerSubmissions(
    playerId: string,
    page = 1,
    limit = 50
  ): Promise<{ submissions: ScoreSubmission[]; total: number }> {
    const playerSubmissions = Array.from(this.submissions.values())
      .filter((s) => s.playerId === playerId)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());

    const offset = (page - 1) * limit;
    const paginatedSubmissions = playerSubmissions.slice(offset, offset + limit);

    return {
      submissions: paginatedSubmissions,
      total: playerSubmissions.length,
    };
  }

  public async getPendingSubmissions(
    page = 1,
    limit = 50
  ): Promise<{ submissions: ScoreSubmission[]; total: number }> {
    const pendingSubmissions = Array.from(this.submissions.values())
      .filter((s) => s.status === ScoreSubmissionStatus.PENDING)
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

    const offset = (page - 1) * limit;
    const paginatedSubmissions = pendingSubmissions.slice(offset, offset + limit);

    return {
      submissions: paginatedSubmissions,
      total: pendingSubmissions.length,
    };
  }

  public async disputeSubmission(dispute: ScoreDispute): Promise<ScoreDisputeRecord> {
    const submission = await this.getSubmission(dispute.submissionId);

    if (submission.playerId !== dispute.playerId) {
      throw new ScoreDisputeNotAllowedError('You can only dispute your own submissions');
    }

    if (submission.status === ScoreSubmissionStatus.DISPUTED) {
      throw new ScoreDisputeAlreadyExistsError(dispute.submissionId);
    }

    if (submission.status === ScoreSubmissionStatus.ROLLED_BACK) {
      throw new ScoreDisputeNotAllowedError('Cannot dispute a rolled back submission');
    }

    const timeSinceSubmission = Date.now() - submission.submittedAt.getTime();
    const maxDisputeTime = 7 * 24 * 60 * 60 * 1000;
    if (timeSinceSubmission > maxDisputeTime) {
      throw new ScoreDisputeNotAllowedError('Dispute window has expired (7 days)');
    }

    const now = new Date();
    const disputeRecord: ScoreDisputeRecord = {
      id: uuidv4(),
      submissionId: dispute.submissionId,
      playerId: dispute.playerId,
      reason: dispute.reason,
      evidence: dispute.evidence || [],
      status: 'PENDING',
      createdAt: now,
    };

    this.disputes.set(disputeRecord.id, disputeRecord);
    submission.status = ScoreSubmissionStatus.DISPUTED;
    submission.updatedAt = now;

    logger.info(EventType.SCORE_DISPUTED, `Score disputed: ${dispute.submissionId}`, {
      playerId: dispute.playerId,
    });

    return disputeRecord;
  }

  public async adminAction(action: AdminScoreAction): Promise<ScoreSubmission> {
    const submission = await this.getSubmission(action.submissionId);
    const now = new Date();

    switch (action.action) {
      case 'APPROVE':
        if (submission.status !== ScoreSubmissionStatus.PENDING && 
            submission.status !== ScoreSubmissionStatus.DISPUTED) {
          throw new ScoreValidationFailedError('Can only approve pending or disputed submissions');
        }
        submission.status = ScoreSubmissionStatus.APPROVED;
        submission.approvedAt = now;
        await this.processValidatedSubmission(submission, {
          playerId: submission.playerId,
          score: submission.score,
          leaderboardId: submission.leaderboardId,
          gameId: submission.gameId,
          matchId: submission.matchId,
          sessionId: submission.sessionId,
        });
        logger.logScoreValidated(submission.id, true, { adminId: action.adminId });
        break;

      case 'REJECT':
        if (submission.status === ScoreSubmissionStatus.ROLLED_BACK) {
          throw new ScoreValidationFailedError('Cannot reject a rolled back submission');
        }
        submission.status = ScoreSubmissionStatus.REJECTED;
        submission.rejectedAt = now;
        submission.rejectionReason = action.reason;
        logger.logScoreRejected(submission.id, action.reason || 'Admin rejection', { adminId: action.adminId });
        break;

      case 'ROLLBACK':
        if (submission.status !== ScoreSubmissionStatus.APPROVED && 
            submission.status !== ScoreSubmissionStatus.VALIDATED) {
          throw new ScoreRollbackNotAllowedError(submission.id, 'Can only rollback approved or validated submissions');
        }
        await this.rollbackSubmission(submission);
        submission.status = ScoreSubmissionStatus.ROLLED_BACK;
        logger.info(EventType.SCORE_ROLLED_BACK, `Score rolled back: ${submission.id}`, {
          adminId: action.adminId,
        });
        break;
    }

    submission.updatedAt = now;
    logger.logAdminAction(action.adminId, action.action, submission.id, {
      reason: action.reason,
      metadata: action.metadata,
    });

    return submission;
  }

  public async getSubmissionStatistics(): Promise<{
    total: number;
    pending: number;
    validated: number;
    approved: number;
    rejected: number;
    disputed: number;
    rolledBack: number;
    averageAntiCheatScore: number;
  }> {
    const submissions = Array.from(this.submissions.values());
    const antiCheatScores = submissions
      .filter((s) => s.antiCheatScore !== undefined)
      .map((s) => s.antiCheatScore!);

    return {
      total: submissions.length,
      pending: submissions.filter((s) => s.status === ScoreSubmissionStatus.PENDING).length,
      validated: submissions.filter((s) => s.status === ScoreSubmissionStatus.VALIDATED).length,
      approved: submissions.filter((s) => s.status === ScoreSubmissionStatus.APPROVED).length,
      rejected: submissions.filter((s) => s.status === ScoreSubmissionStatus.REJECTED).length,
      disputed: submissions.filter((s) => s.status === ScoreSubmissionStatus.DISPUTED).length,
      rolledBack: submissions.filter((s) => s.status === ScoreSubmissionStatus.ROLLED_BACK).length,
      averageAntiCheatScore: antiCheatScores.length > 0
        ? antiCheatScores.reduce((a, b) => a + b, 0) / antiCheatScores.length
        : 0,
    };
  }

  public async getAuditTrail(submissionId: string): Promise<{
    submission: ScoreSubmission;
    disputes: ScoreDisputeRecord[];
    rankHistory: RankHistory[];
  }> {
    const submission = await this.getSubmission(submissionId);
    const disputes = Array.from(this.disputes.values())
      .filter((d) => d.submissionId === submissionId);
    const history = this.rankHistory.get(submission.playerId) || [];
    const relevantHistory = history.filter(
      (h) => h.snapshotAt >= submission.submittedAt
    );

    return {
      submission,
      disputes,
      rankHistory: relevantHistory,
    };
  }

  public async banPlayer(
    playerId: string,
    reason: string,
    durationDays?: number
  ): Promise<BannedPlayer> {
    const now = new Date();
    const bannedUntil = durationDays
      ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
      : undefined;

    const ban: BannedPlayer = {
      playerId,
      reason,
      bannedAt: now,
      bannedUntil,
      isPermanent: !durationDays,
    };

    this.bannedPlayers.set(playerId, ban);
    logger.info(EventType.PLAYER_BANNED, `Player banned: ${playerId}`, { reason, durationDays });

    return ban;
  }

  public async unbanPlayer(playerId: string): Promise<boolean> {
    const deleted = this.bannedPlayers.delete(playerId);
    if (deleted) {
      logger.info(EventType.PLAYER_UNBANNED, `Player unbanned: ${playerId}`);
    }
    return deleted;
  }

  public async isPlayerBanned(playerId: string): Promise<boolean> {
    const ban = this.bannedPlayers.get(playerId);
    if (!ban) return false;

    if (ban.isPermanent) return true;

    if (ban.bannedUntil && new Date() > ban.bannedUntil) {
      this.bannedPlayers.delete(playerId);
      return false;
    }

    return true;
  }

  private async checkPlayerBan(playerId: string): Promise<void> {
    const ban = this.bannedPlayers.get(playerId);
    if (!ban) return;

    if (ban.isPermanent) {
      throw new PlayerBannedError(playerId, ban.reason);
    }

    if (ban.bannedUntil && new Date() <= ban.bannedUntil) {
      throw new PlayerBannedError(playerId, `Banned until ${ban.bannedUntil.toISOString()}`);
    }

    this.bannedPlayers.delete(playerId);
  }

  private async runAntiCheatValidation(request: ScoreSubmissionRequest): Promise<AntiCheatResult> {
    if (!config.ANTI_CHEAT_ENABLED) {
      return { isValid: true, score: 100, violations: [], details: {} };
    }

    const violations: string[] = [];
    let score = 100;
    const details: Record<string, unknown> = {};

    const scoreHistory = await cacheService.getAntiCheatScoreHistory(request.playerId);
    
    if (scoreHistory.length >= 5) {
      const avgScore = scoreHistory.reduce((a, b) => a + b, 0) / scoreHistory.length;
      const stdDev = Math.sqrt(
        scoreHistory.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scoreHistory.length
      );

      if (request.score > avgScore + config.ANTI_CHEAT_SCORE_VARIANCE_THRESHOLD * stdDev) {
        violations.push('SCORE_VARIANCE_EXCEEDED');
        score -= 30;
        details.avgScore = avgScore;
        details.stdDev = stdDev;
        details.threshold = config.ANTI_CHEAT_SCORE_VARIANCE_THRESHOLD;
      }
    }

    const recentSubmissions = Array.from(this.submissions.values())
      .filter(
        (s) =>
          s.playerId === request.playerId &&
          Date.now() - s.submittedAt.getTime() < config.ANTI_CHEAT_SUBMISSION_RATE_WINDOW * 1000
      );

    if (recentSubmissions.length >= config.ANTI_CHEAT_SUBMISSION_RATE_LIMIT) {
      violations.push('SUBMISSION_RATE_EXCEEDED');
      score -= 20;
      details.recentSubmissions = recentSubmissions.length;
      details.rateLimit = config.ANTI_CHEAT_SUBMISSION_RATE_LIMIT;
    }

    if (request.validationData) {
      const gameTime = request.validationData.gameTime as number | undefined;
      if (gameTime !== undefined && gameTime < 60) {
        violations.push('SUSPICIOUS_GAME_TIME');
        score -= 25;
        details.gameTime = gameTime;
      }

      const actionsPerMinute = request.validationData.actionsPerMinute as number | undefined;
      if (actionsPerMinute !== undefined && actionsPerMinute > 1000) {
        violations.push('IMPOSSIBLE_APM');
        score -= 40;
        details.actionsPerMinute = actionsPerMinute;
      }
    }

    if (request.score > 1000000) {
      violations.push('UNREALISTIC_SCORE');
      score -= 50;
    }

    await cacheService.addScoreToAntiCheatHistory(request.playerId, request.score);

    return {
      isValid: score >= 70,
      score: Math.max(0, score),
      violations,
      details,
    };
  }

  private generateChecksum(request: ScoreSubmissionRequest): string {
    const data = `${request.playerId}:${request.score}:${request.matchId || ''}:${request.sessionId || ''}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async processValidatedSubmission(
    submission: ScoreSubmission,
    request: ScoreSubmissionRequest
  ): Promise<void> {
    const playerName = `Player_${request.playerId.slice(0, 8)}`;
    const mmr = this.calculateMMRFromScore(submission.score);

    await leaderboardService.updateOrCreateEntry(
      request.playerId,
      playerName,
      submission.score,
      submission.leaderboardId,
      {
        mmr,
        gameId: request.gameId,
        region: request.region,
      }
    );

    if (request.region) {
      await regionalRankingService.updateRegionalRank(
        request.playerId,
        playerName,
        request.region,
        submission.score,
        mmr
      );
    }

    await seasonalRankingService.updateSeasonalRank(
      request.playerId,
      playerName,
      submission.score,
      mmr,
      true
    );

    await friendRankingService.updatePlayerData({
      playerId: request.playerId,
      playerName,
      score: submission.score,
      mmr,
      tier: this.calculateTierFromMMR(mmr),
      wins: 0,
      losses: 0,
      winRate: 0,
      gamesPlayed: 0,
      lastActiveAt: new Date(),
    });

    await friendRankingService.updateChallengeProgress(request.playerId, submission.score);

    await this.recordRankHistory(request.playerId, submission);
  }

  private async rollbackSubmission(submission: ScoreSubmission): Promise<void> {
    if (submission.previousScore !== undefined) {
      const playerName = `Player_${submission.playerId.slice(0, 8)}`;
      await leaderboardService.updateOrCreateEntry(
        submission.playerId,
        playerName,
        submission.previousScore,
        submission.leaderboardId
      );
    }
  }

  private async recordRankHistory(playerId: string, submission: ScoreSubmission): Promise<void> {
    const entry = await leaderboardService.getPlayerRank(playerId, submission.leaderboardId);
    if (!entry) return;

    const history: RankHistory = {
      id: uuidv4(),
      playerId,
      leaderboardId: submission.leaderboardId,
      rank: entry.rank,
      previousRank: entry.previousRank,
      score: entry.score,
      previousScore: submission.previousScore,
      tier: entry.tier,
      previousTier: undefined,
      division: entry.division,
      previousDivision: undefined,
      changeType: RankChangeType.SCORE_UPDATE,
      changeReason: 'Score submission',
      snapshotAt: new Date(),
      createdAt: new Date(),
    };

    const playerHistory = this.rankHistory.get(playerId) || [];
    playerHistory.unshift(history);
    if (playerHistory.length > 100) {
      playerHistory.pop();
    }
    this.rankHistory.set(playerId, playerHistory);
  }

  private calculateMMRFromScore(score: number): number {
    return Math.min(3500, Math.floor(600 + score * 0.1));
  }

  private calculateTierFromMMR(mmr: number): import('../types').RankTier {
    const { RankTier } = require('../types');
    if (mmr >= 3000) return RankTier.LEGEND;
    if (mmr >= 2700) return RankTier.CHALLENGER;
    if (mmr >= 2400) return RankTier.GRANDMASTER;
    if (mmr >= 2100) return RankTier.MASTER;
    if (mmr >= 1800) return RankTier.DIAMOND;
    if (mmr >= 1500) return RankTier.PLATINUM;
    if (mmr >= 1200) return RankTier.GOLD;
    if (mmr >= 900) return RankTier.SILVER;
    if (mmr >= 600) return RankTier.BRONZE;
    return RankTier.UNRANKED;
  }
}

export const scoreSubmissionService = new ScoreSubmissionService();
export default scoreSubmissionService;
