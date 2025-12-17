import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { tournamentService } from '../services/tournament.service';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.post(
  '/',
  [
    body('name').isString().notEmpty().isLength({ max: 100 }),
    body('gameMode').isString().notEmpty(),
    body('format').isIn(['single_elimination', 'double_elimination', 'round_robin', 'swiss']),
    body('maxParticipants').isInt({ min: 2, max: 256 }),
    body('minParticipants').optional().isInt({ min: 2 }),
    body('entryFee').optional().isFloat({ min: 0 }),
    body('prizePool').optional().isObject(),
    body('settings').optional().isObject(),
    body('registrationStartsAt').isISO8601(),
    body('registrationEndsAt').isISO8601(),
    body('startsAt').isISO8601(),
    body('createdBy').isString().notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const tournament = await tournamentService.createTournament({
      ...req.body,
      registrationStartsAt: new Date(req.body.registrationStartsAt),
      registrationEndsAt: new Date(req.body.registrationEndsAt),
      startsAt: new Date(req.body.startsAt),
    });

    res.status(201).json({
      success: true,
      data: tournament,
      message: 'Tournament created',
    });
  })
);

router.get(
  '/',
  [
    query('status').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const result = await tournamentService.getTournaments(
      req.query.status as string,
      page,
      limit
    );

    res.json({
      success: true,
      data: result.tournaments,
      total: result.total,
      page,
      limit,
    });
  })
);

router.get(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tournament = await tournamentService.getTournamentById(req.params.id);

    if (!tournament) {
      res.status(404).json({ success: false, error: 'Tournament not found' });
      return;
    }

    res.json({ success: true, data: tournament });
  })
);

router.post(
  '/:id/open-registration',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tournament = await tournamentService.openRegistration(req.params.id);

    res.json({
      success: true,
      data: tournament,
      message: 'Registration opened',
    });
  })
);

router.post(
  '/:id/register',
  [
    param('id').isUUID(),
    body('userId').isString().notEmpty(),
    body('username').isString().notEmpty(),
    body('teamId').optional().isString(),
    body('teamName').optional().isString(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const participant = await tournamentService.registerParticipant({
      tournamentId: req.params.id,
      userId: req.body.userId,
      username: req.body.username,
      teamId: req.body.teamId,
      teamName: req.body.teamName,
    });

    res.status(201).json({
      success: true,
      data: participant,
      message: 'Registered for tournament',
    });
  })
);

router.get(
  '/:id/participants',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const participantList = await tournamentService.getParticipants(req.params.id);

    res.json({ success: true, data: participantList });
  })
);

router.post(
  '/:id/check-in',
  [
    param('id').isUUID(),
    body('userId').isString().notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const participant = await tournamentService.checkInParticipant(req.params.id, req.body.userId);

    res.json({
      success: true,
      data: participant,
      message: 'Checked in successfully',
    });
  })
);

router.post(
  '/:id/start',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const bracket = await tournamentService.startTournament(req.params.id);

    res.json({
      success: true,
      data: bracket,
      message: 'Tournament started',
    });
  })
);

router.get(
  '/:id/bracket',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const bracket = await tournamentService.getBracket(req.params.id);

    if (!bracket) {
      res.status(404).json({ success: false, error: 'Bracket not generated yet' });
      return;
    }

    res.json({ success: true, data: bracket });
  })
);

router.post(
  '/matches/:matchId/result',
  [
    param('matchId').isUUID(),
    body('winnerId').isString().notEmpty(),
    body('score1').isInt({ min: 0 }),
    body('score2').isInt({ min: 0 }),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const match = await tournamentService.reportMatchResult({
      matchId: req.params.matchId,
      winnerId: req.body.winnerId,
      score1: req.body.score1,
      score2: req.body.score2,
    });

    res.json({
      success: true,
      data: match,
      message: 'Match result reported',
    });
  })
);

router.get(
  '/matches/:matchId',
  [param('matchId').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const match = await tournamentService.getMatch(req.params.matchId);

    if (!match) {
      res.status(404).json({ success: false, error: 'Match not found' });
      return;
    }

    res.json({ success: true, data: match });
  })
);

router.post(
  '/:id/cancel',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tournament = await tournamentService.cancelTournament(req.params.id);

    res.json({
      success: true,
      data: tournament,
      message: 'Tournament cancelled',
    });
  })
);

router.delete(
  '/:id/participants/:userId',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await tournamentService.withdrawParticipant(req.params.id, req.params.userId);

    res.json({
      success: true,
      message: 'Withdrawn from tournament',
    });
  })
);

export default router;
