import { Router } from 'express';
import { dashboardController } from '../controllers';

const router = Router();

router.get('/', (req, res, next) => dashboardController.listDashboards(req, res, next));
router.post('/', (req, res, next) => dashboardController.createDashboard(req, res, next));
router.get('/reports', (req, res, next) => dashboardController.getScheduledReports(req, res, next));

router.get('/:id', (req, res, next) => dashboardController.getDashboard(req, res, next));
router.put('/:id', (req, res, next) => dashboardController.updateDashboard(req, res, next));
router.delete('/:id', (req, res, next) => dashboardController.deleteDashboard(req, res, next));

router.get('/:id/export', (req, res, next) => dashboardController.exportDashboard(req, res, next));
router.get('/:id/data', (req, res, next) => dashboardController.getAllWidgetData(req, res, next));

router.post('/:id/widgets', (req, res, next) => dashboardController.addWidget(req, res, next));
router.put('/:id/widgets/:widgetId', (req, res, next) => dashboardController.updateWidget(req, res, next));
router.delete('/:id/widgets/:widgetId', (req, res, next) => dashboardController.removeWidget(req, res, next));
router.get('/:id/widgets/:widgetId/data', (req, res, next) => dashboardController.getWidgetData(req, res, next));

router.post('/:id/reports', (req, res, next) => dashboardController.createScheduledReport(req, res, next));

export default router;
