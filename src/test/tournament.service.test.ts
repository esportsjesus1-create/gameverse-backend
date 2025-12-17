import { TournamentService } from '../services/tournament.service';
import {
  TournamentNotFoundError,
  RegistrationClosedError,
  TournamentFullError,
  AlreadyRegisteredError,
  MatchNotFoundError,
} from '../types';

describe('TournamentService', () => {
  let tournamentService: TournamentService;

  beforeEach(() => {
    tournamentService = new TournamentService();
  });

  describe('createTournament', () => {
    it('should create a tournament successfully', async () => {
      const tournament = await tournamentService.createTournament({
        name: 'Test Tournament',
        gameMode: 'battle_royale',
        format: 'single_elimination',
        maxParticipants: 16,
        registrationStartsAt: new Date(),
        registrationEndsAt: new Date(Date.now() + 86400000),
        startsAt: new Date(Date.now() + 172800000),
        createdBy: 'admin-1',
      });

      expect(tournament).toBeDefined();
      expect(tournament.name).toBe('Test Tournament');
      expect(tournament.status).toBe('draft');
      expect(tournament.format).toBe('single_elimination');
    });

    it('should create tournament with prize pool', async () => {
      const tournament = await tournamentService.createTournament({
        name: 'Prize Tournament',
        gameMode: 'deathmatch',
        format: 'double_elimination',
        maxParticipants: 32,
        prizePool: { total: 1000, currency: 'USD' },
        registrationStartsAt: new Date(),
        registrationEndsAt: new Date(Date.now() + 86400000),
        startsAt: new Date(Date.now() + 172800000),
        createdBy: 'admin-2',
      });

      expect(tournament.prizePool.total).toBe(1000);
      expect(tournament.prizePool.distribution).toHaveLength(3);
    });
  });

  describe('registerParticipant', () => {
    it('should register participant successfully', async () => {
      const tournament = await tournamentService.createTournament({
        name: 'Registration Test',
        gameMode: 'solo',
        format: 'single_elimination',
        maxParticipants: 8,
        registrationStartsAt: new Date(),
        registrationEndsAt: new Date(Date.now() + 86400000),
        startsAt: new Date(Date.now() + 172800000),
        createdBy: 'admin-3',
      });

      await tournamentService.openRegistration(tournament.id);

      const participant = await tournamentService.registerParticipant({
        tournamentId: tournament.id,
        userId: 'user-1',
        username: 'Player1',
      });

      expect(participant).toBeDefined();
      expect(participant.userId).toBe('user-1');
      expect(participant.status).toBe('registered');
    });

    it('should throw error when registration is closed', async () => {
      const tournament = await tournamentService.createTournament({
        name: 'Closed Registration',
        gameMode: 'solo',
        format: 'single_elimination',
        maxParticipants: 8,
        registrationStartsAt: new Date(),
        registrationEndsAt: new Date(Date.now() + 86400000),
        startsAt: new Date(Date.now() + 172800000),
        createdBy: 'admin-4',
      });

      await expect(
        tournamentService.registerParticipant({
          tournamentId: tournament.id,
          userId: 'user-2',
          username: 'Player2',
        })
      ).rejects.toThrow(RegistrationClosedError);
    });

    it('should throw error when tournament is full', async () => {
      const tournament = await tournamentService.createTournament({
        name: 'Full Tournament',
        gameMode: 'solo',
        format: 'single_elimination',
        maxParticipants: 2,
        registrationStartsAt: new Date(),
        registrationEndsAt: new Date(Date.now() + 86400000),
        startsAt: new Date(Date.now() + 172800000),
        createdBy: 'admin-5',
      });

      await tournamentService.openRegistration(tournament.id);

      await tournamentService.registerParticipant({
        tournamentId: tournament.id,
        userId: 'user-3',
        username: 'Player3',
      });

      await tournamentService.registerParticipant({
        tournamentId: tournament.id,
        userId: 'user-4',
        username: 'Player4',
      });

      await expect(
        tournamentService.registerParticipant({
          tournamentId: tournament.id,
          userId: 'user-5',
          username: 'Player5',
        })
      ).rejects.toThrow(TournamentFullError);
    });

    it('should throw error when already registered', async () => {
      const tournament = await tournamentService.createTournament({
        name: 'Duplicate Registration',
        gameMode: 'solo',
        format: 'single_elimination',
        maxParticipants: 8,
        registrationStartsAt: new Date(),
        registrationEndsAt: new Date(Date.now() + 86400000),
        startsAt: new Date(Date.now() + 172800000),
        createdBy: 'admin-6',
      });

      await tournamentService.openRegistration(tournament.id);

      await tournamentService.registerParticipant({
        tournamentId: tournament.id,
        userId: 'user-6',
        username: 'Player6',
      });

      await expect(
        tournamentService.registerParticipant({
          tournamentId: tournament.id,
          userId: 'user-6',
          username: 'Player6',
        })
      ).rejects.toThrow(AlreadyRegisteredError);
    });
  });

  describe('startTournament', () => {
    it('should generate bracket for single elimination', async () => {
      const tournament = await tournamentService.createTournament({
        name: 'Bracket Test',
        gameMode: 'solo',
        format: 'single_elimination',
        maxParticipants: 8,
        minParticipants: 4,
        settings: { checkInRequired: false },
        registrationStartsAt: new Date(),
        registrationEndsAt: new Date(Date.now() + 86400000),
        startsAt: new Date(Date.now() + 172800000),
        createdBy: 'admin-7',
      });

      await tournamentService.openRegistration(tournament.id);

      for (let i = 1; i <= 4; i++) {
        await tournamentService.registerParticipant({
          tournamentId: tournament.id,
          userId: `user-bracket-${i}`,
          username: `Player${i}`,
        });
      }

      const bracket = await tournamentService.startTournament(tournament.id);

      expect(bracket).toBeDefined();
      expect(bracket.format).toBe('single_elimination');
      expect(bracket.rounds.length).toBeGreaterThan(0);
    });

    it('should throw error with not enough participants', async () => {
      const tournament = await tournamentService.createTournament({
        name: 'Not Enough',
        gameMode: 'solo',
        format: 'single_elimination',
        maxParticipants: 8,
        minParticipants: 4,
        settings: { checkInRequired: false },
        registrationStartsAt: new Date(),
        registrationEndsAt: new Date(Date.now() + 86400000),
        startsAt: new Date(Date.now() + 172800000),
        createdBy: 'admin-8',
      });

      await tournamentService.openRegistration(tournament.id);

      await tournamentService.registerParticipant({
        tournamentId: tournament.id,
        userId: 'user-alone',
        username: 'LonelyPlayer',
      });

      await expect(
        tournamentService.startTournament(tournament.id)
      ).rejects.toThrow('Not enough participants');
    });
  });

  describe('reportMatchResult', () => {
    it('should report match result and advance winner', async () => {
      const tournament = await tournamentService.createTournament({
        name: 'Match Result Test',
        gameMode: 'solo',
        format: 'single_elimination',
        maxParticipants: 4,
        minParticipants: 2,
        settings: { checkInRequired: false },
        registrationStartsAt: new Date(),
        registrationEndsAt: new Date(Date.now() + 86400000),
        startsAt: new Date(Date.now() + 172800000),
        createdBy: 'admin-9',
      });

      await tournamentService.openRegistration(tournament.id);

      const participants = [];
      for (let i = 1; i <= 4; i++) {
        const p = await tournamentService.registerParticipant({
          tournamentId: tournament.id,
          userId: `user-match-${i}`,
          username: `MatchPlayer${i}`,
        });
        participants.push(p);
      }

      const bracket = await tournamentService.startTournament(tournament.id);
      const firstMatch = bracket.rounds[0].matches[0];

      const result = await tournamentService.reportMatchResult({
        matchId: firstMatch.id,
        winnerId: firstMatch.participant1Id!,
        score1: 3,
        score2: 1,
      });

      expect(result.status).toBe('completed');
      expect(result.winnerId).toBe(firstMatch.participant1Id);
    });

    it('should throw error for non-existent match', async () => {
      await expect(
        tournamentService.reportMatchResult({
          matchId: '00000000-0000-0000-0000-000000000000',
          winnerId: 'user-x',
          score1: 1,
          score2: 0,
        })
      ).rejects.toThrow(MatchNotFoundError);
    });
  });

  describe('checkInParticipant', () => {
    it('should check in participant', async () => {
      const tournament = await tournamentService.createTournament({
        name: 'Check In Test',
        gameMode: 'solo',
        format: 'single_elimination',
        maxParticipants: 8,
        registrationStartsAt: new Date(),
        registrationEndsAt: new Date(Date.now() + 86400000),
        startsAt: new Date(Date.now() + 172800000),
        createdBy: 'admin-10',
      });

      await tournamentService.openRegistration(tournament.id);

      await tournamentService.registerParticipant({
        tournamentId: tournament.id,
        userId: 'user-checkin',
        username: 'CheckInPlayer',
      });

      const participant = await tournamentService.checkInParticipant(tournament.id, 'user-checkin');

      expect(participant.status).toBe('checked_in');
      expect(participant.checkedInAt).toBeDefined();
    });
  });

  describe('cancelTournament', () => {
    it('should cancel tournament', async () => {
      const tournament = await tournamentService.createTournament({
        name: 'Cancel Test',
        gameMode: 'solo',
        format: 'single_elimination',
        maxParticipants: 8,
        registrationStartsAt: new Date(),
        registrationEndsAt: new Date(Date.now() + 86400000),
        startsAt: new Date(Date.now() + 172800000),
        createdBy: 'admin-11',
      });

      const cancelled = await tournamentService.cancelTournament(tournament.id);

      expect(cancelled.status).toBe('cancelled');
    });
  });

  describe('withdrawParticipant', () => {
    it('should withdraw participant', async () => {
      const tournament = await tournamentService.createTournament({
        name: 'Withdraw Test',
        gameMode: 'solo',
        format: 'single_elimination',
        maxParticipants: 8,
        registrationStartsAt: new Date(),
        registrationEndsAt: new Date(Date.now() + 86400000),
        startsAt: new Date(Date.now() + 172800000),
        createdBy: 'admin-12',
      });

      await tournamentService.openRegistration(tournament.id);

      await tournamentService.registerParticipant({
        tournamentId: tournament.id,
        userId: 'user-withdraw',
        username: 'WithdrawPlayer',
      });

      await tournamentService.withdrawParticipant(tournament.id, 'user-withdraw');

      const count = tournamentService.getParticipantCount(tournament.id);
      expect(count).toBe(0);
    });
  });
});
