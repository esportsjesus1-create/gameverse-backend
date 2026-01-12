import { Router } from 'express';
import eventsRouter from './events';
import metricsRouter from './metrics';
import analyticsRouter from './analytics';
import monitoringRouter from './monitoring';
import dashboardsRouter from './dashboards';

const router = Router();

router.use('/events', eventsRouter);
router.use('/metrics', metricsRouter);
router.use('/analytics', analyticsRouter);
router.use('/monitoring', monitoringRouter);
router.use('/dashboards', dashboardsRouter);

export default router;
