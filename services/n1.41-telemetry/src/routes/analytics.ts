import { Router } from 'express';
import { analyticsController } from '../controllers';

const router = Router();

router.get('/sessions', (req, res, next) => analyticsController.getSessionAnalytics(req, res, next));
router.get('/sessions/active', (req, res, next) => analyticsController.getActiveSessions(req, res, next));
router.post('/sessions', (req, res, next) => analyticsController.createSession(req, res, next));
router.get('/sessions/:sessionId', (req, res, next) => analyticsController.getSession(req, res, next));
router.post('/sessions/:sessionId/end', (req, res, next) => analyticsController.endSession(req, res, next));

router.get('/users/:userId', (req, res, next) => analyticsController.getUserBehavior(req, res, next));
router.get('/engagement', (req, res, next) => analyticsController.getEngagementMetrics(req, res, next));

router.post('/funnels', (req, res, next) => analyticsController.analyzeFunnel(req, res, next));
router.get('/cohorts', (req, res, next) => analyticsController.getCohortAnalysis(req, res, next));

export default router;
