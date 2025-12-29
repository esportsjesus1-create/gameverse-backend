import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchStatus } from '../entities/tournament-match.entity';

export class ScheduleMatchDto {
  @ApiProperty({ description: 'Match ID' })
  @IsUUID()
  matchId: string;

  @ApiProperty({ description: 'Scheduled date and time' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ description: 'Server ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serverId?: string;

  @ApiPropertyOptional({ description: 'Server name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serverName?: string;

  @ApiPropertyOptional({ description: 'Lobby code' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lobbyCode?: string;
}

export class SubmitMatchResultDto {
  @ApiProperty({ description: 'Match ID' })
  @IsUUID()
  matchId: string;

  @ApiProperty({ description: 'Participant 1 score' })
  @IsInt()
  @Min(0)
  participant1Score: number;

  @ApiProperty({ description: 'Participant 2 score' })
  @IsInt()
  @Min(0)
  participant2Score: number;

  @ApiProperty({ description: 'Winner ID' })
  @IsUUID()
  winnerId: string;

  @ApiPropertyOptional({ description: 'Game-level statistics' })
  @IsOptional()
  @IsObject()
  gameStats?: Record<string, unknown>[];

  @ApiPropertyOptional({ description: 'Submitter ID for confirmation tracking' })
  @IsOptional()
  @IsUUID()
  submitterId?: string;
}

export class ConfirmMatchResultDto {
  @ApiProperty({ description: 'Match ID' })
  @IsUUID()
  matchId: string;

  @ApiProperty({ description: 'Confirming participant ID' })
  @IsUUID()
  participantId: string;

  @ApiProperty({ description: 'Confirmation status' })
  @IsBoolean()
  confirmed: boolean;
}

export class AdminOverrideResultDto {
  @ApiProperty({ description: 'Match ID' })
  @IsUUID()
  matchId: string;

  @ApiProperty({ description: 'Admin user ID' })
  @IsUUID()
  adminId: string;

  @ApiProperty({ description: 'Participant 1 score' })
  @IsInt()
  @Min(0)
  participant1Score: number;

  @ApiProperty({ description: 'Participant 2 score' })
  @IsInt()
  @Min(0)
  participant2Score: number;

  @ApiProperty({ description: 'Winner ID' })
  @IsUUID()
  winnerId: string;

  @ApiProperty({ description: 'Override reason' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class UpdateMatchStatusDto {
  @ApiProperty({ description: 'Match ID' })
  @IsUUID()
  matchId: string;

  @ApiProperty({ description: 'New match status', enum: MatchStatus })
  @IsEnum(MatchStatus)
  status: MatchStatus;

  @ApiPropertyOptional({ description: 'Reason for status change' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class MatchCheckInDto {
  @ApiProperty({ description: 'Match ID' })
  @IsUUID()
  matchId: string;

  @ApiProperty({ description: 'Participant ID checking in' })
  @IsUUID()
  participantId: string;
}

export class RaiseDisputeDto {
  @ApiProperty({ description: 'Match ID' })
  @IsUUID()
  matchId: string;

  @ApiProperty({ description: 'Participant ID raising dispute' })
  @IsUUID()
  participantId: string;

  @ApiProperty({ description: 'Dispute reason' })
  @IsString()
  @MaxLength(2000)
  reason: string;
}

export class ResolveDisputeDto {
  @ApiProperty({ description: 'Match ID' })
  @IsUUID()
  matchId: string;

  @ApiProperty({ description: 'Admin user ID resolving dispute' })
  @IsUUID()
  adminId: string;

  @ApiProperty({ description: 'Resolution description' })
  @IsString()
  @MaxLength(2000)
  resolution: string;

  @ApiPropertyOptional({ description: 'Final participant 1 score' })
  @IsOptional()
  @IsInt()
  @Min(0)
  participant1Score?: number;

  @ApiPropertyOptional({ description: 'Final participant 2 score' })
  @IsOptional()
  @IsInt()
  @Min(0)
  participant2Score?: number;

  @ApiPropertyOptional({ description: 'Final winner ID' })
  @IsOptional()
  @IsUUID()
  winnerId?: string;
}

export class PostponeMatchDto {
  @ApiProperty({ description: 'Match ID' })
  @IsUUID()
  matchId: string;

  @ApiProperty({ description: 'New scheduled date and time' })
  @IsDateString()
  newScheduledAt: string;

  @ApiPropertyOptional({ description: 'Reason for postponement' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AssignServerDto {
  @ApiProperty({ description: 'Match ID' })
  @IsUUID()
  matchId: string;

  @ApiProperty({ description: 'Server ID' })
  @IsString()
  @MaxLength(100)
  serverId: string;

  @ApiPropertyOptional({ description: 'Server name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serverName?: string;

  @ApiPropertyOptional({ description: 'Lobby code' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lobbyCode?: string;
}
