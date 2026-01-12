import { Router, Request, Response, NextFunction } from 'express';
import { tournamentController } from '../controllers';
import { participantController } from '../controllers';
import {
  validateCreateTournament,
  validateUpdateTournament,
  validateTournamentId,
  validateAddParticipant,
  validateParticipantId,
  validateListTournaments,
  validateGenerateBracket,
} from '../middleware/validation';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// Tournament CRUD
router.post(
  '/',
  validateCreateTournament,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => tournamentController.create(req, res, next)
);

router.get(
  '/',
  validateListTournaments,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => tournamentController.list(req, res, next)
);

router.get(
  '/:id',
  validateTournamentId,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => tournamentController.getById(req, res, next)
);

router.put(
  '/:id',
  validateUpdateTournament,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => tournamentController.update(req, res, next)
);

router.delete(
  '/:id',
  validateTournamentId,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => tournamentController.delete(req, res, next)
);

// Tournament status
router.patch(
  '/:id/status',
  validateTournamentId,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => tournamentController.updateStatus(req, res, next)
);

// Bracket generation and retrieval
router.post(
  '/:id/generate-bracket',
  validateGenerateBracket,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => tournamentController.generateBracket(req, res, next)
);

router.get(
  '/:id/bracket',
  validateTournamentId,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => tournamentController.getBracket(req, res, next)
);

// Participant management
router.post(
  '/:id/participants',
  validateAddParticipant,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => participantController.addParticipant(req, res, next)
);

router.get(
  '/:id/participants',
  validateTournamentId,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => participantController.getParticipants(req, res, next)
);

router.put(
  '/:id/participants/:participantId',
  validateParticipantId,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => participantController.updateParticipant(req, res, next)
);

router.delete(
  '/:id/participants/:participantId',
  validateParticipantId,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => participantController.removeParticipant(req, res, next)
);

router.post(
  '/:id/participants/:participantId/check-in',
  validateParticipantId,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => participantController.checkIn(req, res, next)
);

router.post(
  '/:id/participants/:participantId/withdraw',
  validateParticipantId,
  validateRequest,
  (req: Request, res: Response, next: NextFunction) => participantController.withdraw(req, res, next)
);

export default router;
