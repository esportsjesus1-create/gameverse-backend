import { ItemService } from '../../src/services/item.service';
import { CreateItemDto, UpdateItemDto } from '../../src/types';
import { NotFoundError, ValidationError } from '../../src/utils/errors';
import * as database from '../../src/config/database';

jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');

const mockQuery = database.query as jest.MockedFunction<typeof database.query>;
const mockTransaction = database.transaction as jest.MockedFunction<typeof database.transaction>;

describe('ItemService', () => {
  let itemService: ItemService;

  beforeEach(() => {
    itemService = new ItemService();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an item successfully', async () => {
      const dto: CreateItemDto = {
        name: 'Test Item',
        price: 9.99,
        description: 'A test item',
        category: 'test',
      };

      const mockRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Item',
        description: 'A test item',
        price: '9.99',
        category: 'test',
        image_url: null,
        metadata: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 } as never);

      const result = await itemService.create(dto);

      expect(result.name).toBe('Test Item');
      expect(result.price).toBe(9.99);
      expect(result.category).toBe('test');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should throw ValidationError when name is empty', async () => {
      const dto: CreateItemDto = {
        name: '',
        price: 9.99,
      };

      await expect(itemService.create(dto)).rejects.toThrow('Item name is required');
    });

    it('should throw ValidationError when price is negative', async () => {
      const dto: CreateItemDto = {
        name: 'Test Item',
        price: -1,
      };

      await expect(itemService.create(dto)).rejects.toThrow('Item price must be a non-negative number');
    });
  });

  describe('findById', () => {
    it('should find an item by id', async () => {
      const mockRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Item',
        description: 'A test item',
        price: '9.99',
        category: 'test',
        image_url: null,
        metadata: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 } as never);

      const result = await itemService.findById('123e4567-e89b-12d3-a456-426614174000');

      expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.name).toBe('Test Item');
    });

    it('should throw NotFoundError when item does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      await expect(itemService.findById('nonexistent-id')).rejects.toThrow('not found');
    });
  });

  describe('findAll', () => {
    it('should return paginated items', async () => {
      const mockRows = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Item 1',
          description: 'A test item',
          price: '9.99',
          category: 'test',
          image_url: null,
          metadata: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '223e4567-e89b-12d3-a456-426614174000',
          name: 'Test Item 2',
          description: 'Another test item',
          price: '19.99',
          category: 'test',
          image_url: null,
          metadata: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: mockRows, rowCount: 2 } as never);

      const result = await itemService.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by category', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      await itemService.findAll({ page: 1, limit: 20, category: 'weapons' });

      expect(mockQuery).toHaveBeenCalledTimes(2);
      const countCall = mockQuery.mock.calls[0];
      expect(countCall[0]).toContain('category = $');
    });
  });

  describe('update', () => {
    it('should update an item successfully', async () => {
      const existingRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Item',
        description: 'A test item',
        price: '9.99',
        category: 'test',
        image_url: null,
        metadata: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedRow = {
        ...existingRow,
        name: 'Updated Item',
        price: '19.99',
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [existingRow], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 } as never);

      const dto: UpdateItemDto = {
        name: 'Updated Item',
        price: 19.99,
      };

      const result = await itemService.update('123e4567-e89b-12d3-a456-426614174000', dto);

      expect(result.name).toBe('Updated Item');
      expect(result.price).toBe(19.99);
    });

    it('should throw ValidationError when updating with empty name', async () => {
      const existingRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Item',
        description: 'A test item',
        price: '9.99',
        category: 'test',
        image_url: null,
        metadata: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [existingRow], rowCount: 1 } as never);

      const dto: UpdateItemDto = {
        name: '   ',
      };

      await expect(itemService.update('123e4567-e89b-12d3-a456-426614174000', dto)).rejects.toThrow('Item name cannot be empty');
    });
  });

  describe('delete', () => {
    it('should delete an item successfully', async () => {
      const existingRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Item',
        description: 'A test item',
        price: '9.99',
        category: 'test',
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

      await expect(itemService.delete('123e4567-e89b-12d3-a456-426614174000')).resolves.not.toThrow();
    });

    it('should throw NotFoundError when deleting non-existent item', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      await expect(itemService.delete('nonexistent-id')).rejects.toThrow('not found');
    });
  });

  describe('findByIds', () => {
    it('should return items for given ids', async () => {
      const mockRows = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Item 1',
          description: 'A test item',
          price: '9.99',
          category: 'test',
          image_url: null,
          metadata: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockRows, rowCount: 1 } as never);

      const result = await itemService.findByIds(['123e4567-e89b-12d3-a456-426614174000']);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return empty array for empty ids', async () => {
      const result = await itemService.findByIds([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('getCategories', () => {
    it('should return distinct categories', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ category: 'weapons' }, { category: 'armor' }],
        rowCount: 2,
      } as never);

      const result = await itemService.getCategories();

      expect(result).toEqual(['weapons', 'armor']);
    });
  });
});
