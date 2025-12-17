import { Router } from 'express';
import { body, param } from 'express-validator';
import { seasonController } from '../controllers';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

const createSeasonValidation = [
  body('name').isString().notEmpty().withMessage('Name is required'),
  body('number').isInt({ min: 1 }).withMessage('Season number must be a positive integer'),
  body('startDate').isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  body('softResetFactor')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Soft reset factor must be between 0 and 1'),
  body('placementMatchesRequired')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Placement matches must be between 1 and 20'),
];

const seasonIdValidation = [
  param('seasonId').isUUID().withMessage('Season ID must be a valid UUID'),
];

const seasonNumberValidation = [
  param('number').isInt({ min: 1 }).withMessage('Season number must be a positive integer'),
];

router.post('/', validate(createSeasonValidation), asyncHandler(seasonController.createSeason.bind(seasonController)));

router.get('/active', asyncHandler(seasonController.getActiveSeason.bind(seasonController)));

router.get('/number/:number', validate(seasonNumberValidation), asyncHandler(seasonController.getSeasonByNumber.bind(seasonController)));

router.get('/:seasonId', validate(seasonIdValidation), asyncHandler(seasonController.getSeasonById.bind(seasonController)));

router.post('/:seasonId/end', validate(seasonIdValidation), asyncHandler(seasonController.endSeason.bind(seasonController)));

router.post('/:seasonId/soft-reset', validate(seasonIdValidation), asyncHandler(seasonController.performSoftReset.bind(seasonController)));

export default router;
