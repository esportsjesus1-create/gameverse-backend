import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import {
  Tenant,
  TenantMember,
  TenantInvitation,
  CreateTenantInput,
  UpdateTenantInput,
  TenantRole,
  DEFAULT_TENANT_SETTINGS,
  PLAN_LIMITS,
  ROLE_PERMISSIONS,
} from '../types';

const tenants: Map<string, Tenant> = new Map();
const members: Map<string, TenantMember> = new Map();
const invitations: Map<string, TenantInvitation> = new Map();

export class TenantService {
  async createTenant(input: CreateTenantInput): Promise<Tenant> {
    const existingBySlug = Array.from(tenants.values()).find(t => t.slug === input.slug);
    if (existingBySlug) {
      throw new Error('Tenant slug already exists');
    }

    if (input.domain) {
      const existingByDomain = Array.from(tenants.values()).find(t => t.domain === input.domain);
      if (existingByDomain) {
        throw new Error('Domain already in use');
      }
    }

    const plan = input.plan || 'free';
    const tenant: Tenant = {
      id: uuidv4(),
      name: input.name,
      slug: input.slug,
      domain: input.domain,
      status: 'active',
      plan,
      ownerId: input.ownerId,
      settings: { ...DEFAULT_TENANT_SETTINGS, ...input.settings },
      limits: PLAN_LIMITS[plan],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    tenants.set(tenant.id, tenant);

    await this.addMember(tenant.id, input.ownerId, 'owner');

    return tenant;
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    return tenants.get(id) || null;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    return Array.from(tenants.values()).find(t => t.slug === slug) || null;
  }

  async getTenantByDomain(domain: string): Promise<Tenant | null> {
    return Array.from(tenants.values()).find(t => t.domain === domain) || null;
  }

  async updateTenant(id: string, input: UpdateTenantInput): Promise<Tenant | null> {
    const tenant = tenants.get(id);
    if (!tenant) return null;

    if (input.name) tenant.name = input.name;
    if (input.domain !== undefined) tenant.domain = input.domain;
    if (input.status) tenant.status = input.status;
    if (input.plan) {
      tenant.plan = input.plan;
      tenant.limits = { ...PLAN_LIMITS[input.plan], ...input.limits };
    }
    if (input.settings) {
      tenant.settings = { ...tenant.settings, ...input.settings };
    }
    if (input.limits) {
      tenant.limits = { ...tenant.limits, ...input.limits };
    }

    tenant.updatedAt = new Date();
    return tenant;
  }

  async suspendTenant(id: string, reason: string): Promise<Tenant | null> {
    const tenant = tenants.get(id);
    if (!tenant) return null;

    tenant.status = 'suspended';
    tenant.suspendedAt = new Date();
    tenant.suspendedReason = reason;
    tenant.updatedAt = new Date();

    return tenant;
  }

  async reactivateTenant(id: string): Promise<Tenant | null> {
    const tenant = tenants.get(id);
    if (!tenant) return null;

    tenant.status = 'active';
    tenant.suspendedAt = undefined;
    tenant.suspendedReason = undefined;
    tenant.updatedAt = new Date();

    return tenant;
  }

  async deleteTenant(id: string): Promise<boolean> {
    const tenant = tenants.get(id);
    if (!tenant) return false;

    for (const [memberId, member] of members.entries()) {
      if (member.tenantId === id) {
        members.delete(memberId);
      }
    }

    for (const [invId, inv] of invitations.entries()) {
      if (inv.tenantId === id) {
        invitations.delete(invId);
      }
    }

    tenants.delete(id);
    return true;
  }

  async addMember(tenantId: string, userId: string, role: TenantRole, invitedBy?: string): Promise<TenantMember> {
    const existing = Array.from(members.values()).find(
      m => m.tenantId === tenantId && m.userId === userId
    );
    if (existing) {
      throw new Error('User is already a member of this tenant');
    }

    const member: TenantMember = {
      id: uuidv4(),
      tenantId,
      userId,
      role,
      permissions: ROLE_PERMISSIONS[role],
      invitedBy,
      joinedAt: new Date(),
    };

    members.set(member.id, member);
    return member;
  }

  async removeMember(tenantId: string, userId: string): Promise<boolean> {
    const member = Array.from(members.values()).find(
      m => m.tenantId === tenantId && m.userId === userId
    );
    if (!member) return false;

    if (member.role === 'owner') {
      throw new Error('Cannot remove tenant owner');
    }

    members.delete(member.id);
    return true;
  }

  async updateMemberRole(tenantId: string, userId: string, role: TenantRole): Promise<TenantMember | null> {
    const member = Array.from(members.values()).find(
      m => m.tenantId === tenantId && m.userId === userId
    );
    if (!member) return null;

    if (member.role === 'owner' && role !== 'owner') {
      throw new Error('Cannot change owner role');
    }

    member.role = role;
    member.permissions = ROLE_PERMISSIONS[role];
    return member;
  }

  async getTenantMembers(tenantId: string): Promise<TenantMember[]> {
    return Array.from(members.values()).filter(m => m.tenantId === tenantId);
  }

  async getUserTenants(userId: string): Promise<Tenant[]> {
    const userMembers = Array.from(members.values()).filter(m => m.userId === userId);
    return userMembers
      .map(m => tenants.get(m.tenantId))
      .filter((t): t is Tenant => t !== undefined);
  }

  async createInvitation(tenantId: string, email: string, role: TenantRole, invitedBy: string): Promise<TenantInvitation> {
    const existing = Array.from(invitations.values()).find(
      i => i.tenantId === tenantId && i.email === email && !i.acceptedAt
    );
    if (existing) {
      throw new Error('Invitation already sent to this email');
    }

    const invitation: TenantInvitation = {
      id: uuidv4(),
      tenantId,
      email,
      role,
      invitedBy,
      token: uuidv4(),
      expiresAt: new Date(Date.now() + config.invitation.expiryHours * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    invitations.set(invitation.id, invitation);
    return invitation;
  }

  async acceptInvitation(token: string, userId: string): Promise<TenantMember> {
    const invitation = Array.from(invitations.values()).find(i => i.token === token);
    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    if (invitation.acceptedAt) {
      throw new Error('Invitation already accepted');
    }

    if (new Date() > invitation.expiresAt) {
      throw new Error('Invitation expired');
    }

    invitation.acceptedAt = new Date();

    return this.addMember(invitation.tenantId, userId, invitation.role, invitation.invitedBy);
  }

  async getTenantInvitations(tenantId: string): Promise<TenantInvitation[]> {
    return Array.from(invitations.values()).filter(
      i => i.tenantId === tenantId && !i.acceptedAt
    );
  }
}

export const tenantService = new TenantService();
