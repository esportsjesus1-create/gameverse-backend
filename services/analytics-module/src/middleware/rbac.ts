/**
 * GameVerse Analytics Module - RBAC Middleware
 * Role-Based Access Control with permissions
 */

import { Request, Response, NextFunction } from 'express';
import { logger, LogEventType } from '../utils/logger';
import { PermissionError, AnalyticsErrorCode } from '../utils/errors';
import { UserRole, Permission, AnalyticsUser } from '../types';

// Role to permissions mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // All permissions
    Permission.METRICS_READ,
    Permission.METRICS_WRITE,
    Permission.METRICS_DELETE,
    Permission.METRICS_EXPORT,
    Permission.EVENTS_READ,
    Permission.EVENTS_WRITE,
    Permission.EVENTS_DELETE,
    Permission.EVENTS_EXPORT,
    Permission.QUERY_BASIC,
    Permission.QUERY_ADVANCED,
    Permission.QUERY_EXPORT,
    Permission.REPORTS_READ,
    Permission.REPORTS_CREATE,
    Permission.REPORTS_SCHEDULE,
    Permission.ADMIN_USERS,
    Permission.ADMIN_CONFIG,
    Permission.ADMIN_AUDIT,
  ],
  [UserRole.ANALYST]: [
    // Read, write, and export permissions
    Permission.METRICS_READ,
    Permission.METRICS_WRITE,
    Permission.METRICS_EXPORT,
    Permission.EVENTS_READ,
    Permission.EVENTS_WRITE,
    Permission.EVENTS_EXPORT,
    Permission.QUERY_BASIC,
    Permission.QUERY_ADVANCED,
    Permission.QUERY_EXPORT,
    Permission.REPORTS_READ,
    Permission.REPORTS_CREATE,
    Permission.REPORTS_SCHEDULE,
  ],
  [UserRole.VIEWER]: [
    // Read-only permissions
    Permission.METRICS_READ,
    Permission.EVENTS_READ,
    Permission.QUERY_BASIC,
    Permission.REPORTS_READ,
  ],
};

// Extended Request interface with user
export interface AuthenticatedRequest extends Request {
  user?: AnalyticsUser;
  requestId?: string;
}

/**
 * Get permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(user: AnalyticsUser | undefined, permission: Permission): boolean {
  if (!user) {
    return false;
  }

  // Check user's explicit permissions first
  if (user.permissions.includes(permission)) {
    return true;
  }

  // Check role-based permissions
  const rolePermissions = getRolePermissions(user.role);
  return rolePermissions.includes(permission);
}

/**
 * Check if a user has all specified permissions
 */
