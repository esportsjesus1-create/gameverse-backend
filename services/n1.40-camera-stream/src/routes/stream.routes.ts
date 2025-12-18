import { Router } from 'express';
import { streamController } from '../controllers/stream.controller';

const router = Router();

router.get('/live', streamController.getLiveStreams.bind(streamController));
router.get('/:id/viewers/stats', streamController.getViewerStats.bind(streamController));
router.get('/:id', streamController.findById.bind(streamController));
router.get('/', streamController.findAll.bind(streamController));
router.post('/', streamController.create.bind(streamController));
router.put('/:id', streamController.update.bind(streamController));
router.post('/:id/start', streamController.start.bind(streamController));
router.post('/:id/stop', streamController.stop.bind(streamController));
router.post('/:id/pause', streamController.pause.bind(streamController));
router.post('/:id/resume', streamController.resume.bind(streamController));
router.patch('/:id/quality', streamController.setQuality.bind(streamController));
router.delete('/:id', streamController.delete.bind(streamController));

export default router;
