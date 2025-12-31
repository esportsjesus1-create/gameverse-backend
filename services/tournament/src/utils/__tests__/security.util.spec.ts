import { BadRequestException } from '@nestjs/common';
import {
  checkRateLimit,
  resetRateLimit,
  detectResultManipulation,
  validateMatchResultConsistency,
  detectBracketManipulation,
  generateSecureLobbyCode,
  hashForLogging,
  validateAdminAction,
  detectSuspiciousRegistration,
  calculateIntegrityScore,
} from '../security.util';

describe('Security Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', () => {
      const key = `test-rate-limit-${Date.now()}`;
      expect(checkRateLimit(key, { maxRequests: 5, windowMs: 60000 })).toBe(true);
      expect(checkRateLimit(key, { maxRequests: 5, windowMs: 60000 })).toBe(true);
    });

    it('should block requests exceeding limit', () => {
      const key = `test-rate-limit-block-${Date.now()}`;
      const config = { maxRequests: 2, windowMs: 60000 };

      expect(checkRateLimit(key, config)).toBe(true);
      expect(checkRateLimit(key, config)).toBe(true);
      expect(checkRateLimit(key, config)).toBe(false);
    });

    it('should use default config when not provided', () => {
      const key = `test-rate-limit-default-${Date.now()}`;
      expect(checkRateLimit(key)).toBe(true);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for key', () => {
      const key = `test-rate-limit-reset-${Date.now()}`;
      const config = { maxRequests: 1, windowMs: 60000 };

      checkRateLimit(key, config);
      checkRateLimit(key, config);
      expect(checkRateLimit(key, config)).toBe(false);

      resetRateLimit(key);
      expect(checkRateLimit(key, config)).toBe(true);
    });
  });

  describe('detectResultManipulation', () => {
    it('should not flag normal results', () => {
      const result = detectResultManipulation(3, 2, 30);
      expect(result.isSuspicious).toBe(false);
      expect(result.riskScore).toBeLessThan(50);
    });

    it('should flag both scores being zero', () => {
      const result = detectResultManipulation(0, 0, 30);
      expect(result.reasons).toContain(
        'Both scores are zero - possible forfeit or manipulation',
      );
      expect(result.riskScore).toBeGreaterThanOrEqual(30);
    });

    it('should flag suspiciously short match duration', () => {
      const result = detectResultManipulation(3, 0, 0.5);
      expect(result.reasons).toContain('Match duration suspiciously short');
      expect(result.riskScore).toBeGreaterThanOrEqual(40);
    });

    it('should flag perfect shutout', () => {
      const result = detectResultManipulation(5, 0, 30);
      expect(result.reasons).toContain('Perfect shutout - may warrant review');
    });

    it('should flag consistent one-sided results', () => {
      const previousMatches = [
        { participant1Score: 3, participant2Score: 0, winnerId: 'player1' },
        { participant1Score: 3, participant2Score: 1, winnerId: 'player1' },
        { participant1Score: 3, participant2Score: 0, winnerId: 'player1' },
        { participant1Score: 3, participant2Score: 2, winnerId: 'player1' },
        { participant1Score: 3, participant2Score: 0, winnerId: 'player1' },
      ];

      const result = detectResultManipulation(3, 0, 30, previousMatches);
      expect(result.reasons).toContain(
        'Consistent one-sided results in recent matches',
      );
    });

    it('should mark as suspicious when risk score >= 50', () => {
      const result = detectResultManipulation(0, 0, 0.5);
      expect(result.isSuspicious).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(50);
    });
  });

  describe('validateMatchResultConsistency', () => {
    it('should not throw for valid result', () => {
      expect(() =>
        validateMatchResultConsistency('player1', 'player1', 'player2', 3, 1),
      ).not.toThrow();
    });

    it('should throw when winner is not a participant', () => {
      expect(() =>
        validateMatchResultConsistency('player3', 'player1', 'player2', 3, 1),
      ).toThrow(BadRequestException);
    });

    it('should throw when winner score is less than loser score', () => {
      expect(() =>
        validateMatchResultConsistency('player1', 'player1', 'player2', 1, 3),
      ).toThrow(BadRequestException);
    });

    it('should throw for tied scores with a winner', () => {
      expect(() =>
        validateMatchResultConsistency('player1', 'player1', 'player2', 2, 2),
      ).toThrow(BadRequestException);
    });

    it('should allow 0-0 tie', () => {
      expect(() =>
        validateMatchResultConsistency('player1', 'player1', 'player2', 0, 0),
      ).not.toThrow();
    });
  });

  describe('detectBracketManipulation', () => {
    it('should not flag normal seeding', () => {
      const result = detectBracketManipulation('player1', 5, 1500, 1000, 2000);
      expect(result.isSuspicious).toBe(false);
    });

    it('should flag MMR below tournament minimum', () => {
      const result = detectBracketManipulation('player1', 5, 800, 1000, 2000);
      expect(result.reasons).toContain('MMR below tournament minimum');
      expect(result.isSuspicious).toBe(true);
    });

    it('should flag MMR above tournament maximum', () => {
      const result = detectBracketManipulation('player1', 5, 2500, 1000, 2000);
      expect(result.reasons).toContain('MMR above tournament maximum');
      expect(result.isSuspicious).toBe(true);
    });

    it('should flag low MMR player requesting top seed', () => {
      const result = detectBracketManipulation('player1', 1, 500);
      expect(result.reasons).toContain('Low MMR player requesting top seed');
    });
  });

  describe('generateSecureLobbyCode', () => {
    it('should generate code of specified length', () => {
      const code = generateSecureLobbyCode(8);
      expect(code).toHaveLength(8);
    });

    it('should generate code with default length', () => {
      const code = generateSecureLobbyCode();
      expect(code).toHaveLength(8);
    });

    it('should only contain valid characters', () => {
      const code = generateSecureLobbyCode(100);
      const validChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (const char of code) {
        expect(validChars).toContain(char);
      }
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateSecureLobbyCode());
      }
      expect(codes.size).toBeGreaterThan(90);
    });
  });

  describe('hashForLogging', () => {
    it('should hash long strings', () => {
      const result = hashForLogging('sensitive-data-here');
      expect(result).toBe('se****re');
    });

    it('should return **** for short strings', () => {
      const result = hashForLogging('abc');
      expect(result).toBe('****');
    });

    it('should handle empty string', () => {
      const result = hashForLogging('');
      expect(result).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(hashForLogging(null as any)).toBe(null);
      expect(hashForLogging(undefined as any)).toBe(undefined);
    });
  });

  describe('validateAdminAction', () => {
    it('should log admin action without throwing', () => {
      expect(() =>
        validateAdminAction('admin-123', 'organizer-456', 'UPDATE_MATCH'),
      ).not.toThrow();
    });
  });

  describe('detectSuspiciousRegistration', () => {
    it('should not flag normal registration', () => {
      const result = detectSuspiciousRegistration('player1', '192.168.1.1', []);
      expect(result.isSuspicious).toBe(false);
    });

    it('should flag multiple registrations from same IP', () => {
      const recentRegistrations = [
        { participantId: 'player2', ipAddress: '192.168.1.1', timestamp: new Date() },
        { participantId: 'player3', ipAddress: '192.168.1.1', timestamp: new Date() },
        { participantId: 'player4', ipAddress: '192.168.1.1', timestamp: new Date() },
      ];

      const result = detectSuspiciousRegistration(
        'player1',
        '192.168.1.1',
        recentRegistrations,
      );
      expect(result.reasons).toContain(
        'Multiple registrations from same IP address',
      );
    });

    it('should flag rapid registration attempts', () => {
      const now = new Date();
      const recentRegistrations = Array.from({ length: 6 }, () => ({
        participantId: 'player1',
        ipAddress: '192.168.1.1',
        timestamp: now,
      }));

      const result = detectSuspiciousRegistration(
        'player1',
        '192.168.1.2',
        recentRegistrations,
      );
      expect(result.reasons).toContain('Rapid registration attempts');
    });

    it('should handle missing IP address', () => {
      const result = detectSuspiciousRegistration('player1', undefined, []);
      expect(result.isSuspicious).toBe(false);
    });
  });

  describe('calculateIntegrityScore', () => {
    it('should return 100 for no matches played', () => {
      const score = calculateIntegrityScore(0, 0, 0, 0);
      expect(score).toBe(100);
    });

    it('should return 100 for perfect integrity', () => {
      const score = calculateIntegrityScore(10, 0, 0, 0);
      expect(score).toBe(100);
    });

    it('should reduce score for disputes', () => {
      const score = calculateIntegrityScore(10, 3, 0, 0);
      expect(score).toBeLessThan(100);
    });

    it('should reduce score for admin overrides', () => {
      const score = calculateIntegrityScore(10, 0, 2, 0);
      expect(score).toBeLessThan(100);
    });

    it('should reduce score for forfeits', () => {
      const score = calculateIntegrityScore(10, 0, 0, 2);
      expect(score).toBeLessThan(100);
    });

    it('should not go below 0', () => {
      const score = calculateIntegrityScore(1, 10, 10, 10);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should not exceed 100', () => {
      const score = calculateIntegrityScore(100, 0, 0, 0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});
