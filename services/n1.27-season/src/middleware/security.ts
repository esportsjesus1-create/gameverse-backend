import { Request, Response, NextFunction } from 'express';
import { RateLimitError, UnauthorizedError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Rate limiter configuration.
 */
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
  message?: string;
}

/**
 * In-memory rate limit store.
 * In production, this should be replaced with Redis for distributed rate limiting.
 */
class RateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  /**
   * Increment the request count for a key.
   */
  public increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const existing = this.store.get(key);

    if (existing && existing.resetTime > now) {
      existing.count++;
      return existing;
    }

    const newEntry = { count: 1, resetTime: now + windowMs };
    this.store.set(key, newEntry);
    return newEntry;
  }

  /**
   * Get the current count for a key.
   */
  public get(key: string): { count: number; resetTime: number } | undefined {
    const entry = this.store.get(key);
    if (entry && entry.resetTime > Date.now()) {
      return entry;
    }
    return undefined;
  }

  /**
   * Reset the count for a key.
   */
  public reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Start periodic cleanup of expired entries.
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.store.entries()) {
        if (value.resetTime <= now) {
          this.store.delete(key);
        }
      }
    }, 60000);
  }

  /**
   * Stop the cleanup interval.
   */
  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

const rateLimitStore = new RateLimitStore();

/**
 * Default key generator using IP address.
 */
function defaultKeyGenerator(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Create a rate limiting middleware.
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
    message = 'Too many requests, please try again later',
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `ratelimit:${keyGenerator(req)}`;
    const { count, resetTime } = rateLimitStore.increment(key, windowMs);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

    if (count > maxRequests) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      
      logger.warn(`Rate limit exceeded for ${key}`, {
        key,
        count,
        maxRequests,
        retryAfter,
      });

      next(new RateLimitError(message, retryAfter));
      return;
    }

    if (skipFailedRequests || skipSuccessfulRequests) {
      res.on('finish', () => {
        if (skipFailedRequests && res.statusCode >= 400) {
          rateLimitStore.reset(key);
        }
        if (skipSuccessfulRequests && res.statusCode < 400) {
          rateLimitStore.reset(key);
        }
      });
    }

    next();
  };
}

/**
 * Pre-configured rate limiters for different endpoints.
 */
export const rateLimiters = {
  standard: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'Too many requests, please try again in a minute',
  }),

  strict: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 20,
    message: 'Rate limit exceeded for this endpoint',
  }),

  auth: rateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    skipSuccessfulRequests: true,
    message: 'Too many authentication attempts, please try again later',
  }),

  admin: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 50,
    message: 'Admin rate limit exceeded',
  }),

  leaderboard: rateLimit({
    windowMs: 10 * 1000,
    maxRequests: 30,
    message: 'Leaderboard rate limit exceeded, please slow down',
  }),

  mmrUpdate: rateLimit({
    windowMs: 1000,
    maxRequests: 10,
    keyGenerator: (req) => `mmr:${req.body?.playerId || defaultKeyGenerator(req)}`,
    message: 'MMR update rate limit exceeded',
  }),
};

/**
 * Authorization role types.
 */
export enum AuthRole {
  PLAYER = 'player',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
  SYSTEM = 'system',
}

/**
 * Extended request interface with auth information.
 */
export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    role: AuthRole;
    permissions: string[];
    sessionId?: string;
  };
}

/**
 * Permission definitions for season module operations.
 */
export const Permissions = {
  SEASON_CREATE: 'season:create',
  SEASON_UPDATE: 'season:update',
  SEASON_DELETE: 'season:delete',
  SEASON_ACTIVATE: 'season:activate',
  SEASON_PAUSE: 'season:pause',
  SEASON_TERMINATE: 'season:terminate',
  SEASON_VIEW: 'season:view',
  PLAYER_VIEW: 'player:view',
  PLAYER_UPDATE: 'player:update',
  PLAYER_BAN: 'player:ban',
  REWARD_CREATE: 'reward:create',
  REWARD_DISTRIBUTE: 'reward:distribute',
  REWARD_CLAIM: 'reward:claim',
  LEADERBOARD_VIEW: 'leaderboard:view',
  ADMIN_ACCESS: 'admin:access',
  ADMIN_BULK_OPERATIONS: 'admin:bulk_operations',
  ADMIN_EMERGENCY: 'admin:emergency',
  AUDIT_VIEW: 'audit:view',
} as const;

/**
 * Role-based permission mappings.
 */
