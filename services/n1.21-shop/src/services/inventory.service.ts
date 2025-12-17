import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/database';
import {
  Inventory,
  CreateInventoryDto,
  UpdateInventoryDto,
  ReserveInventoryDto,
  ReleaseInventoryDto,
  InventoryHistory,
  InventoryChangeType,
  PaginatedResponse,
  PaginationParams,
  LowStockItem,
} from '../types';
import { NotFoundError, ValidationError, InsufficientInventoryError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';
import { itemService } from './item.service';

interface InventoryRow {
  id: string;
  item_id: string;
  quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
  created_at: Date;
  updated_at: Date;
}

interface InventoryHistoryRow {
  id: string;
  item_id: string;
  change_type: InventoryChangeType;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string | null;
  created_at: Date;
}

function mapRowToInventory(row: InventoryRow): Inventory {
  return {
    id: row.id,
    itemId: row.item_id,
    quantity: row.quantity,
    reservedQuantity: row.reserved_quantity,
    lowStockThreshold: row.low_stock_threshold,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToInventoryHistory(row: InventoryHistoryRow): InventoryHistory {
  return {
    id: row.id,
    itemId: row.item_id,
    changeType: row.change_type,
    quantityChange: row.quantity_change,
    previousQuantity: row.previous_quantity,
    newQuantity: row.new_quantity,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export class InventoryService {
  async create(dto: CreateInventoryDto): Promise<Inventory> {
    await itemService.findById(dto.itemId);

    const existingResult = await query<InventoryRow>(
      'SELECT * FROM inventory WHERE item_id = $1',
      [dto.itemId]
    );

    if (existingResult.rows.length > 0) {
      throw new ConflictError(`Inventory already exists for item '${dto.itemId}'`);
    }

    if (dto.quantity < 0) {
      throw new ValidationError('Quantity must be a non-negative number');
    }

    const id = uuidv4();
    const result = await transaction(async (client) => {
      const inventoryResult = await client.query<InventoryRow>(
        `INSERT INTO inventory (id, item_id, quantity, low_stock_threshold)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          id,
          dto.itemId,
          dto.quantity,
          dto.lowStockThreshold ?? config.inventory.defaultLowStockThreshold,
        ]
      );

      if (dto.quantity > 0) {
        await this.recordHistory(
          client,
          dto.itemId,
          'add',
          dto.quantity,
          0,
          dto.quantity,
          'Initial inventory creation'
        );
      }

      return inventoryResult.rows[0];
    });

    logger.info('Inventory created', { itemId: dto.itemId, quantity: dto.quantity });
    return mapRowToInventory(result);
  }

  async findByItemId(itemId: string): Promise<Inventory> {
    const result = await query<InventoryRow>(
      'SELECT * FROM inventory WHERE item_id = $1',
      [itemId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Inventory for item', itemId);
    }

    return mapRowToInventory(result.rows[0]);
  }

  async findAll(params: PaginationParams): Promise<PaginatedResponse<Inventory & { itemName: string }>> {
    const { page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM inventory'
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query<InventoryRow & { item_name: string }>(
      `SELECT inv.*, i.name as item_name
       FROM inventory inv
       JOIN items i ON inv.item_id = i.id
       ORDER BY inv.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      data: result.rows.map(row => ({
        ...mapRowToInventory(row),
        itemName: row.item_name,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(itemId: string, dto: UpdateInventoryDto): Promise<Inventory> {
    const currentInventory = await this.findByItemId(itemId);

    if (dto.quantity !== undefined && dto.quantity < 0) {
      throw new ValidationError('Quantity must be a non-negative number');
    }

    if (dto.quantity !== undefined && dto.quantity < currentInventory.reservedQuantity) {
      throw new ValidationError(
        `Cannot set quantity below reserved quantity (${currentInventory.reservedQuantity})`
      );
    }

    const result = await transaction(async (client) => {
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (dto.quantity !== undefined) {
        updates.push(`quantity = $${paramIndex}`);
        values.push(dto.quantity);
        paramIndex++;

        const changeType: InventoryChangeType = dto.quantity > currentInventory.quantity ? 'add' : 'remove';
        const quantityChange = Math.abs(dto.quantity - currentInventory.quantity);

        if (quantityChange > 0) {
          await this.recordHistory(
            client,
            itemId,
            changeType,
            quantityChange,
            currentInventory.quantity,
            dto.quantity,
            'Manual inventory update'
          );
        }
      }

      if (dto.lowStockThreshold !== undefined) {
        if (dto.lowStockThreshold < 0) {
          throw new ValidationError('Low stock threshold must be a non-negative number');
        }
        updates.push(`low_stock_threshold = $${paramIndex}`);
        values.push(dto.lowStockThreshold);
        paramIndex++;
      }

      if (updates.length === 0) {
        return currentInventory;
      }

      values.push(itemId);
      const inventoryResult = await client.query<InventoryRow>(
        `UPDATE inventory SET ${updates.join(', ')} WHERE item_id = $${paramIndex} RETURNING *`,
        values
      );

      return mapRowToInventory(inventoryResult.rows[0]);
    });

    logger.info('Inventory updated', { itemId });
    return result;
  }

  async reserve(itemId: string, dto: ReserveInventoryDto): Promise<Inventory> {
    if (dto.quantity <= 0) {
      throw new ValidationError('Reserve quantity must be a positive number');
    }

    const result = await transaction(async (client) => {
      const lockResult = await client.query<InventoryRow>(
        'SELECT * FROM inventory WHERE item_id = $1 FOR UPDATE',
        [itemId]
      );

      if (lockResult.rows.length === 0) {
        throw new NotFoundError('Inventory for item', itemId);
      }

      const inventory = mapRowToInventory(lockResult.rows[0]);
      const availableQuantity = inventory.quantity - inventory.reservedQuantity;

      if (dto.quantity > availableQuantity) {
        throw new InsufficientInventoryError(itemId, dto.quantity, availableQuantity);
      }

      const newReservedQuantity = inventory.reservedQuantity + dto.quantity;

      const updateResult = await client.query<InventoryRow>(
        `UPDATE inventory SET reserved_quantity = $1 WHERE item_id = $2 RETURNING *`,
        [newReservedQuantity, itemId]
      );

      await this.recordHistory(
        client,
        itemId,
        'reserve',
        dto.quantity,
        inventory.reservedQuantity,
        newReservedQuantity,
        dto.reason || 'Inventory reserved'
      );

      return mapRowToInventory(updateResult.rows[0]);
    });

    logger.info('Inventory reserved', { itemId, quantity: dto.quantity });
    return result;
  }

  async release(itemId: string, dto: ReleaseInventoryDto): Promise<Inventory> {
    if (dto.quantity <= 0) {
      throw new ValidationError('Release quantity must be a positive number');
    }

    const result = await transaction(async (client) => {
      const lockResult = await client.query<InventoryRow>(
        'SELECT * FROM inventory WHERE item_id = $1 FOR UPDATE',
        [itemId]
      );

      if (lockResult.rows.length === 0) {
        throw new NotFoundError('Inventory for item', itemId);
      }

      const inventory = mapRowToInventory(lockResult.rows[0]);

      if (dto.quantity > inventory.reservedQuantity) {
        throw new ValidationError(
          `Cannot release ${dto.quantity} items. Only ${inventory.reservedQuantity} are reserved.`
        );
      }

      const newReservedQuantity = inventory.reservedQuantity - dto.quantity;

      const updateResult = await client.query<InventoryRow>(
        `UPDATE inventory SET reserved_quantity = $1 WHERE item_id = $2 RETURNING *`,
        [newReservedQuantity, itemId]
      );

      await this.recordHistory(
        client,
        itemId,
        'release',
        dto.quantity,
        inventory.reservedQuantity,
        newReservedQuantity,
        dto.reason || 'Inventory released'
      );

      return mapRowToInventory(updateResult.rows[0]);
    });

    logger.info('Inventory released', { itemId, quantity: dto.quantity });
    return result;
  }

  async getLowStockItems(): Promise<LowStockItem[]> {
    const result = await query<InventoryRow & { item_name: string }>(
      `SELECT inv.*, i.name as item_name
       FROM inventory inv
       JOIN items i ON inv.item_id = i.id
       WHERE (inv.quantity - inv.reserved_quantity) <= inv.low_stock_threshold
       ORDER BY (inv.quantity - inv.reserved_quantity) ASC`
    );

    return result.rows.map(row => ({
      itemId: row.item_id,
      itemName: row.item_name,
      currentQuantity: row.quantity,
      availableQuantity: row.quantity - row.reserved_quantity,
      threshold: row.low_stock_threshold,
    }));
  }

  async getHistory(itemId: string, params: PaginationParams): Promise<PaginatedResponse<InventoryHistory>> {
    const { page = 1, limit = 50 } = params;
    const offset = (page - 1) * limit;

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM inventory_history WHERE item_id = $1',
      [itemId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query<InventoryHistoryRow>(
      `SELECT * FROM inventory_history 
       WHERE item_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [itemId, limit, offset]
    );

    return {
      data: result.rows.map(mapRowToInventoryHistory),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async recordHistory(
    client: { query: (text: string, params?: unknown[]) => Promise<unknown> },
    itemId: string,
    changeType: InventoryChangeType,
    quantityChange: number,
    previousQuantity: number,
    newQuantity: number,
    reason: string
  ): Promise<void> {
    await client.query(
      `INSERT INTO inventory_history 
       (id, item_id, change_type, quantity_change, previous_quantity, new_quantity, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uuidv4(), itemId, changeType, quantityChange, previousQuantity, newQuantity, reason]
    );
  }

  async getOrCreateInventory(itemId: string): Promise<Inventory> {
    try {
      return await this.findByItemId(itemId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return this.create({
          itemId,
          quantity: 0,
          lowStockThreshold: config.inventory.defaultLowStockThreshold,
        });
      }
      throw error;
    }
  }
}

export const inventoryService = new InventoryService();
