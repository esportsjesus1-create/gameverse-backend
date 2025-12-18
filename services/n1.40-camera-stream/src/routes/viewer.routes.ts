import { Router } from 'express';
import { viewerController } from '../controllers/viewer.controller';

const router = Router();

router.get('/stream/:streamId/stats', viewerController.getStreamStats.bind(viewerController));
router.get('/stream/:streamId', viewerController.findByStream.bind(viewerController));
router.get('/:id/network', viewerController.getNetworkCondition.bind(viewerController));
router.get('/:id', viewerController.findById.bind(viewerController));
router.get('/', viewerController.findAll.bind(viewerController));
router.post('/join', viewerController.join.bind(viewerController));
router.post('/:id/leave', viewerController.leave.bind(viewerController));
router.patch('/:id/connection-state', viewerController.setConnectionState.bind(viewerController));
router.patch('/:id/quality', viewerController.setQuality.bind(viewerController));
router.patch('/:id/bandwidth', viewerController.updateBandwidth.bind(viewerController));
router.post('/:id/heartbeat', viewerController.heartbeat.bind(viewerController));

export default router;
