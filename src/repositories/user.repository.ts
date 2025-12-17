import { PoolClient } from 'pg';
import { query, transaction } from '../config/database';
import {
  UserProfile,
  CreateUserProfileInput,
  UpdateUserProfileInput,
  KycStatus,
  KycStatusUpdate,
  KycHistoryEntry,
  PaginationParams,
  PaginatedResult,
  DEFAULT_USER_PREFERENCES,
  UserPreferences,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

interface UserRow {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  email_verified: boolean;
  email_verification_token: string | null;
  email_verification_expires: Date | null;
  kyc_status: KycStatus;
  kyc_verified_at: Date | null;
  kyc_provider: string | null;
  kyc_reference: string | null;
  preferences: UserPreferences;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  anonymized_at: Date | null;
}

interface KycHistoryRow {
  id: string;
  user_id: string;
  status: KycStatus;
  provider: string | null;
  reference: string | null;
  created_at: Date;
}

function mapRowToUser(row: UserRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    emailVerified: row.email_verified,
    emailVerificationToken: row.email_verification_token,
    emailVerificationExpires: row.email_verification_expires,
    kycStatus: row.kyc_status,
    kycVerifiedAt: row.kyc_verified_at,
    kycProvider: row.kyc_provider,
    kycReference: row.kyc_reference,
    preferences: row.preferences,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    anonymizedAt: row.anonymized_at,
  };
}

function mapRowToKycHistory(row: KycHistoryRow): KycHistoryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    provider: row.provider,
    reference: row.reference,
    createdAt: row.created_at,
  };
}

export class UserRepository {
  async create(input: CreateUserProfileInput): Promise<UserProfile> {
    const id = uuidv4();
    const verificationToken = uuidv4();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await query<UserRow>(
      `INSERT INTO users (
        id, email, username, display_name, bio, 
        email_verification_token, email_verification_expires, preferences
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        id,
        input.email.toLowerCase(),
        input.username,
        input.displayName ?? null,
        input.bio ?? null,
        verificationToken,
        verificationExpires,
        JSON.stringify(DEFAULT_USER_PREFERENCES),
      ]
    );

    logger.info('User created', { userId: id, email: input.email });
    return mapRowToUser(result.rows[0]);
  }

  async findById(id: string): Promise<UserProfile | null> {
    const result = await query<UserRow>(
      'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    const result = await query<UserRow>(
      'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase()]
    );
    return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
  }

  async findByUsername(username: string): Promise<UserProfile | null> {
    const result = await query<UserRow>(
      'SELECT * FROM users WHERE username = $1 AND deleted_at IS NULL',
      [username]
    );
    return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
  }

  async findByVerificationToken(token: string): Promise<UserProfile | null> {
    const result = await query<UserRow>(
      `SELECT * FROM users 
       WHERE email_verification_token = $1 
       AND email_verification_expires > NOW()
       AND deleted_at IS NULL`,
      [token]
    );
    return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
  }

  async update(id: string, input: UpdateUserProfileInput): Promise<UserProfile | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.username !== undefined) {
      updates.push(`username = $${paramIndex++}`);
      values.push(input.username);
    }
    if (input.displayName !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      values.push(input.displayName);
    }
    if (input.bio !== undefined) {
      updates.push(`bio = $${paramIndex++}`);
      values.push(input.bio);
    }
    if (input.preferences !== undefined) {
      updates.push(`preferences = preferences || $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(input.preferences));
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query<UserRow>(
      `UPDATE users SET ${updates.join(', ')} 
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows[0]) {
      logger.info('User updated', { userId: id });
      return mapRowToUser(result.rows[0]);
    }
    return null;
  }

  async updateAvatar(id: string, avatarUrl: string): Promise<UserProfile | null> {
    const result = await query<UserRow>(
      `UPDATE users SET avatar_url = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [avatarUrl, id]
    );
    return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
  }

