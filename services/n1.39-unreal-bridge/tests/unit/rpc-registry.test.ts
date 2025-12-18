import { z } from 'zod';
import { RPCRegistry } from '../../src/sdk/rpc-registry';
import { testLogger, createMockClientInfo } from '../setup';
import { ErrorCode } from '../../src/utils/errors';

describe('RPCRegistry', () => {
  let rpcRegistry: RPCRegistry;

  beforeEach(() => {
    rpcRegistry = new RPCRegistry(
      {
        defaultTimeout: 5000,
        maxConcurrentCalls: 100
      },
      testLogger
    );
  });

  afterEach(() => {
    rpcRegistry.stop();
  });

  describe('registerMethod', () => {
    it('should register a new method', () => {
      rpcRegistry.registerMethod({
        name: 'testMethod',
        handler: async () => ({ result: 'success' })
      });

      expect(rpcRegistry.hasMethod('testMethod')).toBe(true);
    });

    it('should throw error for duplicate method', () => {
      rpcRegistry.registerMethod({
        name: 'testMethod',
        handler: async () => ({})
      });

      expect(() =>
        rpcRegistry.registerMethod({
          name: 'testMethod',
          handler: async () => ({})
        })
      ).toThrow();
    });
  });

  describe('unregisterMethod', () => {
    it('should unregister existing method', () => {
      rpcRegistry.registerMethod({
        name: 'testMethod',
        handler: async () => ({})
      });

      const result = rpcRegistry.unregisterMethod('testMethod');

      expect(result).toBe(true);
      expect(rpcRegistry.hasMethod('testMethod')).toBe(false);
    });

    it('should return false for non-existent method', () => {
      const result = rpcRegistry.unregisterMethod('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('hasMethod', () => {
    it('should return true for existing method', () => {
      rpcRegistry.registerMethod({
        name: 'testMethod',
        handler: async () => ({})
      });

      expect(rpcRegistry.hasMethod('testMethod')).toBe(true);
    });

    it('should return false for non-existent method', () => {
      expect(rpcRegistry.hasMethod('non-existent')).toBe(false);
    });
  });

  describe('getMethod', () => {
    it('should return method for existing name', () => {
      const handler = async (): Promise<object> => ({});
      rpcRegistry.registerMethod({
        name: 'testMethod',
        handler
      });

      const method = rpcRegistry.getMethod('testMethod');

      expect(method).toBeDefined();
      expect(method?.name).toBe('testMethod');
    });

    it('should return undefined for non-existent method', () => {
      const method = rpcRegistry.getMethod('non-existent');
      expect(method).toBeUndefined();
    });
  });

  describe('getAllMethods', () => {
    it('should return all registered methods', () => {
      rpcRegistry.registerMethod({
        name: 'method1',
        handler: async () => ({})
      });
      rpcRegistry.registerMethod({
        name: 'method2',
        handler: async () => ({})
      });

      const methods = rpcRegistry.getAllMethods();

      expect(methods.length).toBe(2);
    });
  });

  describe('getMethodNames', () => {
    it('should return all method names', () => {
      rpcRegistry.registerMethod({
        name: 'method1',
        handler: async () => ({})
      });
      rpcRegistry.registerMethod({
        name: 'method2',
        handler: async () => ({})
      });

      const names = rpcRegistry.getMethodNames();

      expect(names).toContain('method1');
      expect(names).toContain('method2');
    });
  });

  describe('executeMethod', () => {
    const mockContext = {
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      sessionId: '550e8400-e29b-41d4-a716-446655440001',
      clientInfo: createMockClientInfo(),
      metadata: {}
    };

    it('should execute method and return result', async () => {
      rpcRegistry.registerMethod({
        name: 'testMethod',
        handler: async (params) => ({ echo: params.value })
      });

      const response = await rpcRegistry.executeMethod(
        { method: 'testMethod', params: { value: 'test' } },
        mockContext
      );

      expect(response.success).toBe(true);
      expect(response.result).toEqual({ echo: 'test' });
    });

    it('should return error for non-existent method', async () => {
      const response = await rpcRegistry.executeMethod(
        { method: 'non-existent' },
        mockContext
      );

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(ErrorCode.RPC_METHOD_NOT_FOUND);
    });

    it('should validate params with schema', async () => {
      rpcRegistry.registerMethod({
        name: 'validatedMethod',
        handler: async (params) => params,
        schema: z.object({
          name: z.string(),
          age: z.number()
        })
      });

      const response = await rpcRegistry.executeMethod(
        { method: 'validatedMethod', params: { name: 'test', age: 'invalid' } },
        mockContext
      );

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(ErrorCode.RPC_INVALID_PARAMS);
    });

    it('should require auth when specified', async () => {
      rpcRegistry.registerMethod({
        name: 'authMethod',
        handler: async () => ({}),
        requiresAuth: true
      });

      const noAuthContext = { ...mockContext, sessionId: '' };
      const response = await rpcRegistry.executeMethod(
        { method: 'authMethod' },
        noAuthContext
      );

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
    });

    it('should handle handler errors', async () => {
      rpcRegistry.registerMethod({
        name: 'errorMethod',
        handler: async () => {
          throw new Error('Handler error');
        }
      });

      const response = await rpcRegistry.executeMethod(
        { method: 'errorMethod' },
        mockContext
      );

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(ErrorCode.RPC_EXECUTION_ERROR);
    });

    it('should handle timeout', async () => {
      rpcRegistry.registerMethod({
        name: 'slowMethod',
        handler: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10000));
          return {};
        },
        timeout: 100
      });

      const responsePromise = rpcRegistry.executeMethod(
        { method: 'slowMethod' },
        mockContext
      );

      jest.advanceTimersByTime(200);

      const response = await responsePromise;

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(ErrorCode.RPC_TIMEOUT);
    });
  });

  describe('registerBuiltinMethods', () => {
    it('should register built-in methods', () => {
      rpcRegistry.registerBuiltinMethods();

      expect(rpcRegistry.hasMethod('ping')).toBe(true);
      expect(rpcRegistry.hasMethod('echo')).toBe(true);
      expect(rpcRegistry.hasMethod('getServerTime')).toBe(true);
      expect(rpcRegistry.hasMethod('getMethodList')).toBe(true);
    });

    it('should execute ping method', async () => {
      rpcRegistry.registerBuiltinMethods();

      const mockContext = {
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        sessionId: '550e8400-e29b-41d4-a716-446655440001',
        clientInfo: createMockClientInfo(),
        metadata: {}
      };

      const response = await rpcRegistry.executeMethod(
        { method: 'ping' },
        mockContext
      );

      expect(response.success).toBe(true);
      expect((response.result as { pong: boolean }).pong).toBe(true);
    });

    it('should execute echo method', async () => {
      rpcRegistry.registerBuiltinMethods();

      const mockContext = {
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        sessionId: '550e8400-e29b-41d4-a716-446655440001',
        clientInfo: createMockClientInfo(),
        metadata: {}
      };

      const response = await rpcRegistry.executeMethod(
        { method: 'echo', params: { message: 'hello' } },
        mockContext
      );

      expect(response.success).toBe(true);
      expect(response.result).toEqual({ message: 'hello' });
    });
  });

  describe('start/stop', () => {
    it('should start and stop without errors', () => {
      expect(() => rpcRegistry.start()).not.toThrow();
      expect(() => rpcRegistry.stop()).not.toThrow();
    });
  });
});
