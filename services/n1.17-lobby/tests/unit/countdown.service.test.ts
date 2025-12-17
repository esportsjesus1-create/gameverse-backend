import { CountdownService } from '../../src/services/countdown.service';
import { redisService } from '../../src/services/redis.service';
import { lobbyService } from '../../src/services/lobby.service';
import { LobbyStatus } from '../../src/types';

jest.mock('../../src/services/redis.service');
jest.mock('../../src/services/lobby.service');

describe('CountdownService', () => {
  let countdownService: CountdownService;
  let onTickMock: jest.Mock;
  let onCompleteMock: jest.Mock;
  let onCancelledMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    
    countdownService = new CountdownService();
    onTickMock = jest.fn();
    onCompleteMock = jest.fn();
    onCancelledMock = jest.fn();
    
    countdownService.setCallbacks(onTickMock, onCompleteMock, onCancelledMock);
  });

  afterEach(() => {
    countdownService.stopAll();
    jest.useRealTimers();
  });

  describe('startCountdown', () => {
    it('should start a countdown and emit initial tick', async () => {
      const lobbyId = 'lobby-123';
      const duration = 5;

      (lobbyService.updateLobbyStatus as jest.Mock).mockResolvedValue({});
      (redisService.setCountdownState as jest.Mock).mockResolvedValue(undefined);

      const state = await countdownService.startCountdown(lobbyId, duration);

      expect(state.lobbyId).toBe(lobbyId);
      expect(state.duration).toBe(duration);
      expect(state.remaining).toBe(duration);
      expect(state.active).toBe(true);
      expect(lobbyService.updateLobbyStatus).toHaveBeenCalledWith(lobbyId, LobbyStatus.COUNTDOWN);
      expect(onTickMock).toHaveBeenCalledWith(lobbyId, duration);
    });

    it('should cancel existing countdown before starting new one', async () => {
      const lobbyId = 'lobby-123';
      
      (lobbyService.updateLobbyStatus as jest.Mock).mockResolvedValue({});
      (redisService.setCountdownState as jest.Mock).mockResolvedValue(undefined);
      (redisService.deleteCountdownState as jest.Mock).mockResolvedValue(undefined);
      (lobbyService.resetReadyStatus as jest.Mock).mockResolvedValue(undefined);

      await countdownService.startCountdown(lobbyId, 10);
      await countdownService.startCountdown(lobbyId, 5);

      expect(redisService.deleteCountdownState).toHaveBeenCalled();
    });

    it('should tick every second', async () => {
      const lobbyId = 'lobby-123';
      const duration = 3;

      (lobbyService.updateLobbyStatus as jest.Mock).mockResolvedValue({});
      (redisService.setCountdownState as jest.Mock).mockResolvedValue(undefined);
      (redisService.getCountdownState as jest.Mock).mockResolvedValue({
        lobbyId,
        startedAt: Date.now(),
        duration,
        remaining: duration - 1,
        active: true
      });

      await countdownService.startCountdown(lobbyId, duration);

      expect(onTickMock).toHaveBeenCalledWith(lobbyId, 3);
      expect(onTickMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelCountdown', () => {
    it('should cancel an active countdown', async () => {
      const lobbyId = 'lobby-123';

      (lobbyService.updateLobbyStatus as jest.Mock).mockResolvedValue({});
      (redisService.setCountdownState as jest.Mock).mockResolvedValue(undefined);
      (redisService.deleteCountdownState as jest.Mock).mockResolvedValue(undefined);
      (lobbyService.resetReadyStatus as jest.Mock).mockResolvedValue(undefined);

      await countdownService.startCountdown(lobbyId, 10);
      await countdownService.cancelCountdown(lobbyId);

      expect(redisService.deleteCountdownState).toHaveBeenCalledWith(lobbyId);
      expect(lobbyService.updateLobbyStatus).toHaveBeenCalledWith(lobbyId, LobbyStatus.WAITING);
      expect(lobbyService.resetReadyStatus).toHaveBeenCalledWith(lobbyId);
      expect(onCancelledMock).toHaveBeenCalledWith(lobbyId);
    });

    it('should handle cancelling non-existent countdown gracefully', async () => {
      const lobbyId = 'non-existent';

      (redisService.deleteCountdownState as jest.Mock).mockResolvedValue(undefined);
      (lobbyService.updateLobbyStatus as jest.Mock).mockResolvedValue({});
      (lobbyService.resetReadyStatus as jest.Mock).mockResolvedValue(undefined);

      await expect(countdownService.cancelCountdown(lobbyId)).resolves.not.toThrow();
    });
  });

  describe('isCountdownActive', () => {
    it('should return true for active countdown', async () => {
      const lobbyId = 'lobby-123';

      (lobbyService.updateLobbyStatus as jest.Mock).mockResolvedValue({});
      (redisService.setCountdownState as jest.Mock).mockResolvedValue(undefined);

      await countdownService.startCountdown(lobbyId, 10);

      expect(countdownService.isCountdownActive(lobbyId)).toBe(true);
    });

    it('should return false for inactive countdown', () => {
      expect(countdownService.isCountdownActive('non-existent')).toBe(false);
    });
  });

  describe('stopAll', () => {
    it('should stop all active countdowns', async () => {
      (lobbyService.updateLobbyStatus as jest.Mock).mockResolvedValue({});
      (redisService.setCountdownState as jest.Mock).mockResolvedValue(undefined);

      await countdownService.startCountdown('lobby-1', 10);
      await countdownService.startCountdown('lobby-2', 10);

      countdownService.stopAll();

      expect(countdownService.isCountdownActive('lobby-1')).toBe(false);
      expect(countdownService.isCountdownActive('lobby-2')).toBe(false);
    });
  });

  describe('getCountdownState', () => {
    it('should return countdown state from redis', async () => {
      const lobbyId = 'lobby-123';
      const mockState = {
        lobbyId,
        startedAt: Date.now(),
        duration: 10,
        remaining: 5,
        active: true
      };

      (redisService.getCountdownState as jest.Mock).mockResolvedValue(mockState);

      const state = await countdownService.getCountdownState(lobbyId);

      expect(state).toEqual(mockState);
      expect(redisService.getCountdownState).toHaveBeenCalledWith(lobbyId);
    });

    it('should return null if no countdown state exists', async () => {
      (redisService.getCountdownState as jest.Mock).mockResolvedValue(null);

      const state = await countdownService.getCountdownState('non-existent');

      expect(state).toBeNull();
    });
  });
});
