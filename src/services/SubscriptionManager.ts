import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
  ChainId,
  SubscriptionConfig,
  SubscriptionType,
  SubscriptionFilter,
  ISubscriptionManager,
  HealthCheckResult
} from '../types';
import { ProviderManager } from '../providers/ProviderManager';
import { logger } from '../utils/logger';
import { getChainConfig } from '../config';

interface ActiveSubscription {
  config: SubscriptionConfig;
  wsConnection?: WebSocket;
  providerSubscriptionId?: string;
  isActive: boolean;
  createdAt: Date;
  lastEventAt?: Date;
  eventCount: number;
}

export class SubscriptionManager extends EventEmitter implements ISubscriptionManager {
  private providerManager: ProviderManager;
  private subscriptions: Map<string, ActiveSubscription> = new Map();
  private wsConnections: Map<ChainId, WebSocket> = new Map();
  private reconnectIntervals: Map<ChainId, NodeJS.Timeout> = new Map();

  constructor(providerManager: ProviderManager) {
    super();
    this.providerManager = providerManager;
  }

  async subscribe(config: SubscriptionConfig): Promise<string> {
    const subscriptionId = config.id || uuidv4();
    const fullConfig: SubscriptionConfig = { ...config, id: subscriptionId };

    try {
      const wsConnection = await this.getOrCreateWsConnection(config.chainId);
      
      const providerSubId = await this.createProviderSubscription(
        wsConnection,
        fullConfig
      );

      const subscription: ActiveSubscription = {
        config: fullConfig,
        wsConnection,
        providerSubscriptionId: providerSubId,
        isActive: true,
        createdAt: new Date(),
        eventCount: 0
      };

      this.subscriptions.set(subscriptionId, subscription);

      logger.info('Subscription created', {
        subscriptionId,
        chainId: config.chainId,
        type: config.type
      });

      return subscriptionId;
    } catch (error) {
      logger.error('Failed to create subscription', {
        chainId: config.chainId,
        type: config.type,
        error: (error as Error).message
      });
      throw error;
    }
  }

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    try {
      if (subscription.wsConnection && subscription.providerSubscriptionId) {
        await this.removeProviderSubscription(
          subscription.wsConnection,
          subscription.providerSubscriptionId
        );
      }

      subscription.isActive = false;
      this.subscriptions.delete(subscriptionId);

      logger.info('Subscription removed', { subscriptionId });
      return true;
    } catch (error) {
      logger.error('Failed to unsubscribe', {
        subscriptionId,
        error: (error as Error).message
      });
      return false;
    }
  }

  getActiveSubscriptions(): SubscriptionConfig[] {
    return Array.from(this.subscriptions.values())
      .filter((s) => s.isActive)
      .map((s) => s.config);
  }

  getSubscriptionStats(subscriptionId: string): {
    eventCount: number;
    lastEventAt?: Date;
    isActive: boolean;
  } | null {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return null;
    }

    return {
      eventCount: subscription.eventCount,
      lastEventAt: subscription.lastEventAt,
      isActive: subscription.isActive
    };
  }

  private async getOrCreateWsConnection(chainId: ChainId): Promise<WebSocket> {
    const existing = this.wsConnections.get(chainId);
    if (existing && existing.readyState === WebSocket.OPEN) {
      return existing;
    }

    const wsProvider = await this.providerManager.getWebSocketProvider(chainId);
    if (!wsProvider) {
      throw new Error(`No WebSocket provider available for chain ${chainId}`);
    }

    const wsUrl = (wsProvider as unknown as { _websocket?: { url?: string } })._websocket?.url;
    if (!wsUrl) {
      throw new Error(`Cannot get WebSocket URL for chain ${chainId}`);
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        logger.info('WebSocket connection established', { chainId });
        this.wsConnections.set(chainId, ws);
        resolve(ws);
      });

      ws.on('message', (data) => {
        this.handleWsMessage(chainId, data.toString());
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', { chainId, error: error.message });
        reject(error);
      });

      ws.on('close', () => {
        logger.warn('WebSocket connection closed', { chainId });
        this.wsConnections.delete(chainId);
        this.scheduleReconnect(chainId);
      });
    });
  }

  private async createProviderSubscription(
    ws: WebSocket,
    config: SubscriptionConfig
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const requestId = Date.now();
      const subscribeMethod = this.getSubscribeMethod(config.type);
      const params = this.getSubscribeParams(config);

      const request = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'eth_subscribe',
        params: [subscribeMethod, ...params]
      };

      const timeout = setTimeout(() => {
        reject(new Error('Subscription request timed out'));
      }, 10000);

      const messageHandler = (data: WebSocket.Data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === requestId) {
            clearTimeout(timeout);
            ws.off('message', messageHandler);

            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        } catch {
          // Ignore parse errors for other messages
        }
      };

      ws.on('message', messageHandler);
      ws.send(JSON.stringify(request));
    });
  }

  private async removeProviderSubscription(
    ws: WebSocket,
    subscriptionId: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const requestId = Date.now();

      const request = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'eth_unsubscribe',
        params: [subscriptionId]
      };

      const timeout = setTimeout(() => {
        resolve(false);
      }, 5000);

      const messageHandler = (data: WebSocket.Data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === requestId) {
            clearTimeout(timeout);
            ws.off('message', messageHandler);
            resolve(response.result === true);
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.on('message', messageHandler);
      ws.send(JSON.stringify(request));
    });
  }

  private getSubscribeMethod(type: SubscriptionType): string {
    switch (type) {
      case SubscriptionType.NEW_BLOCKS:
        return 'newHeads';
      case SubscriptionType.NEW_TRANSACTIONS:
        return 'newHeads';
      case SubscriptionType.PENDING_TRANSACTIONS:
        return 'newPendingTransactions';
      case SubscriptionType.LOGS:
        return 'logs';
      default:
        return 'newHeads';
    }
  }

  private getSubscribeParams(config: SubscriptionConfig): unknown[] {
    if (config.type === SubscriptionType.LOGS && config.filter) {
      return [this.buildLogFilter(config.filter)];
    }
    return [];
  }

  private buildLogFilter(filter: SubscriptionFilter): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (filter.address) {
      result.address = filter.address;
    }
    if (filter.topics) {
      result.topics = filter.topics;
    }

    return result;
  }

  private handleWsMessage(chainId: ChainId, data: string): void {
    try {
      const message = JSON.parse(data);

      if (message.method === 'eth_subscription' && message.params) {
        const subscriptionId = message.params.subscription;
        const result = message.params.result;

        for (const [id, subscription] of this.subscriptions.entries()) {
          if (
            subscription.providerSubscriptionId === subscriptionId &&
            subscription.config.chainId === chainId
          ) {
            subscription.eventCount++;
            subscription.lastEventAt = new Date();

            if (subscription.config.callback) {
              subscription.config.callback(result);
            }

            this.emit('subscriptionEvent', {
              subscriptionId: id,
              chainId,
              type: subscription.config.type,
              data: result
            });

            break;
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to parse WebSocket message', {
        chainId,
        error: (error as Error).message
      });
    }
  }

  private scheduleReconnect(chainId: ChainId): void {
    const existingInterval = this.reconnectIntervals.get(chainId);
    if (existingInterval) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const ws = await this.getOrCreateWsConnection(chainId);
        
        for (const [id, subscription] of this.subscriptions.entries()) {
          if (subscription.config.chainId === chainId && subscription.isActive) {
            try {
              const newSubId = await this.createProviderSubscription(ws, subscription.config);
              subscription.wsConnection = ws;
              subscription.providerSubscriptionId = newSubId;
              logger.info('Subscription reconnected', { subscriptionId: id });
            } catch (error) {
              logger.warn('Failed to reconnect subscription', {
                subscriptionId: id,
                error: (error as Error).message
              });
            }
          }
        }

        clearInterval(interval);
        this.reconnectIntervals.delete(chainId);
      } catch (error) {
        logger.warn('Reconnection attempt failed', {
          chainId,
          error: (error as Error).message
        });
      }
    }, 5000);

    this.reconnectIntervals.set(chainId, interval);
  }

  async stop(): Promise<void> {
    for (const interval of this.reconnectIntervals.values()) {
      clearInterval(interval);
    }
    this.reconnectIntervals.clear();

    for (const ws of this.wsConnections.values()) {
      ws.close();
    }
    this.wsConnections.clear();

    this.subscriptions.clear();
    logger.info('SubscriptionManager stopped');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const totalSubscriptions = this.subscriptions.size;
    const activeSubscriptions = Array.from(this.subscriptions.values()).filter(
      (s) => s.isActive
    ).length;
    const openConnections = Array.from(this.wsConnections.values()).filter(
      (ws) => ws.readyState === WebSocket.OPEN
    ).length;

    return {
      service: 'subscription-manager',
      status: openConnections > 0 || totalSubscriptions === 0 ? 'healthy' : 'degraded',
      details: {
        totalSubscriptions,
        activeSubscriptions,
        openConnections,
        reconnecting: this.reconnectIntervals.size
      }
    };
  }
}
