/**
 * GameVerse Analytics Module - Routes Index
 * Export all routes for easy importing
 */

import { Router } from 'express';
import metricsRoutes from './metrics.routes';
import eventsRoutes from './events.routes';
import queryRoutes from './query.routes';

const router = Router();

// Mount routes
router.use('/metrics', metricsRoutes);
router.use('/events', eventsRoutes);
router.use('/queries', queryRoutes);

export default router;

export { metricsRoutes, eventsRoutes, queryRoutes };
