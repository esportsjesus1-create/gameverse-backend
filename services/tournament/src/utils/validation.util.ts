import { BadRequestException } from '@nestjs/common';

/**
 * Validation utility functions for tournament module
 * Provides comprehensive input validation for all tournament operations
 */

/**
 * Validate UUID format
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validate and throw if UUID is invalid
 */
export function validateUUID(value: string, fieldName: string): void {
  if (!value || !isValidUUID(value)) {
    throw new BadRequestException(`Invalid UUID format for ${fieldName}: ${value}`);
  }
}

/**
 * Validate date is in the future
 */
export function validateFutureDate(date: Date | string, fieldName: string): void {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) {
    throw new BadRequestException(`Invalid date format for ${fieldName}`);
  }
  if (dateObj <= new Date()) {
    throw new BadRequestException(`${fieldName} must be in the future`);
  }
}

/**
 * Validate date range
 */
export function validateDateRange(
  startDate: Date | string,
  endDate: Date | string,
  startFieldName: string,
  endFieldName: string,
): void {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

  if (isNaN(start.getTime())) {
    throw new BadRequestException(`Invalid date format for ${startFieldName}`);
  }
  if (isNaN(end.getTime())) {
    throw new BadRequestException(`Invalid date format for ${endFieldName}`);
  }
  if (end <= start) {
    throw new BadRequestException(`${endFieldName} must be after ${startFieldName}`);
  }
}

/**
 * Validate positive integer
 */
export function validatePositiveInteger(value: number, fieldName: string, min = 1): void {
  if (!Number.isInteger(value) || value < min) {
    throw new BadRequestException(`${fieldName} must be a positive integer >= ${min}`);
  }
}

/**
 * Validate score range
 */
export function validateScore(score: number, fieldName: string, min = 0, max = 999): void {
  if (!Number.isInteger(score) || score < min || score > max) {
    throw new BadRequestException(`${fieldName} must be an integer between ${min} and ${max}`);
  }
}

/**
 * Validate percentage (0-100)
 */
export function validatePercentage(value: number, fieldName: string): void {
  if (typeof value !== 'number' || value < 0 || value > 100) {
    throw new BadRequestException(`${fieldName} must be a number between 0 and 100`);
  }
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string,
  fieldName: string,
  minLength = 1,
  maxLength = 255,
): void {
  if (!value || typeof value !== 'string') {
    throw new BadRequestException(`${fieldName} is required`);
  }
  if (value.length < minLength || value.length > maxLength) {
    throw new BadRequestException(
      `${fieldName} must be between ${minLength} and ${maxLength} characters`,
    );
  }
}

/**
 * Validate array length
 */
export function validateArrayLength<T>(
  arr: T[],
  fieldName: string,
  minLength = 1,
  maxLength = 1000,
): void {
  if (!Array.isArray(arr)) {
    throw new BadRequestException(`${fieldName} must be an array`);
  }
  if (arr.length < minLength || arr.length > maxLength) {
    throw new BadRequestException(
      `${fieldName} must have between ${minLength} and ${maxLength} items`,
    );
  }
}

/**
 * Validate prize distribution totals to 100% or less
 */
export function validatePrizeDistribution(
  distribution: { placement: number; percentage: number }[],
): void {
  if (!Array.isArray(distribution) || distribution.length === 0) {
    throw new BadRequestException('Prize distribution is required');
  }

  const placements = new Set<number>();
  let totalPercentage = 0;

  for (const item of distribution) {
    if (!Number.isInteger(item.placement) || item.placement < 1) {
      throw new BadRequestException('Placement must be a positive integer');
    }
    if (placements.has(item.placement)) {
      throw new BadRequestException(`Duplicate placement: ${item.placement}`);
    }
    placements.add(item.placement);

    validatePercentage(item.percentage, `Percentage for placement ${item.placement}`);
    totalPercentage += item.percentage;
  }

  if (totalPercentage > 100) {
    throw new BadRequestException(
      `Total prize distribution (${totalPercentage}%) cannot exceed 100%`,
    );
  }
}

/**
 * Validate MMR range
 */
export function validateMmrRange(minMmr?: number, maxMmr?: number): void {
  if (minMmr !== undefined && maxMmr !== undefined) {
    if (minMmr >= maxMmr) {
      throw new BadRequestException('Minimum MMR must be less than maximum MMR');
    }
  }
  if (minMmr !== undefined && minMmr < 0) {
    throw new BadRequestException('Minimum MMR cannot be negative');
  }
  if (maxMmr !== undefined && maxMmr < 0) {
    throw new BadRequestException('Maximum MMR cannot be negative');
  }
}

/**
 * Validate participant count
 */
export function validateParticipantCount(
  minParticipants: number,
  maxParticipants: number,
): void {
  validatePositiveInteger(minParticipants, 'minParticipants', 2);
  validatePositiveInteger(maxParticipants, 'maxParticipants', 2);

  if (minParticipants > maxParticipants) {
    throw new BadRequestException(
      'Minimum participants cannot exceed maximum participants',
    );
  }
}

/**
 * Validate team size
 */
export function validateTeamSize(teamSize: number): void {
  validatePositiveInteger(teamSize, 'teamSize', 1);
  if (teamSize > 100) {
    throw new BadRequestException('Team size cannot exceed 100');
  }
}

/**
 * Validate bracket size is power of 2 for elimination formats
 */
export function validateBracketSize(participantCount: number, format: string): void {
  if (format === 'single_elimination' || format === 'double_elimination') {
    if (participantCount < 2) {
      throw new BadRequestException('At least 2 participants are required for elimination brackets');
    }
  }
}

/**
 * Validate Swiss rounds
 */
export function validateSwissRounds(rounds: number, participantCount: number): void {
  validatePositiveInteger(rounds, 'swissRounds', 1);
  const maxRounds = Math.ceil(Math.log2(participantCount));
  if (rounds > maxRounds + 2) {
    throw new BadRequestException(
      `Swiss rounds (${rounds}) is too high for ${participantCount} participants. Recommended: ${maxRounds}`,
    );
  }
}

/**
 * Validate URL format
 */
export function validateUrl(url: string, fieldName: string): void {
  if (!url) return;
  try {
    new URL(url);
  } catch {
    throw new BadRequestException(`Invalid URL format for ${fieldName}`);
  }
}

/**
 * Validate region code
 */
export function validateRegion(region: string): void {
  const validRegions = ['NA', 'EU', 'APAC', 'SA', 'OCE', 'ME', 'AF', 'SEA', 'CN', 'JP', 'KR'];
  if (!validRegions.includes(region.toUpperCase())) {
    throw new BadRequestException(
      `Invalid region: ${region}. Valid regions: ${validRegions.join(', ')}`,
    );
  }
}

/**
 * Validate currency code
 */
export function validateCurrency(currency: string): void {
  const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'KRW', 'BTC', 'ETH', 'USDC', 'USDT'];
  if (!validCurrencies.includes(currency.toUpperCase())) {
    throw new BadRequestException(
      `Invalid currency: ${currency}. Valid currencies: ${validCurrencies.join(', ')}`,
    );
  }
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  if (!input) return input;
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize tournament name
 */
export function validateTournamentName(name: string): string {
  validateStringLength(name, 'Tournament name', 3, 255);
  return sanitizeString(name.trim());
}

/**
 * Validate and sanitize participant name
 */
export function validateParticipantName(name: string): string {
  validateStringLength(name, 'Participant name', 1, 100);
  return sanitizeString(name.trim());
}
