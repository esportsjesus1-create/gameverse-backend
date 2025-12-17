import { PostgresClient, RpcEndpointRepository } from './postgres';
import { ChainId, ProviderType } from '../types';

const mockPoolClient = {
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  release: jest.fn()
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockPoolClient),
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  end: jest.fn().mockResolvedValue(undefined),
  on: jest.fn()
};

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => mockPool)
}));

describe('PostgresClient', () => {
  let postgresClient: PostgresClient;

  beforeEach(() => {
    jest.clearAllMocks();
    postgresClient = new PostgresClient();
  });

  afterEach(async () => {
    await postgresClient.disconnect();
  });

  describe('connect', () => {
    it('should connect to PostgreSQL', async () => {
      await postgresClient.connect();
    });

    it('should not connect twice', async () => {
      await postgresClient.connect();
      await postgresClient.connect();
    });
  });

  describe('disconnect', () => {
    it('should disconnect from PostgreSQL', async () => {
      await postgresClient.connect();
      await postgresClient.disconnect();
      
      expect(mockPool.end).toHaveBeenCalled();
    });
  });

  describe('query', () => {
    it('should execute query', async () => {
      await postgresClient.connect();
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
      
      const result = await postgresClient.query('SELECT * FROM test');
      
      expect(result.rows).toEqual([{ id: 1 }]);
    });

    it('should execute query with params', async () => {
      await postgresClient.connect();
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
      
      const result = await postgresClient.query('SELECT * FROM test WHERE id = $1', [1]);
      
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1]);
    });

    it('should throw error when not connected', async () => {
      await expect(postgresClient.query('SELECT 1')).rejects.toThrow();
    });
  });

  describe('getClient', () => {
    it('should get pool client', async () => {
      await postgresClient.connect();
      
      const client = await postgresClient.getClient();
      
      expect(client).toBeDefined();
    });

    it('should throw error when not connected', async () => {
      await expect(postgresClient.getClient()).rejects.toThrow();
    });
  });

  describe('initializeSchema', () => {
    it('should create schema', async () => {
      await postgresClient.connect();
      
      await postgresClient.initializeSchema();
      
      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      await postgresClient.connect();
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }], rowCount: 1 });
      
      const health = await postgresClient.healthCheck();
      
      expect(health.service).toBe('postgres');
      expect(health.status).toBe('healthy');
    });

    it('should return unhealthy when not connected', async () => {
      const health = await postgresClient.healthCheck();
      
      expect(health.status).toBe('unhealthy');
    });

    it('should return unhealthy on query error', async () => {
      await postgresClient.connect();
      mockPool.query.mockRejectedValueOnce(new Error('Query failed'));
      
      const health = await postgresClient.healthCheck();
      
      expect(health.status).toBe('unhealthy');
    });
  });
});

describe('RpcEndpointRepository', () => {
  let repository: RpcEndpointRepository;
  let mockPostgresClient: PostgresClient;

  const mockEndpointRow = {
    id: 'test-id',
    chain_id: 1,
    provider_type: 'infura',
    http_url: 'https://mainnet.infura.io/v3/',
    ws_url: 'wss://mainnet.infura.io/ws/v3/',
    api_key: 'test-key',
    priority: 1,
    weight: 100,
    max_retries: 3,
    timeout: 30000,
    rate_limit: 100,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPostgresClient = new PostgresClient();
    repository = new RpcEndpointRepository(mockPostgresClient);
  });

  describe('findAll', () => {
    it('should return all endpoints', async () => {
      await mockPostgresClient.connect();
      mockPool.query.mockResolvedValueOnce({ rows: [mockEndpointRow], rowCount: 1 });
      
      const endpoints = await repository.findAll();
      
      expect(endpoints.length).toBe(1);
      expect(endpoints[0].id).toBe('test-id');
    });

    it('should return empty array when no endpoints', async () => {
      await mockPostgresClient.connect();
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      
      const endpoints = await repository.findAll();
      
      expect(endpoints).toEqual([]);
    });
  });

  describe('findByChainId', () => {
    it('should return endpoints for chain', async () => {
      await mockPostgresClient.connect();
      mockPool.query.mockResolvedValueOnce({ rows: [mockEndpointRow], rowCount: 1 });
      
      const endpoints = await repository.findByChainId(ChainId.ETHEREUM);
      
      expect(endpoints.length).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return endpoint by id', async () => {
      await mockPostgresClient.connect();
      mockPool.query.mockResolvedValueOnce({ rows: [mockEndpointRow], rowCount: 1 });
      
      const endpoint = await repository.findById('test-id');
      
      expect(endpoint?.id).toBe('test-id');
    });

    it('should return null when not found', async () => {
      await mockPostgresClient.connect();
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      
      const endpoint = await repository.findById('non-existent');
      
      expect(endpoint).toBeNull();
    });
  });

  describe('create', () => {
    it('should create endpoint', async () => {
      await mockPostgresClient.connect();
      mockPool.query.mockResolvedValueOnce({ rows: [mockEndpointRow], rowCount: 1 });
      
      const endpoint = await repository.create({
        chainId: ChainId.ETHEREUM,
        providerType: ProviderType.INFURA,
        httpUrl: 'https://mainnet.infura.io/v3/',
        priority: 1,
        weight: 100,
        maxRetries: 3,
        timeout: 30000,
        rateLimit: 100,
        isActive: true
      });
      
      expect(endpoint.id).toBeDefined();
      expect(endpoint.chainId).toBe(ChainId.ETHEREUM);
    });
  });

  describe('update', () => {
    it('should update endpoint', async () => {
      await mockPostgresClient.connect();
      mockPool.query.mockResolvedValueOnce({ rows: [mockEndpointRow], rowCount: 1 });
      
      const endpoint = await repository.update('test-id', { priority: 2 });
      
      expect(endpoint?.id).toBe('test-id');
    });

    it('should return null when not found', async () => {
      await mockPostgresClient.connect();
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      
      const endpoint = await repository.update('non-existent', { priority: 2 });
      
      expect(endpoint).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete endpoint', async () => {
      await mockPostgresClient.connect();
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      
      const result = await repository.delete('test-id');
      
      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      await mockPostgresClient.connect();
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      
      const result = await repository.delete('non-existent');
      
      expect(result).toBe(false);
    });
  });

  describe('setActive', () => {
    it('should set endpoint active status', async () => {
      await mockPostgresClient.connect();
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      
      await repository.setActive('test-id', false);
      
      expect(mockPool.query).toHaveBeenCalled();
    });
  });
});
