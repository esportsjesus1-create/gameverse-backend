import crypto from 'crypto';
import { redis, getReconnectTokenKey } from '../db/redis';
import { config } from '../config';
import { ReconnectionToken, PlayerConnectionStatus } from '../types';
import { getSession, updatePlayerConnectionStatus } from './sessionService';

function generateToken(): string {
  return crypto.randomBytes(config.reconnectionToken.tokenLength).toString('hex');
}

export async function createReconnectionToken(
  sessionId: string,
  playerId: string
): Promise<ReconnectionToken> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  
  if (session.status === 'ended') {
    throw new Error('Cannot create reconnection token for ended session');
  }
  
  const token = generateToken();
  const now = Date.now();
  const expiresAt = now + config.reconnectionToken.ttlSeconds * 1000;
  
  const tokenData: ReconnectionToken = {
    token,
    sessionId,
    playerId,
    createdAt: now,
    expiresAt,
  };
  
  const key = getReconnectTokenKey(sessionId, playerId);
  await redis.setex(key, config.reconnectionToken.ttlSeconds, JSON.stringify(tokenData));
  
  await updatePlayerConnectionStatus(sessionId, playerId, PlayerConnectionStatus.DISCONNECTED);
  
  return tokenData;
}

export async function validateReconnectionToken(
  sessionId: string,
  playerId: string,
  token: string
): Promise<boolean> {
  const key = getReconnectTokenKey(sessionId, playerId);
  const stored = await redis.get(key);
  
  if (!stored) {
    return false;
  }
  
  const tokenData = JSON.parse(stored) as ReconnectionToken;
  
  if (tokenData.token !== token) {
    return false;
  }
  
  if (Date.now() > tokenData.expiresAt) {
    await redis.del(key);
    return false;
  }
  
  return true;
}

export async function useReconnectionToken(
  sessionId: string,
  playerId: string,
  token: string
): Promise<{ success: boolean; message: string }> {
  const session = await getSession(sessionId);
  if (!session) {
    return { success: false, message: 'Session not found' };
  }
  
  if (session.status === 'ended') {
    return { success: false, message: 'Session has ended' };
  }
  
  const isValid = await validateReconnectionToken(sessionId, playerId, token);
  if (!isValid) {
    return { success: false, message: 'Invalid or expired reconnection token' };
  }
  
  const key = getReconnectTokenKey(sessionId, playerId);
  await redis.del(key);
  
  await updatePlayerConnectionStatus(sessionId, playerId, PlayerConnectionStatus.CONNECTED);
  
  return { success: true, message: 'Reconnection successful' };
}

export async function refreshReconnectionToken(
  sessionId: string,
  playerId: string,
  currentToken: string
): Promise<ReconnectionToken | null> {
  const isValid = await validateReconnectionToken(sessionId, playerId, currentToken);
  if (!isValid) {
    return null;
  }
  
  const key = getReconnectTokenKey(sessionId, playerId);
  await redis.del(key);
  
  return createReconnectionToken(sessionId, playerId);
}

export async function getReconnectionTokenInfo(
  sessionId: string,
  playerId: string
): Promise<ReconnectionToken | null> {
  const key = getReconnectTokenKey(sessionId, playerId);
  const stored = await redis.get(key);
  
  if (!stored) {
    return null;
  }
  
  const tokenData = JSON.parse(stored) as ReconnectionToken;
  
  if (Date.now() > tokenData.expiresAt) {
    await redis.del(key);
    return null;
  }
  
  return tokenData;
}

export async function invalidateReconnectionToken(
  sessionId: string,
  playerId: string
): Promise<void> {
  const key = getReconnectTokenKey(sessionId, playerId);
  await redis.del(key);
}

export async function invalidateAllSessionTokens(sessionId: string): Promise<void> {
  const pattern = `reconnect:${sessionId}:*`;
  const keys = await redis.keys(pattern);
  
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
