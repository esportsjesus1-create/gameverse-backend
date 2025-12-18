import { Router } from 'express';
import { monitoringController } from '../controllers';

const router = Router();

router.get('/health', (req, res, next) => monitoringController.getHealth(req, res, next));
router.get('/status', (req, res, next) => monitoringController.getStatus(req, res, next));

router.get('/alerts', (req, res, next) => monitoringController.getAlerts(req, res, next));
router.get('/alerts/:id', (req, res, next) => monitoringController.getAlert(req, res, next));
router.post('/alerts/:id/acknowledge', (req, res, next) => monitoringController.acknowledgeAlert(req, res, next));

router.get('/thresholds', (req, res, next) => monitoringController.getAlertThresholds(req, res, next));
router.post('/thresholds', (req, res, next) => monitoringController.createAlertThreshold(req, res, next));
router.put('/thresholds/:id', (req, res, next) => monitoringController.updateAlertThreshold(req, res, next));
router.delete('/thresholds/:id', (req, res, next) => monitoringController.deleteAlertThreshold(req, res, next));

router.get('/websocket/clients', (req, res, next) => monitoringController.getWebSocketClients(req, res, next));

export default router;
