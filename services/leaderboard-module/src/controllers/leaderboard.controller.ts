import { Request, Response } from 'express';
import { leaderboardService } from '../services/leaderboard.service';
import { seasonalRankingService } from '../services/seasonal.service';
import { regionalRankingService } from '../services/regional.service';
import { friendRankingService } from '../services/friend.service';
import { scoreSubmissionService } from '../services/score.service';
import { logger } from '../utils/logger';
import {
  LeaderboardQuerySchema,
  RankContextQuerySchema,
  FriendLeaderboardQuerySchema,
  PlayerComparisonSchema,
  ScoreSubmissionRequestSchema,
  BatchScoreSubmissionSchema,
  ScoreDisputeSchema,
  AdminScoreActionSchema,
  RankTier,
  Region,
} from '../types';

export class LeaderboardController {
  public async getGlobalLeaderboard(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const query = LeaderboardQuerySchema.parse({
      ...req.query,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    });

    const result = await leaderboardService.getLeaderboardEntries(query);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getGlobalLeaderboard', duration, { requestId: req.headers['x-request-id'] as string });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getTop100(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const leaderboardId = req.params.leaderboardId;

    const result = await leaderboardService.getTop100(leaderboardId);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getTop100', duration, { leaderboardId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getPlayerRank(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const { playerId } = req.params;
    const leaderboardId = req.query.leaderboardId as string | undefined;

    const result = await leaderboardService.getPlayerRank(playerId, leaderboardId);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getPlayerRank', duration, { playerId, leaderboardId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getPlayerContext(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const query = RankContextQuerySchema.parse({
      playerId: req.params.playerId,
      leaderboardId: req.query.leaderboardId,
      contextSize: req.query.contextSize ? parseInt(req.query.contextSize as string, 10) : 5,
    });

    const result = await leaderboardService.getPlayerContext(
      query.playerId,
      query.leaderboardId,
      query.contextSize
    );
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getPlayerContext', duration, { playerId: query.playerId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getLeaderboardStatistics(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const leaderboardId = req.params.leaderboardId;

    const result = await leaderboardService.getLeaderboardStatistics(leaderboardId);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getLeaderboardStatistics', duration, { leaderboardId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async searchPlayers(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const query = req.query.q as string;
    const leaderboardId = req.query.leaderboardId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const result = await leaderboardService.searchPlayers(query, leaderboardId, limit);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('searchPlayers', duration, { query, leaderboardId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getEntriesByTier(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const tier = req.params.tier as RankTier;
    const leaderboardId = req.query.leaderboardId as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const result = await leaderboardService.getEntriesByTier(tier, leaderboardId, page, limit);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getEntriesByTier', duration, { tier, leaderboardId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getSeasonalLeaderboard(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const seasonId = req.params.seasonId;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const result = await seasonalRankingService.getSeasonalLeaderboard(seasonId, page, limit);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getSeasonalLeaderboard', duration, { seasonId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getActiveSeason(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    const result = await seasonalRankingService.getActiveSeason();
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getActiveSeason', duration);

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getPlayerSeasonalRank(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const { playerId } = req.params;
    const seasonId = req.query.seasonId as string | undefined;

    const result = await seasonalRankingService.getPlayerSeasonalRank(playerId, seasonId);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getPlayerSeasonalRank', duration, { playerId, seasonId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getSeasonalRewardPreview(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const { playerId } = req.params;
    const seasonId = req.query.seasonId as string | undefined;

    const result = await seasonalRankingService.getSeasonalRewardPreview(playerId, seasonId);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getSeasonalRewardPreview', duration, { playerId, seasonId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getDecayStatus(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const { playerId } = req.params;
    const seasonId = req.query.seasonId as string | undefined;

    const result = await seasonalRankingService.getDecayStatus(playerId, seasonId);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getDecayStatus', duration, { playerId, seasonId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getPlacementStatus(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const { playerId } = req.params;
    const seasonId = req.query.seasonId as string | undefined;

    const result = await seasonalRankingService.getPlacementStatus(playerId, seasonId);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getPlacementStatus', duration, { playerId, seasonId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getSeasonalTierDistribution(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const seasonId = req.params.seasonId;

    const result = await seasonalRankingService.getSeasonalTierDistribution(seasonId);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getSeasonalTierDistribution', duration, { seasonId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getRegionalLeaderboard(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const region = req.params.region as Region;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const result = await regionalRankingService.getRegionalLeaderboard(region, page, limit);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getRegionalLeaderboard', duration, { region });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getSupportedRegions(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    const result = regionalRankingService.getSupportedRegions();
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getSupportedRegions', duration);

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getPlayerRegionalRank(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const { playerId, region } = req.params;

    const result = await regionalRankingService.getPlayerRegionalRank(playerId, region as Region);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getPlayerRegionalRank', duration, { playerId, region });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getRegionalStatistics(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const region = req.params.region as Region;

    const result = await regionalRankingService.getRegionalStatistics(region);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getRegionalStatistics', duration, { region });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getAllRegionalStatistics(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    const result = await regionalRankingService.getAllRegionalStatistics();
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getAllRegionalStatistics', duration);

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getCrossRegionComparison(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const { playerId } = req.params;

    const result = await regionalRankingService.getCrossRegionComparison(playerId);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getCrossRegionComparison', duration, { playerId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getFriendLeaderboard(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const query = FriendLeaderboardQuerySchema.parse({
      playerId: req.params.playerId,
      ...req.query,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    });

    const result = await friendRankingService.getFriendLeaderboard(query);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getFriendLeaderboard', duration, { playerId: query.playerId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getPlayerRankAmongFriends(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const { playerId } = req.params;

    const result = await friendRankingService.getPlayerRankAmongFriends(playerId);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getPlayerRankAmongFriends', duration, { playerId });

    res.json({
      success: true,
      data: { rank: result },
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getFriendComparison(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const query = PlayerComparisonSchema.parse({
      player1Id: req.params.player1Id,
      player2Id: req.params.player2Id,
      ...req.query,
    });

    const result = await friendRankingService.getFriendComparison(query.player1Id, query.player2Id);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getFriendComparison', duration, { player1Id: query.player1Id, player2Id: query.player2Id });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getActivityFeed(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const { playerId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const result = await friendRankingService.getActivityFeed(playerId, limit);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getActivityFeed', duration, { playerId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async submitScore(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const request = ScoreSubmissionRequestSchema.parse(req.body);

    const result = await scoreSubmissionService.submitScore(request);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('submitScore', duration, { playerId: request.playerId });

    res.status(201).json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async submitBatchScores(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const batch = BatchScoreSubmissionSchema.parse(req.body);

    const result = await scoreSubmissionService.submitBatchScores(batch);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('submitBatchScores', duration, { batchSize: batch.submissions.length });

    res.status(201).json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getSubmission(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const { submissionId } = req.params;

    const result = await scoreSubmissionService.getSubmission(submissionId);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getSubmission', duration, { submissionId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getPlayerSubmissions(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const { playerId } = req.params;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const result = await scoreSubmissionService.getPlayerSubmissions(playerId, page, limit);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getPlayerSubmissions', duration, { playerId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async disputeSubmission(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const dispute = ScoreDisputeSchema.parse(req.body);

    const result = await scoreSubmissionService.disputeSubmission(dispute);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('disputeSubmission', duration, { submissionId: dispute.submissionId });

    res.status(201).json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async adminAction(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const action = AdminScoreActionSchema.parse(req.body);

    const result = await scoreSubmissionService.adminAction(action);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('adminAction', duration, { submissionId: action.submissionId, action: action.action });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getSubmissionStatistics(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    const result = await scoreSubmissionService.getSubmissionStatistics();
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getSubmissionStatistics', duration);

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }

  public async getAuditTrail(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const { submissionId } = req.params;

    const result = await scoreSubmissionService.getAuditTrail(submissionId);
    const duration = Date.now() - startTime;

    logger.logQueryExecuted('getAuditTrail', duration, { submissionId });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
        duration,
      },
    });
  }
}

export const leaderboardController = new LeaderboardController();
export default leaderboardController;
