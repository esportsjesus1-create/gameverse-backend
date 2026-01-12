import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4();
}

export function getCurrentTimestamp(): number {
  return Date.now();
}

export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  const safeIndex = Math.max(0, Math.min(index, sorted.length - 1));
  return sorted[safeIndex] ?? 0;
}

export function calculateAverage(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

export function calculateSum(values: number[]): number {
  return values.reduce((sum, val) => sum + val, 0);
}

export function getTimeRangeForPeriod(
  period: 'minute' | 'hour' | 'day' | 'week' | 'month',
  timestamp: number
): { start: number; end: number } {
  const date = new Date(timestamp);
  let start: Date;
  let end: Date;

  switch (period) {
    case 'minute':
      start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), 0, 0);
      end = new Date(start.getTime() + 60 * 1000);
      break;
    case 'hour':
      start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), 0, 0, 0);
      end = new Date(start.getTime() + 60 * 60 * 1000);
      break;
    case 'day':
      start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'week': {
      const dayOfWeek = date.getDay();
      start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek, 0, 0, 0, 0);
      end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    }
    case 'month':
      start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
      break;
  }

  return { start: start.getTime(), end: end.getTime() };
}

export function convertToCSV<T extends Record<string, unknown>>(data: T[]): string {
  if (data.length === 0) {
    return '';
  }

  const firstItem = data[0];
  if (firstItem === undefined) {
    return '';
  }
  
  const headers = Object.keys(firstItem);
  const csvRows: string[] = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

export function sanitizeString(input: string): string {
  return input.replace(/[<>'"&]/g, (char) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
      '&': '&amp;'
    };
    return entities[char] ?? char;
  });
}

export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((result, item) => {
    const key = keyFn(item);
    const existing = result[key];
    if (existing === undefined) {
      result[key] = [item];
    } else {
      existing.push(item);
    }
    return result;
  }, {} as Record<string, T[]>);
}
