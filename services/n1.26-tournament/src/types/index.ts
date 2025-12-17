import { TournamentStatus, TournamentFormat, MatchStatus, ParticipantStatus } from '@prisma/client';

export { TournamentStatus, TournamentFormat, MatchStatus, ParticipantStatus };

export interface CreateTournamentDto {
  name: string;
  description?: string;
  game: string;
  format?: TournamentFormat;
  maxParticipants: number;
  minParticipants?: number;
  startDate?: Date;
  endDate?: Date;
  registrationStartDate?: Date;
  registrationEndDate?: Date;
  rules?: string;
  prizePool?: string;
  createdBy?: string;
}

export interface UpdateTournamentDto {
  name?: string;
  description?: string;
  game?: string;
  format?: TournamentFormat;
  status?: TournamentStatus;
  maxParticipants?: number;
  minParticipants?: number;
  startDate?: Date;
  endDate?: Date;
  registrationStartDate?: Date;
  registrationEndDate?: Date;
  rules?: string;
  prizePool?: string;
}

export interface TournamentFilters {
  status?: TournamentStatus;
  format?: TournamentFormat;
  game?: string;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateParticipantDto {
  userId?: string;
  teamId?: string;
  name: string;
  email?: string;
  seed?: number;
}

export interface UpdateParticipantDto {
  name?: string;
  email?: string;
  seed?: number;
  status?: ParticipantStatus;
}

export interface UpdateMatchDto {
  player1Score?: number;
  player2Score?: number;
  winnerId?: string;
  status?: MatchStatus;
  scheduledAt?: Date;
}

export interface BracketGenerationOptions {
  shuffleSeeds?: boolean;
  schedulingStartTime?: Date;
  matchDurationMinutes?: number;
  breakBetweenMatchesMinutes?: number;
}

export interface BracketMatch {
  round: number;
  position: number;
  player1Id: string | null;
  player2Id: string | null;
  nextMatchPosition: number | null;
  nextMatchSlot: number | null;
  isBye: boolean;
}

export interface GeneratedBracket {
  totalRounds: number;
  matches: BracketMatch[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface TournamentWithDetails {
  id: string;
  name: string;
  description: string | null;
  game: string;
  format: TournamentFormat;
  status: TournamentStatus;
  maxParticipants: number;
  minParticipants: number;
  startDate: Date | null;
  endDate: Date | null;
  registrationStartDate: Date | null;
  registrationEndDate: Date | null;
  rules: string | null;
  prizePool: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  participants: ParticipantInfo[];
  matches: MatchInfo[];
}

export interface ParticipantInfo {
  id: string;
  name: string;
  email: string | null;
  seed: number | null;
  status: ParticipantStatus;
  checkedInAt: Date | null;
}

export interface MatchInfo {
  id: string;
  round: number;
  position: number;
  player1: ParticipantInfo | null;
  player2: ParticipantInfo | null;
  winner: ParticipantInfo | null;
  player1Score: number | null;
  player2Score: number | null;
  status: MatchStatus;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
}
