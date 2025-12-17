import { Router } from 'express';
import userRoutes from './user.routes';
import blockchainRoutes from './blockchain.routes';

const router = Router();

router.use('/users', userRoutes);
router.use('/users', blockchainRoutes);

export default router;