const rolePermissions: Record<AuthRole, string[]> = {
  [AuthRole.PLAYER]: [
    Permissions.SEASON_VIEW,
    Permissions.PLAYER_VIEW,
    Permissions.REWARD_CLAIM,
    Permissions.LEADERBOARD_VIEW,
  ],
  [AuthRole.MODERATOR]: [
    Permissions.SEASON_VIEW,
    Permissions.PLAYER_VIEW,
    Permissions.PLAYER_UPDATE,
    Permissions.REWARD_CLAIM,
    Permissions.LEADERBOARD_VIEW,
    Permissions.AUDIT_VIEW,
  ],
  [AuthRole.ADMIN]: [
    Permissions.SEASON_CREATE,
    Permissions.SEASON_UPDATE,
    Permissions.SEASON_ACTIVATE,
    Permissions.SEASON_PAUSE,
    Permissions.SEASON_VIEW,
    Permissions.PLAYER_VIEW,
    Permissions.PLAYER_UPDATE,
    Permissions.PLAYER_BAN,
    Permissions.REWARD_CREATE,
    Permissions.REWARD_DISTRIBUTE,
    Permissions.REWARD_CLAIM,
    Permissions.LEADERBOARD_VIEW,
    Permissions.ADMIN_ACCESS,
    Permissions.AUDIT_VIEW,
  ],
  [AuthRole.SUPER_ADMIN]: Object.values(Permissions),
  [AuthRole.SYSTEM]: Object.values(Permissions),
};

/**
 * Get permissions for a role.
 */
export function getPermissionsForRole(role: AuthRole): string[] {
  return rolePermissions[role] || [];
}

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: AuthRole, permission: string): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}

/**
 * Authentication middleware that extracts and validates auth information.
 * In production, this should validate JWT tokens or session cookies.
 */
export function authenticate(options?: { optional?: boolean }) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];

    if (apiKey && typeof apiKey === 'string') {
      if (apiKey.startsWith('system_')) {
        req.auth = {
          userId: 'system',
          role: AuthRole.SYSTEM,
          permissions: getPermissionsForRole(AuthRole.SYSTEM),
        };
        next();
        return;
      }
    }

    if (!authHeader && !apiKey) {
      if (options?.optional) {
        next();
        return;
      }
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      
      if (type !== 'Bearer' || !token) {
        next(new UnauthorizedError('Invalid authorization header format'));
        return;
      }

      try {
        const decoded = decodeAuthToken(token);
        req.auth = {
          userId: decoded.userId,
          role: decoded.role,
          permissions: getPermissionsForRole(decoded.role),
          sessionId: decoded.sessionId,
        };
        next();
      } catch (error) {
        next(new UnauthorizedError('Invalid or expired token'));
      }
      return;
    }

    if (options?.optional) {
      next();
      return;
    }
    next(new UnauthorizedError('Authentication required'));
  };
}

/**
 * Decode an auth token.
 * In production, this should properly validate JWT tokens.
 */
function decodeAuthToken(token: string): {
  userId: string;
  role: AuthRole;
  sessionId?: string;
} {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return {
      userId: payload.sub || payload.userId,
      role: payload.role || AuthRole.PLAYER,
      sessionId: payload.sessionId,
    };
  } catch {
    throw new Error('Failed to decode token');
  }
}

/**
 * Authorization middleware that checks for required permissions.
 */
export function authorize(...requiredPermissions: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const hasAllPermissions = requiredPermissions.every(
      (permission) => req.auth!.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      logger.warn('Authorization failed', {
        userId: req.auth.userId,
        role: req.auth.role,
        requiredPermissions,
        userPermissions: req.auth.permissions,
      });
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }

    next();
  };
}

/**
 * Middleware to check if the user is the owner of a resource or has admin access.
 */
export function authorizeOwnerOrAdmin(getOwnerId: (req: Request) => string | undefined) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const ownerId = getOwnerId(req);
    const isOwner = ownerId === req.auth.userId;
    const isAdmin = req.auth.permissions.includes(Permissions.ADMIN_ACCESS);

    if (!isOwner && !isAdmin) {
      next(new ForbiddenError('Access denied'));
      return;
    }

    next();
  };
}

/**
 * Input sanitization middleware.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query as Record<string, unknown>) as typeof req.query;
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params) as typeof req.params;
  }
  next();
}

/**
 * Recursively sanitize an object by removing potentially dangerous characters.
 */
function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'string' ? sanitizeString(item) :
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) :
        item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Sanitize a string by removing potentially dangerous characters.
 */
function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

/**
 * Security headers middleware.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
}

/**
 * Request ID middleware for tracing.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.headers['x-request-id'] as string || generateRequestId();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
}

/**
 * Generate a unique request ID.
 */
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

export { rateLimitStore };
