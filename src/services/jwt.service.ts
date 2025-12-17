import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { JwtPayload, TokenPair, Role, Permission, TokenExpiredError, InvalidTokenError } from '../types';

export class JwtService {
  private readonly secret: string;
  private readonly accessExpiry: string;
  private readonly refreshExpiry: string;
  private readonly issuer: string;

  constructor() {
    this.secret = config.jwt.secret;
    this.accessExpiry = config.jwt.accessTokenExpiry;
    this.refreshExpiry = config.jwt.refreshTokenExpiry;
    this.issuer = config.jwt.issuer;
  }

  generateTokenPair(
    userId: string,
    email: string,
    roles: Role[],
    permissions: Permission[],
    sessionId: string
  ): TokenPair {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: userId,
      email,
      roles,
      permissions,
      sessionId,
    };

    const accessToken = jwt.sign(payload, this.secret, {
      expiresIn: this.accessExpiry,
      issuer: this.issuer,
      jwtid: uuidv4(),
    });

    const refreshToken = jwt.sign(
      { sub: userId, sessionId, type: 'refresh' },
      this.secret,
      {
        expiresIn: this.refreshExpiry,
        issuer: this.issuer,
        jwtid: uuidv4(),
      }
    );

    const decoded = jwt.decode(accessToken) as { exp: number };
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      const payload = jwt.verify(token, this.secret, {
        issuer: this.issuer,
      }) as JwtPayload;
      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError();
      }
      throw new InvalidTokenError();
    }
  }

  verifyRefreshToken(token: string): { sub: string; sessionId: string } {
    try {
      const payload = jwt.verify(token, this.secret, {
        issuer: this.issuer,
      }) as { sub: string; sessionId: string; type: string };

      if (payload.type !== 'refresh') {
        throw new InvalidTokenError('Invalid token type');
      }

      return { sub: payload.sub, sessionId: payload.sessionId };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError('Refresh token expired');
      }
      if (error instanceof InvalidTokenError) {
        throw error;
      }
      throw new InvalidTokenError();
    }
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }
}

export const jwtService = new JwtService();
