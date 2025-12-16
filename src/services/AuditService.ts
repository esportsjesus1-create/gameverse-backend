import { query } from '../db/pool';
import { AuditLog, PaginationOptions, PaginatedResult } from '../types';
import { config } from '../config';

interface AuditLogInput {
  entityType: string;
  entityId: string;
  action: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function mapRowToAuditLog(row: {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}): AuditLog {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    oldValue: row.old_value,
    newValue: row.new_value,
    userId: row.user_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

export class AuditService {
  async log(input: AuditLogInput): Promise<AuditLog> {
    if (!config.audit.enabled) {
      return {
        id: '',
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        oldValue: input.oldValue,
        newValue: input.newValue,
        userId: input.userId,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        createdAt: new Date(),
      };
    }
    
    const result = await query<{
      id: string;
      entity_type: string;
      entity_id: string;
      action: string;
      old_value: Record<string, unknown> | null;
      new_value: Record<string, unknown> | null;
      user_id: string;
      ip_address: string | null;
      user_agent: string | null;
      created_at: Date;
    }>(
      `INSERT INTO audit_logs (entity_type, entity_id, action, old_value, new_value, user_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.entityType,
        input.entityId,
        input.action,
        input.oldValue ? JSON.stringify(input.oldValue) : null,
        input.newValue ? JSON.stringify(input.newValue) : null,
        input.userId,
        input.ipAddress || null,
        input.userAgent || null,
      ]
    );
    
    return mapRowToAuditLog(result.rows[0]);
  }

  async getLogsForEntity(
    entityType: string,
    entityId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<AuditLog>> {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const offset = (page - 1) * limit;
    
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) FROM audit_logs WHERE entity_type = $1 AND entity_id = $2',
      [entityType, entityId]
    );
    const total = parseInt(countResult.rows[0].count, 10);
    
    const result = await query<{
      id: string;
      entity_type: string;
      entity_id: string;
      action: string;
      old_value: Record<string, unknown> | null;
      new_value: Record<string, unknown> | null;
      user_id: string;
      ip_address: string | null;
      user_agent: string | null;
      created_at: Date;
    }>(
      `SELECT * FROM audit_logs 
       WHERE entity_type = $1 AND entity_id = $2 
       ORDER BY created_at DESC 
       LIMIT $3 OFFSET $4`,
      [entityType, entityId, limit, offset]
    );
    
    return {
      data: result.rows.map(mapRowToAuditLog),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getLogsByUser(
    userId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<AuditLog>> {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const offset = (page - 1) * limit;
    
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) FROM audit_logs WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].count, 10);
    
    const result = await query<{
      id: string;
      entity_type: string;
      entity_id: string;
      action: string;
      old_value: Record<string, unknown> | null;
      new_value: Record<string, unknown> | null;
      user_id: string;
      ip_address: string | null;
      user_agent: string | null;
      created_at: Date;
    }>(
      `SELECT * FROM audit_logs 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    return {
      data: result.rows.map(mapRowToAuditLog),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getRecentLogs(options?: PaginationOptions): Promise<PaginatedResult<AuditLog>> {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const offset = (page - 1) * limit;
    
    const countResult = await query<{ count: string }>('SELECT COUNT(*) FROM audit_logs');
    const total = parseInt(countResult.rows[0].count, 10);
    
    const result = await query<{
      id: string;
      entity_type: string;
      entity_id: string;
      action: string;
      old_value: Record<string, unknown> | null;
      new_value: Record<string, unknown> | null;
      user_id: string;
      ip_address: string | null;
      user_agent: string | null;
      created_at: Date;
    }>(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    
    return {
      data: result.rows.map(mapRowToAuditLog),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async cleanupOldLogs(): Promise<number> {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - config.audit.retentionDays);
    
    const result = await query(
      'DELETE FROM audit_logs WHERE created_at < $1',
      [retentionDate]
    );
    
    return result.rowCount || 0;
  }
}

export const auditService = new AuditService();
