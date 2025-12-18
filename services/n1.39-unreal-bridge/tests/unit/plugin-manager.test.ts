import { PluginManager } from '../../src/sdk/plugin-manager';
import { RPCRegistry } from '../../src/sdk/rpc-registry';
import { PluginInterface, SessionData } from '../../src/types';
import { testLogger, createMockSessionData } from '../setup';

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let rpcRegistry: RPCRegistry;

  beforeEach(() => {
    rpcRegistry = new RPCRegistry(
      { defaultTimeout: 5000, maxConcurrentCalls: 100 },
      testLogger
    );
    pluginManager = new PluginManager(rpcRegistry, testLogger);
  });

  afterEach(async () => {
    await pluginManager.shutdown();
  });

  const createMockPlugin = (name: string, version = '1.0.0'): PluginInterface => ({
    name,
    version,
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined)
  });

  describe('registerPlugin', () => {
    it('should register a plugin', () => {
      const plugin = createMockPlugin('test-plugin');

      pluginManager.registerPlugin(plugin);

      expect(pluginManager.hasPlugin('test-plugin')).toBe(true);
    });

    it('should throw error for duplicate plugin', () => {
      const plugin = createMockPlugin('test-plugin');
      pluginManager.registerPlugin(plugin);

      expect(() => pluginManager.registerPlugin(plugin)).toThrow();
    });

    it('should emit pluginLoaded event', () => {
      const callback = jest.fn();
      pluginManager.on('pluginLoaded', callback);

      const plugin = createMockPlugin('test-plugin', '2.0.0');
      pluginManager.registerPlugin(plugin);

      expect(callback).toHaveBeenCalledWith('test-plugin', '2.0.0');
    });

    it('should register RPC methods from plugin', () => {
      const plugin: PluginInterface = {
        ...createMockPlugin('test-plugin'),
        registerRPCMethods: () => [
          {
            name: 'pluginMethod',
            handler: async () => ({ result: 'from plugin' })
          }
        ]
      };

      pluginManager.registerPlugin(plugin);

      expect(rpcRegistry.hasMethod('pluginMethod')).toBe(true);
    });
  });

  describe('unregisterPlugin', () => {
    it('should unregister existing plugin', () => {
      const plugin = createMockPlugin('test-plugin');
      pluginManager.registerPlugin(plugin);

      const result = pluginManager.unregisterPlugin('test-plugin');

      expect(result).toBe(true);
      expect(pluginManager.hasPlugin('test-plugin')).toBe(false);
    });

    it('should return false for non-existent plugin', () => {
      const result = pluginManager.unregisterPlugin('non-existent');
      expect(result).toBe(false);
    });

    it('should emit pluginUnloaded event', () => {
      const callback = jest.fn();
      pluginManager.on('pluginUnloaded', callback);

      const plugin = createMockPlugin('test-plugin');
      pluginManager.registerPlugin(plugin);
      pluginManager.unregisterPlugin('test-plugin');

      expect(callback).toHaveBeenCalledWith('test-plugin');
    });

    it('should unregister RPC methods from plugin', () => {
      const plugin: PluginInterface = {
        ...createMockPlugin('test-plugin'),
        registerRPCMethods: () => [
          {
            name: 'pluginMethod',
            handler: async () => ({})
          }
        ]
      };

      pluginManager.registerPlugin(plugin);
      expect(rpcRegistry.hasMethod('pluginMethod')).toBe(true);

      pluginManager.unregisterPlugin('test-plugin');
      expect(rpcRegistry.hasMethod('pluginMethod')).toBe(false);
    });
  });

  describe('getPlugin', () => {
    it('should return plugin by name', () => {
      const plugin = createMockPlugin('test-plugin');
      pluginManager.registerPlugin(plugin);

      const retrieved = pluginManager.getPlugin('test-plugin');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-plugin');
    });

    it('should return undefined for non-existent plugin', () => {
      const plugin = pluginManager.getPlugin('non-existent');
      expect(plugin).toBeUndefined();
    });
  });

  describe('hasPlugin', () => {
    it('should return true for existing plugin', () => {
      const plugin = createMockPlugin('test-plugin');
      pluginManager.registerPlugin(plugin);

      expect(pluginManager.hasPlugin('test-plugin')).toBe(true);
    });

    it('should return false for non-existent plugin', () => {
      expect(pluginManager.hasPlugin('non-existent')).toBe(false);
    });
  });

  describe('getAllPlugins', () => {
    it('should return all registered plugins', () => {
      pluginManager.registerPlugin(createMockPlugin('plugin1'));
      pluginManager.registerPlugin(createMockPlugin('plugin2'));

      const plugins = pluginManager.getAllPlugins();

      expect(plugins.length).toBe(2);
    });
  });

  describe('getPluginNames', () => {
    it('should return all plugin names', () => {
      pluginManager.registerPlugin(createMockPlugin('plugin1'));
      pluginManager.registerPlugin(createMockPlugin('plugin2'));

      const names = pluginManager.getPluginNames();

      expect(names).toContain('plugin1');
      expect(names).toContain('plugin2');
    });
  });

  describe('initialize', () => {
    it('should initialize all plugins', async () => {
      const plugin1 = createMockPlugin('plugin1');
      const plugin2 = createMockPlugin('plugin2');

      pluginManager.registerPlugin(plugin1);
      pluginManager.registerPlugin(plugin2);

      await pluginManager.initialize();

      expect(plugin1.initialize).toHaveBeenCalled();
      expect(plugin2.initialize).toHaveBeenCalled();
    });

    it('should emit pluginError on initialization failure', async () => {
      const callback = jest.fn();
      pluginManager.on('pluginError', callback);

      const failingPlugin: PluginInterface = {
        ...createMockPlugin('failing-plugin'),
        initialize: jest.fn().mockRejectedValue(new Error('Init failed'))
      };

      pluginManager.registerPlugin(failingPlugin);
      await pluginManager.initialize();

      expect(callback).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      const plugin = createMockPlugin('test-plugin');
      pluginManager.registerPlugin(plugin);

      await pluginManager.initialize();
      await pluginManager.initialize();

      expect(plugin.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('shutdown', () => {
    it('should shutdown all plugins', async () => {
      const plugin1 = createMockPlugin('plugin1');
      const plugin2 = createMockPlugin('plugin2');

      pluginManager.registerPlugin(plugin1);
      pluginManager.registerPlugin(plugin2);

      await pluginManager.initialize();
      await pluginManager.shutdown();

      expect(plugin1.shutdown).toHaveBeenCalled();
      expect(plugin2.shutdown).toHaveBeenCalled();
    });

    it('should clear all plugins after shutdown', async () => {
      pluginManager.registerPlugin(createMockPlugin('test-plugin'));

      await pluginManager.initialize();
      await pluginManager.shutdown();

      expect(pluginManager.getAllPlugins().length).toBe(0);
    });
  });

  describe('onConnect', () => {
    it('should call onConnect for all plugins', async () => {
      const onConnect = jest.fn().mockResolvedValue(undefined);
      const plugin: PluginInterface = {
        ...createMockPlugin('test-plugin'),
        onConnect
      };

      pluginManager.registerPlugin(plugin);

      const session = createMockSessionData();
      await pluginManager.onConnect(session);

      expect(onConnect).toHaveBeenCalledWith(session);
    });

    it('should emit pluginError on onConnect failure', async () => {
      const callback = jest.fn();
      pluginManager.on('pluginError', callback);

      const plugin: PluginInterface = {
        ...createMockPlugin('test-plugin'),
        onConnect: jest.fn().mockRejectedValue(new Error('Connect failed'))
      };

      pluginManager.registerPlugin(plugin);
      await pluginManager.onConnect(createMockSessionData());

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('onDisconnect', () => {
    it('should call onDisconnect for all plugins', async () => {
      const onDisconnect = jest.fn().mockResolvedValue(undefined);
      const plugin: PluginInterface = {
        ...createMockPlugin('test-plugin'),
        onDisconnect
      };

      pluginManager.registerPlugin(plugin);

      const session = createMockSessionData();
      await pluginManager.onDisconnect(session);

      expect(onDisconnect).toHaveBeenCalledWith(session);
    });

    it('should emit pluginError on onDisconnect failure', async () => {
      const callback = jest.fn();
      pluginManager.on('pluginError', callback);

      const plugin: PluginInterface = {
        ...createMockPlugin('test-plugin'),
        onDisconnect: jest.fn().mockRejectedValue(new Error('Disconnect failed'))
      };

      pluginManager.registerPlugin(plugin);
      await pluginManager.onDisconnect(createMockSessionData());

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('onMessage', () => {
    it('should call onMessage for all plugins', async () => {
      const onMessage = jest.fn().mockResolvedValue(undefined);
      const plugin: PluginInterface = {
        ...createMockPlugin('test-plugin'),
        onMessage
      };

      pluginManager.registerPlugin(plugin);

      const message = {
        header: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'EVENT' as const,
          timestamp: Date.now()
        },
        payload: { test: true }
      };
      const session = createMockSessionData();

      await pluginManager.onMessage(message, session);

      expect(onMessage).toHaveBeenCalledWith(message, session);
    });

    it('should emit pluginError on onMessage failure', async () => {
      const callback = jest.fn();
      pluginManager.on('pluginError', callback);

      const plugin: PluginInterface = {
        ...createMockPlugin('test-plugin'),
        onMessage: jest.fn().mockRejectedValue(new Error('Message failed'))
      };

      pluginManager.registerPlugin(plugin);

      const message = {
        header: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'EVENT' as const,
          timestamp: Date.now()
        },
        payload: {}
      };

      await pluginManager.onMessage(message, createMockSessionData());

      expect(callback).toHaveBeenCalled();
    });
  });
});
