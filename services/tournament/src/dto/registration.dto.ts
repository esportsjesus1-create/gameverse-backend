import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  IsNumber,
  IsArray,
  IsObject,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistrationStatus } from '../entities/tournament-registration.entity';

export class CreateRegistrationDto {
  @ApiProperty({ description: 'Tournament ID' })
  @IsUUID()
  tournamentId: string;

  @ApiProperty({ description: 'Participant user ID' })
  @IsUUID()
  participantId: string;

  @ApiProperty({ description: 'Participant display name' })
  @IsString()
  @MaxLength(100)
  participantName: string;

  @ApiPropertyOptional({ description: 'Team ID for team tournaments' })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({ description: 'Team name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  teamName?: string;

  @ApiPropertyOptional({ description: 'Team member IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teamMemberIds?: string[];

  @ApiPropertyOptional({ description: 'Team member names' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teamMemberNames?: string[];

  @ApiPropertyOptional({ description: 'Participant MMR' })
  @IsOptional()
  @IsInt()
  @Min(0)
  mmr?: number;

  @ApiPropertyOptional({ description: 'Identity verification status' })
  @IsOptional()
  @IsBoolean()
  identityVerified?: boolean;

  @ApiPropertyOptional({ description: 'Participant region' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  region?: string;

  @ApiPropertyOptional({ description: 'Entry fee paid amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  entryFeePaid?: number;

  @ApiPropertyOptional({ description: 'Payment transaction ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentTransactionId?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateRegistrationDto {
  @ApiPropertyOptional({
    description: 'Registration status',
    enum: RegistrationStatus,
  })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;

  @ApiPropertyOptional({ description: 'Seed position' })
  @IsOptional()
  @IsInt()
  @Min(1)
  seed?: number;

  @ApiPropertyOptional({ description: 'Cancellation reason' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellationReason?: string;

  @ApiPropertyOptional({ description: 'Refund issued flag' })
  @IsOptional()
  @IsBoolean()
  refundIssued?: boolean;

  @ApiPropertyOptional({ description: 'Refund amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  refundAmount?: number;

  @ApiPropertyOptional({ description: 'Refund transaction ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  refundTransactionId?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CheckInDto {
  @ApiProperty({ description: 'Registration ID' })
  @IsUUID()
  registrationId: string;
}

export class SubstituteParticipantDto {
  @ApiProperty({ description: 'Registration ID to substitute' })
  @IsUUID()
  registrationId: string;

  @ApiProperty({ description: 'New participant ID' })
  @IsUUID()
  newParticipantId: string;

  @ApiProperty({ description: 'New participant name' })
  @IsString()
  @MaxLength(100)
  newParticipantName: string;

  @ApiPropertyOptional({ description: 'New participant MMR' })
  @IsOptional()
  @IsInt()
  @Min(0)
  newParticipantMmr?: number;
}

export class ManualSeedDto {
  @ApiProperty({ description: 'Registration ID' })
  @IsUUID()
  registrationId: string;

  @ApiProperty({ description: 'New seed position' })
  @IsInt()
  @Min(1)
  seed: number;
}

export class BulkSeedDto {
  @ApiProperty({ description: 'Array of registration ID and seed pairs' })
  @IsArray()
  seeds: ManualSeedDto[];
}
