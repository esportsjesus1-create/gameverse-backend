import { CountdownState, LobbyStatus } from '../types';
import { redisService } from './redis.service';
import { lobbyService } from './lobby.service';
import { LoggerService } from './logger.service';

const logger = new LoggerService('CountdownService');

export type CountdownCallback = (lobbyId: string, remaining: number) => void;
export type CountdownCompleteCallback = (lobbyId: string) => void;
export type CountdownCancelledCallback = (lobbyId: string) => void;

export class CountdownService {
  private activeCountdowns: Map<string, NodeJS.Timeout> = new Map();
  private onTickCallback: CountdownCallback | null = null;
  private onCompleteCallback: CountdownCompleteCallback | null = null;
  private onCancelledCallback: CountdownCancelledCallback | null = null;

  setCallbacks(
    onTick: CountdownCallback,
    onComplete: CountdownCompleteCallback,
    onCancelled: CountdownCancelledCallback
  ): void {
    this.onTickCallback = onTick;
    this.onCompleteCallback = onComplete;
    this.onCancelledCallback = onCancelled;
  }

  async startCountdown(lobbyId: string, duration: number): Promise<CountdownState> {
    if (this.activeCountdowns.has(lobbyId)) {
      await this.cancelCountdown(lobbyId);
    }

    const state: CountdownState = {
      lobbyId,
      startedAt: Date.now(),
      duration,
      remaining: duration,
      active: true
    };

    await redisService.setCountdownState(state);
    await lobbyService.updateLobbyStatus(lobbyId, LobbyStatus.COUNTDOWN);

    logger.info('Countdown started', { lobbyId, duration });

    this.runCountdownTick(lobbyId, duration);

    return state;
  }

  private runCountdownTick(lobbyId: string, remaining: number): void {
    if (remaining <= 0) {
      this.completeCountdown(lobbyId);
      return;
    }

    if (this.onTickCallback) {
      this.onTickCallback(lobbyId, remaining);
    }

    const timeout = setTimeout(async () => {
      const state = await redisService.getCountdownState(lobbyId);
      
      if (!state || !state.active) {
        this.activeCountdowns.delete(lobbyId);
        return;
      }

      const newRemaining = remaining - 1;
      
      await redisService.setCountdownState({
        ...state,
        remaining: newRemaining
      });

      this.runCountdownTick(lobbyId, newRemaining);
    }, 1000);

    this.activeCountdowns.set(lobbyId, timeout);
  }

  private async completeCountdown(lobbyId: string): Promise<void> {
    this.activeCountdowns.delete(lobbyId);
    await redisService.deleteCountdownState(lobbyId);
    await lobbyService.updateLobbyStatus(lobbyId, LobbyStatus.IN_GAME);

    logger.info('Countdown completed', { lobbyId });

    if (this.onCompleteCallback) {
      this.onCompleteCallback(lobbyId);
    }
  }

  async cancelCountdown(lobbyId: string): Promise<void> {
    const timeout = this.activeCountdowns.get(lobbyId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeCountdowns.delete(lobbyId);
    }

    await redisService.deleteCountdownState(lobbyId);
    await lobbyService.updateLobbyStatus(lobbyId, LobbyStatus.WAITING);
    await lobbyService.resetReadyStatus(lobbyId);

    logger.info('Countdown cancelled', { lobbyId });

    if (this.onCancelledCallback) {
      this.onCancelledCallback(lobbyId);
    }
  }

  async getCountdownState(lobbyId: string): Promise<CountdownState | null> {
    return redisService.getCountdownState(lobbyId);
  }

  isCountdownActive(lobbyId: string): boolean {
    return this.activeCountdowns.has(lobbyId);
  }

  async restoreCountdowns(): Promise<void> {
    logger.info('Restoring active countdowns from Redis...');
  }

  stopAll(): void {
    for (const [lobbyId, timeout] of this.activeCountdowns) {
      clearTimeout(timeout);
      logger.info('Countdown stopped', { lobbyId });
    }
    this.activeCountdowns.clear();
  }
}

export const countdownService = new CountdownService();
