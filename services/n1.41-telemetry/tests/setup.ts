import { eventService } from '../src/services/EventService';
import { sessionService } from '../src/services/SessionService';
import { metricsService } from '../src/services/MetricsService';
import { dashboardService } from '../src/services/DashboardService';
import { monitoringService } from '../src/services/MonitoringService';
import { aggregationService } from '../src/services/AggregationService';

beforeEach(() => {
  eventService.clearEvents();
  sessionService.clearSessions();
  metricsService.clearMetrics();
  dashboardService.clearDashboards();
  monitoringService.clearAlerts();
  aggregationService.clearCache();
});

afterAll(() => {
  eventService.stopFlushTimer();
  monitoringService.stopMonitoring();
});
