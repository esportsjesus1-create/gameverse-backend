export type TournamentStatus = 'draft' | 'registration' | 'seeding' | 'in_progress' | 'completed' | 'cancelled';
export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss';
export type MatchStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'bye';
export type ParticipantStatus = 'registered' | 'checked_in' | 'eliminated' | 'winner' | 'disqualified';

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  gameMode: string;
  format: TournamentFormat;
  status: TournamentStatus;
  maxParticipants: number;
  minParticipants: number;
  entryFee: number;
  prizePool: PrizePool;
  rules?: string;
  settings: TournamentSettings;
  registrationStartsAt: Date;
  registrationEndsAt: Date;
  startsAt: Date;
  endsAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TournamentSettings {
  checkInRequired: boolean;
  checkInDuration: number;
  matchDuration: number;
  bestOf: number;
  seeding: 'random' | 'manual' | 'ranked';
  allowLateRegistration: boolean;
  teamSize?: number;
}

export interface PrizePool {
  total: number;
  currency: string;
  distribution: PrizeDistribution[];
}

export interface PrizeDistribution {
  place: number;
  amount: number;
  percentage: number;
}

export interface Participant {
  id: string;
  tournamentId: string;
  userId: string;
  username: string;
  teamId?: string;
  teamName?: string;
  seed?: number;
  status: ParticipantStatus;
  checkedInAt?: Date;
  eliminatedAt?: Date;
  finalPlacement?: number;
  registeredAt: Date;
}

export interface Match {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  bracketPosition: string;
  participant1Id?: string;
  participant2Id?: string;
  winnerId?: string;
  loserId?: string;
  score1?: number;
  score2?: number;
  status: MatchStatus;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  nextMatchId?: string;
  loserNextMatchId?: string;
}

export interface Bracket {
  tournamentId: string;
  format: TournamentFormat;
  rounds: BracketRound[];
  loserBracket?: BracketRound[];
}

export interface BracketRound {
  round: number;
  name: string;
  matches: Match[];
}

export interface CreateTournamentInput {
  name: string;
  description?: string;
  gameMode: string;
  format: TournamentFormat;
  maxParticipants: number;
  minParticipants?: number;
  entryFee?: number;
  prizePool?: Partial<PrizePool>;
  rules?: string;
  settings?: Partial<TournamentSettings>;
  registrationStartsAt: Date;
  registrationEndsAt: Date;
  startsAt: Date;
  createdBy: string;
}

export interface RegisterParticipantInput {
  tournamentId: string;
  userId: string;
  username: string;
  teamId?: string;
  teamName?: string;
}

export interface ReportMatchResultInput {
  matchId: string;
  winnerId: string;
  score1: number;
  score2: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const DEFAULT_TOURNAMENT_SETTINGS: TournamentSettings = {
  checkInRequired: true,
  checkInDuration: 30,
  matchDuration: 60,
  bestOf: 1,
  seeding: 'random',
  allowLateRegistration: false,
};

export const DEFAULT_PRIZE_DISTRIBUTION: PrizeDistribution[] = [
  { place: 1, amount: 0, percentage: 50 },
  { place: 2, amount: 0, percentage: 30 },
  { place: 3, amount: 0, percentage: 20 },
];

export class TournamentError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 400, code: string = 'TOURNAMENT_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, TournamentError.prototype);
  }
}

export class TournamentNotFoundError extends TournamentError {
  constructor() {
    super('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
  }
}

export class RegistrationClosedError extends TournamentError {
  constructor() {
    super('Registration is closed', 400, 'REGISTRATION_CLOSED');
  }
}

export class TournamentFullError extends TournamentError {
  constructor() {
    super('Tournament is full', 400, 'TOURNAMENT_FULL');
  }
}

export class AlreadyRegisteredError extends TournamentError {
  constructor() {
    super('Already registered for this tournament', 400, 'ALREADY_REGISTERED');
  }
}

export class MatchNotFoundError extends TournamentError {
  constructor() {
    super('Match not found', 404, 'MATCH_NOT_FOUND');
  }
}

export class InvalidMatchResultError extends TournamentError {
  constructor() {
    super('Invalid match result', 400, 'INVALID_MATCH_RESULT');
  }
}
