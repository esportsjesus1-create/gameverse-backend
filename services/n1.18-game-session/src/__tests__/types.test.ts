import { SessionStatus, PlayerConnectionStatus } from '../types';

describe('Types', () => {
  describe('SessionStatus', () => {
    it('should have correct enum values', () => {
      expect(SessionStatus.PENDING).toBe('pending');
      expect(SessionStatus.ACTIVE).toBe('active');
      expect(SessionStatus.PAUSED).toBe('paused');
      expect(SessionStatus.ENDED).toBe('ended');
    });

    it('should have exactly 4 status values', () => {
      const statusValues = Object.values(SessionStatus);
      expect(statusValues).toHaveLength(4);
    });
  });

  describe('PlayerConnectionStatus', () => {
    it('should have correct enum values', () => {
      expect(PlayerConnectionStatus.CONNECTED).toBe('connected');
      expect(PlayerConnectionStatus.DISCONNECTED).toBe('disconnected');
      expect(PlayerConnectionStatus.RECONNECTING).toBe('reconnecting');
    });

    it('should have exactly 3 connection status values', () => {
      const statusValues = Object.values(PlayerConnectionStatus);
      expect(statusValues).toHaveLength(3);
    });
  });
});
