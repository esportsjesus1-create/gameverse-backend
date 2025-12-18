import { v4 as uuidv4 } from 'uuid';
import {
  Dashboard,
  StoredDashboard,
  DashboardWidget,
  ExportFormat
} from '../types';
import { logger } from '../utils/logger';
import { getCurrentTimestamp, convertToCSV } from '../utils/helpers';
import { aggregationService } from './AggregationService';
import { metricsService } from './MetricsService';
import { eventService } from './EventService';
import { sessionService } from './SessionService';

export interface WidgetData {
  widgetId: string;
  type: string;
  title: string;
  data: unknown;
  lastUpdated: number;
}

export interface ScheduledReport {
  id: string;
  dashboardId: string;
  schedule: string;
  format: ExportFormat;
  recipients: string[];
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

export class DashboardService {
  private dashboards: Map<string, StoredDashboard> = new Map();
  private scheduledReports: Map<string, ScheduledReport> = new Map();

  public createDashboard(dashboard: Dashboard): StoredDashboard {
    const now = getCurrentTimestamp();
    const storedDashboard: StoredDashboard = {
      ...dashboard,
      id: dashboard.id ?? uuidv4(),
      widgets: dashboard.widgets ?? [],
      createdAt: now,
      updatedAt: now
    };

    this.dashboards.set(storedDashboard.id, storedDashboard);
    logger.info('Dashboard created', { id: storedDashboard.id, name: dashboard.name });

    return storedDashboard;
  }

  public getDashboard(id: string): StoredDashboard | undefined {
    return this.dashboards.get(id);
  }

  public updateDashboard(
    id: string,
    updates: Partial<Pick<Dashboard, 'name' | 'description' | 'widgets'>>
  ): StoredDashboard | undefined {
    const dashboard = this.dashboards.get(id);
    
    if (dashboard === undefined) {
      return undefined;
    }

    const updated: StoredDashboard = {
      ...dashboard,
      ...updates,
      widgets: updates.widgets ?? dashboard.widgets,
      updatedAt: getCurrentTimestamp()
    };

    this.dashboards.set(id, updated);
    logger.info('Dashboard updated', { id });

    return updated;
  }

  public deleteDashboard(id: string): boolean {
    const deleted = this.dashboards.delete(id);
    
    if (deleted) {
      logger.info('Dashboard deleted', { id });
    }

    return deleted;
  }

