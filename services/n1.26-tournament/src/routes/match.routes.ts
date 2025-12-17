import { Router, Request, Response, NextFunction } from 'express';
import { matchController } from '../controllers';
import { validateUpdateMatch, validateMatchId } from '../middleware/validation';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

router.get(
  '/:id',
  validateMatchId,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => matchController.getById(req, res, next)
);

router.put(
  '/:id',
  validateUpdateMatch,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => matchController.updateResult(req, res, next)
);

router.post(
  '/:id/start',
  validateMatchId,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => matchController.startMatch(req, res, next)
);

router.post(
  '/:id/cancel',
  validateMatchId,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => matchController.cancelMatch(req, res, next)
);

router.post(
  '/:id/schedule',
  validateMatchId,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => matchController.scheduleMatch(req, res, next)
);

export default router;
