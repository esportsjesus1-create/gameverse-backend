import request from 'supertest';
import { app } from '../../src/index';

jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
  getClient: jest.fn(),
  closePool: jest.fn(),
  testConnection: jest.fn().mockResolvedValue(true),
  getPool: jest.fn().mockReturnValue({
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  }),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import * as database from '../../src/config/database';

const mockQuery = database.query as jest.MockedFunction<typeof database.query>;
const mockTransaction = database.transaction as jest.MockedFunction<typeof database.transaction>;

describe('API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Endpoints', () => {
    it('GET /health should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('gameverse-shop');
    });

    it('GET /ready should return ready status when database is connected', async () => {
      const response = await request(app).get('/ready');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ready');
    });
  });

  describe('Items API', () => {
    describe('POST /api/items', () => {
      it('should create an item successfully', async () => {
        const mockRow = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Item',
          description: 'A test item',
          price: '9.99',
          category: 'weapons',
          image_url: null,
          metadata: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockQuery.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 } as never);

        const response = await request(app)
          .post('/api/items')
          .send({
            name: 'Test Item',
            price: 9.99,
            description: 'A test item',
            category: 'weapons',
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Test Item');
      });

      it('should return 400 for invalid item data', async () => {
        const response = await request(app)
          .post('/api/items')
          .send({
            name: '',
            price: -1,
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/items', () => {
      it('should return paginated items', async () => {
        const mockRows = [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Test Item',
            description: 'A test item',
            price: '9.99',
            category: 'weapons',
            image_url: null,
            metadata: null,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ];

        mockQuery
          .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as never)
          .mockResolvedValueOnce({ rows: mockRows, rowCount: 1 } as never);

        const response = await request(app).get('/api/items');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.data).toHaveLength(1);
        expect(response.body.data.pagination.total).toBe(1);
      });

      it('should filter items by category', async () => {
        mockQuery
          .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never)
          .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const response = await request(app).get('/api/items?category=weapons');

        expect(response.status).toBe(200);
        expect(mockQuery).toHaveBeenCalledTimes(2);
      });
    });

    describe('GET /api/items/:id', () => {
      it('should return an item by id', async () => {
        const mockRow = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Item',
          description: 'A test item',
          price: '9.99',
          category: 'weapons',
          image_url: null,
          metadata: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockQuery.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 } as never);

        const response = await request(app).get('/api/items/123e4567-e89b-12d3-a456-426614174000');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      });

      it('should return 404 for non-existent item', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const response = await request(app).get('/api/items/123e4567-e89b-12d3-a456-426614174000');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });

      it('should return 400 for invalid UUID', async () => {
        const response = await request(app).get('/api/items/invalid-uuid');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /api/items/:id', () => {
      it('should update an item successfully', async () => {
        const existingRow = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Item',
          description: 'A test item',
          price: '9.99',
          category: 'weapons',
          image_url: null,
          metadata: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        };

        const updatedRow = { ...existingRow, name: 'Updated Item', price: '19.99' };

        mockQuery
          .mockResolvedValueOnce({ rows: [existingRow], rowCount: 1 } as never)
          .mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 } as never);

        const response = await request(app)
          .put('/api/items/123e4567-e89b-12d3-a456-426614174000')
          .send({
            name: 'Updated Item',
            price: 19.99,
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Updated Item');
      });
    });

    describe('DELETE /api/items/:id', () => {
      it('should delete an item successfully', async () => {
        const existingRow = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Item',
          description: 'A test item',
          price: '9.99',
          category: 'weapons',
          image_url: null,
          metadata: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockQuery.mockResolvedValueOnce({ rows: [existingRow], rowCount: 1 } as never);
        mockTransaction.mockImplementationOnce(async (callback) => {
          const mockClient = {
            query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
          };
          return callback(mockClient as never);
        });

        const response = await request(app).delete('/api/items/123e4567-e89b-12d3-a456-426614174000');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/items/categories', () => {
      it('should return distinct categories', async () => {
        mockQuery.mockResolvedValueOnce({
          rows: [{ category: 'weapons' }, { category: 'armor' }],
          rowCount: 2,
        } as never);

        const response = await request(app).get('/api/items/categories');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(['weapons', 'armor']);
      });
    });
  });

  describe('Bundles API', () => {
    describe('POST /api/bundles', () => {
      it('should create a bundle successfully', async () => {
        const mockItemRow = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Item',
          description: null,
          price: '9.99',
          category: null,
          image_url: null,
          metadata: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        };

        const mockBundleRow = {
          id: '223e4567-e89b-12d3-a456-426614174000',
          name: 'Test Bundle',
          description: null,
          discount_type: 'percentage',
          discount_value: '10',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockQuery.mockResolvedValueOnce({ rows: [mockItemRow], rowCount: 1 } as never);

        mockTransaction.mockImplementationOnce(async (callback) => {
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ rows: [mockBundleRow], rowCount: 1 })
              .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
          };
          return callback(mockClient as never);
        });

        const response = await request(app)
          .post('/api/bundles')
          .send({
            name: 'Test Bundle',
            discountType: 'percentage',
            discountValue: 10,
            items: [{ itemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 2 }],
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Test Bundle');
      });

      it('should return 400 for invalid bundle data', async () => {
        const response = await request(app)
          .post('/api/bundles')
          .send({
            name: '',
            discountType: 'invalid',
            discountValue: -1,
            items: [],
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/bundles/:id', () => {
      it('should return a bundle with pricing', async () => {
        const mockBundleRow = {
          id: '223e4567-e89b-12d3-a456-426614174000',
          name: 'Test Bundle',
          description: null,
          discount_type: 'percentage',
          discount_value: '10',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        };

        const mockBundleItemRow = {
          bundle_id: '223e4567-e89b-12d3-a456-426614174000',
          item_id: '123e4567-e89b-12d3-a456-426614174000',
          quantity: 2,
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Item',
          description: null,
          price: '10.00',
          category: null,
          image_url: null,
          metadata: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockQuery
          .mockResolvedValueOnce({ rows: [mockBundleRow], rowCount: 1 } as never)
          .mockResolvedValueOnce({ rows: [mockBundleItemRow], rowCount: 1 } as never);

        const response = await request(app).get('/api/bundles/223e4567-e89b-12d3-a456-426614174000');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.originalPrice).toBe(20);
        expect(response.body.data.finalPrice).toBe(18);
        expect(response.body.data.savings).toBe(2);
      });
    });
  });

  describe('Inventory API', () => {
    describe('POST /api/inventory', () => {
      it('should create inventory successfully', async () => {
        const mockItemRow = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Item',
          description: null,
          price: '9.99',
          category: null,
          image_url: null,
          metadata: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        };

        const mockInventoryRow = {
          id: '323e4567-e89b-12d3-a456-426614174000',
          item_id: '123e4567-e89b-12d3-a456-426614174000',
          quantity: 100,
          reserved_quantity: 0,
          low_stock_threshold: 10,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockQuery
          .mockResolvedValueOnce({ rows: [mockItemRow], rowCount: 1 } as never)
          .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        mockTransaction.mockImplementationOnce(async (callback) => {
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ rows: [mockInventoryRow], rowCount: 1 })
              .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
          };
          return callback(mockClient as never);
        });

        const response = await request(app)
          .post('/api/inventory')
          .send({
            itemId: '123e4567-e89b-12d3-a456-426614174000',
            quantity: 100,
            lowStockThreshold: 10,
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.quantity).toBe(100);
      });
    });

    describe('POST /api/inventory/:itemId/reserve', () => {
      it('should reserve inventory successfully', async () => {
        const mockInventoryRow = {
          id: '323e4567-e89b-12d3-a456-426614174000',
          item_id: '123e4567-e89b-12d3-a456-426614174000',
          quantity: 100,
          reserved_quantity: 10,
          low_stock_threshold: 10,
          created_at: new Date(),
          updated_at: new Date(),
        };

        const updatedRow = { ...mockInventoryRow, reserved_quantity: 30 };

        mockTransaction.mockImplementationOnce(async (callback) => {
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ rows: [mockInventoryRow], rowCount: 1 })
              .mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 })
              .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
          };
          return callback(mockClient as never);
        });

        const response = await request(app)
          .post('/api/inventory/123e4567-e89b-12d3-a456-426614174000/reserve')
          .send({
            quantity: 20,
            reason: 'Order #123',
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.reservedQuantity).toBe(30);
      });
    });

    describe('GET /api/inventory/low-stock', () => {
      it('should return low stock items', async () => {
        const mockRows = [
          {
            id: '323e4567-e89b-12d3-a456-426614174000',
            item_id: '123e4567-e89b-12d3-a456-426614174000',
            quantity: 5,
            reserved_quantity: 2,
            low_stock_threshold: 10,
            created_at: new Date(),
            updated_at: new Date(),
            item_name: 'Low Stock Item',
          },
        ];

        mockQuery.mockResolvedValueOnce({ rows: mockRows, rowCount: 1 } as never);

        const response = await request(app).get('/api/inventory/low-stock');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].itemName).toBe('Low Stock Item');
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/unknown');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
