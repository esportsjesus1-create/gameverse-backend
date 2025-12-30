import { Router } from 'express';
import { ComplianceController } from '../controllers/compliance.controller';

const router = Router();
const complianceController = new ComplianceController();

router.post('/check', complianceController.checkCompliance);

router.post('/age-verification', complianceController.submitAgeVerification);
router.get('/age-verification/:playerId', complianceController.getAgeVerificationStatus);

router.get('/spending-limits/:playerId', complianceController.getSpendingLimitStatus);
router.put('/spending-limits/:playerId', complianceController.setCustomSpendingLimits);
router.delete('/spending-limits/:playerId', complianceController.resetSpendingLimits);

router.get('/report/:playerId', complianceController.getComplianceReport);

router.get('/regulations', complianceController.getRegulationInfo);

export default router;
