import {
  generateId,
  getCurrentTimestamp,
  calculatePercentile,
  calculateAverage,
  calculateSum,
  getTimeRangeForPeriod,
  convertToCSV,
  sanitizeString,
  isValidUUID,
  clamp,
  groupBy
} from '../../src/utils/helpers';

describe('helpers', () => {
  describe('generateId', () => {
    it('should generate a valid UUID', () => {
      const id = generateId();
      expect(isValidUUID(id)).toBe(true);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('getCurrentTimestamp', () => {
    it('should return current timestamp in milliseconds', () => {
      const before = Date.now();
      const timestamp = getCurrentTimestamp();
      const after = Date.now();

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('calculatePercentile', () => {
    it('should calculate p50 correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const p50 = calculatePercentile(values, 50);
      expect(p50).toBe(5);
    });

    it('should calculate p95 correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const p95 = calculatePercentile(values, 95);
      expect(p95).toBe(10);
    });

    it('should return 0 for empty array', () => {
      const p50 = calculatePercentile([], 50);
      expect(p50).toBe(0);
    });

    it('should handle single value', () => {
      const p50 = calculatePercentile([42], 50);
      expect(p50).toBe(42);
    });

    it('should handle unsorted array', () => {
      const values = [5, 1, 9, 3, 7];
      const p50 = calculatePercentile(values, 50);
      expect(p50).toBe(5);
    });
  });

  describe('calculateAverage', () => {
    it('should calculate average correctly', () => {
      const values = [10, 20, 30, 40, 50];
      const avg = calculateAverage(values);
      expect(avg).toBe(30);
    });

    it('should return 0 for empty array', () => {
      const avg = calculateAverage([]);
      expect(avg).toBe(0);
    });

    it('should handle single value', () => {
      const avg = calculateAverage([42]);
      expect(avg).toBe(42);
    });

    it('should handle decimal values', () => {
      const values = [1.5, 2.5, 3.5];
      const avg = calculateAverage(values);
      expect(avg).toBe(2.5);
    });
  });

  describe('calculateSum', () => {
    it('should calculate sum correctly', () => {
      const values = [1, 2, 3, 4, 5];
      const sum = calculateSum(values);
      expect(sum).toBe(15);
    });

    it('should return 0 for empty array', () => {
      const sum = calculateSum([]);
      expect(sum).toBe(0);
    });

    it('should handle negative values', () => {
      const values = [-1, 2, -3, 4];
      const sum = calculateSum(values);
      expect(sum).toBe(2);
    });
  });

  describe('getTimeRangeForPeriod', () => {
    const testTimestamp = new Date('2024-06-15T14:30:45.123Z').getTime();

    it('should calculate minute range', () => {
      const { start, end } = getTimeRangeForPeriod('minute', testTimestamp);
      expect(end - start).toBe(60 * 1000);
    });

    it('should calculate hour range', () => {
      const { start, end } = getTimeRangeForPeriod('hour', testTimestamp);
      expect(end - start).toBe(60 * 60 * 1000);
    });

    it('should calculate day range', () => {
      const { start, end } = getTimeRangeForPeriod('day', testTimestamp);
      expect(end - start).toBe(24 * 60 * 60 * 1000);
    });

    it('should calculate week range', () => {
      const { start, end } = getTimeRangeForPeriod('week', testTimestamp);
      expect(end - start).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should calculate month range', () => {
      const { start, end } = getTimeRangeForPeriod('month', testTimestamp);
      expect(end).toBeGreaterThan(start);
    });
  });

  describe('convertToCSV', () => {
    it('should convert array of objects to CSV', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ];

      const csv = convertToCSV(data);

      expect(csv).toContain('name,age');
      expect(csv).toContain('Alice,30');
      expect(csv).toContain('Bob,25');
    });

    it('should return empty string for empty array', () => {
      const csv = convertToCSV([]);
      expect(csv).toBe('');
    });

    it('should handle values with commas', () => {
      const data = [{ name: 'Doe, John', age: 30 }];
      const csv = convertToCSV(data);
      expect(csv).toContain('"Doe, John"');
    });

    it('should handle values with quotes', () => {
      const data = [{ name: 'John "Johnny" Doe', age: 30 }];
      const csv = convertToCSV(data);
      expect(csv).toContain('""');
    });

    it('should handle null and undefined values', () => {
      const data = [{ name: null, age: undefined }];
      const csv = convertToCSV(data as unknown as Record<string, unknown>[]);
      expect(csv).toContain('name,age');
    });

    it('should handle nested objects', () => {
      const data = [{ name: 'Alice', meta: { key: 'value' } }];
      const csv = convertToCSV(data);
      expect(csv).toContain('name,meta');
    });
  });

  describe('sanitizeString', () => {
    it('should escape HTML entities', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = sanitizeString(input);

      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).toContain('&lt;');
      expect(sanitized).toContain('&gt;');
    });

    it('should escape quotes', () => {
      const input = "It's a \"test\"";
      const sanitized = sanitizeString(input);

      expect(sanitized).toContain('&#39;');
      expect(sanitized).toContain('&quot;');
    });

    it('should escape ampersand', () => {
      const input = 'A & B';
      const sanitized = sanitizeString(input);

      expect(sanitized).toContain('&amp;');
    });

    it('should leave safe strings unchanged', () => {
      const input = 'Hello World 123';
      const sanitized = sanitizeString(input);

      expect(sanitized).toBe(input);
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUID', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should return false for invalid UUID', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });
  });

  describe('groupBy', () => {
    it('should group items by key function', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 }
      ];

      const grouped = groupBy(items, item => item.type);

      expect(grouped['a']).toHaveLength(2);
      expect(grouped['b']).toHaveLength(1);
    });

    it('should return empty object for empty array', () => {
      const grouped = groupBy([], () => 'key');
      expect(Object.keys(grouped)).toHaveLength(0);
    });
  });
});
