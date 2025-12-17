import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as benefitsController from '../controllers/benefitsController';

const router = Router();

router.get('/', benefitsController.getAllBenefits);
router.get('/applicable', benefitsController.getApplicableBenefits);
router.get('/next-tier', benefitsController.getNextTierBenefits);
router.get('/:benefitId', benefitsController.getBenefit);

router.use(authMiddleware);

router.get('/party/:partyId/calculate', benefitsController.calculatePartyBenefits);
router.get('/party/:partyId/summary', benefitsController.getPartyBenefitsSummary);
router.get('/party/:partyId/rewards', benefitsController.getExclusiveRewards);

router.post('/party/:partyId/apply/xp', benefitsController.applyXPBonus);
router.post('/party/:partyId/apply/loot', benefitsController.applyLootBonus);
router.post('/party/:partyId/apply/drop-rate', benefitsController.applyDropRateBonus);
router.post('/party/:partyId/apply/achievement', benefitsController.applyAchievementBonus);

export default router;
