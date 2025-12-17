import { PoolClient } from 'pg';
import { query, transaction } from '../config/database';
import { BlockchainAddress, BlockchainChain, LinkBlockchainAddressInput } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

interface BlockchainAddressRow {
  id: string;
  user_id: string;
  chain: BlockchainChain;
  address: string;
  is_primary: boolean;
  verified_at: Date | null;
  label: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapRowToAddress(row: BlockchainAddressRow): BlockchainAddress {
  return {
    id: row.id,
    userId: row.user_id,
    chain: row.chain,
    address: row.address,
    isPrimary: row.is_primary,
    verifiedAt: row.verified_at,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BlockchainAddressRepository {
  async create(
    userId: string,
    input: LinkBlockchainAddressInput,
    verified: boolean = false
  ): Promise<BlockchainAddress> {
    return transaction(async (client: PoolClient) => {
      const existingCount = await client.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM blockchain_addresses WHERE user_id = $1',
        [userId]
      );
      const isPrimary = parseInt(existingCount.rows[0].count, 10) === 0;

      const id = uuidv4();
      const verifiedAt = verified ? new Date() : null;

      const result = await client.query<BlockchainAddressRow>(
        `INSERT INTO blockchain_addresses (
          id, user_id, chain, address, is_primary, verified_at, label
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          id,
          userId,
          input.chain,
          input.address.toLowerCase(),
          isPrimary,
          verifiedAt,
          input.label ?? null,
        ]
      );

      logger.info('Blockchain address linked', {
        userId,
        chain: input.chain,
        address: input.address,
      });

      return mapRowToAddress(result.rows[0]);
    });
  }

  async findById(id: string): Promise<BlockchainAddress | null> {
    const result = await query<BlockchainAddressRow>(
      'SELECT * FROM blockchain_addresses WHERE id = $1',
      [id]
    );
    return result.rows[0] ? mapRowToAddress(result.rows[0]) : null;
  }

  async findByUserIdAndAddress(
    userId: string,
    chain: BlockchainChain,
    address: string
  ): Promise<BlockchainAddress | null> {
    const result = await query<BlockchainAddressRow>(
      `SELECT * FROM blockchain_addresses 
       WHERE user_id = $1 AND chain = $2 AND address = $3`,
      [userId, chain, address.toLowerCase()]
    );
    return result.rows[0] ? mapRowToAddress(result.rows[0]) : null;
  }

  async findByAddress(
    chain: BlockchainChain,
    address: string
  ): Promise<BlockchainAddress | null> {
    const result = await query<BlockchainAddressRow>(
      'SELECT * FROM blockchain_addresses WHERE chain = $1 AND address = $2',
      [chain, address.toLowerCase()]
    );
    return result.rows[0] ? mapRowToAddress(result.rows[0]) : null;
  }

  async findAllByUserId(userId: string): Promise<BlockchainAddress[]> {
    const result = await query<BlockchainAddressRow>(
      `SELECT * FROM blockchain_addresses 
       WHERE user_id = $1 
       ORDER BY is_primary DESC, created_at ASC`,
      [userId]
    );
    return result.rows.map(mapRowToAddress);
  }

  async findPrimaryByUserId(userId: string): Promise<BlockchainAddress | null> {
    const result = await query<BlockchainAddressRow>(
      'SELECT * FROM blockchain_addresses WHERE user_id = $1 AND is_primary = true',
      [userId]
    );
    return result.rows[0] ? mapRowToAddress(result.rows[0]) : null;
  }

  async setPrimary(userId: string, addressId: string): Promise<BlockchainAddress | null> {
    return transaction(async (client: PoolClient) => {
      await client.query(
        `UPDATE blockchain_addresses 
         SET is_primary = false, updated_at = NOW()
         WHERE user_id = $1 AND is_primary = true`,
        [userId]
      );

      const result = await client.query<BlockchainAddressRow>(
        `UPDATE blockchain_addresses 
         SET is_primary = true, updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [addressId, userId]
      );

      if (result.rows[0]) {
        logger.info('Primary address updated', { userId, addressId });
        return mapRowToAddress(result.rows[0]);
      }
      return null;
    });
  }

  async updateLabel(
    userId: string,
    addressId: string,
    label: string | null
  ): Promise<BlockchainAddress | null> {
    const result = await query<BlockchainAddressRow>(
      `UPDATE blockchain_addresses 
       SET label = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [label, addressId, userId]
    );
    return result.rows[0] ? mapRowToAddress(result.rows[0]) : null;
  }

  async verify(userId: string, addressId: string): Promise<BlockchainAddress | null> {
    const result = await query<BlockchainAddressRow>(
      `UPDATE blockchain_addresses 
       SET verified_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [addressId, userId]
    );
    if (result.rows[0]) {
      logger.info('Blockchain address verified', { userId, addressId });
      return mapRowToAddress(result.rows[0]);
    }
    return null;
  }

  async delete(userId: string, addressId: string): Promise<boolean> {
    return transaction(async (client: PoolClient) => {
      const addressResult = await client.query<BlockchainAddressRow>(
        'SELECT * FROM blockchain_addresses WHERE id = $1 AND user_id = $2',
        [addressId, userId]
      );

      if (!addressResult.rows[0]) {
        return false;
      }

      const wasPrimary = addressResult.rows[0].is_primary;

      await client.query(
        'DELETE FROM blockchain_addresses WHERE id = $1 AND user_id = $2',
        [addressId, userId]
      );

      if (wasPrimary) {
        await client.query(
          `UPDATE blockchain_addresses 
           SET is_primary = true, updated_at = NOW()
           WHERE user_id = $1 
           AND id = (
             SELECT id FROM blockchain_addresses 
             WHERE user_id = $1 
             ORDER BY created_at ASC 
             LIMIT 1
           )`,
          [userId]
        );
      }

      logger.info('Blockchain address unlinked', { userId, addressId });
      return true;
    });
  }

  async deleteAllByUserId(userId: string): Promise<number> {
    const result = await query(
      'DELETE FROM blockchain_addresses WHERE user_id = $1',
      [userId]
    );
    return result.rowCount ?? 0;
  }

  async countByUserId(userId: string): Promise<number> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM blockchain_addresses WHERE user_id = $1',
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async addressExists(chain: BlockchainChain, address: string): Promise<boolean> {
    const result = await query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM blockchain_addresses WHERE chain = $1 AND address = $2
      ) as exists`,
      [chain, address.toLowerCase()]
    );
    return result.rows[0].exists;
  }
}

export const blockchainAddressRepository = new BlockchainAddressRepository();
