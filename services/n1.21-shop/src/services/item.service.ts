import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database';
import {
  Item,
  CreateItemDto,
  UpdateItemDto,
  PaginatedResponse,
  SearchParams,
} from '../types';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

interface ItemRow {
  id: string;
  name: string;
  description: string | null;
  price: string;
  category: string | null;
  image_url: string | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

function mapRowToItem(row: ItemRow): Item {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: parseFloat(row.price),
    category: row.category,
    imageUrl: row.image_url,
    metadata: row.metadata,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ItemService {
  async create(dto: CreateItemDto): Promise<Item> {
    if (!dto.name || dto.name.trim() === '') {
      throw new ValidationError('Item name is required');
    }
    if (dto.price === undefined || dto.price < 0) {
      throw new ValidationError('Item price must be a non-negative number');
    }

    const id = uuidv4();
    const result = await query<ItemRow>(
      `INSERT INTO items (id, name, description, price, category, image_url, metadata, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        dto.name.trim(),
        dto.description || null,
        dto.price,
        dto.category || null,
        dto.imageUrl || null,
        dto.metadata ? JSON.stringify(dto.metadata) : null,
        dto.isActive !== undefined ? dto.isActive : true,
      ]
    );

    logger.info('Item created', { itemId: id, name: dto.name });
    return mapRowToItem(result.rows[0]);
  }

  async findById(id: string): Promise<Item> {
    const result = await query<ItemRow>(
      'SELECT * FROM items WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Item', id);
    }

    return mapRowToItem(result.rows[0]);
  }

  async findAll(params: SearchParams): Promise<PaginatedResponse<Item>> {
    const { page = 1, limit = 20, query: searchQuery, category, minPrice, maxPrice, isActive } = params;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (searchQuery) {
      conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      values.push(`%${searchQuery}%`);
      paramIndex++;
    }

    if (category) {
      conditions.push(`category = $${paramIndex}`);
      values.push(category);
      paramIndex++;
    }

    if (minPrice !== undefined) {
      conditions.push(`price >= $${paramIndex}`);
      values.push(minPrice);
      paramIndex++;
    }

    if (maxPrice !== undefined) {
      conditions.push(`price <= $${paramIndex}`);
      values.push(maxPrice);
      paramIndex++;
    }

    if (isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex}`);
      values.push(isActive);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM items ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await query<ItemRow>(
      `SELECT * FROM items ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      data: dataResult.rows.map(mapRowToItem),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, dto: UpdateItemDto): Promise<Item> {
    await this.findById(id);

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      if (dto.name.trim() === '') {
        throw new ValidationError('Item name cannot be empty');
      }
      updates.push(`name = $${paramIndex}`);
      values.push(dto.name.trim());
      paramIndex++;
    }

    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(dto.description);
      paramIndex++;
    }

    if (dto.price !== undefined) {
      if (dto.price < 0) {
        throw new ValidationError('Item price must be a non-negative number');
      }
      updates.push(`price = $${paramIndex}`);
      values.push(dto.price);
      paramIndex++;
    }

    if (dto.category !== undefined) {
      updates.push(`category = $${paramIndex}`);
      values.push(dto.category);
      paramIndex++;
    }

    if (dto.imageUrl !== undefined) {
      updates.push(`image_url = $${paramIndex}`);
      values.push(dto.imageUrl);
      paramIndex++;
    }

    if (dto.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`);
      values.push(JSON.stringify(dto.metadata));
      paramIndex++;
    }

    if (dto.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(dto.isActive);
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await query<ItemRow>(
      `UPDATE items SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    logger.info('Item updated', { itemId: id });
    return mapRowToItem(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    await transaction(async (client) => {
      await client.query('DELETE FROM bundle_items WHERE item_id = $1', [id]);
      await client.query('DELETE FROM inventory_history WHERE item_id = $1', [id]);
      await client.query('DELETE FROM inventory WHERE item_id = $1', [id]);
      await client.query('DELETE FROM items WHERE id = $1', [id]);
    });

    logger.info('Item deleted', { itemId: id });
  }

  async findByIds(ids: string[]): Promise<Item[]> {
    if (ids.length === 0) return [];

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const result = await query<ItemRow>(
      `SELECT * FROM items WHERE id IN (${placeholders})`,
      ids
    );

    return result.rows.map(mapRowToItem);
  }

  async getCategories(): Promise<string[]> {
    const result = await query<{ category: string }>(
      'SELECT DISTINCT category FROM items WHERE category IS NOT NULL ORDER BY category'
    );
    return result.rows.map(row => row.category);
  }
}

export const itemService = new ItemService();
