import { DashboardService } from '../../src/services/DashboardService';
import { Dashboard } from '../../src/types';

describe('DashboardService', () => {
  let dashboardService: DashboardService;

  beforeEach(() => {
    dashboardService = new DashboardService();
  });

  afterEach(() => {
    dashboardService.clearDashboards();
  });

  describe('createDashboard', () => {
    it('should create a new dashboard', () => {
      const dashboard: Dashboard = {
        name: 'Test Dashboard',
        description: 'A test dashboard'
      };

      const created = dashboardService.createDashboard(dashboard);

      expect(created.id).toBeDefined();
      expect(created.name).toBe('Test Dashboard');
      expect(created.description).toBe('A test dashboard');
      expect(created.widgets).toEqual([]);
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();
    });

    it('should use provided id if given', () => {
      const dashboard: Dashboard = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Dashboard'
      };

      const created = dashboardService.createDashboard(dashboard);

      expect(created.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('getDashboard', () => {
    it('should retrieve a dashboard by id', () => {
      const created = dashboardService.createDashboard({ name: 'Test' });
      const retrieved = dashboardService.getDashboard(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for non-existent dashboard', () => {
      const retrieved = dashboardService.getDashboard('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('updateDashboard', () => {
    it('should update dashboard name', () => {
      const created = dashboardService.createDashboard({ name: 'Original' });
      const updated = dashboardService.updateDashboard(created.id, { name: 'Updated' });

      expect(updated?.name).toBe('Updated');
    });

    it('should update dashboard description', () => {
      const created = dashboardService.createDashboard({ name: 'Test' });
      const updated = dashboardService.updateDashboard(created.id, { 
        description: 'New description' 
      });

      expect(updated?.description).toBe('New description');
    });

    it('should return undefined for non-existent dashboard', () => {
      const updated = dashboardService.updateDashboard('non-existent', { name: 'Test' });
      expect(updated).toBeUndefined();
    });
  });

  describe('deleteDashboard', () => {
    it('should delete an existing dashboard', () => {
      const created = dashboardService.createDashboard({ name: 'Test' });
      const deleted = dashboardService.deleteDashboard(created.id);

      expect(deleted).toBe(true);
      expect(dashboardService.getDashboard(created.id)).toBeUndefined();
    });

    it('should return false for non-existent dashboard', () => {
      const deleted = dashboardService.deleteDashboard('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('listDashboards', () => {
    it('should return all dashboards sorted by updatedAt', () => {
      dashboardService.createDashboard({ name: 'Dashboard 1' });
      dashboardService.createDashboard({ name: 'Dashboard 2' });
      dashboardService.createDashboard({ name: 'Dashboard 3' });

      const dashboards = dashboardService.listDashboards();

      expect(dashboards).toHaveLength(3);
    });
  });

  describe('addWidget', () => {
    it('should add a widget to a dashboard', () => {
      const dashboard = dashboardService.createDashboard({ name: 'Test' });
      
      const widget = dashboardService.addWidget(dashboard.id, {
        type: 'line_chart',
        title: 'Test Widget',
        config: { metricName: 'test' },
        position: { x: 0, y: 0, width: 4, height: 3 }
      });

      expect(widget).toBeDefined();
      expect(widget?.id).toBeDefined();
      expect(widget?.title).toBe('Test Widget');
    });

    it('should return undefined for non-existent dashboard', () => {
      const widget = dashboardService.addWidget('non-existent', {
        type: 'line_chart',
        title: 'Test',
        config: {},
        position: { x: 0, y: 0, width: 4, height: 3 }
      });

      expect(widget).toBeUndefined();
    });
  });

  describe('updateWidget', () => {
    it('should update a widget', () => {
      const dashboard = dashboardService.createDashboard({ name: 'Test' });
      const widget = dashboardService.addWidget(dashboard.id, {
        type: 'line_chart',
        title: 'Original',
        config: {},
        position: { x: 0, y: 0, width: 4, height: 3 }
      });

      if (widget) {
        const updated = dashboardService.updateWidget(dashboard.id, widget.id, {
          title: 'Updated'
        });

        expect(updated?.title).toBe('Updated');
      }
    });

    it('should return undefined for non-existent widget', () => {
      const dashboard = dashboardService.createDashboard({ name: 'Test' });
      const updated = dashboardService.updateWidget(dashboard.id, 'non-existent', {
        title: 'Test'
      });

      expect(updated).toBeUndefined();
    });
  });

  describe('removeWidget', () => {
    it('should remove a widget from a dashboard', () => {
      const dashboard = dashboardService.createDashboard({ name: 'Test' });
      const widget = dashboardService.addWidget(dashboard.id, {
        type: 'line_chart',
        title: 'Test',
        config: {},
        position: { x: 0, y: 0, width: 4, height: 3 }
      });

      if (widget) {
        const removed = dashboardService.removeWidget(dashboard.id, widget.id);
        expect(removed).toBe(true);

        const updatedDashboard = dashboardService.getDashboard(dashboard.id);
        expect(updatedDashboard?.widgets).toHaveLength(0);
      }
    });

    it('should return false for non-existent widget', () => {
      const dashboard = dashboardService.createDashboard({ name: 'Test' });
      const removed = dashboardService.removeWidget(dashboard.id, 'non-existent');

      expect(removed).toBe(false);
    });
  });

  describe('getWidgetData', () => {
    it('should return widget data', () => {
      const dashboard = dashboardService.createDashboard({ name: 'Test' });
      const widget = dashboardService.addWidget(dashboard.id, {
        type: 'metric_card',
        title: 'Test',
        config: {},
        position: { x: 0, y: 0, width: 2, height: 2 }
      });

      if (widget) {
        const data = dashboardService.getWidgetData(dashboard.id, widget.id);

        expect(data).toBeDefined();
        expect(data?.widgetId).toBe(widget.id);
        expect(data?.type).toBe('metric_card');
        expect(data?.lastUpdated).toBeDefined();
      }
    });

    it('should return undefined for non-existent widget', () => {
      const dashboard = dashboardService.createDashboard({ name: 'Test' });
      const data = dashboardService.getWidgetData(dashboard.id, 'non-existent');

      expect(data).toBeUndefined();
    });
  });

  describe('getAllWidgetData', () => {
    it('should return data for all widgets', () => {
      const dashboard = dashboardService.createDashboard({ name: 'Test' });
      dashboardService.addWidget(dashboard.id, {
        type: 'line_chart',
        title: 'Widget 1',
        config: {},
        position: { x: 0, y: 0, width: 4, height: 3 }
      });
      dashboardService.addWidget(dashboard.id, {
        type: 'pie_chart',
        title: 'Widget 2',
        config: {},
        position: { x: 4, y: 0, width: 4, height: 3 }
      });

      const data = dashboardService.getAllWidgetData(dashboard.id);

      expect(data).toHaveLength(2);
    });

    it('should return empty array for non-existent dashboard', () => {
      const data = dashboardService.getAllWidgetData('non-existent');
      expect(data).toHaveLength(0);
    });
  });

  describe('exportDashboard', () => {
    it('should export dashboard as JSON', () => {
      const dashboard = dashboardService.createDashboard({ name: 'Test' });
      dashboardService.addWidget(dashboard.id, {
        type: 'metric_card',
        title: 'Test Widget',
        config: {},
        position: { x: 0, y: 0, width: 2, height: 2 }
      });

      const exported = dashboardService.exportDashboard(dashboard.id, 'json');

      expect(exported).toBeDefined();
      const parsed = JSON.parse(exported!);
      expect(parsed.dashboard.name).toBe('Test');
      expect(parsed.widgets).toHaveLength(1);
    });

    it('should export dashboard as CSV', () => {
      const dashboard = dashboardService.createDashboard({ name: 'Test' });
      dashboardService.addWidget(dashboard.id, {
        type: 'metric_card',
        title: 'Test Widget',
        config: {},
        position: { x: 0, y: 0, width: 2, height: 2 }
      });

      const exported = dashboardService.exportDashboard(dashboard.id, 'csv');

      expect(exported).toBeDefined();
      expect(exported).toContain('widgetId');
    });

    it('should return undefined for non-existent dashboard', () => {
      const exported = dashboardService.exportDashboard('non-existent', 'json');
      expect(exported).toBeUndefined();
    });
  });

  describe('createScheduledReport', () => {
    it('should create a scheduled report', () => {
      const dashboard = dashboardService.createDashboard({ name: 'Test' });
      
      const report = dashboardService.createScheduledReport(
        dashboard.id,
        '0 9 * * *',
        'json',
        ['user@example.com']
      );

      expect(report).toBeDefined();
      expect(report?.dashboardId).toBe(dashboard.id);
      expect(report?.schedule).toBe('0 9 * * *');
      expect(report?.format).toBe('json');
      expect(report?.recipients).toContain('user@example.com');
    });

    it('should return undefined for non-existent dashboard', () => {
      const report = dashboardService.createScheduledReport(
        'non-existent',
        '0 9 * * *',
        'json',
        ['user@example.com']
      );

      expect(report).toBeUndefined();
    });
  });

  describe('getScheduledReports', () => {
    it('should return all scheduled reports', () => {
      const dashboard1 = dashboardService.createDashboard({ name: 'Dashboard 1' });
      const dashboard2 = dashboardService.createDashboard({ name: 'Dashboard 2' });

      dashboardService.createScheduledReport(dashboard1.id, '0 9 * * *', 'json', []);
      dashboardService.createScheduledReport(dashboard2.id, '0 18 * * *', 'csv', []);

      const reports = dashboardService.getScheduledReports();

      expect(reports).toHaveLength(2);
    });

    it('should filter reports by dashboardId', () => {
      const dashboard1 = dashboardService.createDashboard({ name: 'Dashboard 1' });
      const dashboard2 = dashboardService.createDashboard({ name: 'Dashboard 2' });

      dashboardService.createScheduledReport(dashboard1.id, '0 9 * * *', 'json', []);
      dashboardService.createScheduledReport(dashboard2.id, '0 18 * * *', 'csv', []);

      const reports = dashboardService.getScheduledReports(dashboard1.id);

      expect(reports).toHaveLength(1);
      expect(reports[0]?.dashboardId).toBe(dashboard1.id);
    });
  });

  describe('getDashboardCount', () => {
    it('should return total dashboard count', () => {
      dashboardService.createDashboard({ name: 'Dashboard 1' });
      dashboardService.createDashboard({ name: 'Dashboard 2' });

      expect(dashboardService.getDashboardCount()).toBe(2);
    });
  });

  describe('clearDashboards', () => {
    it('should clear all dashboards and reports', () => {
      const dashboard = dashboardService.createDashboard({ name: 'Test' });
      dashboardService.createScheduledReport(dashboard.id, '0 9 * * *', 'json', []);

      dashboardService.clearDashboards();

      expect(dashboardService.getDashboardCount()).toBe(0);
      expect(dashboardService.getScheduledReports()).toHaveLength(0);
    });
  });
});
