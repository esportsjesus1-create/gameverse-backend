import Decimal from 'decimal.js';
import { CurrencyService } from '../../../src/services/CurrencyService';
import * as pool from '../../../src/db/pool';

jest.mock('../../../src/db/pool');

const mockQuery = pool.query as jest.MockedFunction<typeof pool.query>;

describe('CurrencyService', () => {
  let currencyService: CurrencyService;

  beforeEach(() => {
    currencyService = new CurrencyService();
    jest.clearAllMocks();
  });

  describe('getAllCurrencies', () => {
    it('should return all currencies', async () => {
      const mockCurrencies = [
        { code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2, is_base_currency: true },
        { code: 'EUR', name: 'Euro', symbol: '€', decimal_places: 2, is_base_currency: false },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockCurrencies } as never);

      const result = await currencyService.getAllCurrencies();

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('USD');
      expect(result[0].isBaseCurrency).toBe(true);
      expect(result[1].code).toBe('EUR');
    });
  });

  describe('getCurrency', () => {
    it('should return a currency by code', async () => {
      const mockCurrency = { code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2, is_base_currency: true };
      mockQuery.mockResolvedValueOnce({ rows: [mockCurrency] } as never);

      const result = await currencyService.getCurrency('USD');

      expect(result).not.toBeNull();
      expect(result?.code).toBe('USD');
      expect(result?.name).toBe('US Dollar');
    });

    it('should return null for non-existent currency', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await currencyService.getCurrency('XXX');

      expect(result).toBeNull();
    });
  });

  describe('getBaseCurrency', () => {
    it('should return the base currency', async () => {
      const mockCurrency = { code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2, is_base_currency: true };
      mockQuery.mockResolvedValueOnce({ rows: [mockCurrency] } as never);

      const result = await currencyService.getBaseCurrency();

      expect(result.code).toBe('USD');
      expect(result.isBaseCurrency).toBe(true);
    });

    it('should throw error if no base currency configured', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      await expect(currencyService.getBaseCurrency()).rejects.toThrow('No base currency configured');
    });
  });

  describe('createCurrency', () => {
    it('should create a new currency', async () => {
      const newCurrency = { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimalPlaces: 0 };
      const mockResult = { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimal_places: 0, is_base_currency: false };
      mockQuery.mockResolvedValueOnce({ rows: [mockResult] } as never);

      const result = await currencyService.createCurrency(newCurrency);

      expect(result.code).toBe('JPY');
      expect(result.decimalPlaces).toBe(0);
    });
  });

  describe('setExchangeRate', () => {
    it('should set an exchange rate', async () => {
      const mockResult = {
        id: 'rate-1',
        from_currency: 'USD',
        to_currency: 'EUR',
        rate: '0.85',
        effective_date: new Date(),
        created_at: new Date(),
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockResult] } as never);

      const result = await currencyService.setExchangeRate('USD', 'EUR', 0.85);

      expect(result.fromCurrency).toBe('USD');
      expect(result.toCurrency).toBe('EUR');
      expect(result.rate.toString()).toBe('0.85');
    });
  });

  describe('getExchangeRate', () => {
    it('should return 1 for same currency', async () => {
      const result = await currencyService.getExchangeRate('USD', 'USD');

      expect(result.toString()).toBe('1');
    });

    it('should return direct exchange rate', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ rate: '0.85' }] } as never);

      const result = await currencyService.getExchangeRate('USD', 'EUR');

      expect(result.toString()).toBe('0.85');
    });

    it('should return inverse exchange rate if direct not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ rate: '1.18' }] } as never);

      const result = await currencyService.getExchangeRate('EUR', 'USD');

      expect(result.toNumber()).toBeCloseTo(0.847, 2);
    });

    it('should throw error if no exchange rate found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      await expect(currencyService.getExchangeRate('USD', 'XXX')).rejects.toThrow('No exchange rate found');
    });
  });

  describe('convertAmount', () => {
    it('should convert amount between currencies', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ rate: '0.85' }] } as never);

      const result = await currencyService.convertAmount(100, 'USD', 'EUR');

      expect(result.toString()).toBe('85');
    });
  });

  describe('convertToBaseCurrency', () => {
    it('should return same amount for base currency', async () => {
      const mockBaseCurrency = { code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2, is_base_currency: true };
      mockQuery.mockResolvedValueOnce({ rows: [mockBaseCurrency] } as never);

      const result = await currencyService.convertToBaseCurrency(100, 'USD');

      expect(result.amount.toString()).toBe('100');
      expect(result.rate.toString()).toBe('1');
    });

    it('should convert non-base currency to base currency', async () => {
      const mockBaseCurrency = { code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2, is_base_currency: true };
      mockQuery.mockResolvedValueOnce({ rows: [mockBaseCurrency] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ rate: '1.18' }] } as never);

      const result = await currencyService.convertToBaseCurrency(100, 'EUR');

      expect(result.amount.toString()).toBe('118');
      expect(result.rate.toString()).toBe('1.18');
    });
  });

  describe('getExchangeRateHistory', () => {
    it('should return exchange rate history', async () => {
      const mockRates = [
        { id: '1', from_currency: 'USD', to_currency: 'EUR', rate: '0.84', effective_date: new Date('2024-01-01'), created_at: new Date() },
        { id: '2', from_currency: 'USD', to_currency: 'EUR', rate: '0.85', effective_date: new Date('2024-01-02'), created_at: new Date() },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockRates } as never);

      const result = await currencyService.getExchangeRateHistory('USD', 'EUR', new Date('2024-01-01'), new Date('2024-01-31'));

      expect(result).toHaveLength(2);
      expect(result[0].rate.toString()).toBe('0.84');
    });
  });
});
