import { InputSanitizer } from '../../../src/common/security/sanitizer';

describe('InputSanitizer', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const input = '<script>alert("xss")</script>';
      const result = InputSanitizer.escapeHtml(input);
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should escape ampersands', () => {
      const input = 'Tom & Jerry';
      const result = InputSanitizer.escapeHtml(input);
      expect(result).toBe('Tom &amp; Jerry');
    });

    it('should escape single quotes', () => {
      const input = "It's a test";
      const result = InputSanitizer.escapeHtml(input);
      expect(result).toBe('It&#x27;s a test');
    });

    it('should handle empty string', () => {
      expect(InputSanitizer.escapeHtml('')).toBe('');
    });
  });

  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = InputSanitizer.stripHtml(input);
      expect(result).toBe('Hello World');
    });

    it('should remove script tags and content', () => {
      const input = 'Hello<script>alert("xss")</script>World';
      const result = InputSanitizer.stripHtml(input);
      expect(result).not.toContain('script');
      expect(result).not.toContain('alert');
    });

    it('should handle empty string', () => {
      expect(InputSanitizer.stripHtml('')).toBe('');
    });
  });

  describe('removeDangerousPatterns', () => {
    it('should remove javascript: protocol', () => {
      const input = 'javascript:alert(1)';
      const result = InputSanitizer.removeDangerousPatterns(input);
      expect(result).not.toContain('javascript:');
    });

    it('should remove data: protocol', () => {
      const input = 'data:text/html,<script>alert(1)</script>';
      const result = InputSanitizer.removeDangerousPatterns(input);
      expect(result).not.toContain('data:');
    });

    it('should remove on* event handlers', () => {
      const input = 'onclick=alert(1)';
      const result = InputSanitizer.removeDangerousPatterns(input);
      expect(result).not.toContain('onclick');
    });

    it('should handle empty string', () => {
      expect(InputSanitizer.removeDangerousPatterns('')).toBe('');
    });
  });

  describe('sanitizeForSql', () => {
    it('should escape single quotes', () => {
      const input = "O'Brien";
      const result = InputSanitizer.sanitizeForSql(input);
      expect(result).toBe("O''Brien");
    });

    it('should remove SQL comments', () => {
      const input = 'SELECT * FROM users -- comment';
      const result = InputSanitizer.sanitizeForSql(input);
      expect(result).not.toContain('--');
    });

    it('should remove semicolons', () => {
      const input = 'value; DROP TABLE users;';
      const result = InputSanitizer.sanitizeForSql(input);
      expect(result).not.toContain(';');
    });

    it('should handle empty string', () => {
      expect(InputSanitizer.sanitizeForSql('')).toBe('');
    });
  });

  describe('sanitizeFilePath', () => {
    it('should remove path traversal sequences', () => {
      const input = '../../../etc/passwd';
      const result = InputSanitizer.sanitizeFilePath(input);
      expect(result).not.toContain('..');
    });

    it('should normalize path separators', () => {
      const input = 'path\\to\\file';
      const result = InputSanitizer.sanitizeFilePath(input);
      expect(result).toBe('path/to/file');
    });

    it('should remove null bytes', () => {
      const input = 'file\x00.txt';
      const result = InputSanitizer.sanitizeFilePath(input);
      expect(result).not.toContain('\x00');
    });

    it('should handle empty string', () => {
      expect(InputSanitizer.sanitizeFilePath('')).toBe('');
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove path separators', () => {
      const input = 'path/to/file.txt';
      const result = InputSanitizer.sanitizeFilename(input);
      expect(result).not.toContain('/');
    });

    it('should remove special characters', () => {
      const input = 'file<>:"|?*.txt';
      const result = InputSanitizer.sanitizeFilename(input);
      expect(result).not.toMatch(/[<>:"|?*]/);
    });

    it('should preserve valid filename', () => {
      const input = 'valid-file_name.txt';
      const result = InputSanitizer.sanitizeFilename(input);
      expect(result).toBe('valid-file_name.txt');
    });

    it('should handle empty string', () => {
      expect(InputSanitizer.sanitizeFilename('')).toBe('');
    });
  });

  describe('sanitizeEmail', () => {
    it('should return valid email unchanged', () => {
      const input = 'test@example.com';
      const result = InputSanitizer.sanitizeEmail(input);
      expect(result).toBe('test@example.com');
    });

    it('should trim whitespace', () => {
      const input = '  test@example.com  ';
      const result = InputSanitizer.sanitizeEmail(input);
      expect(result).toBe('test@example.com');
    });

    it('should convert to lowercase', () => {
      const input = 'Test@Example.COM';
      const result = InputSanitizer.sanitizeEmail(input);
      expect(result).toBe('test@example.com');
    });

    it('should return null for invalid email', () => {
      const input = 'invalid-email';
      const result = InputSanitizer.sanitizeEmail(input);
      expect(result).toBeNull();
    });

    it('should handle empty string', () => {
      expect(InputSanitizer.sanitizeEmail('')).toBeNull();
    });
  });

  describe('sanitizePhoneNumber', () => {
    it('should return valid E.164 phone number unchanged', () => {
      const input = '+14155551234';
      const result = InputSanitizer.sanitizePhoneNumber(input);
      expect(result).toBe('+14155551234');
    });

    it('should remove non-digit characters except +', () => {
      const input = '+1 (415) 555-1234';
      const result = InputSanitizer.sanitizePhoneNumber(input);
      expect(result).toBe('+14155551234');
    });

    it('should return null for invalid phone number', () => {
      const input = '123';
      const result = InputSanitizer.sanitizePhoneNumber(input);
      expect(result).toBeNull();
    });

    it('should handle empty string', () => {
      expect(InputSanitizer.sanitizePhoneNumber('')).toBeNull();
    });
  });

  describe('sanitizeUrl', () => {
    it('should return valid URL unchanged', () => {
      const input = 'https://example.com/path';
      const result = InputSanitizer.sanitizeUrl(input);
      expect(result).toBe('https://example.com/path');
    });

    it('should reject javascript: URLs', () => {
      const input = 'javascript:alert(1)';
      const result = InputSanitizer.sanitizeUrl(input);
      expect(result).toBeNull();
    });

    it('should reject data: URLs', () => {
      const input = 'data:text/html,<script>alert(1)</script>';
      const result = InputSanitizer.sanitizeUrl(input);
      expect(result).toBeNull();
    });

    it('should return null for invalid URL', () => {
      const input = 'not-a-url';
      const result = InputSanitizer.sanitizeUrl(input);
      expect(result).toBeNull();
    });

    it('should handle empty string', () => {
      expect(InputSanitizer.sanitizeUrl('')).toBeNull();
    });
  });

  describe('sanitizeJson', () => {
    it('should return valid JSON unchanged', () => {
      const input = '{"key": "value"}';
      const result = InputSanitizer.sanitizeJson(input);
      expect(result).toBe('{"key": "value"}');
    });

    it('should return null for invalid JSON', () => {
      const input = '{invalid json}';
      const result = InputSanitizer.sanitizeJson(input);
      expect(result).toBeNull();
    });

    it('should handle empty string', () => {
      expect(InputSanitizer.sanitizeJson('')).toBeNull();
    });
  });

  describe('sanitizeString', () => {
    it('should apply default sanitization', () => {
      const input = '  Hello World  ';
      const result = InputSanitizer.sanitizeString(input);
      expect(result).toBe('Hello World');
    });

    it('should apply maxLength option', () => {
      const input = 'Hello World';
      const result = InputSanitizer.sanitizeString(input, { maxLength: 5 });
      expect(result).toBe('Hello');
    });

    it('should apply lowercase option', () => {
      const input = 'Hello World';
      const result = InputSanitizer.sanitizeString(input, { lowercase: true });
      expect(result).toBe('hello world');
    });

    it('should apply uppercase option', () => {
      const input = 'Hello World';
      const result = InputSanitizer.sanitizeString(input, { uppercase: true });
      expect(result).toBe('HELLO WORLD');
    });

    it('should apply alphanumericOnly option', () => {
      const input = 'Hello-World_123!';
      const result = InputSanitizer.sanitizeString(input, { alphanumericOnly: true });
      expect(result).toBe('HelloWorld123');
    });

    it('should apply escapeHtml option', () => {
      const input = '<script>alert(1)</script>';
      const result = InputSanitizer.sanitizeString(input, { escapeHtml: true });
      expect(result).not.toContain('<script>');
    });

    it('should apply stripHtml option', () => {
      const input = '<p>Hello</p>';
      const result = InputSanitizer.sanitizeString(input, { stripHtml: true });
      expect(result).toBe('Hello');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string fields', () => {
      const input = {
        name: '  John  ',
        email: 'TEST@EXAMPLE.COM',
        age: 25,
      };
      const result = InputSanitizer.sanitizeObject(input);
      expect(result.name).toBe('John');
    });

    it('should apply field-specific options', () => {
      const input = {
        email: 'TEST@EXAMPLE.COM',
        phone: '+1 (415) 555-1234',
      };
      const result = InputSanitizer.sanitizeObject(input, {
        email: { lowercase: true },
      });
      expect(result.email).toBe('test@example.com');
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '  John  ',
        },
      };
      const result = InputSanitizer.sanitizeObject(input);
      expect((result.user as { name: string }).name).toBe('John');
    });

    it('should handle arrays', () => {
      const input = {
        tags: ['  tag1  ', '  tag2  '],
      };
      const result = InputSanitizer.sanitizeObject(input);
      expect(result.tags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('containsDangerousContent', () => {
    it('should detect script tags', () => {
      const input = '<script>alert(1)</script>';
      expect(InputSanitizer.containsDangerousContent(input)).toBe(true);
    });

    it('should detect javascript: protocol', () => {
      const input = 'javascript:alert(1)';
      expect(InputSanitizer.containsDangerousContent(input)).toBe(true);
    });

    it('should detect on* event handlers', () => {
      const input = 'onclick=alert(1)';
      expect(InputSanitizer.containsDangerousContent(input)).toBe(true);
    });

    it('should return false for safe content', () => {
      const input = 'Hello World';
      expect(InputSanitizer.containsDangerousContent(input)).toBe(false);
    });
  });

  describe('detectInjectionAttempt', () => {
    it('should detect SQL injection', () => {
      const input = "'; DROP TABLE users; --";
      const result = InputSanitizer.detectInjectionAttempt(input);
      expect(result.detected).toBe(true);
      expect(result.type).toBe('sql');
    });

    it('should detect XSS', () => {
      const input = '<script>alert(1)</script>';
      const result = InputSanitizer.detectInjectionAttempt(input);
      expect(result.detected).toBe(true);
      expect(result.type).toBe('xss');
    });

    it('should detect path traversal', () => {
      const input = '../../../etc/passwd';
      const result = InputSanitizer.detectInjectionAttempt(input);
      expect(result.detected).toBe(true);
      expect(result.type).toBe('path_traversal');
    });

    it('should return false for safe input', () => {
      const input = 'Hello World';
      const result = InputSanitizer.detectInjectionAttempt(input);
      expect(result.detected).toBe(false);
    });
  });
});
