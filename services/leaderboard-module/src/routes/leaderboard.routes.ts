import { Router } from 'express';
import { leaderboardController } from '../controllers';
import { asyncHandler } from '../middleware/errorHandler';
import { rateLimiter, leaderboardQueryRateLimiter, scoreSubmissionRateLimiter, adminRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get(
  '/global',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getGlobalLeaderboard.bind(leaderboardController))
);

router.get(
  '/global/top100',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getTop100.bind(leaderboardController))
);

router.get(
  '/global/top100/:leaderboardId',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getTop100.bind(leaderboardController))
);

router.get(
  '/global/statistics',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getLeaderboardStatistics.bind(leaderboardController))
);

router.get(
  '/global/statistics/:leaderboardId',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getLeaderboardStatistics.bind(leaderboardController))
);

router.get(
  '/global/search',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.searchPlayers.bind(leaderboardController))
);

router.get(
  '/global/tier/:tier',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getEntriesByTier.bind(leaderboardController))
);

router.get(
  '/player/:playerId/rank',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getPlayerRank.bind(leaderboardController))
);

router.get(
  '/player/:playerId/context',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getPlayerContext.bind(leaderboardController))
);

router.get(
  '/seasonal',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getSeasonalLeaderboard.bind(leaderboardController))
);

router.get(
  '/seasonal/active',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getActiveSeason.bind(leaderboardController))
);

router.get(
  '/seasonal/:seasonId',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getSeasonalLeaderboard.bind(leaderboardController))
);

router.get(
  '/seasonal/:seasonId/tier-distribution',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getSeasonalTierDistribution.bind(leaderboardController))
);

router.get(
  '/seasonal/player/:playerId/rank',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getPlayerSeasonalRank.bind(leaderboardController))
);

router.get(
  '/seasonal/player/:playerId/rewards',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getSeasonalRewardPreview.bind(leaderboardController))
);

router.get(
  '/seasonal/player/:playerId/decay',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getDecayStatus.bind(leaderboardController))
);

router.get(
  '/seasonal/player/:playerId/placement',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getPlacementStatus.bind(leaderboardController))
);

router.get(
  '/regional',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getAllRegionalStatistics.bind(leaderboardController))
);

router.get(
  '/regional/regions',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getSupportedRegions.bind(leaderboardController))
);

router.get(
  '/regional/:region',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getRegionalLeaderboard.bind(leaderboardController))
);

router.get(
  '/regional/:region/statistics',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getRegionalStatistics.bind(leaderboardController))
);

router.get(
  '/regional/player/:playerId/:region',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getPlayerRegionalRank.bind(leaderboardController))
);

router.get(
  '/regional/player/:playerId/comparison',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getCrossRegionComparison.bind(leaderboardController))
);

router.get(
  '/friends/:playerId',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getFriendLeaderboard.bind(leaderboardController))
);

router.get(
  '/friends/:playerId/rank',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getPlayerRankAmongFriends.bind(leaderboardController))
);

router.get(
  '/friends/:playerId/activity',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getActivityFeed.bind(leaderboardController))
);

router.get(
  '/friends/compare/:player1Id/:player2Id',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getFriendComparison.bind(leaderboardController))
);

router.post(
  '/scores/submit',
  scoreSubmissionRateLimiter,
  asyncHandler(leaderboardController.submitScore.bind(leaderboardController))
);

router.post(
  '/scores/batch',
  scoreSubmissionRateLimiter,
  asyncHandler(leaderboardController.submitBatchScores.bind(leaderboardController))
);

router.get(
  '/scores/:submissionId',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getSubmission.bind(leaderboardController))
);

router.get(
  '/scores/player/:playerId',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getPlayerSubmissions.bind(leaderboardController))
);

router.post(
  '/scores/:submissionId/dispute',
  rateLimiter(),
  asyncHandler(leaderboardController.disputeSubmission.bind(leaderboardController))
);

router.get(
  '/scores/:submissionId/audit',
  leaderboardQueryRateLimiter,
  asyncHandler(leaderboardController.getAuditTrail.bind(leaderboardController))
);

router.post(
  '/admin/scores/action',
  adminRateLimiter,
  asyncHandler(leaderboardController.adminAction.bind(leaderboardController))
);

router.get(
  '/admin/scores/statistics',
  adminRateLimiter,
  asyncHandler(leaderboardController.getSubmissionStatistics.bind(leaderboardController))
);

export default router;
