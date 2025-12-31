/**
 * GameVerse Analytics Module - Middleware Index
 * Export all middleware for easy importing
 */

export { rateLimiter, getRateLimitStatus, resetRateLimit, clearAllRateLimits } from './rateLimiter';
export {
  requirePermission,
  requireAnyPermission,
  requireRole,
  requireResourceAccess,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  canAccessResource,
  getRolePermissions,
  AuthenticatedRequest,
} from './rbac';
export {
  validate,
  validateMultiple,
  validateRequestId,
  requireFields,
  sanitizeString,
  sanitizeObject,
} from './validation';
export {
  asyncHandler,
  notFoundHandler,
  errorHandler,
  setupUncaughtExceptionHandler,
} from './errorHandler';
