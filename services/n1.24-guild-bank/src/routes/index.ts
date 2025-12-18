import { Router } from 'express';
import guildBankRoutes from './guildBankRoutes';
import transactionRoutes from './transactionRoutes';
import contributionRoutes from './contributionRoutes';

const router = Router();

// Mount routes
router.use('/banks', guildBankRoutes);
router.use('/transactions', transactionRoutes);
router.use('/', contributionRoutes);

export default router;
