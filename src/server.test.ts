import request from 'supertest';
import { createApp } from './server';
import { ChainId } from './types';

jest.mock('./services/ChainGateway', () => ({
  chainGateway: {
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    getHealth: jest.fn().mockResolvedValue({
      status: 'healthy',
      services: {},
      timestamp: new Date().toISOString()
    }),
    executeRpcRequest: jest.fn().mockResolvedValue({
      jsonrpc: '2.0',
      result: '0x1',
      id: 1
    }),
    getGasPrice: jest.fn().mockResolvedValue({
      chainId: 1,
      slow: BigInt('18000000000'),
      standard: BigInt('20000000000'),
      fast: BigInt('25000000000'),
      instant: BigInt('30000000000'),
      baseFee: BigInt('15000000000'),
      maxPriorityFee: BigInt('2000000000'),
      timestamp: new Date()
    }),
    refreshGasPrice: jest.fn().mockResolvedValue({
      chainId: 1,
      slow: BigInt('18000000000'),
      standard: BigInt('20000000000'),
      fast: BigInt('25000000000'),
      instant: BigInt('30000000000'),
      timestamp: new Date()
    }),
    getGasPriceHistory: jest.fn().mockResolvedValue([
      { price: BigInt('20000000000'), timestamp: new Date() }
    ]),
    getNonce: jest.fn().mockResolvedValue(5),
    incrementNonce: jest.fn().mockResolvedValue(6),
    resetNonce: jest.fn().mockResolvedValue(undefined),
    syncNonce: jest.fn().mockResolvedValue(5),
    getReorgHistory: jest.fn().mockResolvedValue([]),
    getProviderHealth: jest.fn().mockReturnValue([]),
    getAllProviderHealth: jest.fn().mockReturnValue(new Map()),
    getActiveSubscriptions: jest.fn().mockReturnValue([])
  }
}));

jest.mock('./services/RateLimiter', () => ({
  RateLimiter: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    incrementCount: jest.fn().mockResolvedValue({
      key: 'test',
      count: 1,
      resetAt: new Date(Date.now() + 60000),
      remaining: 99
    }),
    getConfig: jest.fn().mockReturnValue({ maxRequests: 100 })
  })),
  createRateLimitMiddleware: jest.fn().mockImplementation(() => {
    return (req: any, res: any, next: any) => {
      res.setHeader('X-RateLimit-Limit', '100');
      res.setHeader('X-RateLimit-Remaining', '99');
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + 60).toString());
      next();
    };
  })
}));

describe('Express Server', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  describe('Health Endpoints', () => {
    describe('GET /health', () => {
      it('should return health status', async () => {
        const response = await request(app).get('/health');
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
      });
    });

    describe('GET /health/live', () => {
      it('should return ok status', async () => {
        const response = await request(app).get('/health/live');
        
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });

    describe('GET /health/ready', () => {
      it('should return ready status', async () => {
        const response = await request(app).get('/health/ready');
        
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ready');
      });
    });
  });

  describe('RPC Endpoint', () => {
    describe('POST /rpc/:chainId', () => {
      it('should execute RPC request', async () => {
        const response = await request(app)
          .post('/rpc/1')
          .send({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1
          });
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('jsonrpc', '2.0');
      });

      it('should return error for invalid chain ID', async () => {
        const response = await request(app)
          .post('/rpc/999')
          .send({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1
          });
        
        expect(response.status).toBe(400);
      });

      it('should return error for missing method', async () => {
        const response = await request(app)
          .post('/rpc/1')
          .send({
            jsonrpc: '2.0',
            params: [],
            id: 1
          });
        
        expect(response.status).toBe(400);
      });
    });
  });

  describe('Gas Price Endpoints', () => {
    describe('GET /gas/:chainId', () => {
      it('should return gas price', async () => {
        const response = await request(app).get('/gas/1');
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('chainId', 1);
        expect(response.body).toHaveProperty('gasPrice');
      });

      it('should return error for invalid chain ID', async () => {
        const response = await request(app).get('/gas/999');
        
        expect(response.status).toBe(400);
      });
    });

    describe('POST /gas/:chainId/refresh', () => {
      it('should refresh gas price', async () => {
        const response = await request(app).post('/gas/1/refresh');
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('chainId', 1);
      });
    });

    describe('GET /gas/:chainId/history', () => {
      it('should return gas price history', async () => {
        const response = await request(app).get('/gas/1/history');
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('history');
      });

      it('should accept limit parameter', async () => {
        const response = await request(app).get('/gas/1/history?limit=10');
        
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Nonce Endpoints', () => {
    const validAddress = '0x1234567890123456789012345678901234567890';

    describe('GET /nonce/:chainId/:address', () => {
      it('should return nonce', async () => {
        const response = await request(app).get(`/nonce/1/${validAddress}`);
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('nonce', 5);
      });
    });

    describe('POST /nonce/:chainId/:address/increment', () => {
      it('should increment nonce', async () => {
        const response = await request(app).post(`/nonce/1/${validAddress}/increment`);
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('nonce', 6);
      });
    });

    describe('POST /nonce/:chainId/:address/reset', () => {
      it('should reset nonce', async () => {
        const response = await request(app).post(`/nonce/1/${validAddress}/reset`);
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message');
      });
    });

    describe('POST /nonce/:chainId/:address/sync', () => {
      it('should sync nonce', async () => {
        const response = await request(app).post(`/nonce/1/${validAddress}/sync`);
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('nonce', 5);
      });
    });
  });

  describe('Reorg Endpoints', () => {
    describe('GET /reorg/:chainId/history', () => {
      it('should return reorg history', async () => {
        const response = await request(app).get('/reorg/1/history');
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('reorgs');
      });
    });
  });

  describe('Provider Endpoints', () => {
    describe('GET /providers/:chainId', () => {
      it('should return provider health for chain', async () => {
        const response = await request(app).get('/providers/1');
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('providers');
      });
    });

    describe('GET /providers', () => {
      it('should return all provider health', async () => {
        const response = await request(app).get('/providers');
        
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Subscription Endpoints', () => {
    describe('GET /subscriptions', () => {
      it('should return active subscriptions', async () => {
        const response = await request(app).get('/subscriptions');
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('count');
        expect(response.body).toHaveProperty('subscriptions');
      });
    });
  });

  describe('Chain Endpoints', () => {
    describe('GET /chains', () => {
      it('should return supported chains', async () => {
        const response = await request(app).get('/chains');
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('chains');
        expect(response.body.chains.length).toBe(5);
      });
    });
  });

  describe('Error Handling', () => {
    describe('404 Not Found', () => {
      it('should return 404 for unknown routes', async () => {
        const response = await request(app).get('/unknown-route');
        
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('error');
      });
    });
  });
});
