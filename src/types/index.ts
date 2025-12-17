export type AuditAction = 
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'IMPORT'
  | 'PERMISSION_CHANGE'
  | 'CONFIG_CHANGE'
  | 'SYSTEM_EVENT';

export type AuditCategory =
  | 'USER'
  | 'AUTH'
  | 'DATA'
  | 'SYSTEM'
  | 'SECURITY'
  | 'COMPLIANCE'
  | 'FINANCIAL';

export type ComplianceStandard = 'GDPR' | 'SOC2' | 'HIPAA' | 'PCI_DSS';

export interface AuditLog {
  id: string;
  timestamp: Date;
  action: AuditAction;
  category: AuditCategory;
  actorId: string;
  actorType: 'user' | 'system' | 'service';
  actorIp?: string;
  actorUserAgent?: string;
  resourceType: string;
  resourceId: string;
  tenantId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  hash: string;
  previousHash?: string;
  complianceTags?: ComplianceStandard[];
}

export interface AuditLogInput {
  action: AuditAction;
  category: AuditCategory;
  actorId: string;
  actorType: 'user' | 'system' | 'service';
  actorIp?: string;
  actorUserAgent?: string;
  resourceType: string;
  resourceId: string;
  tenantId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  complianceTags?: ComplianceStandard[];
}

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  action?: AuditAction;
  category?: AuditCategory;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  tenantId?: string;
  complianceTag?: ComplianceStandard;
  page?: number;
  limit?: number;
}

export interface ComplianceReport {
  id: string;
  standard: ComplianceStandard;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  tenantId?: string;
  summary: {
    totalEvents: number;
    eventsByCategory: Record<AuditCategory, number>;
    eventsByAction: Record<AuditAction, number>;
    uniqueActors: number;
    dataAccessEvents: number;
    securityEvents: number;
  };
  findings: ComplianceFinding[];
  exportFormat: 'json' | 'csv' | 'pdf';
}

export interface ComplianceFinding {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  recommendation: string;
  affectedResources: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
