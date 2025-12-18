import { z } from 'zod';
import {
  RPCMethod,
  RPCContext,
  RPCRequestPayload,
  RPCResponsePayload
} from '../types';
import { RPCError, ErrorCode } from '../utils/errors';
import pino from 'pino';

export interface RPCRegistryConfig {
  defaultTimeout: number;
  maxConcurrentCalls: number;
}

interface PendingCall {
  method: string;
  startedAt: number;
  timeout: number;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

export class RPCRegistry {
  private readonly methods: Map<string, RPCMethod>;
  private readonly pendingCalls: Map<string, PendingCall>;
  private readonly config: RPCRegistryConfig;
  private readonly logger: pino.Logger;
  private timeoutChecker: NodeJS.Timeout | null = null;

  constructor(config: RPCRegistryConfig, logger: pino.Logger) {
    this.config = config;
    this.logger = logger;
    this.methods = new Map();
    this.pendingCalls = new Map();
  }

  start(): void {
    this.timeoutChecker = setInterval(() => {
      this.checkTimeouts();
    }, 1000);
    this.logger.info('RPCRegistry started');
  }

  stop(): void {
    if (this.timeoutChecker) {
      clearInterval(this.timeoutChecker);
      this.timeoutChecker = null;
    }

    for (const [callId, pending] of this.pendingCalls) {
      pending.reject(new RPCError(ErrorCode.RPC_TIMEOUT, 'Registry shutting down'));
      this.pendingCalls.delete(callId);
    }

    this.logger.info('RPCRegistry stopped');
  }

  registerMethod(method: RPCMethod): void {
    if (this.methods.has(method.name)) {
      throw new RPCError(
        ErrorCode.RPC_EXECUTION_ERROR,
        `Method already registered: ${method.name}`
      );
    }

    this.methods.set(method.name, method);
    this.logger.debug({ method: method.name }, 'RPC method registered');
  }

  unregisterMethod(name: string): boolean {
    const removed = this.methods.delete(name);
    if (removed) {
      this.logger.debug({ method: name }, 'RPC method unregistered');
    }
    return removed;
  }

  hasMethod(name: string): boolean {
    return this.methods.has(name);
  }

  getMethod(name: string): RPCMethod | undefined {
    return this.methods.get(name);
  }

  getAllMethods(): RPCMethod[] {
    return Array.from(this.methods.values());
  }

  getMethodNames(): string[] {
    return Array.from(this.methods.keys());
  }

  async executeMethod(
    request: RPCRequestPayload,
    context: RPCContext
  ): Promise<RPCResponsePayload> {
    const method = this.methods.get(request.method);

    if (!method) {
      return {
        success: false,
        error: {
          code: ErrorCode.RPC_METHOD_NOT_FOUND,
          message: `Method not found: ${request.method}`
        }
      };
    }

    if (method.requiresAuth && !context.sessionId) {
      return {
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_REQUIRED,
          message: 'Authentication required for this method'
        }
      };
    }

    if (method.schema && request.params) {
      const validation = method.schema.safeParse(request.params);
      if (!validation.success) {
        return {
          success: false,
          error: {
            code: ErrorCode.RPC_INVALID_PARAMS,
            message: 'Invalid parameters',
            details: validation.error.issues
          }
        };
      }
    }

    const timeout = request.timeout || method.timeout || this.config.defaultTimeout;

    try {
      const result = await Promise.race([
        method.handler(request.params || {}, context),
        this.createTimeoutPromise(timeout)
      ]);

      this.logger.debug(
        { method: request.method, clientId: context.clientId },
        'RPC method executed'
      );

      return {
        success: true,
        result
      };
    } catch (error) {
      if (error instanceof RPCError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        };
      }

      this.logger.error(
        { error, method: request.method },
        'RPC method execution failed'
      );

      return {
        success: false,
        error: {
          code: ErrorCode.RPC_EXECUTION_ERROR,
          message: (error as Error).message
        }
      };
    }
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new RPCError(ErrorCode.RPC_TIMEOUT, 'Method execution timeout'));
      }, timeout);
    });
  }

  private checkTimeouts(): void {
    const now = Date.now();

    for (const [callId, pending] of this.pendingCalls) {
      if (now - pending.startedAt > pending.timeout) {
        pending.reject(new RPCError(ErrorCode.RPC_TIMEOUT, 'Call timeout'));
        this.pendingCalls.delete(callId);
        this.logger.warn({ callId, method: pending.method }, 'RPC call timed out');
      }
    }
  }

  registerBuiltinMethods(): void {
    this.registerMethod({
      name: 'ping',
      handler: async () => ({ pong: true, timestamp: Date.now() }),
      timeout: 5000
    });

    this.registerMethod({
      name: 'echo',
      handler: async (params) => params,
      schema: z.record(z.unknown()),
      timeout: 5000
    });

    this.registerMethod({
      name: 'getServerTime',
      handler: async () => ({
        timestamp: Date.now(),
        iso: new Date().toISOString()
      }),
      timeout: 5000
    });

    this.registerMethod({
      name: 'getMethodList',
      handler: async () => ({
        methods: this.getMethodNames()
      }),
      timeout: 5000
    });

    this.logger.info('Built-in RPC methods registered');
  }
}
