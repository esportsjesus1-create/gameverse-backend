import { BadRequestException } from '@nestjs/common';
import {
  isValidUUID,
  validateUUID,
  validateFutureDate,
  validateDateRange,
  validatePositiveInteger,
  validateScore,
  validatePercentage,
  validateStringLength,
  validateArrayLength,
  validatePrizeDistribution,
  validateMmrRange,
  validateParticipantCount,
  validateTeamSize,
  validateBracketSize,
  validateSwissRounds,
  validateUrl,
  validateRegion,
  validateCurrency,
  sanitizeString,
  validateTournamentName,
  validateParticipantName,
} from '../validation.util';

describe('Validation Utilities', () => {
  describe('isValidUUID', () => {
    it('should return true for valid UUIDs', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('validateUUID', () => {
    it('should not throw for valid UUID', () => {
      expect(() =>
        validateUUID('123e4567-e89b-12d3-a456-426614174000', 'testField'),
      ).not.toThrow();
    });

    it('should throw BadRequestException for invalid UUID', () => {
      expect(() => validateUUID('invalid', 'testField')).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty string', () => {
      expect(() => validateUUID('', 'testField')).toThrow(BadRequestException);
    });
  });

  describe('validateFutureDate', () => {
    it('should not throw for future date', () => {
      const futureDate = new Date(Date.now() + 86400000);
      expect(() => validateFutureDate(futureDate, 'startDate')).not.toThrow();
    });

    it('should not throw for future date string', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      expect(() => validateFutureDate(futureDate, 'startDate')).not.toThrow();
    });

    it('should throw BadRequestException for past date', () => {
      const pastDate = new Date(Date.now() - 86400000);
      expect(() => validateFutureDate(pastDate, 'startDate')).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid date string', () => {
      expect(() => validateFutureDate('not-a-date', 'startDate')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateDateRange', () => {
    it('should not throw for valid date range', () => {
      const start = new Date(Date.now() + 86400000);
      const end = new Date(Date.now() + 172800000);
      expect(() =>
        validateDateRange(start, end, 'startDate', 'endDate'),
      ).not.toThrow();
    });

    it('should throw BadRequestException when end is before start', () => {
      const start = new Date(Date.now() + 172800000);
      const end = new Date(Date.now() + 86400000);
      expect(() =>
        validateDateRange(start, end, 'startDate', 'endDate'),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid start date', () => {
      const end = new Date(Date.now() + 86400000);
      expect(() =>
        validateDateRange('invalid', end, 'startDate', 'endDate'),
      ).toThrow(BadRequestException);
    });
  });

  describe('validatePositiveInteger', () => {
    it('should not throw for positive integer', () => {
      expect(() => validatePositiveInteger(5, 'count')).not.toThrow();
    });

    it('should not throw for minimum value', () => {
      expect(() => validatePositiveInteger(10, 'count', 10)).not.toThrow();
    });

    it('should throw BadRequestException for zero', () => {
      expect(() => validatePositiveInteger(0, 'count')).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for negative number', () => {
      expect(() => validatePositiveInteger(-5, 'count')).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for decimal', () => {
      expect(() => validatePositiveInteger(5.5, 'count')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateScore', () => {
    it('should not throw for valid score', () => {
      expect(() => validateScore(50, 'score')).not.toThrow();
    });

    it('should not throw for zero score', () => {
      expect(() => validateScore(0, 'score')).not.toThrow();
    });

    it('should throw BadRequestException for negative score', () => {
      expect(() => validateScore(-1, 'score')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for score above max', () => {
      expect(() => validateScore(1000, 'score')).toThrow(BadRequestException);
    });

    it('should respect custom min/max', () => {
      expect(() => validateScore(5, 'score', 0, 10)).not.toThrow();
      expect(() => validateScore(15, 'score', 0, 10)).toThrow(BadRequestException);
    });
  });

  describe('validatePercentage', () => {
    it('should not throw for valid percentage', () => {
      expect(() => validatePercentage(50, 'percentage')).not.toThrow();
      expect(() => validatePercentage(0, 'percentage')).not.toThrow();
      expect(() => validatePercentage(100, 'percentage')).not.toThrow();
    });

    it('should throw BadRequestException for negative percentage', () => {
      expect(() => validatePercentage(-1, 'percentage')).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for percentage over 100', () => {
      expect(() => validatePercentage(101, 'percentage')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateStringLength', () => {
    it('should not throw for valid string', () => {
      expect(() => validateStringLength('test', 'name')).not.toThrow();
    });

    it('should throw BadRequestException for empty string', () => {
      expect(() => validateStringLength('', 'name')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for string too short', () => {
      expect(() => validateStringLength('ab', 'name', 3)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for string too long', () => {
      expect(() => validateStringLength('abcdef', 'name', 1, 5)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateArrayLength', () => {
    it('should not throw for valid array', () => {
      expect(() => validateArrayLength([1, 2, 3], 'items')).not.toThrow();
    });

    it('should throw BadRequestException for empty array', () => {
      expect(() => validateArrayLength([], 'items')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for array too long', () => {
      expect(() => validateArrayLength([1, 2, 3, 4, 5, 6], 'items', 1, 5)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for non-array', () => {
      expect(() => validateArrayLength('not-array' as any, 'items')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validatePrizeDistribution', () => {
    it('should not throw for valid distribution', () => {
      const distribution = [
        { placement: 1, percentage: 50 },
        { placement: 2, percentage: 30 },
        { placement: 3, percentage: 20 },
      ];
      expect(() => validatePrizeDistribution(distribution)).not.toThrow();
    });

    it('should throw BadRequestException for empty distribution', () => {
      expect(() => validatePrizeDistribution([])).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate placements', () => {
      const distribution = [
        { placement: 1, percentage: 50 },
        { placement: 1, percentage: 30 },
      ];
      expect(() => validatePrizeDistribution(distribution)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for total over 100%', () => {
      const distribution = [
        { placement: 1, percentage: 60 },
        { placement: 2, percentage: 50 },
      ];
      expect(() => validatePrizeDistribution(distribution)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid placement', () => {
      const distribution = [{ placement: 0, percentage: 50 }];
      expect(() => validatePrizeDistribution(distribution)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateMmrRange', () => {
    it('should not throw for valid MMR range', () => {
      expect(() => validateMmrRange(1000, 2000)).not.toThrow();
    });

    it('should not throw when only min is provided', () => {
      expect(() => validateMmrRange(1000, undefined)).not.toThrow();
    });

    it('should not throw when only max is provided', () => {
      expect(() => validateMmrRange(undefined, 2000)).not.toThrow();
    });

    it('should throw BadRequestException when min >= max', () => {
      expect(() => validateMmrRange(2000, 1000)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for negative min', () => {
      expect(() => validateMmrRange(-100, 2000)).toThrow(BadRequestException);
    });
  });

  describe('validateParticipantCount', () => {
    it('should not throw for valid participant count', () => {
      expect(() => validateParticipantCount(2, 16)).not.toThrow();
    });

    it('should throw BadRequestException when min > max', () => {
      expect(() => validateParticipantCount(16, 8)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for min < 2', () => {
      expect(() => validateParticipantCount(1, 16)).toThrow(BadRequestException);
    });
  });

  describe('validateTeamSize', () => {
    it('should not throw for valid team size', () => {
      expect(() => validateTeamSize(5)).not.toThrow();
    });

    it('should throw BadRequestException for team size > 100', () => {
      expect(() => validateTeamSize(101)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for team size < 1', () => {
      expect(() => validateTeamSize(0)).toThrow(BadRequestException);
    });
  });

  describe('validateBracketSize', () => {
    it('should not throw for valid bracket size', () => {
      expect(() => validateBracketSize(8, 'single_elimination')).not.toThrow();
    });

    it('should throw BadRequestException for < 2 participants in elimination', () => {
      expect(() => validateBracketSize(1, 'single_elimination')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateSwissRounds', () => {
    it('should not throw for valid Swiss rounds', () => {
      expect(() => validateSwissRounds(5, 16)).not.toThrow();
    });

    it('should throw BadRequestException for too many rounds', () => {
      expect(() => validateSwissRounds(10, 8)).toThrow(BadRequestException);
    });
  });

  describe('validateUrl', () => {
    it('should not throw for valid URL', () => {
      expect(() => validateUrl('https://example.com', 'website')).not.toThrow();
    });

    it('should not throw for empty URL', () => {
      expect(() => validateUrl('', 'website')).not.toThrow();
    });

    it('should throw BadRequestException for invalid URL', () => {
      expect(() => validateUrl('not-a-url', 'website')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateRegion', () => {
    it('should not throw for valid region', () => {
      expect(() => validateRegion('NA')).not.toThrow();
      expect(() => validateRegion('EU')).not.toThrow();
      expect(() => validateRegion('APAC')).not.toThrow();
    });

    it('should throw BadRequestException for invalid region', () => {
      expect(() => validateRegion('INVALID')).toThrow(BadRequestException);
    });
  });

  describe('validateCurrency', () => {
    it('should not throw for valid currency', () => {
      expect(() => validateCurrency('USD')).not.toThrow();
      expect(() => validateCurrency('EUR')).not.toThrow();
      expect(() => validateCurrency('BTC')).not.toThrow();
    });

    it('should throw BadRequestException for invalid currency', () => {
      expect(() => validateCurrency('INVALID')).toThrow(BadRequestException);
    });
  });

  describe('sanitizeString', () => {
    it('should escape HTML characters', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;',
      );
    });

    it('should handle empty string', () => {
      expect(sanitizeString('')).toBe('');
    });

    it('should return null/undefined as is', () => {
      expect(sanitizeString(null as any)).toBe(null);
      expect(sanitizeString(undefined as any)).toBe(undefined);
    });
  });

  describe('validateTournamentName', () => {
    it('should return sanitized tournament name', () => {
      const result = validateTournamentName('Test Tournament');
      expect(result).toBe('Test Tournament');
    });

    it('should trim whitespace', () => {
      const result = validateTournamentName('  Test Tournament  ');
      expect(result).toBe('Test Tournament');
    });

    it('should throw BadRequestException for name too short', () => {
      expect(() => validateTournamentName('ab')).toThrow(BadRequestException);
    });
  });

  describe('validateParticipantName', () => {
    it('should return sanitized participant name', () => {
      const result = validateParticipantName('Player1');
      expect(result).toBe('Player1');
    });

    it('should sanitize HTML in name', () => {
      const result = validateParticipantName('<script>Player</script>');
      expect(result).not.toContain('<script>');
    });
  });
});
