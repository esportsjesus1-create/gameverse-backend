import { Router } from 'express';
import { cameraController } from '../controllers/camera.controller';

const router = Router();

router.get('/online', cameraController.getOnlineCameras.bind(cameraController));
router.get('/owner/:ownerId', cameraController.findByOwner.bind(cameraController));
router.get('/:id', cameraController.findById.bind(cameraController));
router.get('/', cameraController.findAll.bind(cameraController));
router.post('/', cameraController.create.bind(cameraController));
router.put('/:id', cameraController.update.bind(cameraController));
router.patch('/:id/status', cameraController.setStatus.bind(cameraController));
router.delete('/:id', cameraController.delete.bind(cameraController));

export default router;
