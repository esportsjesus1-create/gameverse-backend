import { Router } from 'express';
import cameraRoutes from './camera.routes';
import streamRoutes from './stream.routes';
import recordingRoutes from './recording.routes';
import viewerRoutes from './viewer.routes';

const router = Router();

router.use('/cameras', cameraRoutes);
router.use('/streams', streamRoutes);
router.use('/recordings', recordingRoutes);
router.use('/viewers', viewerRoutes);

export default router;
