import {
  IsOptional,
  IsUUID,
  IsInt,
  IsString,
  IsEnum,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum LeaderboardSortBy {
  RANK = 'rank',
  POINTS = 'points',
  WINS = 'wins',
  WIN_RATE = 'winRate',
  MATCHES_PLAYED = 'matchesPlayed',
}

export enum LeaderboardTimeframe {
  ALL_TIME = 'all_time',
  YEARLY = 'yearly',
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
}

export class GetTournamentStandingsDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: LeaderboardSortBy,
    default: LeaderboardSortBy.RANK,
  })
  @IsOptional()
  @IsEnum(LeaderboardSortBy)
  sortBy?: LeaderboardSortBy;

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

export class GetGlobalLeaderboardDto {
  @ApiPropertyOptional({ description: 'Game ID filter' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  gameId?: string;

  @ApiPropertyOptional({ description: 'Region filter' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  region?: string;

  @ApiPropertyOptional({
    description: 'Timeframe',
    enum: LeaderboardTimeframe,
    default: LeaderboardTimeframe.ALL_TIME,
  })
  @IsOptional()
  @IsEnum(LeaderboardTimeframe)
  timeframe?: LeaderboardTimeframe;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: LeaderboardSortBy,
    default: LeaderboardSortBy.POINTS,
  })
  @IsOptional()
  @IsEnum(LeaderboardSortBy)
  sortBy?: LeaderboardSortBy;
}

export class GetPlayerStatsDto {
  @ApiProperty({ description: 'Player ID' })
  @IsUUID()
  playerId: string;

  @ApiPropertyOptional({ description: 'Game ID filter' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  gameId?: string;

  @ApiPropertyOptional({
    description: 'Timeframe',
    enum: LeaderboardTimeframe,
    default: LeaderboardTimeframe.ALL_TIME,
  })
  @IsOptional()
  @IsEnum(LeaderboardTimeframe)
  timeframe?: LeaderboardTimeframe;
}

export class GetHistoricalResultsDto {
  @ApiPropertyOptional({ description: 'Tournament ID' })
  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @ApiPropertyOptional({ description: 'Player ID' })
  @IsOptional()
  @IsUUID()
  playerId?: string;

  @ApiPropertyOptional({ description: 'Game ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  gameId?: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class LeaderboardResponseDto {
  @ApiProperty({ description: 'Leaderboard entries' })
  entries: LeaderboardEntryDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  totalPages: number;

  @ApiProperty({ description: 'Cache timestamp' })
  cachedAt: Date;
}

export class LeaderboardEntryDto {
  @ApiProperty({ description: 'Rank position' })
  rank: number;

  @ApiProperty({ description: 'Participant ID' })
  participantId: string;

  @ApiProperty({ description: 'Participant name' })
  participantName: string;

  @ApiPropertyOptional({ description: 'Team ID' })
  teamId?: string;

  @ApiPropertyOptional({ description: 'Team name' })
  teamName?: string;

  @ApiProperty({ description: 'Points' })
  points: number;

  @ApiProperty({ description: 'Wins' })
  wins: number;

  @ApiProperty({ description: 'Losses' })
  losses: number;

  @ApiProperty({ description: 'Win rate' })
  winRate: number;

  @ApiProperty({ description: 'Matches played' })
  matchesPlayed: number;

  @ApiPropertyOptional({ description: 'Current streak' })
  currentStreak?: number;

  @ApiPropertyOptional({ description: 'Streak type' })
  streakType?: string;
}

export class PlayerStatsResponseDto {
  @ApiProperty({ description: 'Player ID' })
  playerId: string;

  @ApiProperty({ description: 'Player name' })
  playerName: string;

  @ApiProperty({ description: 'Total tournaments participated' })
  tournamentsPlayed: number;

  @ApiProperty({ description: 'Total wins' })
  totalWins: number;

  @ApiProperty({ description: 'Total losses' })
  totalLosses: number;

  @ApiProperty({ description: 'Overall win rate' })
  overallWinRate: number;

  @ApiProperty({ description: 'Tournament wins (1st place)' })
  tournamentWins: number;

  @ApiProperty({ description: 'Top 3 finishes' })
  topThreeFinishes: number;

  @ApiProperty({ description: 'Average placement' })
  averagePlacement: number;

  @ApiProperty({ description: 'Total prize money earned' })
  totalPrizeEarnings: number;

  @ApiProperty({ description: 'Best placement' })
  bestPlacement: number;

  @ApiProperty({ description: 'Current ranking' })
  currentRanking: number;

  @ApiProperty({ description: 'Recent form (last 10 matches)' })
  recentForm: string[];
}
