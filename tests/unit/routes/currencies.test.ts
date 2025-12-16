import request from 'supertest';
import express from 'express';
import currenciesRouter from '../../../src/routes/currencies';
import Decimal from 'decimal.js';

jest.mock('../../../src/services/CurrencyService', () => ({
  currencyService: {
    getAllCurrencies: jest.fn(),
    getCurrency: jest.fn(),
    getBaseCurrency: jest.fn(),
    createCurrency: jest.fn(),
    setExchangeRate: jest.fn(),
    getExchangeRate: jest.fn(),
    getExchangeRateHistory: jest.fn(),
    convertAmount: jest.fn(),
  },
}));

const { currencyService } = require('../../../src/services/CurrencyService');

const app = express();
app.use(express.json());
app.use('/currencies', currenciesRouter);

describe('Currencies Routes', () => {
  const mockCurrency = {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    decimalPlaces: 2,
    isBaseCurrency: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /currencies', () => {
    it('should return all currencies', async () => {
      currencyService.getAllCurrencies.mockResolvedValue([mockCurrency]);

      const response = await request(app).get('/currencies');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /currencies/base', () => {
    it('should return the base currency', async () => {
      currencyService.getBaseCurrency.mockResolvedValue(mockCurrency);

      const response = await request(app).get('/currencies/base');

      expect(response.status).toBe(200);
      expect(response.body.code).toBe('USD');
    });
  });

  describe('GET /currencies/:code', () => {
    it('should return a currency by code', async () => {
      currencyService.getCurrency.mockResolvedValue(mockCurrency);

      const response = await request(app).get('/currencies/USD');

      expect(response.status).toBe(200);
      expect(response.body.code).toBe('USD');
    });

    it('should return 404 for non-existent currency', async () => {
      currencyService.getCurrency.mockResolvedValue(null);

      const response = await request(app).get('/currencies/XXX');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /currencies', () => {
    it('should create a currency', async () => {
      currencyService.createCurrency.mockResolvedValue(mockCurrency);

      const response = await request(app)
        .post('/currencies')
        .send({ code: 'USD', name: 'US Dollar', symbol: '$' });

      expect(response.status).toBe(201);
      expect(response.body.code).toBe('USD');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/currencies')
        .send({ code: 'USD' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /currencies/exchange-rates', () => {
    it('should set an exchange rate', async () => {
      const mockRate = {
        id: 'rate-1',
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: new Decimal(0.85),
        effectiveDate: new Date(),
        createdAt: new Date(),
      };
      currencyService.setExchangeRate.mockResolvedValue(mockRate);

      const response = await request(app)
        .post('/currencies/exchange-rates')
        .send({ fromCurrency: 'USD', toCurrency: 'EUR', rate: 0.85 });

      expect(response.status).toBe(201);
      expect(response.body.rate).toBe('0.85');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/currencies/exchange-rates')
        .send({ fromCurrency: 'USD' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /currencies/exchange-rates/:from/:to', () => {
    it('should return exchange rate', async () => {
      currencyService.getExchangeRate.mockResolvedValue(new Decimal(0.85));

      const response = await request(app).get('/currencies/exchange-rates/USD/EUR');

      expect(response.status).toBe(200);
      expect(response.body.rate).toBe('0.85');
    });
  });

  describe('GET /currencies/exchange-rates/:from/:to/history', () => {
    it('should return exchange rate history', async () => {
      const mockRates = [
        { id: '1', fromCurrency: 'USD', toCurrency: 'EUR', rate: new Decimal(0.85), effectiveDate: new Date(), createdAt: new Date() },
      ];
      currencyService.getExchangeRateHistory.mockResolvedValue(mockRates);

      const response = await request(app).get('/currencies/exchange-rates/USD/EUR/history');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('POST /currencies/convert', () => {
    it('should convert amount', async () => {
      currencyService.convertAmount.mockResolvedValue(new Decimal(85));

      const response = await request(app)
        .post('/currencies/convert')
        .send({ amount: 100, fromCurrency: 'USD', toCurrency: 'EUR' });

      expect(response.status).toBe(200);
      expect(response.body.convertedAmount).toBe('85');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/currencies/convert')
        .send({ amount: 100 });

      expect(response.status).toBe(400);
    });
  });
});
