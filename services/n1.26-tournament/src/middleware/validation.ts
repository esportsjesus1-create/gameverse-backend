import { body, param, query, ValidationChain } from 'express-validator';
import { TournamentStatus, TournamentFormat, MatchStatus } from '@prisma/client';

export const validateCreateTournament: ValidationChain[] = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 255 })
    .withMessage('Name must be at most 255 characters'),
  body('game')
    .trim()
    .notEmpty()
    .withMessage('Game is required')
    .isLength({ max: 100 })
    .withMessage('Game must be at most 100 characters'),
  body('maxParticipants')
    .isInt({ min: 2, max: 1024 })
    .withMessage('Max participants must be between 2 and 1024'),
  body('minParticipants')
    .optional()
    .isInt({ min: 2 })
    .withMessage('Min participants must be at least 2'),
  body('format')
    .optional()
    .isIn(Object.values(TournamentFormat))
    .withMessage(`Format must be one of: ${Object.values(TournamentFormat).join(', ')}`),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be at most 2000 characters'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  body('registrationStartDate')
    .optional()
    .isISO8601()
    .withMessage('Registration start date must be a valid ISO 8601 date'),
  body('registrationEndDate')
    .optional()
    .isISO8601()
    .withMessage('Registration end date must be a valid ISO 8601 date'),
  body('rules')
    .optional()
    .trim()
    .isLength({ max: 10000 })
    .withMessage('Rules must be at most 10000 characters'),
  body('prizePool')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Prize pool must be at most 500 characters'),
];

export const validateUpdateTournament: ValidationChain[] = [
  param('id').isUUID().withMessage('Invalid tournament ID'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Name must be at most 255 characters'),
  body('game')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Game cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Game must be at most 100 characters'),
  body('maxParticipants')
    .optional()
    .isInt({ min: 2, max: 1024 })
    .withMessage('Max participants must be between 2 and 1024'),
  body('status')
    .optional()
    .isIn(Object.values(TournamentStatus))
    .withMessage(`Status must be one of: ${Object.values(TournamentStatus).join(', ')}`),
  body('format')
    .optional()
    .isIn(Object.values(TournamentFormat))
    .withMessage(`Format must be one of: ${Object.values(TournamentFormat).join(', ')}`),
];

export const validateTournamentId: ValidationChain[] = [
  param('id').isUUID().withMessage('Invalid tournament ID'),
];

export const validateAddParticipant: ValidationChain[] = [
  param('id').isUUID().withMessage('Invalid tournament ID'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 255 })
    .withMessage('Name must be at most 255 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email address'),
  body('userId')
    .optional()
    .isUUID()
    .withMessage('Invalid user ID'),
  body('teamId')
    .optional()
    .isUUID()
    .withMessage('Invalid team ID'),
  body('seed')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Seed must be a positive integer'),
];

export const validateParticipantId: ValidationChain[] = [
  param('id').isUUID().withMessage('Invalid tournament ID'),
  param('participantId').isUUID().withMessage('Invalid participant ID'),
];

export const validateUpdateMatch: ValidationChain[] = [
  param('id').isUUID().withMessage('Invalid match ID'),
  body('player1Score')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Player 1 score must be a non-negative integer'),
  body('player2Score')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Player 2 score must be a non-negative integer'),
  body('winnerId')
    .optional()
    .isUUID()
    .withMessage('Invalid winner ID'),
  body('status')
    .optional()
    .isIn(Object.values(MatchStatus))
    .withMessage(`Status must be one of: ${Object.values(MatchStatus).join(', ')}`),
  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid ISO 8601 date'),
];

export const validateMatchId: ValidationChain[] = [
  param('id').isUUID().withMessage('Invalid match ID'),
];

export const validateListTournaments: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(Object.values(TournamentStatus))
    .withMessage(`Status must be one of: ${Object.values(TournamentStatus).join(', ')}`),
  query('format')
    .optional()
    .isIn(Object.values(TournamentFormat))
    .withMessage(`Format must be one of: ${Object.values(TournamentFormat).join(', ')}`),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'startDate', 'name'])
    .withMessage('Sort by must be one of: createdAt, startDate, name'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

export const validateGenerateBracket: ValidationChain[] = [
  param('id').isUUID().withMessage('Invalid tournament ID'),
  body('shuffleSeeds')
    .optional()
    .isBoolean()
    .withMessage('Shuffle seeds must be a boolean'),
  body('schedulingStartTime')
    .optional()
    .isISO8601()
    .withMessage('Scheduling start time must be a valid ISO 8601 date'),
  body('matchDurationMinutes')
    .optional()
    .isInt({ min: 1, max: 480 })
    .withMessage('Match duration must be between 1 and 480 minutes'),
  body('breakBetweenMatchesMinutes')
    .optional()
    .isInt({ min: 0, max: 120 })
    .withMessage('Break between matches must be between 0 and 120 minutes'),
];
