import { Router } from 'express';
import { contributionController } from '../controllers';
import { authenticate } from '../middleware';

const router = Router();

// Contribution routes
router.get(
  '/banks/:bankId/contributions',
  authenticate,
  contributionController.getAllContributions.bind(contributionController)
);

router.get(
  '/banks/:bankId/contributions/me',
  authenticate,
  contributionController.getMyContribution.bind(contributionController)
);

router.get(
  '/banks/:bankId/contributions/:memberId',
  authenticate,
  contributionController.getMemberContribution.bind(contributionController)
);

router.get(
  '/banks/:bankId/contributions/:memberId/summary',
  authenticate,
  contributionController.getContributionSummary.bind(contributionController)
);

router.get(
  '/banks/:bankId/leaderboard',
  authenticate,
  contributionController.getLeaderboard.bind(contributionController)
);

router.get(
  '/banks/:bankId/totals',
  authenticate,
  contributionController.getTotalContributions.bind(contributionController)
);

router.post(
  '/banks/:bankId/contributions/reset',
  authenticate,
  contributionController.resetContributions.bind(contributionController)
);

// Guild member management routes
router.get(
  '/guilds/:guildId/members',
  authenticate,
  contributionController.getGuildMembers.bind(contributionController)
);

router.post(
  '/guilds/:guildId/members',
  authenticate,
  contributionController.addGuildMember.bind(contributionController)
);

router.patch(
  '/guilds/:guildId/members/:memberId',
  authenticate,
  contributionController.updateMemberRole.bind(contributionController)
);

router.delete(
  '/guilds/:guildId/members/:memberId',
  authenticate,
  contributionController.removeGuildMember.bind(contributionController)
);

router.get(
  '/guilds/:guildId/approvers',
  authenticate,
  contributionController.getApprovers.bind(contributionController)
);

export default router;
