import { LobbyService } from '../services/lobby.service';
import {
  LobbyError,
  LobbyFullError,
  LobbyNotFoundError,
  PlayerNotInLobbyError,
  UnauthorizedError,
} from '../types';

describe('LobbyService', () => {
  let lobbyService: LobbyService;

  beforeEach(() => {
    lobbyService = new LobbyService();
  });

  describe('createLobby', () => {
    it('should create a lobby successfully', async () => {
      const lobby = await lobbyService.createLobby({
        name: 'Test Lobby',
        hostId: 'host-1',
        type: 'public',
        gameMode: 'squad',
        maxPlayers: 10,
      });

      expect(lobby).toBeDefined();
      expect(lobby.name).toBe('Test Lobby');
      expect(lobby.hostId).toBe('host-1');
      expect(lobby.type).toBe('public');
      expect(lobby.status).toBe('waiting');
      expect(lobby.players).toHaveLength(1);
      expect(lobby.players[0].isHost).toBe(true);
    });

    it('should create a private lobby with invite code', async () => {
      const lobby = await lobbyService.createLobby({
        name: 'Private Lobby',
        hostId: 'host-2',
        type: 'private',
        gameMode: 'duo',
        maxPlayers: 4,
      });

      expect(lobby.type).toBe('private');
      expect(lobby.inviteCode).toBeDefined();
      expect(lobby.settings.isPrivate).toBe(true);
    });

    it('should throw error if player is already in a lobby', async () => {
      await lobbyService.createLobby({
        name: 'First Lobby',
        hostId: 'host-3',
        type: 'public',
        gameMode: 'solo',
        maxPlayers: 10,
      });

      await expect(
        lobbyService.createLobby({
          name: 'Second Lobby',
          hostId: 'host-3',
          type: 'public',
          gameMode: 'solo',
          maxPlayers: 10,
        })
      ).rejects.toThrow(LobbyError);
    });
  });

  describe('joinLobby', () => {
    it('should allow player to join a public lobby', async () => {
      const lobby = await lobbyService.createLobby({
        name: 'Join Test',
        hostId: 'host-4',
        type: 'public',
        gameMode: 'squad',
        maxPlayers: 10,
      });

      const result = await lobbyService.joinLobby({
        lobbyId: lobby.id,
        userId: 'player-1',
        username: 'Player1',
      });

      expect(result.lobby.players).toHaveLength(2);
      expect(result.player.userId).toBe('player-1');
      expect(result.player.isHost).toBe(false);
    });

    it('should require invite code for private lobby', async () => {
      const lobby = await lobbyService.createLobby({
        name: 'Private Join Test',
        hostId: 'host-5',
        type: 'private',
        gameMode: 'duo',
        maxPlayers: 4,
      });

      await expect(
        lobbyService.joinLobby({
          lobbyId: lobby.id,
          userId: 'player-2',
          username: 'Player2',
        })
      ).rejects.toThrow(UnauthorizedError);

      const result = await lobbyService.joinLobby({
        lobbyId: lobby.id,
        userId: 'player-2',
        username: 'Player2',
        inviteCode: lobby.inviteCode,
      });

      expect(result.lobby.players).toHaveLength(2);
    });

    it('should throw error when lobby is full', async () => {
      const lobby = await lobbyService.createLobby({
        name: 'Full Lobby',
        hostId: 'host-6',
        type: 'public',
        gameMode: 'duo',
        maxPlayers: 2,
      });

      await lobbyService.joinLobby({
        lobbyId: lobby.id,
        userId: 'player-3',
        username: 'Player3',
      });

      await expect(
        lobbyService.joinLobby({
          lobbyId: lobby.id,
          userId: 'player-4',
          username: 'Player4',
        })
      ).rejects.toThrow(LobbyFullError);
    });

    it('should throw error for non-existent lobby', async () => {
      await expect(
        lobbyService.joinLobby({
          lobbyId: '00000000-0000-0000-0000-000000000000',
          userId: 'player-5',
          username: 'Player5',
        })
      ).rejects.toThrow(LobbyNotFoundError);
    });
  });

  describe('leaveLobby', () => {
    it('should allow player to leave lobby', async () => {
      const lobby = await lobbyService.createLobby({
        name: 'Leave Test',
        hostId: 'host-7',
        type: 'public',
        gameMode: 'squad',
        maxPlayers: 10,
      });

      await lobbyService.joinLobby({
        lobbyId: lobby.id,
        userId: 'player-6',
        username: 'Player6',
      });

      const updatedLobby = await lobbyService.leaveLobby(lobby.id, 'player-6');

      expect(updatedLobby).toBeDefined();
      expect(updatedLobby!.players).toHaveLength(1);
    });

    it('should transfer host when host leaves', async () => {
      const lobby = await lobbyService.createLobby({
        name: 'Host Leave Test',
        hostId: 'host-8',
        type: 'public',
        gameMode: 'squad',
        maxPlayers: 10,
      });

      await lobbyService.joinLobby({
        lobbyId: lobby.id,
        userId: 'player-7',
        username: 'Player7',
      });

      const updatedLobby = await lobbyService.leaveLobby(lobby.id, 'host-8');

      expect(updatedLobby).toBeDefined();
      expect(updatedLobby!.hostId).toBe('player-7');
      expect(updatedLobby!.players[0].isHost).toBe(true);
    });

    it('should close lobby when last player leaves', async () => {
      const lobby = await lobbyService.createLobby({
        name: 'Close Test',
        hostId: 'host-9',
        type: 'public',
        gameMode: 'solo',
        maxPlayers: 10,
      });

      const result = await lobbyService.leaveLobby(lobby.id, 'host-9');

      expect(result).toBeNull();
      expect(await lobbyService.getLobbyById(lobby.id)).toBeNull();
    });
  });

  describe('kickPlayer', () => {
    it('should allow host to kick player', async () => {
      const lobby = await lobbyService.createLobby({
        name: 'Kick Test',
        hostId: 'host-10',
        type: 'public',
        gameMode: 'squad',
        maxPlayers: 10,
      });

      await lobbyService.joinLobby({
        lobbyId: lobby.id,
        userId: 'player-8',
        username: 'Player8',
      });

      const updatedLobby = await lobbyService.kickPlayer(lobby.id, 'host-10', 'player-8');

      expect(updatedLobby.players).toHaveLength(1);
    });

    it('should not allow non-host to kick', async () => {
      const lobby = await lobbyService.createLobby({
        name: 'Kick Auth Test',
        hostId: 'host-11',
        type: 'public',
        gameMode: 'squad',
        maxPlayers: 10,
      });

      await lobbyService.joinLobby({
        lobbyId: lobby.id,
        userId: 'player-9',
        username: 'Player9',
      });

      await expect(
        lobbyService.kickPlayer(lobby.id, 'player-9', 'host-11')
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('setPlayerReady', () => {
    it('should set player ready status', async () => {
      const lobby = await lobbyService.createLobby({
        name: 'Ready Test',
        hostId: 'host-12',
        type: 'public',
        gameMode: 'squad',
        maxPlayers: 10,
      });

      await lobbyService.joinLobby({
        lobbyId: lobby.id,
        userId: 'player-10',
        username: 'Player10',
      });

      const updatedLobby = await lobbyService.setPlayerReady(lobby.id, 'player-10', true);
      const player = updatedLobby.players.find(p => p.userId === 'player-10');

      expect(player!.status).toBe('ready');
      expect(player!.readyAt).toBeDefined();
    });
  });

  describe('startReadyCheck', () => {
    it('should start ready check when enough players', async () => {
      const lobby = await lobbyService.createLobby({
        name: 'Ready Check Test',
        hostId: 'host-13',
        type: 'public',
        gameMode: 'duo',
        maxPlayers: 4,
        minPlayers: 2,
      });

      await lobbyService.joinLobby({
        lobbyId: lobby.id,
        userId: 'player-11',
        username: 'Player11',
      });

      const updatedLobby = await lobbyService.startReadyCheck(lobby.id, 'host-13');

      expect(updatedLobby.status).toBe('ready_check');
      expect(updatedLobby.readyCheckStartedAt).toBeDefined();
    });

    it('should throw error when not enough players', async () => {
      const lobby = await lobbyService.createLobby({
        name: 'Not Enough Players',
        hostId: 'host-14',
        type: 'public',
        gameMode: 'squad',
        maxPlayers: 10,
        minPlayers: 4,
      });

      await expect(
        lobbyService.startReadyCheck(lobby.id, 'host-14')
      ).rejects.toThrow(LobbyError);
    });
  });

  describe('getPublicLobbies', () => {
    it('should return paginated public lobbies', async () => {
      await lobbyService.createLobby({
        name: 'Public 1',
        hostId: 'host-15',
        type: 'public',
        gameMode: 'squad',
        maxPlayers: 10,
      });

      await lobbyService.createLobby({
        name: 'Public 2',
        hostId: 'host-16',
        type: 'public',
        gameMode: 'duo',
        maxPlayers: 4,
      });

      const result = await lobbyService.getPublicLobbies(1, 10);

      expect(result.data.length).toBeGreaterThanOrEqual(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('handleDisconnect and handleReconnect', () => {
    it('should mark player as disconnected', async () => {
      const lobby = await lobbyService.createLobby({
        name: 'Disconnect Test',
        hostId: 'host-17',
        type: 'public',
        gameMode: 'squad',
        maxPlayers: 10,
      });

      await lobbyService.joinLobby({
        lobbyId: lobby.id,
        userId: 'player-12',
        username: 'Player12',
      });

      const result = await lobbyService.handleDisconnect('player-12');

      expect(result.lobby).toBeDefined();
      const player = result.lobby!.players.find(p => p.userId === 'player-12');
      expect(player!.status).toBe('disconnected');
    });

    it('should reconnect player', async () => {
      const lobby = await lobbyService.createLobby({
        name: 'Reconnect Test',
        hostId: 'host-18',
        type: 'public',
        gameMode: 'squad',
        maxPlayers: 10,
      });

      await lobbyService.joinLobby({
        lobbyId: lobby.id,
        userId: 'player-13',
        username: 'Player13',
      });

      await lobbyService.handleDisconnect('player-13');
      const reconnectedLobby = await lobbyService.handleReconnect('player-13');

      const player = reconnectedLobby!.players.find(p => p.userId === 'player-13');
      expect(player!.status).toBe('joined');
    });
  });
});
