import { Router } from 'express';
import tournamentRoutes from './tournament.routes';
import matchRoutes from './match.routes';

const router = Router();

router.use('/tournaments', tournamentRoutes);
router.use('/matches', matchRoutes);

export default router;
