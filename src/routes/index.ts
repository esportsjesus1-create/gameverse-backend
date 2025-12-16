import { Router } from 'express';
import accountsRouter from './accounts';
import transactionsRouter from './transactions';
import currenciesRouter from './currencies';
import statementsRouter from './statements';
import snapshotsRouter from './snapshots';
import reconciliationRouter from './reconciliation';
import auditRouter from './audit';

const router = Router();

router.use('/accounts', accountsRouter);
router.use('/transactions', transactionsRouter);
router.use('/currencies', currenciesRouter);
router.use('/statements', statementsRouter);
router.use('/snapshots', snapshotsRouter);
router.use('/reconciliation', reconciliationRouter);
router.use('/audit', auditRouter);

export default router;
