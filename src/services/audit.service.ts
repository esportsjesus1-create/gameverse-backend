import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { config } from '../config';
import {
  AuditLog,
  AuditLogInput,
  AuditQuery,
  PaginatedResult,
  ComplianceReport,
  ComplianceStandard,
  ComplianceFinding,
  AuditCategory,
  AuditAction,
} from '../types';

const auditLogs: AuditLog[] = [];
let lastHash: string | undefined;

export class AuditService {
  private readonly hashSecret: string;

  constructor() {
    this.hashSecret = config.hashSecret;
  }

  async createLog(input: AuditLogInput): Promise<AuditLog> {
    const id = uuidv4();
    const timestamp = new Date();

    const logData = {
      id,
      timestamp: timestamp.toISOString(),
      ...input,
      previousHash: lastHash,
    };

    const hash = this.generateHash(logData);

    const auditLog: AuditLog = {
      id,
      timestamp,
      action: input.action,
      category: input.category,
      actorId: input.actorId,
      actorType: input.actorType,
      actorIp: input.actorIp,
      actorUserAgent: input.actorUserAgent,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      tenantId: input.tenantId,
      description: input.description,
      metadata: input.metadata,
      previousState: input.previousState,
      newState: input.newState,
      hash,
      previousHash: lastHash,
      complianceTags: input.complianceTags,
    };

    auditLogs.push(auditLog);
    lastHash = hash;

    return auditLog;
  }

  async queryLogs(query: AuditQuery): Promise<PaginatedResult<AuditLog>> {
    const page = query.page || 1;
    const limit = query.limit || 50;

    let filtered = [...auditLogs];

    if (query.startDate) {
      filtered = filtered.filter(log => log.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      filtered = filtered.filter(log => log.timestamp <= query.endDate!);
    }
    if (query.action) {
      filtered = filtered.filter(log => log.action === query.action);
    }
    if (query.category) {
      filtered = filtered.filter(log => log.category === query.category);
    }
    if (query.actorId) {
      filtered = filtered.filter(log => log.actorId === query.actorId);
    }
    if (query.resourceType) {
      filtered = filtered.filter(log => log.resourceType === query.resourceType);
    }
    if (query.resourceId) {
      filtered = filtered.filter(log => log.resourceId === query.resourceId);
    }
    if (query.tenantId) {
      filtered = filtered.filter(log => log.tenantId === query.tenantId);
    }
    if (query.complianceTag) {
      filtered = filtered.filter(log => 
        log.complianceTags?.includes(query.complianceTag!)
      );
    }

    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return { data, total, page, limit, totalPages };
  }

  async getLogById(id: string): Promise<AuditLog | null> {
    return auditLogs.find(log => log.id === id) || null;
  }

  async verifyIntegrity(startId?: string, endId?: string): Promise<{ valid: boolean; invalidLogs: string[] }> {
    const invalidLogs: string[] = [];
    let startIndex = 0;
    let endIndex = auditLogs.length;

    if (startId) {
      startIndex = auditLogs.findIndex(log => log.id === startId);
      if (startIndex === -1) startIndex = 0;
    }
    if (endId) {
      endIndex = auditLogs.findIndex(log => log.id === endId);
      if (endIndex === -1) endIndex = auditLogs.length;
      else endIndex++;
    }

    for (let i = startIndex; i < endIndex; i++) {
      const log = auditLogs[i];
      const expectedPreviousHash = i > 0 ? auditLogs[i - 1].hash : undefined;

      if (log.previousHash !== expectedPreviousHash) {
        invalidLogs.push(log.id);
        continue;
      }

      const logData = {
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        action: log.action,
        category: log.category,
        actorId: log.actorId,
        actorType: log.actorType,
        actorIp: log.actorIp,
        actorUserAgent: log.actorUserAgent,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        tenantId: log.tenantId,
        description: log.description,
        metadata: log.metadata,
        previousState: log.previousState,
        newState: log.newState,
        previousHash: log.previousHash,
        complianceTags: log.complianceTags,
      };

      const calculatedHash = this.generateHash(logData);
      if (calculatedHash !== log.hash) {
        invalidLogs.push(log.id);
      }
    }

    return { valid: invalidLogs.length === 0, invalidLogs };
  }

  async generateComplianceReport(
    standard: ComplianceStandard,
    periodStart: Date,
    periodEnd: Date,
    tenantId?: string
  ): Promise<ComplianceReport> {
    const query: AuditQuery = {
      startDate: periodStart,
      endDate: periodEnd,
      tenantId,
      complianceTag: standard,
    };

    const { data: logs } = await this.queryLogs({ ...query, limit: 100000 });

    const eventsByCategory: Record<AuditCategory, number> = {
      USER: 0, AUTH: 0, DATA: 0, SYSTEM: 0, SECURITY: 0, COMPLIANCE: 0, FINANCIAL: 0,
    };
    const eventsByAction: Record<AuditAction, number> = {
      CREATE: 0, READ: 0, UPDATE: 0, DELETE: 0, LOGIN: 0, LOGOUT: 0,
      EXPORT: 0, IMPORT: 0, PERMISSION_CHANGE: 0, CONFIG_CHANGE: 0, SYSTEM_EVENT: 0,
    };
    const uniqueActors = new Set<string>();

    for (const log of logs) {
      eventsByCategory[log.category]++;
      eventsByAction[log.action]++;
      uniqueActors.add(log.actorId);
    }

    const findings: ComplianceFinding[] = this.analyzeForFindings(logs, standard);

    return {
      id: uuidv4(),
      standard,
      generatedAt: new Date(),
      periodStart,
      periodEnd,
      tenantId,
      summary: {
        totalEvents: logs.length,
        eventsByCategory,
        eventsByAction,
        uniqueActors: uniqueActors.size,
        dataAccessEvents: eventsByCategory.DATA,
        securityEvents: eventsByCategory.SECURITY,
      },
      findings,
      exportFormat: 'json',
    };
  }

  private analyzeForFindings(logs: AuditLog[], standard: ComplianceStandard): ComplianceFinding[] {
    const findings: ComplianceFinding[] = [];

    if (standard === 'GDPR') {
      const dataExports = logs.filter(l => l.action === 'EXPORT' && l.category === 'DATA');
      if (dataExports.length > 100) {
        findings.push({
          severity: 'medium',
          category: 'Data Export',
          description: `High volume of data exports detected (${dataExports.length})`,
          recommendation: 'Review data export policies and ensure proper authorization',
          affectedResources: dataExports.slice(0, 10).map(l => l.resourceId),
        });
      }
    }

    if (standard === 'SOC2') {
      const configChanges = logs.filter(l => l.action === 'CONFIG_CHANGE');
      const unauthorizedChanges = configChanges.filter(l => l.actorType !== 'user');
      if (unauthorizedChanges.length > 0) {
        findings.push({
          severity: 'high',
          category: 'Configuration Management',
          description: `System-initiated configuration changes detected (${unauthorizedChanges.length})`,
          recommendation: 'Review automated configuration changes for compliance',
          affectedResources: unauthorizedChanges.map(l => l.resourceId),
        });
      }
    }

    return findings;
  }

  private generateHash(data: Record<string, unknown>): string {
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    return CryptoJS.HmacSHA256(jsonString, this.hashSecret).toString();
  }
}

export const auditService = new AuditService();
