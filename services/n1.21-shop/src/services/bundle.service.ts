import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database';
import {
  Bundle,
  BundleItem,
  CreateBundleDto,
  UpdateBundleDto,
  BundleWithPricing,
  PaginatedResponse,
  PaginationParams,
  Item,
} from '../types';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { itemService } from './item.service';

interface BundleRow {
  id: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface BundleItemRow {
  bundle_id: string;
  item_id: string;
  quantity: number;
}

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

function mapRowToBundle(row: BundleRow): Bundle {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    discountType: row.discount_type,
    discountValue: parseFloat(row.discount_value),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

export class BundleService {
  async create(dto: CreateBundleDto): Promise<Bundle> {
    if (!dto.name || dto.name.trim() === '') {
      throw new ValidationError('Bundle name is required');
    }
    if (!dto.discountType || !['percentage', 'fixed'].includes(dto.discountType)) {
      throw new ValidationError('Discount type must be "percentage" or "fixed"');
    }
    if (dto.discountValue === undefined || dto.discountValue < 0) {
      throw new ValidationError('Discount value must be a non-negative number');
    }
    if (dto.discountType === 'percentage' && dto.discountValue > 100) {
      throw new ValidationError('Percentage discount cannot exceed 100');
    }
    if (!dto.items || dto.items.length === 0) {
      throw new ValidationError('Bundle must contain at least one item');
    }

    const itemIds = dto.items.map(item => item.itemId);
    const existingItems = await itemService.findByIds(itemIds);
    const existingItemIds = new Set(existingItems.map(item => item.id));
    
    const missingItems = itemIds.filter(id => !existingItemIds.has(id));
    if (missingItems.length > 0) {
      throw new ValidationError(`Items not found: ${missingItems.join(', ')}`);
    }

    const bundle = await transaction(async (client) => {
      const id = uuidv4();
      const bundleResult = await client.query<BundleRow>(
        `INSERT INTO bundles (id, name, description, discount_type, discount_value, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          id,
          dto.name.trim(),
          dto.description || null,
          dto.discountType,
          dto.discountValue,
          dto.isActive !== undefined ? dto.isActive : true,
        ]
      );

      for (const item of dto.items) {
        await client.query(
          `INSERT INTO bundle_items (bundle_id, item_id, quantity)
           VALUES ($1, $2, $3)`,
          [id, item.itemId, item.quantity]
        );
      }

      return mapRowToBundle(bundleResult.rows[0]);
    });

    logger.info('Bundle created', { bundleId: bundle.id, name: dto.name });
    return bundle;
  }

  async findById(id: string): Promise<Bundle> {
    const result = await query<BundleRow>(
      'SELECT * FROM bundles WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Bundle', id);
    }

    const bundle = mapRowToBundle(result.rows[0]);
    bundle.items = await this.getBundleItems(id);
    return bundle;
  }

  async findByIdWithPricing(id: string): Promise<BundleWithPricing> {
    const bundle = await this.findById(id);
    return this.calculateBundlePricing(bundle);
  }

  private async getBundleItems(bundleId: string): Promise<BundleItem[]> {
    const result = await query<BundleItemRow & ItemRow>(
      `SELECT bi.bundle_id, bi.item_id, bi.quantity,
              i.id, i.name, i.description, i.price, i.category, 
              i.image_url, i.metadata, i.is_active, i.created_at, i.updated_at
       FROM bundle_items bi
       JOIN items i ON bi.item_id = i.id
       WHERE bi.bundle_id = $1`,
      [bundleId]
    );

    return result.rows.map(row => ({
      bundleId: row.bundle_id,
      itemId: row.item_id,
      quantity: row.quantity,
      item: mapRowToItem(row),
    }));
  }

  private calculateBundlePricing(bundle: Bundle): BundleWithPricing {
    let originalPrice = 0;
    
    if (bundle.items) {
      for (const bundleItem of bundle.items) {
        if (bundleItem.item) {
          originalPrice += bundleItem.item.price * bundleItem.quantity;
        }
      }
    }

    let discount = 0;
    if (bundle.discountType === 'percentage') {
      discount = originalPrice * (bundle.discountValue / 100);
    } else {
      discount = bundle.discountValue;
    }

    const finalPrice = Math.max(0, originalPrice - discount);
    const savings = originalPrice - finalPrice;

    return {
      ...bundle,
      originalPrice: Math.round(originalPrice * 100) / 100,
      finalPrice: Math.round(finalPrice * 100) / 100,
      savings: Math.round(savings * 100) / 100,
    };
  }

  async findAll(params: PaginationParams): Promise<PaginatedResponse<BundleWithPricing>> {
    const { page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM bundles'
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const bundleResult = await query<BundleRow>(
      'SELECT * FROM bundles ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    const bundlesWithPricing: BundleWithPricing[] = [];
    for (const row of bundleResult.rows) {
      const bundle = mapRowToBundle(row);
      bundle.items = await this.getBundleItems(bundle.id);
      bundlesWithPricing.push(this.calculateBundlePricing(bundle));
    }

    return {
      data: bundlesWithPricing,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, dto: UpdateBundleDto): Promise<Bundle> {
    await this.findById(id);

    if (dto.discountType && !['percentage', 'fixed'].includes(dto.discountType)) {
      throw new ValidationError('Discount type must be "percentage" or "fixed"');
    }
    if (dto.discountValue !== undefined && dto.discountValue < 0) {
      throw new ValidationError('Discount value must be a non-negative number');
    }
    if (dto.discountType === 'percentage' && dto.discountValue !== undefined && dto.discountValue > 100) {
      throw new ValidationError('Percentage discount cannot exceed 100');
    }

    if (dto.items) {
      if (dto.items.length === 0) {
        throw new ValidationError('Bundle must contain at least one item');
      }
      const itemIds = dto.items.map(item => item.itemId);
      const existingItems = await itemService.findByIds(itemIds);
      const existingItemIds = new Set(existingItems.map(item => item.id));
      
      const missingItems = itemIds.filter(itemId => !existingItemIds.has(itemId));
      if (missingItems.length > 0) {
        throw new ValidationError(`Items not found: ${missingItems.join(', ')}`);
      }
    }

    await transaction(async (client) => {
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (dto.name !== undefined) {
        if (dto.name.trim() === '') {
          throw new ValidationError('Bundle name cannot be empty');
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

      if (dto.discountType !== undefined) {
        updates.push(`discount_type = $${paramIndex}`);
        values.push(dto.discountType);
        paramIndex++;
      }

      if (dto.discountValue !== undefined) {
        updates.push(`discount_value = $${paramIndex}`);
        values.push(dto.discountValue);
        paramIndex++;
      }

      if (dto.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        values.push(dto.isActive);
        paramIndex++;
      }

      let bundleResult;
      if (updates.length > 0) {
        values.push(id);
        bundleResult = await client.query<BundleRow>(
          `UPDATE bundles SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
          values
        );
      } else {
        bundleResult = await client.query<BundleRow>(
          'SELECT * FROM bundles WHERE id = $1',
          [id]
        );
      }

      if (dto.items) {
        await client.query('DELETE FROM bundle_items WHERE bundle_id = $1', [id]);
        for (const item of dto.items) {
          await client.query(
            `INSERT INTO bundle_items (bundle_id, item_id, quantity)
             VALUES ($1, $2, $3)`,
            [id, item.itemId, item.quantity]
          );
        }
      }

      return mapRowToBundle(bundleResult.rows[0]);
    });

    logger.info('Bundle updated', { bundleId: id });
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    await transaction(async (client) => {
      await client.query('DELETE FROM bundle_items WHERE bundle_id = $1', [id]);
      await client.query('DELETE FROM bundles WHERE id = $1', [id]);
    });

    logger.info('Bundle deleted', { bundleId: id });
  }
}

export const bundleService = new BundleService();
