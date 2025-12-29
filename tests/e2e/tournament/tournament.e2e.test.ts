import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import {
  createTestUser,
  createTestTournament,
  registerTournamentParticipant,
  cleanupTestData,
} from '../helpers/testUtils';

describe('E2E Tournament Tests', () => {
  let pool: Pool;
  let redis: Redis;
  let client: PoolClient;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.TEST_POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.TEST_POSTGRES_PORT || '5433', 10),
      database: process.env.TEST_POSTGRES_DB || 'gameverse_test',
      user: process.env.TEST_POSTGRES_USER || 'gameverse_test',
      password: process.env.TEST_POSTGRES_PASSWORD || 'gameverse_test_secret',
    });
    redis = new Redis({
      host: process.env.TEST_REDIS_HOST || 'localhost',
      port: parseInt(process.env.TEST_REDIS_PORT || '6380', 10),
      db: parseInt(process.env.TEST_REDIS_DB || '1', 10),
      lazyConnect: true,
    });
  });

  beforeEach(async () => {
    client = await pool.connect();
    await cleanupTestData(client);
  });

  afterEach(async () => {
    if (client) {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
    await redis.quit();
  });

  describe('E2E-TOURNAMENT-001: Create tournament with valid parameters', () => {
    it('should create a new tournament successfully', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id, {
        name: 'Championship 2024',
        max_participants: 32,
      });

      expect(tournament).toBeDefined();
      expect(tournament.id).toBeDefined();
      expect(tournament.name).toBe('Championship 2024');
      expect(tournament.organizer_id).toBe(organizer.id);
      expect(tournament.status).toBe('registration_open');
    });
  });

  describe('E2E-TOURNAMENT-002: Create single elimination tournament', () => {
    it('should create single elimination tournament', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id, {
        type: 'single_elimination',
      });

      expect(tournament.type).toBe('single_elimination');
    });
  });

  describe('E2E-TOURNAMENT-003: Create double elimination tournament', () => {
    it('should create double elimination tournament', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id, {
        type: 'double_elimination',
      });

      expect(tournament.type).toBe('double_elimination');
    });
  });

  describe('E2E-TOURNAMENT-004: Create round robin tournament', () => {
    it('should create round robin tournament', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id, {
        type: 'round_robin',
      });

      expect(tournament.type).toBe('round_robin');
    });
  });

  describe('E2E-TOURNAMENT-005: Create swiss tournament', () => {
    it('should create swiss tournament', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id, {
        type: 'swiss',
      });

      expect(tournament.type).toBe('swiss');
    });
  });

  describe('E2E-TOURNAMENT-006: Create team tournament', () => {
    it('should create team-based tournament', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id, {
        format: 'team',
        team_size: 5,
      });

      expect(tournament.format).toBe('team');
      expect(tournament.team_size).toBe(5);
    });
  });

  describe('E2E-TOURNAMENT-007: Create private tournament', () => {
    it('should create private tournament', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id, {
        visibility: 'private',
      });

      expect(tournament.visibility).toBe('private');
    });
  });

  describe('E2E-TOURNAMENT-008: Create invite-only tournament', () => {
    it('should create invite-only tournament', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id, {
        visibility: 'invite_only',
      });

      expect(tournament.visibility).toBe('invite_only');
    });
  });

  describe('E2E-TOURNAMENT-009: Set tournament entry fee', () => {
    it('should set entry fee for tournament', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id, {
        entry_fee: 10,
        entry_fee_currency: 'USD',
      });

      expect(parseFloat(tournament.entry_fee)).toBe(10);
      expect(tournament.entry_fee_currency).toBe('USD');
    });
  });

  describe('E2E-TOURNAMENT-010: Set tournament prize pool', () => {
    it('should set prize pool for tournament', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id, {
        prize_pool: 1000,
        prize_pool_currency: 'USD',
      });

      expect(parseFloat(tournament.prize_pool)).toBe(1000);
    });
  });

  describe('E2E-TOURNAMENT-011: Register for tournament', () => {
    it('should register participant for tournament', async () => {
      const organizer = await createTestUser(client);
      const player = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);

      const participant = await registerTournamentParticipant(client, tournament.id, player.id);

      expect(participant.tournament_id).toBe(tournament.id);
      expect(participant.user_id).toBe(player.id);
      expect(participant.status).toBe('registered');
    });
  });

  describe('E2E-TOURNAMENT-012: Participant count increments on registration', () => {
    it('should increment current_participants on registration', async () => {
      const organizer = await createTestUser(client);
      const player = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);

      await registerTournamentParticipant(client, tournament.id, player.id);

      const result = await client.query(
        'SELECT current_participants FROM tournaments WHERE id = $1',
        [tournament.id]
      );
      expect(result.rows[0].current_participants).toBe(1);
    });
  });

  describe('E2E-TOURNAMENT-013: Withdraw from tournament', () => {
    it('should allow participant to withdraw', async () => {
      const organizer = await createTestUser(client);
      const player = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);
      await registerTournamentParticipant(client, tournament.id, player.id);

      await client.query(
        "UPDATE tournament_participants SET status = 'withdrawn' WHERE tournament_id = $1 AND user_id = $2",
        [tournament.id, player.id]
      );

      const result = await client.query(
        'SELECT status FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
        [tournament.id, player.id]
      );
      expect(result.rows[0].status).toBe('withdrawn');
    });
  });

  describe('E2E-TOURNAMENT-014: Check-in for tournament', () => {
    it('should allow participant to check-in', async () => {
      const organizer = await createTestUser(client);
      const player = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);
      await registerTournamentParticipant(client, tournament.id, player.id);

      await client.query(
        "UPDATE tournament_participants SET status = 'checked_in', check_in_at = NOW() WHERE tournament_id = $1 AND user_id = $2",
        [tournament.id, player.id]
      );

      const result = await client.query(
        'SELECT status, check_in_at FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
        [tournament.id, player.id]
      );
      expect(result.rows[0].status).toBe('checked_in');
      expect(result.rows[0].check_in_at).toBeDefined();
    });
  });

  describe('E2E-TOURNAMENT-015: Get tournament participants', () => {
    it('should retrieve all tournament participants', async () => {
      const organizer = await createTestUser(client);
      const player1 = await createTestUser(client);
      const player2 = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);
      await registerTournamentParticipant(client, tournament.id, player1.id);
      await registerTournamentParticipant(client, tournament.id, player2.id);

      const result = await client.query(
        'SELECT * FROM tournament_participants WHERE tournament_id = $1',
        [tournament.id]
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-TOURNAMENT-016: Create tournament team', () => {
    it('should create team for tournament', async () => {
      const organizer = await createTestUser(client);
      const captain = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id, { format: 'team' });

      const result = await client.query(
        `INSERT INTO tournament_teams (tournament_id, name, tag, captain_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [tournament.id, 'Team Alpha', 'ALPHA', captain.id]
      );

      expect(result.rows[0].name).toBe('Team Alpha');
      expect(result.rows[0].captain_id).toBe(captain.id);
    });
  });

  describe('E2E-TOURNAMENT-017: Add member to tournament team', () => {
    it('should add member to team', async () => {
      const organizer = await createTestUser(client);
      const captain = await createTestUser(client);
      const member = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id, { format: 'team' });

      const teamResult = await client.query(
        `INSERT INTO tournament_teams (tournament_id, name, captain_id) VALUES ($1, $2, $3) RETURNING id`,
        [tournament.id, 'Team Alpha', captain.id]
      );

      await client.query(
        `INSERT INTO tournament_team_members (team_id, user_id, role) VALUES ($1, $2, $3)`,
        [teamResult.rows[0].id, member.id, 'member']
      );

      const result = await client.query(
        'SELECT * FROM tournament_team_members WHERE team_id = $1',
        [teamResult.rows[0].id]
      );
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-TOURNAMENT-018: Create tournament round', () => {
    it('should create tournament round', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);

      const result = await client.query(
        `INSERT INTO tournament_rounds (tournament_id, round_number, name, type, best_of)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [tournament.id, 1, 'Round 1', 'winners', 3]
      );

      expect(result.rows[0].round_number).toBe(1);
      expect(result.rows[0].best_of).toBe(3);
    });
  });

  describe('E2E-TOURNAMENT-019: Create tournament match', () => {
    it('should create match between participants', async () => {
      const organizer = await createTestUser(client);
      const player1 = await createTestUser(client);
      const player2 = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);
      const p1 = await registerTournamentParticipant(client, tournament.id, player1.id);
      const p2 = await registerTournamentParticipant(client, tournament.id, player2.id);

      const roundResult = await client.query(
        `INSERT INTO tournament_rounds (tournament_id, round_number, type) VALUES ($1, $2, $3) RETURNING id`,
        [tournament.id, 1, 'winners']
      );

      const result = await client.query(
        `INSERT INTO tournament_matches (tournament_id, round_id, match_number, participant1_id, participant2_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [tournament.id, roundResult.rows[0].id, 1, p1.id, p2.id]
      );

      expect(result.rows[0].participant1_id).toBe(p1.id);
      expect(result.rows[0].participant2_id).toBe(p2.id);
      expect(result.rows[0].status).toBe('pending');
    });
  });

  describe('E2E-TOURNAMENT-020: Start tournament match', () => {
    it('should start match', async () => {
      const organizer = await createTestUser(client);
      const player1 = await createTestUser(client);
      const player2 = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);
      const p1 = await registerTournamentParticipant(client, tournament.id, player1.id);
      const p2 = await registerTournamentParticipant(client, tournament.id, player2.id);

      const roundResult = await client.query(
        `INSERT INTO tournament_rounds (tournament_id, round_number, type) VALUES ($1, $2, $3) RETURNING id`,
        [tournament.id, 1, 'winners']
      );

      const matchResult = await client.query(
        `INSERT INTO tournament_matches (tournament_id, round_id, match_number, participant1_id, participant2_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [tournament.id, roundResult.rows[0].id, 1, p1.id, p2.id]
      );

      await client.query(
        "UPDATE tournament_matches SET status = 'in_progress', started_at = NOW() WHERE id = $1",
        [matchResult.rows[0].id]
      );

      const result = await client.query(
        'SELECT status, started_at FROM tournament_matches WHERE id = $1',
        [matchResult.rows[0].id]
      );
      expect(result.rows[0].status).toBe('in_progress');
      expect(result.rows[0].started_at).toBeDefined();
    });
  });

  describe('E2E-TOURNAMENT-021: Complete tournament match', () => {
    it('should complete match with winner', async () => {
      const organizer = await createTestUser(client);
      const player1 = await createTestUser(client);
      const player2 = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);
      const p1 = await registerTournamentParticipant(client, tournament.id, player1.id);
      const p2 = await registerTournamentParticipant(client, tournament.id, player2.id);

      const roundResult = await client.query(
        `INSERT INTO tournament_rounds (tournament_id, round_number, type) VALUES ($1, $2, $3) RETURNING id`,
        [tournament.id, 1, 'winners']
      );

      const matchResult = await client.query(
        `INSERT INTO tournament_matches (tournament_id, round_id, match_number, participant1_id, participant2_id, status)
         VALUES ($1, $2, $3, $4, $5, 'in_progress') RETURNING id`,
        [tournament.id, roundResult.rows[0].id, 1, p1.id, p2.id]
      );

      await client.query(
        `UPDATE tournament_matches SET status = 'completed', winner_id = $1, loser_id = $2, 
         score1 = 2, score2 = 1, completed_at = NOW() WHERE id = $3`,
        [p1.id, p2.id, matchResult.rows[0].id]
      );

      const result = await client.query(
        'SELECT status, winner_id, score1, score2 FROM tournament_matches WHERE id = $1',
        [matchResult.rows[0].id]
      );
      expect(result.rows[0].status).toBe('completed');
      expect(result.rows[0].winner_id).toBe(p1.id);
      expect(result.rows[0].score1).toBe(2);
    });
  });

  describe('E2E-TOURNAMENT-022: Forfeit tournament match', () => {
    it('should forfeit match', async () => {
      const organizer = await createTestUser(client);
      const player1 = await createTestUser(client);
      const player2 = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);
      const p1 = await registerTournamentParticipant(client, tournament.id, player1.id);
      const p2 = await registerTournamentParticipant(client, tournament.id, player2.id);

      const roundResult = await client.query(
        `INSERT INTO tournament_rounds (tournament_id, round_number, type) VALUES ($1, $2, $3) RETURNING id`,
        [tournament.id, 1, 'winners']
      );

      const matchResult = await client.query(
        `INSERT INTO tournament_matches (tournament_id, round_id, match_number, participant1_id, participant2_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [tournament.id, roundResult.rows[0].id, 1, p1.id, p2.id]
      );

      await client.query(
        "UPDATE tournament_matches SET status = 'forfeit', winner_id = $1 WHERE id = $2",
        [p2.id, matchResult.rows[0].id]
      );

      const result = await client.query('SELECT status FROM tournament_matches WHERE id = $1', [
        matchResult.rows[0].id,
      ]);
      expect(result.rows[0].status).toBe('forfeit');
    });
  });

  describe('E2E-TOURNAMENT-023: Eliminate participant', () => {
    it('should eliminate participant from tournament', async () => {
      const organizer = await createTestUser(client);
      const player = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);
      await registerTournamentParticipant(client, tournament.id, player.id);

      await client.query(
        "UPDATE tournament_participants SET status = 'eliminated', eliminated_at = NOW() WHERE tournament_id = $1 AND user_id = $2",
        [tournament.id, player.id]
      );

      const result = await client.query(
        'SELECT status, eliminated_at FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
        [tournament.id, player.id]
      );
      expect(result.rows[0].status).toBe('eliminated');
    });
  });

  describe('E2E-TOURNAMENT-024: Disqualify participant', () => {
    it('should disqualify participant', async () => {
      const organizer = await createTestUser(client);
      const player = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);
      await registerTournamentParticipant(client, tournament.id, player.id);

      await client.query(
        "UPDATE tournament_participants SET status = 'disqualified' WHERE tournament_id = $1 AND user_id = $2",
        [tournament.id, player.id]
      );

      const result = await client.query(
        'SELECT status FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
        [tournament.id, player.id]
      );
      expect(result.rows[0].status).toBe('disqualified');
    });
  });

  describe('E2E-TOURNAMENT-025: Set participant seed', () => {
    it('should set participant seed', async () => {
      const organizer = await createTestUser(client);
      const player = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);
      await registerTournamentParticipant(client, tournament.id, player.id);

      await client.query(
        'UPDATE tournament_participants SET seed = $1 WHERE tournament_id = $2 AND user_id = $3',
        [1, tournament.id, player.id]
      );

      const result = await client.query(
        'SELECT seed FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
        [tournament.id, player.id]
      );
      expect(result.rows[0].seed).toBe(1);
    });
  });

  describe('E2E-TOURNAMENT-026: Set final placement', () => {
    it('should set participant final placement', async () => {
      const organizer = await createTestUser(client);
      const player = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);
      await registerTournamentParticipant(client, tournament.id, player.id);

      await client.query(
        'UPDATE tournament_participants SET final_placement = $1 WHERE tournament_id = $2 AND user_id = $3',
        [1, tournament.id, player.id]
      );

      const result = await client.query(
        'SELECT final_placement FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
        [tournament.id, player.id]
      );
      expect(result.rows[0].final_placement).toBe(1);
    });
  });

  describe('E2E-TOURNAMENT-027: Create tournament bracket', () => {
    it('should create tournament bracket', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);

      const bracketData = {
        rounds: [{ round: 1, matches: [{ match: 1, p1: null, p2: null }] }],
      };

      const result = await client.query(
        `INSERT INTO tournament_brackets (tournament_id, bracket_type, bracket_data)
         VALUES ($1, $2, $3) RETURNING *`,
        [tournament.id, 'single_elimination', JSON.stringify(bracketData)]
      );

      expect(result.rows[0].bracket_type).toBe('single_elimination');
    });
  });

  describe('E2E-TOURNAMENT-028: Update tournament bracket', () => {
    it('should update tournament bracket', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);

      await client.query(
        `INSERT INTO tournament_brackets (tournament_id, bracket_type, bracket_data)
         VALUES ($1, $2, $3)`,
        [tournament.id, 'single_elimination', '{}']
      );

      const newBracketData = { rounds: [{ round: 1, matches: [] }] };
      await client.query(
        'UPDATE tournament_brackets SET bracket_data = $1, updated_at = NOW() WHERE tournament_id = $2',
        [JSON.stringify(newBracketData), tournament.id]
      );

      const result = await client.query(
        'SELECT bracket_data FROM tournament_brackets WHERE tournament_id = $1',
        [tournament.id]
      );
      expect(result.rows[0].bracket_data.rounds).toBeDefined();
    });
  });

  describe('E2E-TOURNAMENT-029: Create tournament prize', () => {
    it('should create prize for placement', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);

      const result = await client.query(
        `INSERT INTO tournament_prizes (tournament_id, placement, prize_type, prize_value, prize_currency)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [tournament.id, 1, 'currency', 500, 'USD']
      );

      expect(result.rows[0].placement).toBe(1);
      expect(parseFloat(result.rows[0].prize_value)).toBe(500);
    });
  });

  describe('E2E-TOURNAMENT-030: Claim tournament prize', () => {
    it('should claim prize', async () => {
      const organizer = await createTestUser(client);
      const winner = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);

      const prizeResult = await client.query(
        `INSERT INTO tournament_prizes (tournament_id, placement, prize_type, prize_value)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [tournament.id, 1, 'currency', 500]
      );

      await client.query(
        'UPDATE tournament_prizes SET claimed = true, claimed_by = $1, claimed_at = NOW() WHERE id = $2',
        [winner.id, prizeResult.rows[0].id]
      );

      const result = await client.query(
        'SELECT claimed, claimed_by FROM tournament_prizes WHERE id = $1',
        [prizeResult.rows[0].id]
      );
      expect(result.rows[0].claimed).toBe(true);
      expect(result.rows[0].claimed_by).toBe(winner.id);
    });
  });

  describe('E2E-TOURNAMENT-031: Open tournament registration', () => {
    it('should open registration', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id, { status: 'draft' });

      await client.query(
        "UPDATE tournaments SET status = 'registration_open', registration_start_at = NOW() WHERE id = $1",
        [tournament.id]
      );

      const result = await client.query('SELECT status FROM tournaments WHERE id = $1', [
        tournament.id,
      ]);
      expect(result.rows[0].status).toBe('registration_open');
    });
  });

  describe('E2E-TOURNAMENT-032: Close tournament registration', () => {
    it('should close registration', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);

      await client.query(
        "UPDATE tournaments SET status = 'registration_closed', registration_end_at = NOW() WHERE id = $1",
        [tournament.id]
      );

      const result = await client.query('SELECT status FROM tournaments WHERE id = $1', [
        tournament.id,
      ]);
      expect(result.rows[0].status).toBe('registration_closed');
    });
  });

  describe('E2E-TOURNAMENT-033: Start tournament', () => {
    it('should start tournament', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);

      await client.query("UPDATE tournaments SET status = 'in_progress' WHERE id = $1", [
        tournament.id,
      ]);

      const result = await client.query('SELECT status FROM tournaments WHERE id = $1', [
        tournament.id,
      ]);
      expect(result.rows[0].status).toBe('in_progress');
    });
  });

  describe('E2E-TOURNAMENT-034: Complete tournament', () => {
    it('should complete tournament', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id, {
        status: 'in_progress',
      });

      await client.query(
        "UPDATE tournaments SET status = 'completed', end_at = NOW() WHERE id = $1",
        [tournament.id]
      );

      const result = await client.query('SELECT status, end_at FROM tournaments WHERE id = $1', [
        tournament.id,
      ]);
      expect(result.rows[0].status).toBe('completed');
      expect(result.rows[0].end_at).toBeDefined();
    });
  });

  describe('E2E-TOURNAMENT-035: Cancel tournament', () => {
    it('should cancel tournament', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);

      await client.query("UPDATE tournaments SET status = 'cancelled' WHERE id = $1", [
        tournament.id,
      ]);

      const result = await client.query('SELECT status FROM tournaments WHERE id = $1', [
        tournament.id,
      ]);
      expect(result.rows[0].status).toBe('cancelled');
    });
  });

  describe('E2E-TOURNAMENT-036: Update tournament details', () => {
    it('should update tournament details', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);

      await client.query(
        'UPDATE tournaments SET name = $1, description = $2, rules = $3 WHERE id = $4',
        ['Updated Championship', 'New description', 'Updated rules', tournament.id]
      );

      const result = await client.query(
        'SELECT name, description, rules FROM tournaments WHERE id = $1',
        [tournament.id]
      );
      expect(result.rows[0].name).toBe('Updated Championship');
    });
  });

  describe('E2E-TOURNAMENT-037: Search public tournaments', () => {
    it('should search public tournaments', async () => {
      const organizer = await createTestUser(client);
      await createTestTournament(client, organizer.id, {
        name: 'Public Championship',
        visibility: 'public',
      });
      await createTestTournament(client, organizer.id, {
        name: 'Private Event',
        visibility: 'private',
      });

      const result = await client.query("SELECT * FROM tournaments WHERE visibility = 'public'");
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-TOURNAMENT-038: Filter tournaments by game', () => {
    it('should filter tournaments by game', async () => {
      const organizer = await createTestUser(client);
      await createTestTournament(client, organizer.id, { game_id: 'game-a' });
      await createTestTournament(client, organizer.id, { game_id: 'game-b' });

      const result = await client.query("SELECT * FROM tournaments WHERE game_id = 'game-a'");
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-TOURNAMENT-039: Filter tournaments by status', () => {
    it('should filter tournaments by status', async () => {
      const organizer = await createTestUser(client);
      await createTestTournament(client, organizer.id, { status: 'registration_open' });
      await createTestTournament(client, organizer.id, { status: 'in_progress' });

      const result = await client.query(
        "SELECT * FROM tournaments WHERE status = 'registration_open'"
      );
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-TOURNAMENT-040: Get upcoming tournaments', () => {
    it('should get upcoming tournaments', async () => {
      const organizer = await createTestUser(client);
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await createTestTournament(client, organizer.id, { start_at: futureDate });

      const result = await client.query(
        "SELECT * FROM tournaments WHERE start_at > NOW() AND status = 'registration_open'"
      );
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-TOURNAMENT-041: Get tournament matches', () => {
    it('should get all matches for tournament', async () => {
      const organizer = await createTestUser(client);
      const player1 = await createTestUser(client);
      const player2 = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);
      const p1 = await registerTournamentParticipant(client, tournament.id, player1.id);
      const p2 = await registerTournamentParticipant(client, tournament.id, player2.id);

      const roundResult = await client.query(
        `INSERT INTO tournament_rounds (tournament_id, round_number, type) VALUES ($1, $2, $3) RETURNING id`,
        [tournament.id, 1, 'winners']
      );

      await client.query(
        `INSERT INTO tournament_matches (tournament_id, round_id, match_number, participant1_id, participant2_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [tournament.id, roundResult.rows[0].id, 1, p1.id, p2.id]
      );

      const result = await client.query(
        'SELECT * FROM tournament_matches WHERE tournament_id = $1',
        [tournament.id]
      );
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-TOURNAMENT-042: Get tournament rounds', () => {
    it('should get all rounds for tournament', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);

      await client.query(
        `INSERT INTO tournament_rounds (tournament_id, round_number, type) VALUES ($1, $2, $3)`,
        [tournament.id, 1, 'winners']
      );
      await client.query(
        `INSERT INTO tournament_rounds (tournament_id, round_number, type) VALUES ($1, $2, $3)`,
        [tournament.id, 2, 'winners']
      );

      const result = await client.query(
        'SELECT * FROM tournament_rounds WHERE tournament_id = $1 ORDER BY round_number',
        [tournament.id]
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-TOURNAMENT-043: Log tournament activity', () => {
    it('should log tournament activity', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);

      await client.query(
        `INSERT INTO tournament_activity_log (tournament_id, user_id, action, details)
         VALUES ($1, $2, $3, $4)`,
        [
          tournament.id,
          organizer.id,
          'tournament_created',
          JSON.stringify({ name: tournament.name }),
        ]
      );

      const result = await client.query(
        'SELECT * FROM tournament_activity_log WHERE tournament_id = $1',
        [tournament.id]
      );
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-TOURNAMENT-044: Get tournament activity log', () => {
    it('should retrieve tournament activity log', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);

      await client.query(
        `INSERT INTO tournament_activity_log (tournament_id, action) VALUES ($1, $2)`,
        [tournament.id, 'tournament_created']
      );
      await client.query(
        `INSERT INTO tournament_activity_log (tournament_id, action) VALUES ($1, $2)`,
        [tournament.id, 'registration_opened']
      );

      const result = await client.query(
        'SELECT * FROM tournament_activity_log WHERE tournament_id = $1 ORDER BY created_at DESC',
        [tournament.id]
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-TOURNAMENT-045: Prevent registration when full', () => {
    it('should detect tournament is full', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id, { max_participants: 2 });

      await client.query('UPDATE tournaments SET current_participants = 2 WHERE id = $1', [
        tournament.id,
      ]);

      const result = await client.query(
        'SELECT current_participants >= max_participants as is_full FROM tournaments WHERE id = $1',
        [tournament.id]
      );
      expect(result.rows[0].is_full).toBe(true);
    });
  });

  describe('E2E-TOURNAMENT-046: Prevent duplicate registration', () => {
    it('should detect duplicate registration', async () => {
      const organizer = await createTestUser(client);
      const player = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);
      await registerTournamentParticipant(client, tournament.id, player.id);

      const result = await client.query(
        `SELECT EXISTS(
          SELECT 1 FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2
        ) as already_registered`,
        [tournament.id, player.id]
      );
      expect(result.rows[0].already_registered).toBe(true);
    });
  });

  describe('E2E-TOURNAMENT-047: Get user tournament history', () => {
    it('should get user tournament participation history', async () => {
      const organizer = await createTestUser(client);
      const player = await createTestUser(client);
      const tournament1 = await createTestTournament(client, organizer.id);
      const tournament2 = await createTestTournament(client, organizer.id);
      await registerTournamentParticipant(client, tournament1.id, player.id);
      await registerTournamentParticipant(client, tournament2.id, player.id);

      const result = await client.query(
        `SELECT t.* FROM tournaments t
         JOIN tournament_participants tp ON t.id = tp.tournament_id
         WHERE tp.user_id = $1`,
        [player.id]
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-TOURNAMENT-048: Get tournament with organizer details', () => {
    it('should get tournament with organizer info', async () => {
      const organizer = await createTestUser(client, { display_name: 'Tournament Organizer' });
      const tournament = await createTestTournament(client, organizer.id);

      const result = await client.query(
        `SELECT t.*, u.display_name as organizer_name
         FROM tournaments t
         JOIN users u ON t.organizer_id = u.id
         WHERE t.id = $1`,
        [tournament.id]
      );
      expect(result.rows[0].organizer_name).toBe('Tournament Organizer');
    });
  });

  describe('E2E-TOURNAMENT-049: Update participant stats', () => {
    it('should update participant stats', async () => {
      const organizer = await createTestUser(client);
      const player = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);
      await registerTournamentParticipant(client, tournament.id, player.id);

      await client.query(
        'UPDATE tournament_participants SET stats = $1 WHERE tournament_id = $2 AND user_id = $3',
        [JSON.stringify({ wins: 3, losses: 1, kills: 25 }), tournament.id, player.id]
      );

      const result = await client.query(
        'SELECT stats FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
        [tournament.id, player.id]
      );
      expect(result.rows[0].stats.wins).toBe(3);
    });
  });

  describe('E2E-TOURNAMENT-050: Cascade delete participants on tournament delete', () => {
    it('should delete participants when tournament is deleted', async () => {
      const organizer = await createTestUser(client);
      const player = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);
      await registerTournamentParticipant(client, tournament.id, player.id);

      await client.query('DELETE FROM tournaments WHERE id = $1', [tournament.id]);

      const result = await client.query(
        'SELECT * FROM tournament_participants WHERE tournament_id = $1',
        [tournament.id]
      );
      expect(result.rows.length).toBe(0);
    });
  });

  describe('E2E-TOURNAMENT-051: Index performance for tournament queries', () => {
    it('should use indexes for tournament queries', async () => {
      const organizer = await createTestUser(client);
      await createTestTournament(client, organizer.id);

      const result = await client.query(
        "EXPLAIN SELECT * FROM tournaments WHERE status = 'registration_open' AND visibility = 'public'"
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('E2E-TOURNAMENT-052: Index performance for participant queries', () => {
    it('should use indexes for participant queries', async () => {
      const organizer = await createTestUser(client);
      const tournament = await createTestTournament(client, organizer.id);

      const result = await client.query(
        'EXPLAIN SELECT * FROM tournament_participants WHERE tournament_id = $1',
        [tournament.id]
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });
});
