import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  IsNumber,
  IsDateString,
  IsArray,
  IsObject,
  Min,
  Max,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TournamentFormat,
  TournamentVisibility,
  RegistrationType,
} from '../entities/tournament.entity';

export class PrizeDistributionDto {
  @ApiProperty({ description: 'Placement position (1st, 2nd, etc.)' })
  @IsInt()
  @Min(1)
  placement: number;

  @ApiProperty({ description: 'Percentage of prize pool for this placement' })
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;
}

export class CreateTournamentDto {
  @ApiProperty({ description: 'Tournament name', example: 'Summer Championship 2024' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Tournament description' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ description: 'Game ID for the tournament' })
  @IsString()
  @MaxLength(100)
  gameId: string;

  @ApiPropertyOptional({ description: 'Game name for display' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  gameName?: string;

  @ApiProperty({
    description: 'Tournament format',
    enum: TournamentFormat,
    example: TournamentFormat.SINGLE_ELIMINATION,
  })
  @IsEnum(TournamentFormat)
  format: TournamentFormat;

  @ApiPropertyOptional({
    description: 'Tournament visibility',
    enum: TournamentVisibility,
    default: TournamentVisibility.PUBLIC,
  })
  @IsOptional()
  @IsEnum(TournamentVisibility)
  visibility?: TournamentVisibility;

  @ApiPropertyOptional({
    description: 'Registration type',
    enum: RegistrationType,
    default: RegistrationType.OPEN,
  })
  @IsOptional()
  @IsEnum(RegistrationType)
  registrationType?: RegistrationType;

  @ApiProperty({ description: 'Organizer user ID' })
  @IsUUID()
  organizerId: string;

  @ApiPropertyOptional({ description: 'Organizer display name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  organizerName?: string;

  @ApiPropertyOptional({ description: 'Team size (1 for solo)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  teamSize?: number;

  @ApiPropertyOptional({ description: 'Maximum number of participants', default: 16 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(1024)
  maxParticipants?: number;

  @ApiPropertyOptional({ description: 'Minimum number of participants', default: 2 })
  @IsOptional()
  @IsInt()
  @Min(2)
  minParticipants?: number;

  @ApiPropertyOptional({ description: 'Minimum MMR requirement' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minMmr?: number;

  @ApiPropertyOptional({ description: 'Maximum MMR requirement' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxMmr?: number;

  @ApiPropertyOptional({ description: 'Require identity verification for entry' })
  @IsOptional()
  @IsBoolean()
  requiresIdentityVerification?: boolean;

  @ApiPropertyOptional({ description: 'Allowed regions for participants' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedRegions?: string[];

  @ApiPropertyOptional({ description: 'Total prize pool amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  prizePool?: number;

  @ApiPropertyOptional({ description: 'Prize pool currency', default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  prizeCurrency?: string;

  @ApiPropertyOptional({ description: 'Prize distribution by placement' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrizeDistributionDto)
  prizeDistribution?: PrizeDistributionDto[];

  @ApiPropertyOptional({ description: 'Entry fee amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  entryFee?: number;

  @ApiPropertyOptional({ description: 'Entry fee currency', default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  entryFeeCurrency?: string;

  @ApiPropertyOptional({ description: 'Registration start date' })
  @IsOptional()
  @IsDateString()
  registrationStartDate?: string;

  @ApiPropertyOptional({ description: 'Registration end date' })
  @IsOptional()
  @IsDateString()
  registrationEndDate?: string;

  @ApiPropertyOptional({ description: 'Check-in start date' })
  @IsOptional()
  @IsDateString()
  checkInStartDate?: string;

  @ApiPropertyOptional({ description: 'Check-in end date' })
  @IsOptional()
  @IsDateString()
  checkInEndDate?: string;

  @ApiProperty({ description: 'Tournament start date' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'Tournament end date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Match interval in minutes', default: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  matchIntervalMinutes?: number;

  @ApiPropertyOptional({ description: 'Tournament rules' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  rules?: string;

  @ApiPropertyOptional({ description: 'Allow spectators', default: true })
  @IsOptional()
  @IsBoolean()
  allowSpectators?: boolean;

  @ApiPropertyOptional({ description: 'Enable streaming', default: false })
  @IsOptional()
  @IsBoolean()
  enableStreaming?: boolean;

  @ApiPropertyOptional({ description: 'Stream URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  streamUrl?: string;

  @ApiPropertyOptional({ description: 'Discord server URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  discordUrl?: string;

  @ApiPropertyOptional({ description: 'Banner image URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerImageUrl?: string;

  @ApiPropertyOptional({ description: 'Thumbnail URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: 'Number of Swiss rounds', default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  swissRounds?: number;

  @ApiPropertyOptional({ description: 'Enable grand finals bracket reset', default: true })
  @IsOptional()
  @IsBoolean()
  grandFinalsReset?: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
