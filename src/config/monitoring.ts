import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import * as promClient from 'prom-client';
import { logger } from './logger';
import dotenv from 'dotenv';

dotenv.config();

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'gameverse-backend',
  [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
});

const traceExporter = new OTLPTraceExporter({
  url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318'}/v1/traces`,
});

const metricExporter = new OTLPMetricExporter({
  url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318'}/v1/metrics`,
});

let sdk: NodeSDK | null = null;

export function initializeOpenTelemetry(): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60000,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metricReader: metricReader as any,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  logger.info('OpenTelemetry initialized');
}

export async function shutdownOpenTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    logger.info('OpenTelemetry shut down');
  }
}

const metricsPrefix = process.env.METRICS_PREFIX || 'gameverse_';

promClient.collectDefaultMetrics({
  prefix: metricsPrefix,
  labels: { service: 'gameverse-backend' },
});

export const httpRequestDuration = new promClient.Histogram({
  name: `${metricsPrefix}http_request_duration_seconds`,
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5],
});

export const httpRequestTotal = new promClient.Counter({
  name: `${metricsPrefix}http_requests_total`,
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const activeConnections = new promClient.Gauge({
  name: `${metricsPrefix}active_connections`,
  help: 'Number of active connections',
  labelNames: ['type'],
});

export const databaseQueryDuration = new promClient.Histogram({
  name: `${metricsPrefix}database_query_duration_seconds`,
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const databaseQueryTotal = new promClient.Counter({
  name: `${metricsPrefix}database_queries_total`,
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
});

export const cacheHitTotal = new promClient.Counter({
  name: `${metricsPrefix}cache_hits_total`,
  help: 'Total number of cache hits',
  labelNames: ['operation'],
});

export const cacheMissTotal = new promClient.Counter({
  name: `${metricsPrefix}cache_misses_total`,
  help: 'Total number of cache misses',
  labelNames: ['operation'],
});

export const cacheOperationDuration = new promClient.Histogram({
  name: `${metricsPrefix}cache_operation_duration_seconds`,
  help: 'Duration of cache operations in seconds',
  labelNames: ['operation'],
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
});

export const partyOperations = new promClient.Counter({
  name: `${metricsPrefix}party_operations_total`,
  help: 'Total number of party operations',
  labelNames: ['operation', 'status'],
});

export const activeParties = new promClient.Gauge({
  name: `${metricsPrefix}active_parties`,
  help: 'Number of active parties',
});

export const tournamentOperations = new promClient.Counter({
  name: `${metricsPrefix}tournament_operations_total`,
  help: 'Total number of tournament operations',
  labelNames: ['operation', 'status'],
});

export const activeTournaments = new promClient.Gauge({
  name: `${metricsPrefix}active_tournaments`,
  help: 'Number of active tournaments',
});

export const seasonOperations = new promClient.Counter({
  name: `${metricsPrefix}season_operations_total`,
  help: 'Total number of season operations',
  labelNames: ['operation', 'status'],
});

export const activeSeasons = new promClient.Gauge({
  name: `${metricsPrefix}active_seasons`,
  help: 'Number of active seasons',
});

export const socialOperations = new promClient.Counter({
  name: `${metricsPrefix}social_operations_total`,
  help: 'Total number of social operations',
  labelNames: ['operation', 'status'],
});

export const onlineUsers = new promClient.Gauge({
  name: `${metricsPrefix}online_users`,
  help: 'Number of online users',
});

export const errorTotal = new promClient.Counter({
  name: `${metricsPrefix}errors_total`,
  help: 'Total number of errors',
  labelNames: ['type', 'code'],
});

export async function getMetrics(): Promise<string> {
  return promClient.register.metrics();
}

export function getContentType(): string {
  return promClient.register.contentType;
}

export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  duration: number
): void {
  httpRequestDuration.labels(method, route, statusCode.toString()).observe(duration);
  httpRequestTotal.labels(method, route, statusCode.toString()).inc();
}

export function recordDatabaseQuery(
  operation: string,
  table: string,
  duration: number,
  success: boolean
): void {
  databaseQueryDuration.labels(operation, table).observe(duration);
  databaseQueryTotal.labels(operation, table, success ? 'success' : 'error').inc();
}

export function recordCacheOperation(operation: string, hit: boolean, duration: number): void {
  cacheOperationDuration.labels(operation).observe(duration);
  if (hit) {
    cacheHitTotal.labels(operation).inc();
  } else {
    cacheMissTotal.labels(operation).inc();
  }
}

export function recordError(type: string, code: string): void {
  errorTotal.labels(type, code).inc();
}

export { promClient };