  public listDashboards(): StoredDashboard[] {
    return Array.from(this.dashboards.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public addWidget(dashboardId: string, widget: Omit<DashboardWidget, 'id'>): DashboardWidget | undefined {
    const dashboard = this.dashboards.get(dashboardId);
    
    if (dashboard === undefined) {
      return undefined;
    }

    const newWidget: DashboardWidget = {
      ...widget,
      id: uuidv4()
    };

    dashboard.widgets.push(newWidget);
    dashboard.updatedAt = getCurrentTimestamp();
    this.dashboards.set(dashboardId, dashboard);

    logger.info('Widget added to dashboard', { dashboardId, widgetId: newWidget.id });

    return newWidget;
  }

  public updateWidget(
    dashboardId: string,
    widgetId: string,
    updates: Partial<Omit<DashboardWidget, 'id'>>
  ): DashboardWidget | undefined {
    const dashboard = this.dashboards.get(dashboardId);
    
    if (dashboard === undefined) {
      return undefined;
    }

    const widgetIndex = dashboard.widgets.findIndex(w => w.id === widgetId);
    
    if (widgetIndex === -1) {
      return undefined;
    }

    const existingWidget = dashboard.widgets[widgetIndex];
    if (existingWidget === undefined) {
      return undefined;
    }

    const updatedWidget: DashboardWidget = {
      ...existingWidget,
      ...updates
    };

    dashboard.widgets[widgetIndex] = updatedWidget;
    dashboard.updatedAt = getCurrentTimestamp();
    this.dashboards.set(dashboardId, dashboard);

    return updatedWidget;
  }

  public removeWidget(dashboardId: string, widgetId: string): boolean {
    const dashboard = this.dashboards.get(dashboardId);
    
    if (dashboard === undefined) {
      return false;
    }

    const initialLength = dashboard.widgets.length;
    dashboard.widgets = dashboard.widgets.filter(w => w.id !== widgetId);
    
    if (dashboard.widgets.length === initialLength) {
      return false;
    }

    dashboard.updatedAt = getCurrentTimestamp();
    this.dashboards.set(dashboardId, dashboard);

    logger.info('Widget removed from dashboard', { dashboardId, widgetId });

    return true;
  }

  public getWidgetData(dashboardId: string, widgetId: string): WidgetData | undefined {
    const dashboard = this.dashboards.get(dashboardId);
    
    if (dashboard === undefined) {
      return undefined;
    }

    const widget = dashboard.widgets.find(w => w.id === widgetId);
    
    if (widget === undefined) {
      return undefined;
    }

    const data = this.fetchWidgetData(widget);

    return {
      widgetId: widget.id,
      type: widget.type,
      title: widget.title,
      data,
      lastUpdated: getCurrentTimestamp()
    };
  }

  public getAllWidgetData(dashboardId: string): WidgetData[] {
    const dashboard = this.dashboards.get(dashboardId);
    
    if (dashboard === undefined) {
      return [];
    }

    return dashboard.widgets.map(widget => ({
      widgetId: widget.id,
      type: widget.type,
      title: widget.title,
      data: this.fetchWidgetData(widget),
      lastUpdated: getCurrentTimestamp()
    }));
  }

  private fetchWidgetData(widget: DashboardWidget): unknown {
    const config = widget.config;
    const metricName = config['metricName'] as string | undefined;
    const period = (config['period'] as string | undefined) ?? 'hour';
    const startTime = config['startTime'] as number | undefined;
    const endTime = config['endTime'] as number | undefined;

    switch (widget.type) {
      case 'line_chart':
      case 'bar_chart':
        if (metricName !== undefined) {
          return aggregationService.getTimeSeriesData(
            metricName,
            period as 'minute' | 'hour' | 'day' | 'week' | 'month',
            startTime,
            endTime
          );
        }
        return aggregationService.getEventTimeSeries(
          period as 'minute' | 'hour' | 'day' | 'week' | 'month',
          startTime,
          endTime
        );

      case 'pie_chart':
        return eventService.getEventCountByType();

      case 'metric_card':
        if (metricName !== undefined) {
          const value = metricsService.getGaugeValue(metricName);
          return {
            name: metricName,
            value: value ?? metricsService.getCounterValue(metricName)
          };
        }
        return {
          events: eventService.getEventCount(),
          metrics: metricsService.getMetricCount(),
          sessions: sessionService.getSessionCount()
        };

      case 'table': {
        if (metricName !== undefined) {
          const metricsQueryOptions: Parameters<typeof metricsService.queryMetrics>[0] = {
            metricName,
            limit: 100
          };
          if (startTime !== undefined) metricsQueryOptions.startTime = startTime;
          if (endTime !== undefined) metricsQueryOptions.endTime = endTime;
          return metricsService.queryMetrics(metricsQueryOptions).data;
        }
        const eventsQueryOptions: Parameters<typeof eventService.queryEvents>[0] = {
          limit: 100
        };
        if (startTime !== undefined) eventsQueryOptions.startTime = startTime;
        if (endTime !== undefined) eventsQueryOptions.endTime = endTime;
        return eventService.queryEvents(eventsQueryOptions).data;
      }

      case 'heatmap':
        return aggregationService.aggregateEvents(
          period as 'minute' | 'hour' | 'day' | 'week' | 'month',
          startTime,
          endTime
        );

      default:
        return null;
    }
  }

  public exportDashboard(dashboardId: string, format: ExportFormat): string | undefined {
    const dashboard = this.dashboards.get(dashboardId);
    
    if (dashboard === undefined) {
      return undefined;
    }

    const widgetData = this.getAllWidgetData(dashboardId);

    const exportData = {
      dashboard: {
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        exportedAt: getCurrentTimestamp()
      },
      widgets: widgetData
    };

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    }

    const flatData = widgetData.map(w => ({
      widgetId: w.widgetId,
      type: w.type,
      title: w.title,
      data: JSON.stringify(w.data),
      lastUpdated: w.lastUpdated
    }));

    return convertToCSV(flatData);
  }

  public createScheduledReport(
    dashboardId: string,
    schedule: string,
    format: ExportFormat,
    recipients: string[]
  ): ScheduledReport | undefined {
    const dashboard = this.dashboards.get(dashboardId);
    
    if (dashboard === undefined) {
      return undefined;
    }

    const report: ScheduledReport = {
      id: uuidv4(),
      dashboardId,
      schedule,
      format,
      recipients,
      enabled: true
    };

    this.scheduledReports.set(report.id, report);
    logger.info('Scheduled report created', { id: report.id, dashboardId });

    return report;
  }

  public getScheduledReports(dashboardId?: string): ScheduledReport[] {
    const reports = Array.from(this.scheduledReports.values());
    
    if (dashboardId !== undefined) {
      return reports.filter(r => r.dashboardId === dashboardId);
    }

    return reports;
  }

  public updateScheduledReport(
    id: string,
    updates: Partial<Pick<ScheduledReport, 'schedule' | 'format' | 'recipients' | 'enabled'>>
  ): ScheduledReport | undefined {
    const report = this.scheduledReports.get(id);
    
    if (report === undefined) {
      return undefined;
    }

    const updated: ScheduledReport = { ...report, ...updates };
    this.scheduledReports.set(id, updated);

    return updated;
  }

  public deleteScheduledReport(id: string): boolean {
    return this.scheduledReports.delete(id);
  }

  public getDashboardCount(): number {
    return this.dashboards.size;
  }

  public clearDashboards(): void {
    this.dashboards.clear();
    this.scheduledReports.clear();
    logger.info('All dashboards cleared');
  }
}

export const dashboardService = new DashboardService();
