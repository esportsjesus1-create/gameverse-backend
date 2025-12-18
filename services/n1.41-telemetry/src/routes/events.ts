import { Router } from 'express';
import { eventController } from '../controllers';

const router = Router();

router.post('/', (req, res, next) => eventController.trackEvent(req, res, next));
router.post('/batch', (req, res, next) => eventController.trackBatchEvents(req, res, next));
router.get('/', (req, res, next) => eventController.queryEvents(req, res, next));
router.get('/stats', (req, res, next) => eventController.getEventStats(req, res, next));
router.get('/:id', (req, res, next) => eventController.getEvent(req, res, next));

export default router;
