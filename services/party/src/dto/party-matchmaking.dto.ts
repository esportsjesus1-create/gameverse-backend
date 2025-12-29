import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  IsArray,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartMatchmakingDto {
  @ApiProperty({ description: 'Game ID' })
  @IsUUID()
  gameId: string;

  @ApiPropertyOptional({ description: 'Game mode' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  gameMode?: string;

  @ApiPropertyOptional({ description: 'Preferred regions' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredRegions?: string[];

  @ApiPropertyOptional({ description: 'Rank range minimum' })
  @IsOptional()
  @IsInt()
  @Min(0)
  rankRangeMin?: number;

  @ApiPropertyOptional({ description: 'Rank range maximum' })
  @IsOptional()
  @IsInt()
  @Min(0)
  rankRangeMax?: number;

  @ApiPropertyOptional({ description: 'Max wait time in seconds', minimum: 30, maximum: 600 })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(600)
  maxWaitTime?: number;

  @ApiPropertyOptional({ description: 'Expand search over time' })
  @IsOptional()
  @IsBoolean()
  expandSearch?: boolean;

  @ApiPropertyOptional({ description: 'Prioritize speed over quality' })
  @IsOptional()
  @IsBoolean()
  prioritizeSpeed?: boolean;

  @ApiPropertyOptional({ description: 'Additional matchmaking criteria' })
  @IsOptional()
  criteria?: Record<string, unknown>;
}

export class CancelMatchmakingDto {
  @ApiPropertyOptional({ description: 'Reason for cancellation' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class ReadyCheckDto {
  @ApiPropertyOptional({ description: 'Timeout in seconds', minimum: 10, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(60)
  timeout?: number;
}

export class ReadyCheckResponseDto {
  @ApiProperty({ description: 'Ready status' })
  @IsBoolean()
  ready: boolean;
}

export class MatchFoundDto {
  @ApiProperty({ description: 'Match ID' })
  @IsUUID()
  matchId: string;

  @ApiProperty({ description: 'Server information' })
  serverInfo: {
    ip: string;
    port: number;
    region: string;
    connectionToken: string;
  };

  @ApiProperty({ description: 'Teams' })
  teams: Array<{
    teamId: string;
    players: Array<{
      odId: string;
      username: string;
      rank: number;
    }>;
  }>;

  @ApiPropertyOptional({ description: 'Match metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class MatchmakingStatusDto {
  @ApiProperty({ description: 'Is currently matchmaking' })
  isMatchmaking: boolean;

  @ApiPropertyOptional({ description: 'Matchmaking ticket ID' })
  ticketId?: string;

  @ApiPropertyOptional({ description: 'Time in queue (seconds)' })
  timeInQueue?: number;

  @ApiPropertyOptional({ description: 'Estimated wait time (seconds)' })
  estimatedWaitTime?: number;

  @ApiPropertyOptional({ description: 'Current search parameters' })
  searchParameters?: {
    gameId: string;
    gameMode: string;
    rankRange: { min: number; max: number };
    regions: string[];
  };

  @ApiPropertyOptional({ description: 'Players found' })
  playersFound?: number;

  @ApiPropertyOptional({ description: 'Players needed' })
  playersNeeded?: number;
}

export class JoinMatchDto {
  @ApiProperty({ description: 'Match ID to join' })
  @IsUUID()
  matchId: string;
}

export class LeaveMatchDto {
  @ApiPropertyOptional({ description: 'Reason for leaving' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class ReportMatchResultDto {
  @ApiProperty({ description: 'Match ID' })
  @IsUUID()
  matchId: string;

  @ApiProperty({ description: 'Result (win/loss/draw)' })
  @IsString()
  result: 'win' | 'loss' | 'draw';

  @ApiPropertyOptional({ description: 'Score' })
  @IsOptional()
  score?: {
    team1: number;
    team2: number;
  };

  @ApiPropertyOptional({ description: 'Match statistics' })
  @IsOptional()
  stats?: Record<string, unknown>;
}
