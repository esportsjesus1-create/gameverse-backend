import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { generateToken } from '../websocket/server';
import { validate } from '../middleware/validation.middleware';
import { LoggerService } from '../services/logger.service';

const router = Router();
const logger = new LoggerService('AuthRoutes');

const generateTokenValidation = [
  body('playerId')
    .optional()
    .isString()
    .withMessage('Player ID must be a string')
];

router.post(
  '/token',
  validate(generateTokenValidation),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const playerId = req.body.playerId || uuidv4();
      const token = generateToken(playerId);

      logger.info('Token generated', { playerId });

      res.json({
        success: true,
        data: {
          token,
          playerId,
          expiresIn: '24h'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Token generation failed', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate token',
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;
