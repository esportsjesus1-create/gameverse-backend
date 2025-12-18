import { Request, Response, NextFunction } from 'express';
import { monitoringService } from '../services';
import { createError } from '../middleware/errorHandler';
import { webSocketHandler } from '../websocket/WebSocketHandler';

export class MonitoringController {
  public getHealth(req: Request, res: Response, next: NextFunction): void {
    try {
      const health = monitoringService.getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        success: true,
        data: health
      });
    } catch (error) {
      next(error);
    }
  }

  public getStatus(req: Request, res: Response, next: NextFunction): void {
    try {
      const status = monitoringService.getSystemStatus();

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }

  public getAlerts(req: Request, res: Response, next: NextFunction): void {
    try {
      const { includeResolved } = req.query;
      const alerts = monitoringService.getAlerts(includeResolved === 'true');

      res.json({
        success: true,
        data: alerts,
        count: alerts.length
      });
    } catch (error) {
      next(error);
    }
  }

  public getAlert(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;

      if (id === undefined) {
        throw createError('Alert ID is required', 400, 'MISSING_ID');
      }

      const alert = monitoringService.getAlert(id);

      if (alert === undefined) {
        throw createError('Alert not found', 404, 'ALERT_NOT_FOUND');
      }

      res.json({
        success: true,
        data: alert
      });
    } catch (error) {
      next(error);
    }
  }

  public acknowledgeAlert(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;

      if (id === undefined) {
        throw createError('Alert ID is required', 400, 'MISSING_ID');
      }

      const alert = monitoringService.acknowledgeAlert(id);

      if (alert === undefined) {
        throw createError('Alert not found', 404, 'ALERT_NOT_FOUND');
      }

      res.json({
        success: true,
        data: alert
      });
    } catch (error) {
      next(error);
    }
  }

  public getAlertThresholds(req: Request, res: Response, next: NextFunction): void {
    try {
      const thresholds = monitoringService.getAlertThresholds();

      res.json({
        success: true,
        data: thresholds,
        count: thresholds.length
      });
    } catch (error) {
      next(error);
    }
  }

  public createAlertThreshold(req: Request, res: Response, next: NextFunction): void {
    try {
      const { metricName, operator, value, severity, enabled } = req.body as {
        metricName: string;
        operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
        value: number;
        severity: 'info' | 'warning' | 'critical';
        enabled?: boolean;
      };

      if (metricName === undefined || operator === undefined || value === undefined || severity === undefined) {
        throw createError('Missing required fields', 400, 'INVALID_INPUT');
      }

      const threshold = monitoringService.addAlertThreshold({
        metricName,
        operator,
        value,
        severity,
        enabled: enabled ?? true
      });

      res.status(201).json({
        success: true,
        data: threshold
      });
    } catch (error) {
      next(error);
    }
  }

  public updateAlertThreshold(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      const updates = req.body as Partial<{
        metricName: string;
        operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
        value: number;
        severity: 'info' | 'warning' | 'critical';
        enabled: boolean;
      }>;

      if (id === undefined) {
        throw createError('Threshold ID is required', 400, 'MISSING_ID');
      }

      const threshold = monitoringService.updateAlertThreshold(id, updates);

      if (threshold === undefined) {
        throw createError('Threshold not found', 404, 'THRESHOLD_NOT_FOUND');
      }

      res.json({
        success: true,
        data: threshold
      });
    } catch (error) {
      next(error);
    }
  }

  public deleteAlertThreshold(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;

      if (id === undefined) {
        throw createError('Threshold ID is required', 400, 'MISSING_ID');
      }

      const deleted = monitoringService.deleteAlertThreshold(id);

      if (!deleted) {
        throw createError('Threshold not found', 404, 'THRESHOLD_NOT_FOUND');
      }

      res.json({
        success: true,
        message: 'Threshold deleted'
      });
    } catch (error) {
      next(error);
    }
  }

  public getWebSocketClients(req: Request, res: Response, next: NextFunction): void {
    try {
      const clients = webSocketHandler.getClientInfo();

      res.json({
        success: true,
        data: clients,
        count: clients.length
      });
    } catch (error) {
      next(error);
    }
  }
}

export const monitoringController = new MonitoringController();
