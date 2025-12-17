import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { jwtService } from './jwt.service';
import { walletService } from './wallet.service';
import {
  User,
  Session,
  TokenPair,
  AuthResult,
  Role,
  Permission,
  ROLE_PERMISSIONS,
  InvalidCredentialsError,
  WalletVerificationError,
  WalletSignaturePayload,
} from '../types';

const users: Map<string, User> = new Map();
const sessions: Map<string, Session> = new Map();

export class AuthService {
  async register(
    email: string,
    username: string,
    password: string,
    walletAddress?: string
  ): Promise<AuthResult> {
    const existingByEmail = Array.from(users.values()).find(u => u.email === email);
    if (existingByEmail) {
      throw new InvalidCredentialsError('Email already registered');
    }

    const existingByUsername = Array.from(users.values()).find(u => u.username === username);
    if (existingByUsername) {
      throw new InvalidCredentialsError('Username already taken');
    }

    const passwordHash = await bcrypt.hash(password, config.bcrypt.saltRounds);
    const userId = uuidv4();
    const defaultRoles: Role[] = ['user'];
    const permissions = this.getPermissionsForRoles(defaultRoles);

    const user: User = {
      id: userId,
      email,
      username,
      passwordHash,
      walletAddress: walletAddress?.toLowerCase(),
      roles: defaultRoles,
      permissions,
      emailVerified: false,
      walletVerified: false,
      mfaEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    users.set(userId, user);

    const session = await this.createSession(user);
    const tokens = jwtService.generateTokenPair(
      user.id,
      user.email,
      user.roles,
      user.permissions,
      session.id
    );

    return {
      user: this.sanitizeUser(user),
      tokens,
      session,
    };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = Array.from(users.values()).find(u => u.email === email);
    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsError();
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    user.lastLoginAt = new Date();
    user.updatedAt = new Date();

    const session = await this.createSession(user);
    const tokens = jwtService.generateTokenPair(
      user.id,
      user.email,
      user.roles,
      user.permissions,
      session.id
    );

    return {
      user: this.sanitizeUser(user),
      tokens,
      session,
    };
  }

  async loginWithWallet(payload: WalletSignaturePayload): Promise<AuthResult> {
    const isValid = await walletService.verifySignature(payload);
    if (!isValid) {
      throw new WalletVerificationError();
    }

    const normalizedAddress = payload.address.toLowerCase();
    let user = Array.from(users.values()).find(u => u.walletAddress === normalizedAddress);

    if (!user) {
      const userId = uuidv4();
      const defaultRoles: Role[] = ['user'];
      const permissions = this.getPermissionsForRoles(defaultRoles);

      user = {
        id: userId,
        email: `${normalizedAddress.slice(0, 10)}@wallet.gameverse`,
        username: `user_${normalizedAddress.slice(2, 10)}`,
        walletAddress: normalizedAddress,
        roles: defaultRoles,
        permissions,
        emailVerified: false,
        walletVerified: true,
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      users.set(userId, user);
    } else {
      user.walletVerified = true;
      user.lastLoginAt = new Date();
      user.updatedAt = new Date();
    }

    const session = await this.createSession(user);
    const tokens = jwtService.generateTokenPair(
      user.id,
      user.email,
      user.roles,
      user.permissions,
      session.id
    );

    return {
      user: this.sanitizeUser(user),
      tokens,
      session,
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const { sub: userId, sessionId } = jwtService.verifyRefreshToken(refreshToken);

    const session = sessions.get(sessionId);
    if (!session || session.isRevoked) {
      throw new InvalidCredentialsError('Session not found or revoked');
    }

    const user = users.get(userId);
    if (!user) {
      throw new InvalidCredentialsError('User not found');
    }

    return jwtService.generateTokenPair(
      user.id,
      user.email,
      user.roles,
      user.permissions,
      sessionId
    );
  }

  async logout(sessionId: string): Promise<void> {
    const session = sessions.get(sessionId);
    if (session) {
      session.isRevoked = true;
    }
  }

  async logoutAll(userId: string): Promise<void> {
    for (const session of sessions.values()) {
      if (session.userId === userId) {
        session.isRevoked = true;
      }
    }
  }

  private async createSession(user: User): Promise<Session> {
    const sessionId = uuidv4();
    const session: Session = {
      id: sessionId,
      userId: user.id,
      token: uuidv4(),
      refreshToken: uuidv4(),
      expiresAt: new Date(Date.now() + config.redis.sessionTtl * 1000),
      createdAt: new Date(),
      isRevoked: false,
    };

    sessions.set(sessionId, session);
    return session;
  }

  private getPermissionsForRoles(roles: Role[]): Permission[] {
    const permissions = new Set<Permission>();
    for (const role of roles) {
      const rolePermissions = ROLE_PERMISSIONS[role] || [];
      for (const permission of rolePermissions) {
        permissions.add(permission);
      }
    }
    return Array.from(permissions);
  }

  private sanitizeUser(user: User): Omit<User, 'passwordHash' | 'mfaSecret'> {
    const { passwordHash: _p, mfaSecret: _m, ...sanitized } = user;
    return sanitized;
  }

  getUserById(userId: string): User | undefined {
    return users.get(userId);
  }

  getSessionById(sessionId: string): Session | undefined {
    return sessions.get(sessionId);
  }
}

export const authService = new AuthService();
