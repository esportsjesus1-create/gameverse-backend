import { InventoryService } from '../../src/services/inventory.service';
import { CreateInventoryDto, UpdateInventoryDto, ReserveInventoryDto, ReleaseInventoryDto } from '../../src/types';
import { NotFoundError, ValidationError, InsufficientInventoryError, ConflictError } from '../../src/utils/errors';
import * as database from '../../src/config/database';
import { itemService } from '../../src/services/item.service';

jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/item.service');

const mockQuery = database.query as jest.MockedFunction<typeof database.query>;
const mockTransaction = database.transaction as jest.MockedFunction<typeof database.transaction>;
const mockItemServiceFindById = itemService.findById as jest.MockedFunction<typeof itemService.findById>;

describe('InventoryService', () => {
  let inventoryService: InventoryService;

  beforeEach(() => {
    inventoryService = new InventoryService();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create inventory successfully', async () => {
      const dto: CreateInventoryDto = {
        itemId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 100,
        lowStockThreshold: 10,
      };

      mockItemServiceFindById.mockResolvedValueOnce({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Item',
        description: null,
        price: 9.99,
        category: null,
        imageUrl: null,
        metadata: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const mockInventoryRow = {
        id: '323e4567-e89b-12d3-a456-426614174000',
        item_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 100,
        reserved_quantity: 0,
        low_stock_threshold: 10,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockInventoryRow], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
        };
        return callback(mockClient as never);
      });

      const result = await inventoryService.create(dto);

      expect(result.itemId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.quantity).toBe(100);
      expect(result.lowStockThreshold).toBe(10);
    });

    it('should throw ConflictError when inventory already exists', async () => {
      const dto: CreateInventoryDto = {
        itemId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 100,
      };

      mockItemServiceFindById.mockResolvedValueOnce({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Item',
        description: null,
        price: 9.99,
        category: null,
        imageUrl: null,
        metadata: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const existingInventory = {
        id: '323e4567-e89b-12d3-a456-426614174000',
        item_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 50,
        reserved_quantity: 0,
        low_stock_threshold: 10,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [existingInventory], rowCount: 1 } as never);

      await expect(inventoryService.create(dto)).rejects.toThrow('Inventory already exists');
    });

    it('should throw ValidationError when quantity is negative', async () => {
      const dto: CreateInventoryDto = {
        itemId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: -10,
      };

      mockItemServiceFindById.mockResolvedValueOnce({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Item',
        description: null,
        price: 9.99,
        category: null,
        imageUrl: null,
        metadata: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      await expect(inventoryService.create(dto)).rejects.toThrow('Quantity must be a non-negative number');
    });
  });

  describe('findByItemId', () => {
    it('should find inventory by item id', async () => {
      const mockInventoryRow = {
        id: '323e4567-e89b-12d3-a456-426614174000',
        item_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 100,
        reserved_quantity: 10,
        low_stock_threshold: 10,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockInventoryRow], rowCount: 1 } as never);

      const result = await inventoryService.findByItemId('123e4567-e89b-12d3-a456-426614174000');

      expect(result.itemId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.quantity).toBe(100);
      expect(result.reservedQuantity).toBe(10);
    });

    it('should throw NotFoundError when inventory does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      await expect(inventoryService.findByItemId('nonexistent-id')).rejects.toThrow('not found');
    });
  });

  describe('update', () => {
    it('should update inventory quantity successfully', async () => {
      const mockInventoryRow = {
        id: '323e4567-e89b-12d3-a456-426614174000',
        item_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 100,
        reserved_quantity: 10,
        low_stock_threshold: 10,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockInventoryRow], rowCount: 1 } as never);

      const updatedRow = { ...mockInventoryRow, quantity: 150 };

      mockTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [updatedRow], rowCount: 1 }),
        };
        return callback(mockClient as never);
      });

      const dto: UpdateInventoryDto = {
        quantity: 150,
      };

      const result = await inventoryService.update('123e4567-e89b-12d3-a456-426614174000', dto);

      expect(result.quantity).toBe(150);
    });

    it('should throw ValidationError when setting quantity below reserved', async () => {
      const mockInventoryRow = {
        id: '323e4567-e89b-12d3-a456-426614174000',
        item_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 100,
        reserved_quantity: 50,
        low_stock_threshold: 10,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockInventoryRow], rowCount: 1 } as never);

      const dto: UpdateInventoryDto = {
        quantity: 30,
      };

      await expect(inventoryService.update('123e4567-e89b-12d3-a456-426614174000', dto)).rejects.toThrow('Cannot set quantity below reserved quantity');
    });
  });

  describe('reserve', () => {
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

      const dto: ReserveInventoryDto = {
        quantity: 20,
        reason: 'Order #123',
      };

      const result = await inventoryService.reserve('123e4567-e89b-12d3-a456-426614174000', dto);

      expect(result.reservedQuantity).toBe(30);
    });

    it('should throw InsufficientInventoryError when not enough available', async () => {
      const mockInventoryRow = {
        id: '323e4567-e89b-12d3-a456-426614174000',
        item_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 100,
        reserved_quantity: 90,
        low_stock_threshold: 10,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValueOnce({ rows: [mockInventoryRow], rowCount: 1 }),
        };
        return callback(mockClient as never);
      });

      const dto: ReserveInventoryDto = {
        quantity: 20,
      };

      await expect(inventoryService.reserve('123e4567-e89b-12d3-a456-426614174000', dto)).rejects.toThrow('Insufficient inventory');
    });

    it('should throw ValidationError when reserve quantity is not positive', async () => {
      const dto: ReserveInventoryDto = {
        quantity: 0,
      };

      await expect(inventoryService.reserve('123e4567-e89b-12d3-a456-426614174000', dto)).rejects.toThrow('Reserve quantity must be a positive number');
    });
  });

  describe('release', () => {
    it('should release inventory successfully', async () => {
      const mockInventoryRow = {
        id: '323e4567-e89b-12d3-a456-426614174000',
        item_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 100,
        reserved_quantity: 30,
        low_stock_threshold: 10,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedRow = { ...mockInventoryRow, reserved_quantity: 10 };

      mockTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockInventoryRow], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
        };
        return callback(mockClient as never);
      });

      const dto: ReleaseInventoryDto = {
        quantity: 20,
        reason: 'Order cancelled',
      };

      const result = await inventoryService.release('123e4567-e89b-12d3-a456-426614174000', dto);

      expect(result.reservedQuantity).toBe(10);
    });

    it('should throw ValidationError when releasing more than reserved', async () => {
      const mockInventoryRow = {
        id: '323e4567-e89b-12d3-a456-426614174000',
        item_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 100,
        reserved_quantity: 10,
        low_stock_threshold: 10,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValueOnce({ rows: [mockInventoryRow], rowCount: 1 }),
        };
        return callback(mockClient as never);
      });

      const dto: ReleaseInventoryDto = {
        quantity: 20,
      };

      await expect(inventoryService.release('123e4567-e89b-12d3-a456-426614174000', dto)).rejects.toThrow('Cannot release');
    });
  });

  describe('getLowStockItems', () => {
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

      const result = await inventoryService.getLowStockItems();

      expect(result).toHaveLength(1);
      expect(result[0].itemName).toBe('Low Stock Item');
      expect(result[0].availableQuantity).toBe(3);
    });
  });

  describe('getHistory', () => {
    it('should return paginated inventory history', async () => {
      const mockHistoryRows = [
        {
          id: '423e4567-e89b-12d3-a456-426614174000',
          item_id: '123e4567-e89b-12d3-a456-426614174000',
          change_type: 'add' as const,
          quantity_change: 100,
          previous_quantity: 0,
          new_quantity: 100,
          reason: 'Initial stock',
          created_at: new Date(),
        },
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: mockHistoryRows, rowCount: 1 } as never);

      const result = await inventoryService.getHistory('123e4567-e89b-12d3-a456-426614174000', { page: 1, limit: 50 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].changeType).toBe('add');
      expect(result.pagination.total).toBe(1);
    });
  });
});
