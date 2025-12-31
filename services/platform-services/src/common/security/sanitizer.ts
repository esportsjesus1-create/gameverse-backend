import { SecurityInputSanitizationError } from '../errors';

export interface SanitizeOptions {
  maxLength?: number;
  allowHtml?: boolean;
  allowUrls?: boolean;
  allowEmails?: boolean;
  allowNumbers?: boolean;
  allowSpecialChars?: boolean;
  customPattern?: RegExp;
  trim?: boolean;
  toLowerCase?: boolean;
  toUpperCase?: boolean;
}

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:/gi,
  /vbscript:/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
  /@import/gi,
  /<!--[\s\S]*?-->/g,
  /<!\[CDATA\[[\s\S]*?\]\]>/gi,
];

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|UNION|JOIN)\b)/gi,
  /(--)|(\/\*)|(\*\/)/g,
  /(;|\||&)/g,
  /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi,
  /'\s*(OR|AND)\s+'[^']*'\s*=\s*'[^']*/gi,
];

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.\\+/g,
  /%2e%2e%2f/gi,
  /%2e%2e\//gi,
  /\.%2e\//gi,
  /%2e\.\//gi,
  /\.\.%2f/gi,
  /%2e%2e%5c/gi,
];

export class InputSanitizer {
  static escapeHtml(input: string): string {
    return input.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
  }

  static stripHtml(input: string): string {
    return input
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'");
  }

  static removeDangerousPatterns(input: string): string {
    let result = input;
    for (const pattern of DANGEROUS_PATTERNS) {
      result = result.replace(pattern, '');
    }
    return result;
  }

  static sanitizeForSql(input: string): string {
    let result = input;
    for (const pattern of SQL_INJECTION_PATTERNS) {
      result = result.replace(pattern, '');
    }
    return result.replace(/'/g, "''");
  }

  static sanitizeFilePath(input: string): string {
    let result = input;
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      result = result.replace(pattern, '');
    }
    return result.replace(/[<>:"|?*\x00-\x1f]/g, '');
  }

  static sanitizeFilename(input: string): string {
    return input
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/^\.+/, '')
      .replace(/\.+$/, '')
      .trim()
      .slice(0, 255);
  }

  static sanitizeEmail(input: string): string {
    const trimmed = input.trim().toLowerCase();
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(trimmed)) {
      throw new SecurityInputSanitizationError('email', 'Invalid email format');
    }
    return trimmed;
  }

  static sanitizePhoneNumber(input: string): string {
    const cleaned = input.replace(/[^\d+]/g, '');
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(cleaned)) {
      throw new SecurityInputSanitizationError('phoneNumber', 'Invalid phone number format');
    }
    return cleaned;
  }

  static sanitizeUrl(input: string): string {
    const trimmed = input.trim();
    try {
      const url = new URL(trimmed);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new SecurityInputSanitizationError(
          'url',
          'Only HTTP and HTTPS protocols are allowed'
        );
      }
      return url.toString();
    } catch {
      throw new SecurityInputSanitizationError('url', 'Invalid URL format');
    }
  }

  static sanitizeJson(input: string): string {
    try {
      const parsed = JSON.parse(input);
      return JSON.stringify(parsed);
    } catch {
      throw new SecurityInputSanitizationError('json', 'Invalid JSON format');
    }
  }

  static sanitizeString(input: string, options: SanitizeOptions = {}): string {
    let result = input;

    if (options.trim !== false) {
      result = result.trim();
    }

    if (options.maxLength && result.length > options.maxLength) {
      result = result.slice(0, options.maxLength);
    }

    if (!options.allowHtml) {
      result = this.stripHtml(result);
      result = this.removeDangerousPatterns(result);
    } else {
      result = this.escapeHtml(result);
    }

    if (options.toLowerCase) {
      result = result.toLowerCase();
    }

    if (options.toUpperCase) {
      result = result.toUpperCase();
    }

    if (options.customPattern) {
      result = result.replace(options.customPattern, '');
    }

    return result;
  }

  static sanitizeObject<T extends Record<string, unknown>>(
    obj: T,
    fieldOptions?: Record<string, SanitizeOptions>
  ): T {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const options = fieldOptions?.[key] || {};

      if (typeof value === 'string') {
        result[key] = this.sanitizeString(value, options);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'string' ? this.sanitizeString(item, options) : item
        );
      } else if (value !== null && typeof value === 'object') {
        result[key] = this.sanitizeObject(value as Record<string, unknown>, fieldOptions);
      } else {
        result[key] = value;
      }
    }

    return result as T;
  }

  static validateAndSanitize<T>(
    input: unknown,
    validator: (value: unknown) => T,
    sanitizeOptions?: SanitizeOptions
  ): T {
    if (typeof input === 'string' && sanitizeOptions) {
      input = this.sanitizeString(input, sanitizeOptions);
    }
    return validator(input);
  }

  static containsDangerousContent(input: string): boolean {
    for (const pattern of [
      ...DANGEROUS_PATTERNS,
      ...SQL_INJECTION_PATTERNS,
      ...PATH_TRAVERSAL_PATTERNS,
    ]) {
      if (pattern.test(input)) {
        return true;
      }
    }
    return false;
  }

  static detectInjectionAttempt(input: string): { detected: boolean; type?: string } {
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        return { detected: true, type: 'sql_injection' };
      }
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        return { detected: true, type: 'xss' };
      }
    }

    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(input)) {
        return { detected: true, type: 'path_traversal' };
      }
    }

    return { detected: false };
  }
}

export const sanitizeString = InputSanitizer.sanitizeString.bind(InputSanitizer);
export const sanitizeEmail = InputSanitizer.sanitizeEmail.bind(InputSanitizer);
export const sanitizePhoneNumber = InputSanitizer.sanitizePhoneNumber.bind(InputSanitizer);
export const sanitizeUrl = InputSanitizer.sanitizeUrl.bind(InputSanitizer);
export const sanitizeFilename = InputSanitizer.sanitizeFilename.bind(InputSanitizer);
export const sanitizeFilePath = InputSanitizer.sanitizeFilePath.bind(InputSanitizer);
export const sanitizeObject = InputSanitizer.sanitizeObject.bind(InputSanitizer);
export const escapeHtml = InputSanitizer.escapeHtml.bind(InputSanitizer);
export const stripHtml = InputSanitizer.stripHtml.bind(InputSanitizer);
export const containsDangerousContent =
  InputSanitizer.containsDangerousContent.bind(InputSanitizer);
export const detectInjectionAttempt = InputSanitizer.detectInjectionAttempt.bind(InputSanitizer);

export default InputSanitizer;
