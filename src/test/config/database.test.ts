import { Pool } from 'pg';

jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  };
  return { Pool: jest.fn(() => mockPool) };
});

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Database Config', () => {
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockPool = new Pool() as jest.Mocked<Pool>;
  });

  describe('getPool', () => {
    it('should create pool on first call', async () => {
      const { getPool } = await import('../../config/database');
      const pool = getPool();
      expect(pool).toBeDefined();
    });

    it('should return same pool on subsequent calls', async () => {
      const { getPool } = await import('../../config/database');
      const pool1 = getPool();
      const pool2 = getPool();
      expect(pool1).toBe(pool2);
    });
  });

  describe('query', () => {
    it('should execute query', async () => {
      const { query, getPool } = await import('../../config/database');
      const pool = getPool();
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });

      const result = await query('SELECT * FROM users WHERE id = $1', ['1']);

      expect(result.rows).toEqual([{ id: 1 }]);
    });
  });

  describe('getClient', () => {
    it('should get client from pool', async () => {
      const { getClient, getPool } = await import('../../config/database');
      const pool = getPool();
      const mockClient = { query: jest.fn(), release: jest.fn() };
      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      const client = await getClient();

      expect(client).toBe(mockClient);
    });
  });

  describe('transaction', () => {
    it('should execute transaction successfully', async () => {
      const { transaction, getPool } = await import('../../config/database');
      const pool = getPool();
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };
      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      const result = await transaction(async (client) => {
        await client.query('INSERT INTO users VALUES ($1)', ['test']);
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const { transaction, getPool } = await import('../../config/database');
      const pool = getPool();
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };
      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      await expect(
        transaction(async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('closePool', () => {
    it('should close pool', async () => {
      const { closePool, getPool } = await import('../../config/database');
      const pool = getPool();
      (pool.end as jest.Mock).mockResolvedValue(undefined);

      await closePool();

      expect(pool.end).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return true when healthy', async () => {
      const { healthCheck, getPool } = await import('../../config/database');
      const pool = getPool();
      (pool.query as jest.Mock).mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });

      const result = await healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when unhealthy', async () => {
      const { healthCheck, getPool } = await import('../../config/database');
      const pool = getPool();
      (pool.query as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const result = await healthCheck();

      expect(result).toBe(false);
    });
  });
});
