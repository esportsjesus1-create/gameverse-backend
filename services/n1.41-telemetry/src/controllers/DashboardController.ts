import { Request, Response, NextFunction } from 'express';
import { DashboardSchema, ExportFormatSchema } from '../types';
import { dashboardService } from '../services';
import { createError } from '../middleware/errorHandler';

export class DashboardController {
  public listDashboards(req: Request, res: Response, next: NextFunction): void {
    try {
      const dashboards = dashboardService.listDashboards();

      res.json({
        success: true,
        data: dashboards,
        count: dashboards.length
      });
    } catch (error) {
      next(error);
    }
  }

  public createDashboard(req: Request, res: Response, next: NextFunction): void {
    try {
      const validatedDashboard = DashboardSchema.parse(req.body);
      const dashboard = dashboardService.createDashboard(validatedDashboard);

      res.status(201).json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      next(error);
    }
  }

  public getDashboard(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;

      if (id === undefined) {
        throw createError('Dashboard ID is required', 400, 'MISSING_ID');
      }

      const dashboard = dashboardService.getDashboard(id);

      if (dashboard === undefined) {
        throw createError('Dashboard not found', 404, 'DASHBOARD_NOT_FOUND');
      }

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      next(error);
    }
  }

  public updateDashboard(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const { name, description, widgets } = req.body as {
        name?: string;
        description?: string;
        widgets?: unknown[];
      };

      if (id === undefined) {
        throw createError('Dashboard ID is required', 400, 'MISSING_ID');
      }

      const dashboard = dashboardService.updateDashboard(id, {
        name,
        description,
        widgets: widgets as Parameters<typeof dashboardService.updateDashboard>[1]['widgets']
      });

      if (dashboard === undefined) {
        throw createError('Dashboard not found', 404, 'DASHBOARD_NOT_FOUND');
      }

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      next(error);
    }
  }

  public deleteDashboard(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;

      if (id === undefined) {
        throw createError('Dashboard ID is required', 400, 'MISSING_ID');
      }

      const deleted = dashboardService.deleteDashboard(id);

      if (!deleted) {
        throw createError('Dashboard not found', 404, 'DASHBOARD_NOT_FOUND');
      }

      res.json({
        success: true,
        message: 'Dashboard deleted'
      });
    } catch (error) {
      next(error);
    }
  }

  public addWidget(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const { type, title, config, position } = req.body as {
        type: string;
        title: string;
        config: Record<string, unknown>;
        position: { x: number; y: number; width: number; height: number };
      };

      if (id === undefined) {
        throw createError('Dashboard ID is required', 400, 'MISSING_ID');
      }

      if (type === undefined || title === undefined || config === undefined || position === undefined) {
        throw createError('Missing required widget fields', 400, 'INVALID_INPUT');
      }

      const widget = dashboardService.addWidget(id, {
        type: type as 'line_chart' | 'bar_chart' | 'pie_chart' | 'metric_card' | 'table' | 'heatmap',
        title,
        config,
        position
      });

      if (widget === undefined) {
        throw createError('Dashboard not found', 404, 'DASHBOARD_NOT_FOUND');
      }

      res.status(201).json({
        success: true,
        data: widget
      });
    } catch (error) {
      next(error);
    }
  }

  public updateWidget(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id, widgetId } = req.params;
      const updates = req.body as Partial<{
        type: string;
        title: string;
        config: Record<string, unknown>;
        position: { x: number; y: number; width: number; height: number };
      }>;

      if (id === undefined || widgetId === undefined) {
        throw createError('Dashboard ID and Widget ID are required', 400, 'MISSING_ID');
      }

      const widget = dashboardService.updateWidget(id, widgetId, updates as Parameters<typeof dashboardService.updateWidget>[2]);

      if (widget === undefined) {
        throw createError('Dashboard or widget not found', 404, 'NOT_FOUND');
      }

      res.json({
        success: true,
        data: widget
      });
    } catch (error) {
      next(error);
    }
  }

  public removeWidget(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id, widgetId } = req.params;

      if (id === undefined || widgetId === undefined) {
        throw createError('Dashboard ID and Widget ID are required', 400, 'MISSING_ID');
      }

      const removed = dashboardService.removeWidget(id, widgetId);

      if (!removed) {
        throw createError('Dashboard or widget not found', 404, 'NOT_FOUND');
      }

      res.json({
        success: true,
        message: 'Widget removed'
      });
    } catch (error) {
      next(error);
    }
  }

  public getWidgetData(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id, widgetId } = req.params;

      if (id === undefined || widgetId === undefined) {
        throw createError('Dashboard ID and Widget ID are required', 400, 'MISSING_ID');
      }

      const data = dashboardService.getWidgetData(id, widgetId);

      if (data === undefined) {
        throw createError('Dashboard or widget not found', 404, 'NOT_FOUND');
      }

      res.json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  public getAllWidgetData(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;

      if (id === undefined) {
        throw createError('Dashboard ID is required', 400, 'MISSING_ID');
      }

      const data = dashboardService.getAllWidgetData(id);

      res.json({
        success: true,
        data,
        count: data.length
      });
    } catch (error) {
      next(error);
    }
  }

  public exportDashboard(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const { format } = req.query;

      if (id === undefined) {
        throw createError('Dashboard ID is required', 400, 'MISSING_ID');
      }

      const validatedFormat = ExportFormatSchema.parse(format ?? 'json');
      const exported = dashboardService.exportDashboard(id, validatedFormat);

      if (exported === undefined) {
        throw createError('Dashboard not found', 404, 'DASHBOARD_NOT_FOUND');
      }

      const contentType = validatedFormat === 'json' ? 'application/json' : 'text/csv';
      const filename = `dashboard-${id}.${validatedFormat}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exported);
    } catch (error) {
      next(error);
    }
  }

  public createScheduledReport(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const { schedule, format, recipients } = req.body as {
        schedule: string;
        format: 'json' | 'csv';
        recipients: string[];
      };

      if (id === undefined) {
        throw createError('Dashboard ID is required', 400, 'MISSING_ID');
      }

      if (schedule === undefined || format === undefined || !Array.isArray(recipients)) {
        throw createError('Missing required fields', 400, 'INVALID_INPUT');
      }

      const report = dashboardService.createScheduledReport(id, schedule, format, recipients);

      if (report === undefined) {
        throw createError('Dashboard not found', 404, 'DASHBOARD_NOT_FOUND');
      }

      res.status(201).json({
        success: true,
        data: report
      });
    } catch (error) {
      next(error);
    }
  }

  public getScheduledReports(req: Request, res: Response, next: NextFunction): void {
    try {
      const { dashboardId } = req.query;
      const reports = dashboardService.getScheduledReports(dashboardId as string | undefined);

      res.json({
        success: true,
        data: reports,
        count: reports.length
      });
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
