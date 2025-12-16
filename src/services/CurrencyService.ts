import Decimal from 'decimal.js';
import { query } from '../db/pool';
import { Currency, ExchangeRate } from '../types';

export class CurrencyService {
  async getAllCurrencies(): Promise<Currency[]> {
    const result = await query<{
      code: string;
      name: string;
      symbol: string;
      decimal_places: number;
      is_base_currency: boolean;
    }>('SELECT * FROM currencies ORDER BY code');
    
    return result.rows.map(row => ({
      code: row.code,
      name: row.name,
      symbol: row.symbol,
      decimalPlaces: row.decimal_places,
      isBaseCurrency: row.is_base_currency,
    }));
  }

  async getCurrency(code: string): Promise<Currency | null> {
    const result = await query<{
      code: string;
      name: string;
      symbol: string;
      decimal_places: number;
      is_base_currency: boolean;
    }>('SELECT * FROM currencies WHERE code = $1', [code]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      code: row.code,
      name: row.name,
      symbol: row.symbol,
      decimalPlaces: row.decimal_places,
      isBaseCurrency: row.is_base_currency,
    };
  }

  async getBaseCurrency(): Promise<Currency> {
    const result = await query<{
      code: string;
      name: string;
      symbol: string;
      decimal_places: number;
      is_base_currency: boolean;
    }>('SELECT * FROM currencies WHERE is_base_currency = TRUE');
    
    if (result.rows.length === 0) {
      throw new Error('No base currency configured');
    }
    
    const row = result.rows[0];
    return {
      code: row.code,
      name: row.name,
      symbol: row.symbol,
      decimalPlaces: row.decimal_places,
      isBaseCurrency: row.is_base_currency,
    };
  }

  async createCurrency(currency: Omit<Currency, 'isBaseCurrency'> & { isBaseCurrency?: boolean }): Promise<Currency> {
    const result = await query<{
      code: string;
      name: string;
      symbol: string;
      decimal_places: number;
      is_base_currency: boolean;
    }>(
      `INSERT INTO currencies (code, name, symbol, decimal_places, is_base_currency)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [currency.code, currency.name, currency.symbol, currency.decimalPlaces, currency.isBaseCurrency || false]
    );
    
    const row = result.rows[0];
    return {
      code: row.code,
      name: row.name,
      symbol: row.symbol,
      decimalPlaces: row.decimal_places,
      isBaseCurrency: row.is_base_currency,
    };
  }

  async setExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    rate: Decimal | string | number,
    effectiveDate: Date = new Date()
  ): Promise<ExchangeRate> {
    const rateDecimal = new Decimal(rate);
    const dateStr = effectiveDate.toISOString().split('T')[0];
    
    const result = await query<{
      id: string;
      from_currency: string;
      to_currency: string;
      rate: string;
      effective_date: Date;
      created_at: Date;
    }>(
      `INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (from_currency, to_currency, effective_date)
       DO UPDATE SET rate = EXCLUDED.rate
       RETURNING *`,
      [fromCurrency, toCurrency, rateDecimal.toString(), dateStr]
    );
    
    const row = result.rows[0];
    return {
      id: row.id,
      fromCurrency: row.from_currency,
      toCurrency: row.to_currency,
      rate: new Decimal(row.rate),
      effectiveDate: row.effective_date,
      createdAt: row.created_at,
    };
  }

  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    date: Date = new Date()
  ): Promise<Decimal> {
    if (fromCurrency === toCurrency) {
      return new Decimal(1);
    }
    
    const dateStr = date.toISOString().split('T')[0];
    
    const result = await query<{ rate: string }>(
      `SELECT rate FROM exchange_rates
       WHERE from_currency = $1 AND to_currency = $2 AND effective_date <= $3
       ORDER BY effective_date DESC
       LIMIT 1`,
      [fromCurrency, toCurrency, dateStr]
    );
    
    if (result.rows.length > 0) {
      return new Decimal(result.rows[0].rate);
    }
    
    const inverseResult = await query<{ rate: string }>(
      `SELECT rate FROM exchange_rates
       WHERE from_currency = $1 AND to_currency = $2 AND effective_date <= $3
       ORDER BY effective_date DESC
       LIMIT 1`,
      [toCurrency, fromCurrency, dateStr]
    );
    
    if (inverseResult.rows.length > 0) {
      return new Decimal(1).div(new Decimal(inverseResult.rows[0].rate));
    }
    
    throw new Error(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
  }

  async convertAmount(
    amount: Decimal | string | number,
    fromCurrency: string,
    toCurrency: string,
    date: Date = new Date()
  ): Promise<Decimal> {
    const amountDecimal = new Decimal(amount);
    const rate = await this.getExchangeRate(fromCurrency, toCurrency, date);
    return amountDecimal.mul(rate);
  }

  async convertToBaseCurrency(
    amount: Decimal | string | number,
    fromCurrency: string,
    date: Date = new Date()
  ): Promise<{ amount: Decimal; rate: Decimal }> {
    const baseCurrency = await this.getBaseCurrency();
    
    if (fromCurrency === baseCurrency.code) {
      return {
        amount: new Decimal(amount),
        rate: new Decimal(1),
      };
    }
    
    const rate = await this.getExchangeRate(fromCurrency, baseCurrency.code, date);
    const convertedAmount = new Decimal(amount).mul(rate);
    
    return {
      amount: convertedAmount,
      rate,
    };
  }

  async getExchangeRateHistory(
    fromCurrency: string,
    toCurrency: string,
    startDate: Date,
    endDate: Date
  ): Promise<ExchangeRate[]> {
    const result = await query<{
      id: string;
      from_currency: string;
      to_currency: string;
      rate: string;
      effective_date: Date;
      created_at: Date;
    }>(
      `SELECT * FROM exchange_rates
       WHERE from_currency = $1 AND to_currency = $2
       AND effective_date BETWEEN $3 AND $4
       ORDER BY effective_date`,
      [fromCurrency, toCurrency, startDate, endDate]
    );
    
    return result.rows.map(row => ({
      id: row.id,
      fromCurrency: row.from_currency,
      toCurrency: row.to_currency,
      rate: new Decimal(row.rate),
      effectiveDate: row.effective_date,
      createdAt: row.created_at,
    }));
  }
}

export const currencyService = new CurrencyService();