export function hasAllPermissions(user: AnalyticsUser | undefined, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(user, permission));
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(user: AnalyticsUser | undefined, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

/**
 * RBAC middleware factory - requires specific permission(s)
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      const error = new PermissionError(
        AnalyticsErrorCode.PERMISSION_DENIED,
        'Authentication required',
        { requiredPermission: permissions.join(', ') }
      );

      logger.logSecurity(LogEventType.PERMISSION_DENIED, 'Unauthenticated access attempt', {
        path: req.path,
        method: req.method,
        requiredPermissions: permissions,
      });

      res.status(error.statusCode).json(error.toResponse(req.requestId, req.path));
      return;
    }

    const hasRequired = permissions.length === 1
      ? hasPermission(user, permissions[0])
      : hasAllPermissions(user, permissions);

    if (!hasRequired) {
      const error = new PermissionError(
        AnalyticsErrorCode.PERMISSION_INSUFFICIENT_ROLE,
        `Insufficient permissions. Required: ${permissions.join(', ')}`,
        {
          requiredPermission: permissions.join(', '),
          requiredRole: getMinimumRoleForPermissions(permissions),
        }
      );

      logger.logSecurity(LogEventType.PERMISSION_DENIED, 'Insufficient permissions', {
        userId: user.id,
        userRole: user.role,
        path: req.path,
        method: req.method,
        requiredPermissions: permissions,
        userPermissions: user.permissions,
      });

      res.status(error.statusCode).json(error.toResponse(req.requestId, req.path));
      return;
    }

    next();
  };
}

/**
 * RBAC middleware factory - requires any of the specified permissions
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      const error = new PermissionError(
        AnalyticsErrorCode.PERMISSION_DENIED,
        'Authentication required',
        { requiredPermission: permissions.join(' OR ') }
      );

      logger.logSecurity(LogEventType.PERMISSION_DENIED, 'Unauthenticated access attempt', {
        path: req.path,
        method: req.method,
        requiredPermissions: permissions,
      });

      res.status(error.statusCode).json(error.toResponse(req.requestId, req.path));
      return;
    }

    if (!hasAnyPermission(user, permissions)) {
      const error = new PermissionError(
        AnalyticsErrorCode.PERMISSION_INSUFFICIENT_ROLE,
        `Insufficient permissions. Required one of: ${permissions.join(', ')}`,
        {
          requiredPermission: permissions.join(' OR '),
          requiredRole: getMinimumRoleForPermissions(permissions),
        }
      );

      logger.logSecurity(LogEventType.PERMISSION_DENIED, 'Insufficient permissions', {
        userId: user.id,
        userRole: user.role,
        path: req.path,
        method: req.method,
        requiredPermissions: permissions,
        userPermissions: user.permissions,
      });

      res.status(error.statusCode).json(error.toResponse(req.requestId, req.path));
      return;
    }

    next();
  };
}

/**
 * RBAC middleware factory - requires specific role(s)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      const error = new PermissionError(
        AnalyticsErrorCode.PERMISSION_DENIED,
        'Authentication required',
        { requiredRole: roles.join(' OR ') }
      );

      logger.logSecurity(LogEventType.PERMISSION_DENIED, 'Unauthenticated access attempt', {
        path: req.path,
        method: req.method,
        requiredRoles: roles,
      });

      res.status(error.statusCode).json(error.toResponse(req.requestId, req.path));
      return;
    }

    if (!roles.includes(user.role)) {
      const error = new PermissionError(
        AnalyticsErrorCode.PERMISSION_INSUFFICIENT_ROLE,
        `Insufficient role. Required: ${roles.join(' OR ')}`,
        { requiredRole: roles.join(' OR ') }
      );

      logger.logSecurity(LogEventType.PERMISSION_DENIED, 'Insufficient role', {
        userId: user.id,
        userRole: user.role,
        path: req.path,
        method: req.method,
        requiredRoles: roles,
      });

      res.status(error.statusCode).json(error.toResponse(req.requestId, req.path));
      return;
    }

    next();
  };
}

/**
 * Get the minimum role required for a set of permissions
 */
function getMinimumRoleForPermissions(permissions: Permission[]): string {
  // Check if VIEWER role has all permissions
  const viewerPermissions = ROLE_PERMISSIONS[UserRole.VIEWER];
  if (permissions.every((p) => viewerPermissions.includes(p))) {
    return UserRole.VIEWER;
  }

  // Check if ANALYST role has all permissions
  const analystPermissions = ROLE_PERMISSIONS[UserRole.ANALYST];
  if (permissions.every((p) => analystPermissions.includes(p))) {
    return UserRole.ANALYST;
  }

  // Default to ADMIN
  return UserRole.ADMIN;
}

/**
 * Check if user can access a specific resource
 */
export function canAccessResource(
  user: AnalyticsUser | undefined,
  resourceType: string,
  resourceOwnerId?: string,
  action: 'read' | 'write' | 'delete' = 'read'
): boolean {
  if (!user) {
    return false;
  }

  // Admins can access everything
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Check if user owns the resource
  if (resourceOwnerId && user.id === resourceOwnerId) {
    return true;
  }

  // Check permissions based on resource type and action
  const permissionMap: Record<string, Record<string, Permission>> = {
    metrics: {
      read: Permission.METRICS_READ,
      write: Permission.METRICS_WRITE,
      delete: Permission.METRICS_DELETE,
    },
    events: {
      read: Permission.EVENTS_READ,
      write: Permission.EVENTS_WRITE,
      delete: Permission.EVENTS_DELETE,
    },
    reports: {
      read: Permission.REPORTS_READ,
      write: Permission.REPORTS_CREATE,
      delete: Permission.REPORTS_CREATE,
    },
  };

  const permission = permissionMap[resourceType]?.[action];
  if (!permission) {
    return false;
  }

  return hasPermission(user, permission);
}

/**
 * Resource access middleware factory
 */
export function requireResourceAccess(
  resourceType: string,
  action: 'read' | 'write' | 'delete' = 'read',
  getResourceOwnerId?: (req: AuthenticatedRequest) => string | undefined
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    const resourceOwnerId = getResourceOwnerId?.(req);

    if (!canAccessResource(user, resourceType, resourceOwnerId, action)) {
      const error = new PermissionError(
        AnalyticsErrorCode.PERMISSION_RESOURCE_RESTRICTED,
        `Access denied to ${resourceType} resource`,
        { requiredPermission: `${resourceType}:${action}` }
      );

      logger.logSecurity(LogEventType.PERMISSION_DENIED, 'Resource access denied', {
        userId: user?.id,
        userRole: user?.role,
        resourceType,
        action,
        path: req.path,
        method: req.method,
      });

      res.status(error.statusCode).json(error.toResponse(req.requestId, req.path));
      return;
    }

    next();
  };
}

export default {
  requirePermission,
  requireAnyPermission,
  requireRole,
  requireResourceAccess,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  canAccessResource,
  getRolePermissions,
};
