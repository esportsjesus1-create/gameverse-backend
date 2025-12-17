export type Role = 'user' | 'admin' | 'moderator' | 'developer' | 'super_admin';

export type Permission = 
  | 'read:users'
  | 'write:users'
  | 'delete:users'
  | 'read:roles'
  | 'write:roles'
  | 'read:audit'
  | 'admin:all';

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash?: string;
  walletAddress?: string;
  roles: Role[];
  permissions: Permission[];
  emailVerified: boolean;
  walletVerified: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isRevoked: boolean;
}

export interface JwtPayload {
  sub: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
  sessionId: string;
  iat: number;
  exp: number;
}

export interface WalletSignaturePayload {
  address: string;
  message: string;
  signature: string;
  chainId: number;
}

export interface OAuth2Provider {
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthResult {
  user: Omit<User, 'passwordHash' | 'mfaSecret'>;
  tokens: TokenPair;
  session: Session;
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  user: ['read:users'],
  moderator: ['read:users', 'write:users', 'read:audit'],
  developer: ['read:users', 'write:users', 'read:roles'],
  admin: ['read:users', 'write:users', 'delete:users', 'read:roles', 'write:roles', 'read:audit'],
  super_admin: ['read:users', 'write:users', 'delete:users', 'read:roles', 'write:roles', 'read:audit', 'admin:all'],
};

export class AuthError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 401, code: string = 'AUTH_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message: string = 'Invalid credentials') {
    super(message, 401, 'INVALID_CREDENTIALS');
  }
}

export class TokenExpiredError extends AuthError {
  constructor(message: string = 'Token expired') {
    super(message, 401, 'TOKEN_EXPIRED');
  }
}

export class InvalidTokenError extends AuthError {
  constructor(message: string = 'Invalid token') {
    super(message, 401, 'INVALID_TOKEN');
  }
}

export class InsufficientPermissionsError extends AuthError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'INSUFFICIENT_PERMISSIONS');
  }
}

export class WalletVerificationError extends AuthError {
  constructor(message: string = 'Wallet verification failed') {
    super(message, 401, 'WALLET_VERIFICATION_FAILED');
  }
}
