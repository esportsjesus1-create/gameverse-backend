import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { RpcEndpoint, ChainId, ProviderType, HealthCheckResult } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ConnectionError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

export class PostgresClient {
  private pool: Pool | null = null;
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    try {
      this.pool = new Pool({
        host: config.postgres.host,
        port: config.postgres.port,
        database: config.postgres.database,
        user: config.postgres.user,
        password: config.postgres.password,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      });

      this.pool.on('error', (err) => {
        logger.error('Unexpected Postgres pool error', { error: err.message });
      });

      await this.pool.query('SELECT 1');
      this.isConnected = true;
      logger.info('Connected to PostgreSQL');
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to connect to PostgreSQL', { error: err.message });
      throw new ConnectionError('PostgreSQL', { error: err.message });
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info('Disconnected from PostgreSQL');
    }
  }

  async query<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new ConnectionError('PostgreSQL', { reason: 'Not connected' });
    }
    return this.pool.query<T>(sql, params);
  }

  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new ConnectionError('PostgreSQL', { reason: 'Not connected' });
    }
    return this.pool.connect();
  }

  async initializeSchema(): Promise<void> {
    const schema = `
      CREATE TABLE IF NOT EXISTS rpc_endpoints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chain_id INTEGER NOT NULL,
        provider_type VARCHAR(50) NOT NULL,
        http_url TEXT NOT NULL,
        ws_url TEXT,
        api_key TEXT,
        priority INTEGER DEFAULT 1,
        weight INTEGER DEFAULT 100,
        max_retries INTEGER DEFAULT 3,
        timeout INTEGER DEFAULT 30000,
        rate_limit INTEGER DEFAULT 100,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_rpc_endpoints_chain_id ON rpc_endpoints(chain_id);
      CREATE INDEX IF NOT EXISTS idx_rpc_endpoints_active ON rpc_endpoints(is_active);

      CREATE TABLE IF NOT EXISTS provider_health (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        endpoint_id UUID REFERENCES rpc_endpoints(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL,
        latency INTEGER,
        error_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        block_height BIGINT,
        last_check TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(endpoint_id)
      );

      CREATE TABLE IF NOT EXISTS reorg_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chain_id INTEGER NOT NULL,
        old_block_number BIGINT NOT NULL,
        old_block_hash VARCHAR(66) NOT NULL,
        new_block_number BIGINT NOT NULL,
        new_block_hash VARCHAR(66) NOT NULL,
        depth INTEGER NOT NULL,
        detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_reorg_events_chain_id ON reorg_events(chain_id);
      CREATE INDEX IF NOT EXISTS idx_reorg_events_detected_at ON reorg_events(detected_at);
    `;

    await this.query(schema);
    logger.info('PostgreSQL schema initialized');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      if (!this.pool) {
        return {
          service: 'postgres',
          status: 'unhealthy',
          message: 'Not connected'
        };
      }

      await this.pool.query('SELECT 1');
      const latency = Date.now() - startTime;

      return {
        service: 'postgres',
        status: latency < 100 ? 'healthy' : 'degraded',
        latency,
        details: { connected: this.isConnected }
      };
    } catch (error) {
      const err = error as Error;
      return {
        service: 'postgres',
        status: 'unhealthy',
        latency: Date.now() - startTime,
        message: err.message
      };
    }
  }
}

export class RpcEndpointRepository {
  constructor(private db: PostgresClient) {}

  async findAll(): Promise<RpcEndpoint[]> {
    const result = await this.db.query<RpcEndpointRow>(
      'SELECT * FROM rpc_endpoints ORDER BY priority ASC, weight DESC'
    );
    return result.rows.map(this.mapRowToEndpoint);
  }

  async findByChainId(chainId: ChainId): Promise<RpcEndpoint[]> {
    const result = await this.db.query<RpcEndpointRow>(
      'SELECT * FROM rpc_endpoints WHERE chain_id = $1 AND is_active = true ORDER BY priority ASC, weight DESC',
      [chainId]
    );
    return result.rows.map(this.mapRowToEndpoint);
  }

  async findById(id: string): Promise<RpcEndpoint | null> {
    const result = await this.db.query<RpcEndpointRow>(
      'SELECT * FROM rpc_endpoints WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? this.mapRowToEndpoint(result.rows[0]) : null;
  }

  async create(endpoint: Omit<RpcEndpoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<RpcEndpoint> {
    const id = uuidv4();
    const now = new Date();

    await this.db.query(
      `INSERT INTO rpc_endpoints (id, chain_id, provider_type, http_url, ws_url, api_key, priority, weight, max_retries, timeout, rate_limit, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id,
        endpoint.chainId,
        endpoint.providerType,
        endpoint.httpUrl,
        endpoint.wsUrl,
        endpoint.apiKey,
        endpoint.priority,
        endpoint.weight,
        endpoint.maxRetries,
        endpoint.timeout,
        endpoint.rateLimit,
        endpoint.isActive,
        now,
        now
      ]
    );

    return {
      ...endpoint,
      id,
      createdAt: now,
      updatedAt: now
    };
  }

  async update(id: string, updates: Partial<RpcEndpoint>): Promise<RpcEndpoint | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const updated = { ...existing, ...updates, updatedAt: new Date() };

    await this.db.query(
      `UPDATE rpc_endpoints SET
        chain_id = $2,
        provider_type = $3,
        http_url = $4,
        ws_url = $5,
        api_key = $6,
        priority = $7,
        weight = $8,
        max_retries = $9,
        timeout = $10,
        rate_limit = $11,
        is_active = $12,
        updated_at = $13
       WHERE id = $1`,
      [
        id,
        updated.chainId,
        updated.providerType,
        updated.httpUrl,
        updated.wsUrl,
        updated.apiKey,
        updated.priority,
        updated.weight,
        updated.maxRetries,
        updated.timeout,
        updated.rateLimit,
        updated.isActive,
        updated.updatedAt
      ]
    );

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM rpc_endpoints WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.db.query(
      'UPDATE rpc_endpoints SET is_active = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id, isActive]
    );
  }

  private mapRowToEndpoint(row: RpcEndpointRow): RpcEndpoint {
    return {
      id: row.id,
      chainId: row.chain_id as ChainId,
      providerType: row.provider_type as ProviderType,
      httpUrl: row.http_url,
      wsUrl: row.ws_url ?? undefined,
      apiKey: row.api_key ?? undefined,
      priority: row.priority,
      weight: row.weight,
      maxRetries: row.max_retries,
      timeout: row.timeout,
      rateLimit: row.rate_limit,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

interface RpcEndpointRow {
  id: string;
  chain_id: number;
  provider_type: string;
  http_url: string;
  ws_url: string | null;
  api_key: string | null;
  priority: number;
  weight: number;
  max_retries: number;
  timeout: number;
  rate_limit: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export const postgresClient = new PostgresClient();
