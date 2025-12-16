import { Router, Request, Response, NextFunction } from 'express';
import { currencyService } from '../services/CurrencyService';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currencies = await currencyService.getAllCurrencies();
    res.json({ data: currencies, total: currencies.length });
  } catch (error) {
    next(error);
  }
});

router.get('/base', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currency = await currencyService.getBaseCurrency();
    res.json(currency);
  } catch (error) {
    next(error);
  }
});

router.get('/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currency = await currencyService.getCurrency(req.params.code);
    
    if (!currency) {
      res.status(404).json({ error: 'Currency not found' });
      return;
    }
    
    res.json(currency);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, symbol, decimalPlaces, isBaseCurrency } = req.body;
    
    if (!code || !name || !symbol) {
      res.status(400).json({ error: 'Missing required fields: code, name, symbol' });
      return;
    }
    
    const currency = await currencyService.createCurrency({
      code,
      name,
      symbol,
      decimalPlaces: decimalPlaces ?? 2,
      isBaseCurrency,
    });
    
    res.status(201).json(currency);
  } catch (error) {
    next(error);
  }
});

router.post('/exchange-rates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromCurrency, toCurrency, rate, effectiveDate } = req.body;
    
    if (!fromCurrency || !toCurrency || !rate) {
      res.status(400).json({ error: 'Missing required fields: fromCurrency, toCurrency, rate' });
      return;
    }
    
    const exchangeRate = await currencyService.setExchangeRate(
      fromCurrency,
      toCurrency,
      rate,
      effectiveDate ? new Date(effectiveDate) : new Date()
    );
    
    res.status(201).json({
      ...exchangeRate,
      rate: exchangeRate.rate.toString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/exchange-rates/:from/:to', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    const rate = await currencyService.getExchangeRate(req.params.from, req.params.to, date);
    
    res.json({
      fromCurrency: req.params.from,
      toCurrency: req.params.to,
      rate: rate.toString(),
      date,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/exchange-rates/:from/:to/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    
    const history = await currencyService.getExchangeRateHistory(
      req.params.from,
      req.params.to,
      startDate,
      endDate
    );
    
    res.json({
      data: history.map(r => ({ ...r, rate: r.rate.toString() })),
      total: history.length,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/convert', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, fromCurrency, toCurrency, date } = req.body;
    
    if (!amount || !fromCurrency || !toCurrency) {
      res.status(400).json({ error: 'Missing required fields: amount, fromCurrency, toCurrency' });
      return;
    }
    
    const convertedAmount = await currencyService.convertAmount(
      amount,
      fromCurrency,
      toCurrency,
      date ? new Date(date) : new Date()
    );
    
    res.json({
      originalAmount: amount,
      fromCurrency,
      convertedAmount: convertedAmount.toString(),
      toCurrency,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
