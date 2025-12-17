export type TenantStatus = 'active' | 'suspended' | 'pending' | 'archived';
export type TenantPlan = 'free' | 'starter' | 'professional' | 'enterprise';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  status: TenantStatus;
  plan: TenantPlan;
  ownerId: string;
  settings: TenantSettings;
  limits: TenantLimits;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  suspendedAt?: Date;
  suspendedReason?: string;
}

export interface TenantSettings {
  theme?: {
    primaryColor?: string;
    logoUrl?: string;
    faviconUrl?: string;
  };
  features: {
    nftMarketplace: boolean;
    socialFeatures: boolean;
    analytics: boolean;
    customDomain: boolean;
    apiAccess: boolean;
    webhooks: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    webhookUrl?: string;
  };
  security: {
    mfaRequired: boolean;
    ipWhitelist?: string[];
    sessionTimeout: number;
  };
}

export interface TenantLimits {
  maxUsers: number;
  maxStorage: number;
  maxApiCalls: number;
  maxNfts: number;
  maxTransactions: number;
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: TenantRole;
  permissions: TenantPermission[];
  invitedBy?: string;
  joinedAt: Date;
  lastActiveAt?: Date;
}

export type TenantRole = 'owner' | 'admin' | 'member' | 'viewer';

export type TenantPermission =
  | 'manage:tenant'
  | 'manage:members'
  | 'manage:settings'
  | 'view:analytics'
  | 'manage:content'
  | 'manage:nfts'
  | 'manage:billing';

export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  role: TenantRole;
  invitedBy: string;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  domain?: string;
  plan?: TenantPlan;
  ownerId: string;
  settings?: Partial<TenantSettings>;
}

export interface UpdateTenantInput {
  name?: string;
  domain?: string;
  status?: TenantStatus;
  plan?: TenantPlan;
  settings?: Partial<TenantSettings>;
  limits?: Partial<TenantLimits>;
}

export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  features: {
    nftMarketplace: true,
    socialFeatures: true,
    analytics: false,
    customDomain: false,
    apiAccess: false,
    webhooks: false,
  },
  notifications: {
    emailEnabled: true,
  },
  security: {
    mfaRequired: false,
    sessionTimeout: 86400,
  },
};

export const PLAN_LIMITS: Record<TenantPlan, TenantLimits> = {
  free: {
    maxUsers: 5,
    maxStorage: 1073741824,
    maxApiCalls: 1000,
    maxNfts: 100,
    maxTransactions: 100,
  },
  starter: {
    maxUsers: 25,
    maxStorage: 10737418240,
    maxApiCalls: 10000,
    maxNfts: 1000,
    maxTransactions: 1000,
  },
  professional: {
    maxUsers: 100,
    maxStorage: 107374182400,
    maxApiCalls: 100000,
    maxNfts: 10000,
    maxTransactions: 10000,
  },
  enterprise: {
    maxUsers: -1,
    maxStorage: -1,
    maxApiCalls: -1,
    maxNfts: -1,
    maxTransactions: -1,
  },
};

export const ROLE_PERMISSIONS: Record<TenantRole, TenantPermission[]> = {
  owner: ['manage:tenant', 'manage:members', 'manage:settings', 'view:analytics', 'manage:content', 'manage:nfts', 'manage:billing'],
  admin: ['manage:members', 'manage:settings', 'view:analytics', 'manage:content', 'manage:nfts'],
  member: ['view:analytics', 'manage:content', 'manage:nfts'],
  viewer: ['view:analytics'],
};
