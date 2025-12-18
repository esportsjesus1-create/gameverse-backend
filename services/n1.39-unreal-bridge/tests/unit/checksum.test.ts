import {
  calculateChecksum,
  verifyChecksum,
  calculateCRC32,
  generateStateChecksum
} from '../../src/utils/checksum';

describe('Checksum utilities', () => {
  describe('calculateChecksum', () => {
    it('should calculate SHA256 checksum for string', () => {
      const checksum = calculateChecksum('test data');

      expect(checksum).toBeDefined();
      expect(checksum.length).toBe(64);
    });

    it('should calculate SHA256 checksum for buffer', () => {
      const buffer = Buffer.from('test data');
      const checksum = calculateChecksum(buffer);

      expect(checksum).toBeDefined();
      expect(checksum.length).toBe(64);
    });

    it('should produce consistent results', () => {
      const checksum1 = calculateChecksum('same data');
      const checksum2 = calculateChecksum('same data');

      expect(checksum1).toBe(checksum2);
    });

    it('should produce different results for different data', () => {
      const checksum1 = calculateChecksum('data 1');
      const checksum2 = calculateChecksum('data 2');

      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('verifyChecksum', () => {
    it('should return true for matching checksum', () => {
      const data = 'test data';
      const checksum = calculateChecksum(data);

      const result = verifyChecksum(data, checksum);

      expect(result).toBe(true);
    });

    it('should return false for non-matching checksum', () => {
      const data = 'test data';
      const wrongChecksum = 'invalid-checksum';

      const result = verifyChecksum(data, wrongChecksum);

      expect(result).toBe(false);
    });

    it('should work with buffer data', () => {
      const buffer = Buffer.from('test data');
      const checksum = calculateChecksum(buffer);

      const result = verifyChecksum(buffer, checksum);

      expect(result).toBe(true);
    });
  });

  describe('calculateCRC32', () => {
    it('should calculate CRC32 for string', () => {
      const crc = calculateCRC32('test data');

      expect(crc).toBeDefined();
      expect(typeof crc).toBe('number');
    });

    it('should calculate CRC32 for buffer', () => {
      const buffer = Buffer.from('test data');
      const crc = calculateCRC32(buffer);

      expect(crc).toBeDefined();
      expect(typeof crc).toBe('number');
    });

    it('should produce consistent results', () => {
      const crc1 = calculateCRC32('same data');
      const crc2 = calculateCRC32('same data');

      expect(crc1).toBe(crc2);
    });

    it('should produce different results for different data', () => {
      const crc1 = calculateCRC32('data 1');
      const crc2 = calculateCRC32('data 2');

      expect(crc1).not.toBe(crc2);
    });

    it('should return positive number', () => {
      const crc = calculateCRC32('test');
      expect(crc).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateStateChecksum', () => {
    it('should generate checksum for object state', () => {
      const state = { key: 'value', number: 123 };
      const checksum = generateStateChecksum(state);

      expect(checksum).toBeDefined();
      expect(checksum.length).toBe(64);
    });

    it('should produce consistent results regardless of key order', () => {
      const state1 = { a: 1, b: 2, c: 3 };
      const state2 = { c: 3, a: 1, b: 2 };

      const checksum1 = generateStateChecksum(state1);
      const checksum2 = generateStateChecksum(state2);

      expect(checksum1).toBe(checksum2);
    });

    it('should produce different results for different states', () => {
      const state1 = { value: 1 };
      const state2 = { value: 2 };

      const checksum1 = generateStateChecksum(state1);
      const checksum2 = generateStateChecksum(state2);

      expect(checksum1).not.toBe(checksum2);
    });

    it('should handle nested objects', () => {
      const state = {
        level1: {
          level2: {
            value: 'deep'
          }
        }
      };

      const checksum = generateStateChecksum(state);

      expect(checksum).toBeDefined();
      expect(checksum.length).toBe(64);
    });

    it('should handle arrays', () => {
      const state = { items: [1, 2, 3] };
      const checksum = generateStateChecksum(state);

      expect(checksum).toBeDefined();
    });
  });
});
