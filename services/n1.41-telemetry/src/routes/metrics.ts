import { Router } from 'express';
import { metricsController } from '../controllers';

const router = Router();

router.post('/', (req, res, next) => metricsController.recordMetric(req, res, next));
router.post('/batch', (req, res, next) => metricsController.recordBatchMetrics(req, res, next));
router.get('/', (req, res, next) => metricsController.queryMetrics(req, res, next));
router.get('/names', (req, res, next) => metricsController.getMetricNames(req, res, next));
router.get('/top', (req, res, next) => metricsController.getTopMetrics(req, res, next));
router.get('/aggregated/:name', (req, res, next) => metricsController.getAggregatedMetrics(req, res, next));
router.get('/timeseries/:name', (req, res, next) => metricsController.getMetricTimeSeries(req, res, next));

export default router;
