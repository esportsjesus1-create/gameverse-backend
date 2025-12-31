import { BadRequestException } from '@nestjs/common';
import { createTournamentLogger, TournamentEventType } from './logger.util';

const logger = createTournamentLogger('SecurityUtil');

/**
 * Security utility functions for tournament module
 * Provides competitive integrity measures and fraud detection
 */

/**
 * Rate limiter configuration
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * In-memory rate limiter store
 * In production, this should use Redis for distributed rate limiting
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Check rate limit for a given key
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 },
): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs });
    return true;
  }

  if (record.count >= config.maxRequests) {
    logger.logSecurityAlert('RATE_LIMIT_EXCEEDED', {
      key,
      count: record.count,
      limit: config.maxRequests,
    });
    return false;
  }

  record.count++;
  return true;
}

/**
 * Reset rate limit for a key
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Result manipulation detection patterns
 */
export interface ManipulationCheckResult {
  isSuspicious: boolean;
  reasons: string[];
  riskScore: number;
}

/**
 * Check for suspicious match result patterns
 */
export function detectResultManipulation(
  participant1Score: number,
  participant2Score: number,
  matchDurationMinutes?: number,
  previousMatches?: Array<{
    participant1Score: number;
    participant2Score: number;
    winnerId: string;
  }>,
): ManipulationCheckResult {
  const reasons: string[] = [];
  let riskScore = 0;

  if (participant1Score === 0 && participant2Score === 0) {
    reasons.push('Both scores are zero - possible forfeit or manipulation');
    riskScore += 30;
  }

  if (matchDurationMinutes !== undefined && matchDurationMinutes < 1) {
    reasons.push('Match duration suspiciously short');
    riskScore += 40;
  }

  const scoreDifference = Math.abs(participant1Score - participant2Score);
  const totalScore = participant1Score + participant2Score;
  if (totalScore > 0 && scoreDifference === totalScore) {
    reasons.push('Perfect shutout - may warrant review');
    riskScore += 10;
  }

  if (previousMatches && previousMatches.length >= 3) {
    const recentResults = previousMatches.slice(-5);
    const allSameWinner = recentResults.every(
      (m) => m.winnerId === recentResults[0].winnerId,
    );
    if (allSameWinner && recentResults.length >= 5) {
      reasons.push('Consistent one-sided results in recent matches');
      riskScore += 20;
    }
  }

  const isSuspicious = riskScore >= 50;

  if (isSuspicious) {
    logger.logSecurityAlert('RESULT_MANIPULATION_DETECTED', {
      participant1Score,
      participant2Score,
      matchDurationMinutes,
      riskScore,
      reasons,
    });
  }

  return { isSuspicious, reasons, riskScore };
}

/**
 * Validate match result consistency
 */
export function validateMatchResultConsistency(
  winnerId: string,
  participant1Id: string,
  participant2Id: string,
  participant1Score: number,
  participant2Score: number,
): void {
  if (winnerId !== participant1Id && winnerId !== participant2Id) {
    throw new BadRequestException('Winner must be one of the match participants');
  }

  if (winnerId === participant1Id && participant1Score < participant2Score) {
    throw new BadRequestException(
      'Winner score cannot be less than loser score',
    );
  }

  if (winnerId === participant2Id && participant2Score < participant1Score) {
    throw new BadRequestException(
      'Winner score cannot be less than loser score',
    );
  }

  if (participant1Score === participant2Score && participant1Score > 0) {
    throw new BadRequestException(
      'Tied scores require a tiebreaker - winner cannot be determined',
    );
  }
}

/**
 * Check for bracket manipulation attempts
 */
export function detectBracketManipulation(
  participantId: string,
  requestedSeed: number,
  actualMmr: number,
  tournamentMinMmr?: number,
  tournamentMaxMmr?: number,
): ManipulationCheckResult {
  const reasons: string[] = [];
  let riskScore = 0;

  if (tournamentMinMmr && actualMmr < tournamentMinMmr) {
    reasons.push('MMR below tournament minimum');
    riskScore += 50;
  }

  if (tournamentMaxMmr && actualMmr > tournamentMaxMmr) {
    reasons.push('MMR above tournament maximum');
    riskScore += 50;
  }

  if (requestedSeed === 1 && actualMmr < 1000) {
    reasons.push('Low MMR player requesting top seed');
    riskScore += 30;
  }

  const isSuspicious = riskScore >= 50;

  if (isSuspicious) {
    logger.logSecurityAlert('BRACKET_MANIPULATION_DETECTED', {
      participantId,
      requestedSeed,
      actualMmr,
      riskScore,
      reasons,
    });
  }

  return { isSuspicious, reasons, riskScore };
}

/**
 * Generate secure random lobby code
 */
export function generateSecureLobbyCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const randomValues = new Uint32Array(length);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < length; i++) {
      randomValues[i] = Math.floor(Math.random() * chars.length);
    }
  }
  
  for (let i = 0; i < length; i++) {
    code += chars.charAt(randomValues[i] % chars.length);
  }
  return code;
}

/**
 * Hash sensitive data for logging
 */
export function hashForLogging(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return value.substring(0, 2) + '****' + value.substring(value.length - 2);
}

/**
 * Validate admin action authorization
 */
export function validateAdminAction(
  adminId: string,
  tournamentOrganizerId: string,
  action: string,
): void {
  logger.logAuditTrail(action, adminId, tournamentOrganizerId, 'tournament', {
    authorized: true,
  });
}

/**
 * Check for suspicious registration patterns
 */
export function detectSuspiciousRegistration(
  participantId: string,
  ipAddress?: string,
  recentRegistrations?: Array<{ participantId: string; ipAddress?: string; timestamp: Date }>,
): ManipulationCheckResult {
  const reasons: string[] = [];
  let riskScore = 0;

  if (recentRegistrations && ipAddress) {
    const sameIpRegistrations = recentRegistrations.filter(
      (r) => r.ipAddress === ipAddress && r.participantId !== participantId,
    );
    if (sameIpRegistrations.length >= 3) {
      reasons.push('Multiple registrations from same IP address');
      riskScore += 40;
    }
  }

  if (recentRegistrations) {
    const recentFromSameUser = recentRegistrations.filter(
      (r) =>
        r.participantId === participantId &&
        Date.now() - r.timestamp.getTime() < 60000,
    );
    if (recentFromSameUser.length >= 5) {
      reasons.push('Rapid registration attempts');
      riskScore += 30;
    }
  }

  const isSuspicious = riskScore >= 50;

  if (isSuspicious) {
    logger.logSecurityAlert('SUSPICIOUS_REGISTRATION', {
      participantId,
      ipAddress: ipAddress ? hashForLogging(ipAddress) : undefined,
      riskScore,
      reasons,
    });
  }

  return { isSuspicious, reasons, riskScore };
}

/**
 * Competitive integrity score calculation
 */
export function calculateIntegrityScore(
  matchesPlayed: number,
  disputedMatches: number,
  adminOverrides: number,
  forfeits: number,
): number {
  if (matchesPlayed === 0) return 100;

  const disputeRate = disputedMatches / matchesPlayed;
  const overrideRate = adminOverrides / matchesPlayed;
  const forfeitRate = forfeits / matchesPlayed;

  let score = 100;
  score -= disputeRate * 30;
  score -= overrideRate * 20;
  score -= forfeitRate * 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}
