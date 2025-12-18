import { EventEmitter } from 'eventemitter3';
import { PluginInterface, SessionData, BaseMessage } from '../types';
import { UnrealBridgeError, ErrorCode } from '../utils/errors';
import { RPCRegistry } from './rpc-registry';
import pino from 'pino';

export interface PluginManagerEvents {
  pluginLoaded: (name: string, version: string) => void;
  pluginUnloaded: (name: string) => void;
  pluginError: (name: string, error: Error) => void;
}

export class PluginManager extends EventEmitter<PluginManagerEvents> {
  private readonly plugins: Map<string, PluginInterface>;
  private readonly rpcRegistry: RPCRegistry;
  private readonly logger: pino.Logger;
  private initialized = false;

  constructor(rpcRegistry: RPCRegistry, logger: pino.Logger) {
    super();
    this.plugins = new Map();
    this.rpcRegistry = rpcRegistry;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    for (const [name, plugin] of this.plugins) {
      try {
        await plugin.initialize();
        this.logger.info({ plugin: name }, 'Plugin initialized');
      } catch (error) {
        this.logger.error({ plugin: name, error }, 'Plugin initialization failed');
        this.emit('pluginError', name, error as Error);
      }
    }

    this.initialized = true;
    this.logger.info('PluginManager initialized');
  }

  async shutdown(): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      try {
        await plugin.shutdown();
        this.logger.info({ plugin: name }, 'Plugin shutdown');
      } catch (error) {
        this.logger.error({ plugin: name, error }, 'Plugin shutdown failed');
      }
    }

    this.plugins.clear();
    this.initialized = false;
    this.logger.info('PluginManager shutdown');
  }

  registerPlugin(plugin: PluginInterface): void {
    if (this.plugins.has(plugin.name)) {
      throw new UnrealBridgeError(
        ErrorCode.PLUGIN_INITIALIZATION_ERROR,
        `Plugin already registered: ${plugin.name}`
      );
    }

    this.plugins.set(plugin.name, plugin);

    if (plugin.registerRPCMethods) {
      const methods = plugin.registerRPCMethods();
      for (const method of methods) {
        this.rpcRegistry.registerMethod(method);
      }
    }

    this.emit('pluginLoaded', plugin.name, plugin.version);
    this.logger.info({ plugin: plugin.name, version: plugin.version }, 'Plugin registered');
  }

  unregisterPlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    if (plugin.registerRPCMethods) {
      const methods = plugin.registerRPCMethods();
      for (const method of methods) {
        this.rpcRegistry.unregisterMethod(method.name);
      }
    }

    this.plugins.delete(name);
    this.emit('pluginUnloaded', name);
    this.logger.info({ plugin: name }, 'Plugin unregistered');

    return true;
  }

  getPlugin(name: string): PluginInterface | undefined {
    return this.plugins.get(name);
  }

  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  getAllPlugins(): PluginInterface[] {
    return Array.from(this.plugins.values());
  }

  getPluginNames(): string[] {
    return Array.from(this.plugins.keys());
  }

  async onConnect(session: SessionData): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (plugin.onConnect) {
        try {
          await plugin.onConnect(session);
        } catch (error) {
          this.logger.error(
            { plugin: name, sessionId: session.sessionId, error },
            'Plugin onConnect failed'
          );
          this.emit('pluginError', name, error as Error);
        }
      }
    }
  }

  async onDisconnect(session: SessionData): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (plugin.onDisconnect) {
        try {
          await plugin.onDisconnect(session);
        } catch (error) {
          this.logger.error(
            { plugin: name, sessionId: session.sessionId, error },
            'Plugin onDisconnect failed'
          );
          this.emit('pluginError', name, error as Error);
        }
      }
    }
  }

  async onMessage(message: BaseMessage, session: SessionData): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (plugin.onMessage) {
        try {
          await plugin.onMessage(message, session);
        } catch (error) {
          this.logger.error(
            { plugin: name, messageId: message.header.id, error },
            'Plugin onMessage failed'
          );
          this.emit('pluginError', name, error as Error);
        }
      }
    }
  }
}
