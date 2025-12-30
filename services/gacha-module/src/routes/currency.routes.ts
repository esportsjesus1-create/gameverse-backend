import { Router } from 'express';
import { CurrencyController } from '../controllers/currency.controller';

const router = Router();
const currencyController = new CurrencyController();

router.get('/balance/:playerId', currencyController.getBalance);
router.post('/purchase', currencyController.purchaseCurrency);
router.post('/add', currencyController.addCurrency);
router.post('/deduct', currencyController.deductCurrency);
router.post('/refund', currencyController.refundTransaction);

router.get('/transactions/:playerId', currencyController.getTransactionHistory);

router.get('/spending-limits/:playerId', currencyController.getSpendingLimits);
router.put('/spending-limits/:playerId', currencyController.setSpendingLimits);

export default router;
