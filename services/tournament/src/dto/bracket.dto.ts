import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  IsEnum,
  IsArray,
  IsObject,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TournamentFormat } from '../entities/tournament.entity';

export class SeedEntryDto {
  @ApiProperty({ description: 'Participant/Registration ID' })
  @IsUUID()
  participantId: string;

  @ApiProperty({ description: 'Seed position' })
  @IsInt()
  @Min(1)
  seed: number;

  @ApiProperty({ description: 'Participant name' })
  @IsString()
  @MaxLength(100)
  name: string;
}

export class GenerateBracketDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;

  @ApiPropertyOptional({
    description: 'Tournament format override',
    enum: TournamentFormat,
  })
  @IsOptional()
  @IsEnum(TournamentFormat)
  format?: TournamentFormat;

  @ApiPropertyOptional({
    description: 'Custom seeds (optional, will use MMR-based seeding if not provided)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeedEntryDto)
  seeds?: SeedEntryDto[];

  @ApiPropertyOptional({ description: 'Number of Swiss rounds (for Swiss format)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  swissRounds?: number;

  @ApiPropertyOptional({
    description: 'Enable grand finals bracket reset (for double elimination)',
  })
  @IsOptional()
  @IsBoolean()
  grandFinalsReset?: boolean;
}

export class ReseedBracketDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;

  @ApiProperty({ description: 'Bracket ID' })
  @IsUUID()
  bracketId: string;

  @ApiPropertyOptional({ description: 'New seeds' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeedEntryDto)
  seeds?: SeedEntryDto[];

  @ApiPropertyOptional({ description: 'Use current standings for reseeding' })
  @IsOptional()
  @IsBoolean()
  useCurrentStandings?: boolean;
}

export class DisqualifyParticipantDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;

  @ApiProperty({ description: 'Participant ID to disqualify' })
  @IsUUID()
  participantId: string;

  @ApiProperty({ description: 'Reason for disqualification' })
  @IsString()
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ description: 'Admin ID performing disqualification' })
  @IsOptional()
  @IsUUID()
  adminId?: string;
}

export class BracketResetDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;

  @ApiProperty({ description: 'Match ID for grand finals reset' })
  @IsUUID()
  matchId: string;
}

export class ExportBracketDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;

  @ApiPropertyOptional({ description: 'Bracket ID (optional, exports all if not specified)' })
  @IsOptional()
  @IsUUID()
  bracketId?: string;

  @ApiPropertyOptional({
    description: 'Export format',
    enum: ['json', 'image', 'pdf'],
    default: 'json',
  })
  @IsOptional()
  @IsString()
  format?: 'json' | 'image' | 'pdf';
}

export class SwissPairingDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;

  @ApiProperty({ description: 'Round number to generate pairings for' })
  @IsInt()
  @Min(1)
  round: number;
}

export class BracketVisualizationDto {
  @ApiProperty({ description: 'Bracket ID' })
  @IsUUID()
  bracketId: string;

  @ApiPropertyOptional({ description: 'Include match details' })
  @IsOptional()
  @IsBoolean()
  includeMatchDetails?: boolean;

  @ApiPropertyOptional({ description: 'Include participant details' })
  @IsOptional()
  @IsBoolean()
  includeParticipantDetails?: boolean;
}

export class CreateGroupsDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;

  @ApiProperty({ description: 'Number of groups' })
  @IsInt()
  @Min(2)
  @Max(32)
  numberOfGroups: number;

  @ApiPropertyOptional({ description: 'Number of participants advancing from each group' })
  @IsOptional()
  @IsInt()
  @Min(1)
  advancingPerGroup?: number;

  @ApiPropertyOptional({ description: 'Custom group assignments' })
  @IsOptional()
  @IsObject()
  groupAssignments?: Record<string, string[]>;
}
