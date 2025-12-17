import { Request, Response, NextFunction } from 'express';
import {
  validate,
  validateQuery,
  validateParams,
  createUserSchema,
  updateUserSchema,
  linkAddressSchema,
  updateAddressLabelSchema,
  updateKycStatusSchema,
  paginationSchema,
  idParamSchema,
  exportFormatSchema,
} from '../../middleware/validation.middleware';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('validate', () => {
    it('should pass valid body', () => {
      mockReq.body = {
        email: 'test@example.com',
        username: 'testuser',
      };

      const middleware = validate(createUserSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject invalid body', () => {
      mockReq.body = {
        email: 'invalid-email',
        username: 'ab',
      };

      const middleware = validate(createUserSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toContain('email');
    });

    it('should handle non-Zod errors', () => {
      const badSchema = {
        parse: () => {
          throw new Error('Non-Zod error');
        },
      };

      const middleware = validate(badSchema as never);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateQuery', () => {
    it('should pass valid query', () => {
      mockReq.query = {
        page: '1',
        limit: '20',
      };

      const middleware = validateQuery(paginationSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject invalid query', () => {
      mockReq.query = {
        page: '-1',
        limit: '200',
      };

      const middleware = validateQuery(paginationSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error).toBeDefined();
    });

    it('should handle non-Zod errors in query validation', () => {
      const badSchema = {
        parse: () => {
          throw new Error('Non-Zod error');
        },
      };

      const middleware = validateQuery(badSchema as never);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateParams', () => {
    it('should pass valid params', () => {
      mockReq.params = {
        id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const middleware = validateParams(idParamSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject invalid params', () => {
      mockReq.params = {
        id: 'invalid-uuid',
      };

      const middleware = validateParams(idParamSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toContain('Invalid ID format');
    });

    it('should handle non-Zod errors in params validation', () => {
      const badSchema = {
        parse: () => {
          throw new Error('Non-Zod error');
        },
      };

      const middleware = validateParams(badSchema as never);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('createUserSchema', () => {
    it('should validate valid user input', () => {
      const input = {
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'Test User',
        bio: 'Test bio',
      };

      expect(() => createUserSchema.parse(input)).not.toThrow();
    });

    it('should reject invalid email', () => {
      const input = {
        email: 'invalid',
        username: 'testuser',
      };

      expect(() => createUserSchema.parse(input)).toThrow();
    });

    it('should reject short username', () => {
      const input = {
        email: 'test@example.com',
        username: 'ab',
      };

      expect(() => createUserSchema.parse(input)).toThrow();
    });

    it('should reject long username', () => {
      const input = {
        email: 'test@example.com',
        username: 'a'.repeat(31),
      };

      expect(() => createUserSchema.parse(input)).toThrow();
    });

    it('should reject username with special characters', () => {
      const input = {
        email: 'test@example.com',
        username: 'test@user',
      };

      expect(() => createUserSchema.parse(input)).toThrow();
    });

    it('should reject long display name', () => {
      const input = {
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'a'.repeat(101),
      };

      expect(() => createUserSchema.parse(input)).toThrow();
    });

    it('should reject long bio', () => {
      const input = {
        email: 'test@example.com',
        username: 'testuser',
        bio: 'a'.repeat(501),
      };

      expect(() => createUserSchema.parse(input)).toThrow();
    });
  });

  describe('updateUserSchema', () => {
    it('should validate valid update input', () => {
      const input = {
        username: 'newusername',
        displayName: 'New Name',
        bio: 'New bio',
      };

      expect(() => updateUserSchema.parse(input)).not.toThrow();
    });

    it('should validate preferences update', () => {
      const input = {
        preferences: {
          notifications: {
            email: true,
            push: false,
          },
          privacy: {
            profileVisibility: 'public',
          },
          display: {
            theme: 'dark',
          },
        },
      };

      expect(() => updateUserSchema.parse(input)).not.toThrow();
    });

    it('should reject invalid theme', () => {
      const input = {
        preferences: {
          display: {
            theme: 'invalid',
          },
        },
      };

      expect(() => updateUserSchema.parse(input)).toThrow();
    });

    it('should reject invalid profile visibility', () => {
      const input = {
        preferences: {
          privacy: {
            profileVisibility: 'invalid',
          },
        },
      };

      expect(() => updateUserSchema.parse(input)).toThrow();
    });
  });

  describe('linkAddressSchema', () => {
    it('should validate valid address input', () => {
      const input = {
        chain: 'ethereum',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
        label: 'Main Wallet',
      };

      expect(() => linkAddressSchema.parse(input)).not.toThrow();
    });

    it('should reject invalid chain', () => {
      const input = {
        chain: 'invalid',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
      };

      expect(() => linkAddressSchema.parse(input)).toThrow();
    });

    it('should reject empty address', () => {
      const input = {
        chain: 'ethereum',
        address: '',
        signature: '0xsignature',
        message: 'Sign this message',
      };

      expect(() => linkAddressSchema.parse(input)).toThrow();
    });

    it('should reject long label', () => {
      const input = {
        chain: 'ethereum',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
        signature: '0xsignature',
        message: 'Sign this message',
        label: 'a'.repeat(51),
      };

      expect(() => linkAddressSchema.parse(input)).toThrow();
    });

    it('should accept all valid chains', () => {
      const chains = ['ethereum', 'polygon', 'solana', 'avalanche', 'binance', 'arbitrum', 'optimism', 'base'];
      chains.forEach(chain => {
        const input = {
          chain,
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3c',
          signature: '0xsignature',
          message: 'Sign this message',
        };
        expect(() => linkAddressSchema.parse(input)).not.toThrow();
      });
    });
  });

  describe('updateAddressLabelSchema', () => {
    it('should validate valid label', () => {
      const input = { label: 'New Label' };
      expect(() => updateAddressLabelSchema.parse(input)).not.toThrow();
    });

    it('should validate null label', () => {
      const input = { label: null };
      expect(() => updateAddressLabelSchema.parse(input)).not.toThrow();
    });

    it('should reject long label', () => {
      const input = { label: 'a'.repeat(51) };
      expect(() => updateAddressLabelSchema.parse(input)).toThrow();
    });
  });

  describe('updateKycStatusSchema', () => {
    it('should validate valid KYC status', () => {
      const input = {
        status: 'verified',
        provider: 'provider1',
        reference: 'ref123',
      };

      expect(() => updateKycStatusSchema.parse(input)).not.toThrow();
    });

    it('should reject invalid status', () => {
      const input = {
        status: 'invalid',
      };

      expect(() => updateKycStatusSchema.parse(input)).toThrow();
    });

    it('should accept all valid statuses', () => {
      const statuses = ['none', 'pending', 'verified', 'rejected', 'expired'];
      statuses.forEach(status => {
        const input = { status };
        expect(() => updateKycStatusSchema.parse(input)).not.toThrow();
      });
    });
  });

  describe('paginationSchema', () => {
    it('should use defaults', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should parse string numbers', () => {
      const result = paginationSchema.parse({ page: '2', limit: '50' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it('should reject limit over 100', () => {
      expect(() => paginationSchema.parse({ limit: '101' })).toThrow();
    });
  });

  describe('exportFormatSchema', () => {
    it('should default to json', () => {
      const result = exportFormatSchema.parse({});
      expect(result.format).toBe('json');
    });

    it('should accept csv', () => {
      const result = exportFormatSchema.parse({ format: 'csv' });
      expect(result.format).toBe('csv');
    });

    it('should reject invalid format', () => {
      expect(() => exportFormatSchema.parse({ format: 'xml' })).toThrow();
    });
  });
});