  async verifyEmail(id: string): Promise<UserProfile | null> {
    const result = await query<UserRow>(
      `UPDATE users SET 
        email_verified = true, 
        email_verification_token = NULL,
        email_verification_expires = NULL,
        updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id]
    );
    if (result.rows[0]) {
      logger.info('Email verified', { userId: id });
      return mapRowToUser(result.rows[0]);
    }
    return null;
  }

  async regenerateVerificationToken(id: string): Promise<UserProfile | null> {
    const verificationToken = uuidv4();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await query<UserRow>(
      `UPDATE users SET 
        email_verification_token = $1,
        email_verification_expires = $2,
        updated_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL AND email_verified = false
       RETURNING *`,
      [verificationToken, verificationExpires, id]
    );
    return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
  }

  async updateKycStatus(id: string, update: KycStatusUpdate): Promise<UserProfile | null> {
    return transaction(async (client: PoolClient) => {
      const historyId = uuidv4();
      await client.query(
        `INSERT INTO kyc_history (id, user_id, status, provider, reference)
         VALUES ($1, $2, $3, $4, $5)`,
        [historyId, id, update.status, update.provider ?? null, update.reference ?? null]
      );

      const verifiedAt = update.status === 'verified' ? new Date() : null;
      const result = await client.query<UserRow>(
        `UPDATE users SET 
          kyc_status = $1,
          kyc_verified_at = $2,
          kyc_provider = $3,
          kyc_reference = $4,
          updated_at = NOW()
         WHERE id = $5 AND deleted_at IS NULL
         RETURNING *`,
        [update.status, verifiedAt, update.provider ?? null, update.reference ?? null, id]
      );

      if (result.rows[0]) {
        logger.info('KYC status updated', { userId: id, status: update.status });
        return mapRowToUser(result.rows[0]);
      }
      return null;
    });
  }

  async getKycHistory(userId: string): Promise<KycHistoryEntry[]> {
    const result = await query<KycHistoryRow>(
      'SELECT * FROM kyc_history WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows.map(mapRowToKycHistory);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await query(
      `UPDATE users SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (result.rowCount && result.rowCount > 0) {
      logger.info('User soft deleted', { userId: id });
      return true;
    }
    return false;
  }

  async anonymize(id: string): Promise<boolean> {
    return transaction(async (client: PoolClient) => {
      const anonymizedEmail = `anonymized_${uuidv4()}@deleted.gameverse.com`;
      const anonymizedUsername = `deleted_user_${uuidv4().substring(0, 8)}`;

      const result = await client.query(
        `UPDATE users SET 
          email = $1,
          username = $2,
          display_name = NULL,
          avatar_url = NULL,
          bio = NULL,
          email_verified = false,
          email_verification_token = NULL,
          email_verification_expires = NULL,
          kyc_status = 'none',
          kyc_verified_at = NULL,
          kyc_provider = NULL,
          kyc_reference = NULL,
          preferences = $3,
          deleted_at = NOW(),
          anonymized_at = NOW(),
          updated_at = NOW()
         WHERE id = $4 AND anonymized_at IS NULL`,
        [anonymizedEmail, anonymizedUsername, JSON.stringify(DEFAULT_USER_PREFERENCES), id]
      );

      await client.query(
        'DELETE FROM blockchain_addresses WHERE user_id = $1',
        [id]
      );

      await client.query(
        'DELETE FROM kyc_history WHERE user_id = $1',
        [id]
      );

      if (result.rowCount && result.rowCount > 0) {
        logger.info('User anonymized (right to forget)', { userId: id });
        return true;
      }
      return false;
    });
  }

  async findAll(params: PaginationParams): Promise<PaginatedResult<UserProfile>> {
    const offset = (params.page - 1) * params.limit;

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL'
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query<UserRow>(
      `SELECT * FROM users 
       WHERE deleted_at IS NULL 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [params.limit, offset]
    );

    return {
      data: result.rows.map(mapRowToUser),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async exists(id: string): Promise<boolean> {
    const result = await query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL) as exists',
      [id]
    );
    return result.rows[0].exists;
  }

  async emailExists(email: string): Promise<boolean> {
    const result = await query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND deleted_at IS NULL) as exists',
      [email.toLowerCase()]
    );
    return result.rows[0].exists;
  }

  async usernameExists(username: string): Promise<boolean> {
    const result = await query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM users WHERE username = $1 AND deleted_at IS NULL) as exists',
      [username]
    );
    return result.rows[0].exists;
  }
}

export const userRepository = new UserRepository();
