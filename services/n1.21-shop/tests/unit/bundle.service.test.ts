import { BundleService } from '../../src/services/bundle.service';
import { CreateBundleDto, UpdateBundleDto } from '../../src/types';
import { NotFoundError, ValidationError } from '../../src/utils/errors';
import * as database from '../../src/config/database';
import { itemService } from '../../src/services/item.service';

jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/item.service');

const mockQuery = database.query as jest.MockedFunction<typeof database.query>;
const mockTransaction = database.transaction as jest.MockedFunction<typeof database.transaction>;
const mockItemServiceFindByIds = itemService.findByIds as jest.MockedFunction<typeof itemService.findByIds>;

describe('BundleService', () => {
  let bundleService: BundleService;

  beforeEach(() => {
    bundleService = new BundleService();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a bundle successfully', async () => {
      const dto: CreateBundleDto = {
        name: 'Test Bundle',
        discountType: 'percentage',
        discountValue: 10,
        items: [
          { itemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 2 },
        ],
      };

      mockItemServiceFindByIds.mockResolvedValueOnce([
        {
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
        },
      ]);

      const mockBundleRow = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        name: 'Test Bundle',
        description: null,
        discount_type: 'percentage' as const,
        discount_value: '10',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockBundleRow], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
        };
        return callback(mockClient as never);
      });

      const result = await bundleService.create(dto);

      expect(result.name).toBe('Test Bundle');
      expect(result.discountType).toBe('percentage');
      expect(result.discountValue).toBe(10);
    });

    it('should throw ValidationError when name is empty', async () => {
      const dto: CreateBundleDto = {
        name: '',
        discountType: 'percentage',
        discountValue: 10,
        items: [{ itemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 1 }],
      };

      await expect(bundleService.create(dto)).rejects.toThrow('Bundle name is required');
    });

    it('should throw ValidationError when discount type is invalid', async () => {
      const dto = {
        name: 'Test Bundle',
        discountType: 'invalid' as 'percentage',
        discountValue: 10,
        items: [{ itemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 1 }],
      };

      await expect(bundleService.create(dto)).rejects.toThrow('Discount type must be');
    });

    it('should throw ValidationError when percentage discount exceeds 100', async () => {
      const dto: CreateBundleDto = {
        name: 'Test Bundle',
        discountType: 'percentage',
        discountValue: 150,
        items: [{ itemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 1 }],
      };

      await expect(bundleService.create(dto)).rejects.toThrow('Percentage discount cannot exceed 100');
    });

    it('should throw ValidationError when items array is empty', async () => {
      const dto: CreateBundleDto = {
        name: 'Test Bundle',
        discountType: 'percentage',
        discountValue: 10,
        items: [],
      };

      await expect(bundleService.create(dto)).rejects.toThrow('Bundle must contain at least one item');
    });

    it('should throw ValidationError when item does not exist', async () => {
      const dto: CreateBundleDto = {
        name: 'Test Bundle',
        discountType: 'percentage',
        discountValue: 10,
        items: [{ itemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 1 }],
      };

      mockItemServiceFindByIds.mockResolvedValueOnce([]);

      await expect(bundleService.create(dto)).rejects.toThrow('Items not found');
    });
  });

  describe('findById', () => {
    it('should find a bundle by id with items', async () => {
      const mockBundleRow = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        name: 'Test Bundle',
        description: null,
        discount_type: 'percentage' as const,
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
        price: '9.99',
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

      const result = await bundleService.findById('223e4567-e89b-12d3-a456-426614174000');

      expect(result.id).toBe('223e4567-e89b-12d3-a456-426614174000');
      expect(result.name).toBe('Test Bundle');
      expect(result.items).toHaveLength(1);
    });

    it('should throw NotFoundError when bundle does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      await expect(bundleService.findById('nonexistent-id')).rejects.toThrow('not found');
    });
  });

  describe('findByIdWithPricing', () => {
    it('should calculate bundle pricing correctly with percentage discount', async () => {
      const mockBundleRow = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        name: 'Test Bundle',
        description: null,
        discount_type: 'percentage' as const,
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

      const result = await bundleService.findByIdWithPricing('223e4567-e89b-12d3-a456-426614174000');

      expect(result.originalPrice).toBe(20);
      expect(result.finalPrice).toBe(18);
      expect(result.savings).toBe(2);
    });

    it('should calculate bundle pricing correctly with fixed discount', async () => {
      const mockBundleRow = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        name: 'Test Bundle',
        description: null,
        discount_type: 'fixed' as const,
        discount_value: '5',
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

      const result = await bundleService.findByIdWithPricing('223e4567-e89b-12d3-a456-426614174000');

      expect(result.originalPrice).toBe(20);
      expect(result.finalPrice).toBe(15);
      expect(result.savings).toBe(5);
    });
  });

  describe('findAll', () => {
    it('should return paginated bundles with pricing', async () => {
      const mockBundleRow = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        name: 'Test Bundle',
        description: null,
        discount_type: 'percentage' as const,
        discount_value: '10',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockBundleItemRow = {
        bundle_id: '223e4567-e89b-12d3-a456-426614174000',
        item_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 1,
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
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [mockBundleRow], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [mockBundleItemRow], rowCount: 1 } as never);

      const result = await bundleService.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('update', () => {
    it('should update a bundle successfully', async () => {
      const mockBundleRow = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        name: 'Test Bundle',
        description: null,
        discount_type: 'percentage' as const,
        discount_value: '10',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockBundleItemRow = {
        bundle_id: '223e4567-e89b-12d3-a456-426614174000',
        item_id: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 1,
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

      mockTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [{ ...mockBundleRow, name: 'Updated Bundle' }], rowCount: 1 }),
        };
        return callback(mockClient as never);
      });

      mockQuery
        .mockResolvedValueOnce({ rows: [{ ...mockBundleRow, name: 'Updated Bundle' }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [mockBundleItemRow], rowCount: 1 } as never);

      const dto: UpdateBundleDto = {
        name: 'Updated Bundle',
      };

      const result = await bundleService.update('223e4567-e89b-12d3-a456-426614174000', dto);

      expect(result.name).toBe('Updated Bundle');
    });
  });

  describe('delete', () => {
    it('should delete a bundle successfully', async () => {
      const mockBundleRow = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        name: 'Test Bundle',
        description: null,
        discount_type: 'percentage' as const,
        discount_value: '10',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockBundleRow], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      mockTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        };
        return callback(mockClient as never);
      });

      await expect(bundleService.delete('223e4567-e89b-12d3-a456-426614174000')).resolves.not.toThrow();
    });
  });
});
