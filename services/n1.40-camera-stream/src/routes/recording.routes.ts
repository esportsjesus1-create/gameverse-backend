import { Router } from 'express';
import { recordingController } from '../controllers/recording.controller';

const router = Router();

router.get('/stream/:streamId', recordingController.findByStream.bind(recordingController));
router.get('/storage/:ownerId', recordingController.getStorageUsage.bind(recordingController));
router.get('/:id', recordingController.findById.bind(recordingController));
router.get('/', recordingController.findAll.bind(recordingController));
router.post('/', recordingController.start.bind(recordingController));
router.post('/:id/stop', recordingController.stop.bind(recordingController));
router.post('/:id/pause', recordingController.pause.bind(recordingController));
router.post('/:id/resume', recordingController.resume.bind(recordingController));
router.delete('/:id', recordingController.delete.bind(recordingController));

export default router;
