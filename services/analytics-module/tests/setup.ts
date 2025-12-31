/**
 * GameVerse Analytics Module - Test Setup
 * Jest configuration and test utilities
 */

import { cacheService } from '../src/services/cache.service';
import { metricsService } from '../src/services/metrics.service';
import { eventsService } from '../src/services/events.service';
import { queryService } from '../src/services/query.service';
import { clearAllRateLimits } from '../src/middleware/rateLimiter';

// Increase test timeout
jest.setTimeout(30000);

// Mock console to reduce noise in tests
const originalConsole = { ...console };
beforeAll(() => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.debug = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
});

// Clean up before each test
beforeEach(async () => {
  // Clear all data stores
  await metricsService.clearAllMetrics();
  await eventsService.clearAllEvents();
  await queryService.clearAllQueries();
  cacheService.clear();
  clearAllRateLimits();
});

// Clean up after all tests
afterAll(() => {
  cacheService.stop();
});

// Test utilities
export const createTestUser = (overrides = {}) => ({
  id: 'test-user-id',
  externalId: 'external-123',
  role: 'ADMIN' as const,
  tier: 'PREMIUM' as const,
  permissions: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createTestMetric = (overrides = {}) => ({
  name: 'test_metric',
  type: 'COUNTER' as const,
  category: 'PLAYER' as const,
  value: 100,
  labels: { env: 'test' },
  ...overrides,
});

export const createTestEvent = (overrides = {}) => ({
  type: 'PLAYER_LOGIN' as const,
  playerId: 'player-123',
  sessionId: 'session-456',
  payload: { action: 'test' },
  metadata: {
    source: 'test',
    version: '1.0',
  },
  ...overrides,
});

export const createTestQuery = (overrides = {}) => ({
  metrics: ['test_metric'],
  filters: [],
  aggregations: [{ field: 'value', type: 'SUM' as const }],
  timeRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date(),
  },
  limit: 100,
  offset: 0,
  ...overrides,
});

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
