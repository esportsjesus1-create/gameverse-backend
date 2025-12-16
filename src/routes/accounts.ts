import { Router, Request, Response, NextFunction } from 'express';
import { accountService } from '../services/AccountService';
import { AccountType } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, type, currencyCode, parentId, description } = req.body;
    const userId = req.headers['x-user-id'] as string || 'system';
    
    if (!code || !name || !type || !currencyCode) {
      res.status(400).json({ error: 'Missing required fields: code, name, type, currencyCode' });
      return;
    }
    
    if (!Object.values(AccountType).includes(type)) {
      res.status(400).json({ error: `Invalid account type. Must be one of: ${Object.values(AccountType).join(', ')}` });
      return;
    }
    
    const account = await accountService.createAccount(
      { code, name, type, currencyCode, parentId, description },
      userId
    );
    
    res.status(201).json(account);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const type = req.query.type as AccountType;
    
    if (type) {
      const accounts = await accountService.getAccountsByType(type);
      res.json({ data: accounts, total: accounts.length });
    } else {
      const result = await accountService.getAllAccounts({ page, limit });
      res.json(result);
    }
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await accountService.getAccount(req.params.id);
    
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    
    res.json(account);
  } catch (error) {
    next(error);
  }
});

router.get('/code/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await accountService.getAccountByCode(req.params.code);
    
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    
    res.json(account);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : undefined;
    const inBaseCurrency = req.query.baseCurrency === 'true';
    
    let balance;
    if (inBaseCurrency) {
      balance = await accountService.getAccountBalanceInBaseCurrency(req.params.id, asOfDate);
    } else {
      balance = await accountService.getAccountBalance(req.params.id, asOfDate);
    }
    
    res.json({ accountId: req.params.id, balance: balance.toString(), asOfDate: asOfDate || new Date() });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/children', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const children = await accountService.getChildAccounts(req.params.id);
    res.json({ data: children, total: children.length });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, isActive } = req.body;
    const userId = req.headers['x-user-id'] as string || 'system';
    
    const account = await accountService.updateAccount(
      req.params.id,
      { name, description, isActive },
      userId
    );
    
    res.json(account);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/deactivate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'system';
    const account = await accountService.deactivateAccount(req.params.id, userId);
    res.json(account);
  } catch (error) {
    next(error);
  }
});

export default router;
