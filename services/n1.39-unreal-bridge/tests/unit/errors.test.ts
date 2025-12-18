import {
  ErrorCode,
  UnrealBridgeError,
  AuthenticationError,
  SessionError,
  RPCError,
  StateError,
  AssetError,
  isUnrealBridgeError,
  createErrorPayload
} from '../../src/utils/errors';

describe('Error utilities', () => {
  describe('UnrealBridgeError', () => {
    it('should create error with code and message', () => {
      const error = new UnrealBridgeError(ErrorCode.UNKNOWN, 'Test error');

      expect(error.code).toBe(ErrorCode.UNKNOWN);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('UnrealBridgeError');
    });

    it('should default to recoverable true', () => {
      const error = new UnrealBridgeError(ErrorCode.UNKNOWN, 'Test error');
      expect(error.recoverable).toBe(true);
    });

    it('should accept recoverable flag', () => {
      const error = new UnrealBridgeError(ErrorCode.UNKNOWN, 'Test error', false);
      expect(error.recoverable).toBe(false);
    });

    it('should accept details', () => {
      const details = { extra: 'info' };
      const error = new UnrealBridgeError(ErrorCode.UNKNOWN, 'Test error', true, details);
      expect(error.details).toEqual(details);
    });

    it('should serialize to JSON', () => {
      const error = new UnrealBridgeError(
        ErrorCode.INVALID_MESSAGE,
        'Invalid message',
        true,
        { field: 'test' }
      );

      const json = error.toJSON();

      expect(json.name).toBe('UnrealBridgeError');
      expect(json.code).toBe(ErrorCode.INVALID_MESSAGE);
      expect(json.message).toBe('Invalid message');
      expect(json.recoverable).toBe(true);
      expect(json.details).toEqual({ field: 'test' });
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error', () => {
      const error = new AuthenticationError('Auth failed');

      expect(error.code).toBe(ErrorCode.AUTHENTICATION_FAILED);
      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toBe('Auth failed');
    });

    it('should accept details', () => {
      const error = new AuthenticationError('Auth failed', { reason: 'invalid token' });
      expect(error.details).toEqual({ reason: 'invalid token' });
    });
  });

  describe('SessionError', () => {
    it('should create session error', () => {
      const error = new SessionError(ErrorCode.SESSION_NOT_FOUND, 'Session not found');

      expect(error.code).toBe(ErrorCode.SESSION_NOT_FOUND);
      expect(error.name).toBe('SessionError');
    });

    it('should accept different session error codes', () => {
      const error = new SessionError(ErrorCode.SESSION_EXPIRED, 'Session expired');
      expect(error.code).toBe(ErrorCode.SESSION_EXPIRED);
    });
  });

  describe('RPCError', () => {
    it('should create RPC error', () => {
      const error = new RPCError(ErrorCode.RPC_METHOD_NOT_FOUND, 'Method not found');

      expect(error.code).toBe(ErrorCode.RPC_METHOD_NOT_FOUND);
      expect(error.name).toBe('RPCError');
    });

    it('should accept different RPC error codes', () => {
      const error = new RPCError(ErrorCode.RPC_TIMEOUT, 'Timeout');
      expect(error.code).toBe(ErrorCode.RPC_TIMEOUT);
    });
  });

  describe('StateError', () => {
    it('should create state error', () => {
      const error = new StateError(ErrorCode.STATE_NOT_FOUND, 'State not found');

      expect(error.code).toBe(ErrorCode.STATE_NOT_FOUND);
      expect(error.name).toBe('StateError');
    });

    it('should accept different state error codes', () => {
      const error = new StateError(ErrorCode.STATE_VERSION_CONFLICT, 'Version conflict');
      expect(error.code).toBe(ErrorCode.STATE_VERSION_CONFLICT);
    });
  });

  describe('AssetError', () => {
    it('should create asset error', () => {
      const error = new AssetError(ErrorCode.ASSET_NOT_FOUND, 'Asset not found');

      expect(error.code).toBe(ErrorCode.ASSET_NOT_FOUND);
      expect(error.name).toBe('AssetError');
    });

    it('should accept different asset error codes', () => {
      const error = new AssetError(ErrorCode.ASSET_CHECKSUM_MISMATCH, 'Checksum mismatch');
      expect(error.code).toBe(ErrorCode.ASSET_CHECKSUM_MISMATCH);
    });
  });

  describe('isUnrealBridgeError', () => {
    it('should return true for UnrealBridgeError', () => {
      const error = new UnrealBridgeError(ErrorCode.UNKNOWN, 'Test');
      expect(isUnrealBridgeError(error)).toBe(true);
    });

    it('should return true for subclasses', () => {
      expect(isUnrealBridgeError(new AuthenticationError('Test'))).toBe(true);
      expect(isUnrealBridgeError(new SessionError(ErrorCode.SESSION_NOT_FOUND, 'Test'))).toBe(true);
      expect(isUnrealBridgeError(new RPCError(ErrorCode.RPC_TIMEOUT, 'Test'))).toBe(true);
      expect(isUnrealBridgeError(new StateError(ErrorCode.STATE_NOT_FOUND, 'Test'))).toBe(true);
      expect(isUnrealBridgeError(new AssetError(ErrorCode.ASSET_NOT_FOUND, 'Test'))).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');
      expect(isUnrealBridgeError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isUnrealBridgeError(null)).toBe(false);
      expect(isUnrealBridgeError(undefined)).toBe(false);
      expect(isUnrealBridgeError('string')).toBe(false);
      expect(isUnrealBridgeError(123)).toBe(false);
    });
  });

  describe('createErrorPayload', () => {
    it('should create error payload from UnrealBridgeError', () => {
      const error = new UnrealBridgeError(
        ErrorCode.INVALID_PAYLOAD,
        'Invalid payload',
        true,
        { field: 'test' }
      );

      const payload = createErrorPayload(error);

      expect(payload.code).toBe(ErrorCode.INVALID_PAYLOAD);
      expect(payload.message).toBe('Invalid payload');
      expect(payload.recoverable).toBe(true);
      expect(payload.details).toEqual({ field: 'test' });
    });

    it('should handle error without details', () => {
      const error = new UnrealBridgeError(ErrorCode.UNKNOWN, 'Error');

      const payload = createErrorPayload(error);

      expect(payload.details).toBeUndefined();
    });
  });

  describe('ErrorCode enum', () => {
    it('should have expected error codes', () => {
      expect(ErrorCode.UNKNOWN).toBe(1000);
      expect(ErrorCode.INVALID_MESSAGE).toBe(1001);
      expect(ErrorCode.AUTHENTICATION_REQUIRED).toBe(1003);
      expect(ErrorCode.RPC_METHOD_NOT_FOUND).toBe(2001);
      expect(ErrorCode.STATE_NOT_FOUND).toBe(3001);
      expect(ErrorCode.ASSET_NOT_FOUND).toBe(4001);
      expect(ErrorCode.PLUGIN_INITIALIZATION_ERROR).toBe(5001);
    });
  });
});
