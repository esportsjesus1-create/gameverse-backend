import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  IsEmail,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InviteType } from '../entities/party-invite.entity';

export class CreateInviteDto {
  @ApiPropertyOptional({ description: 'Invitee user ID (for direct invites)' })
  @IsOptional()
  @IsUUID()
  inviteeId?: string;

  @ApiPropertyOptional({ description: 'Invitee username' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  inviteeUsername?: string;

  @ApiPropertyOptional({ description: 'Invitee email (for email invites)' })
  @IsOptional()
  @IsEmail()
  inviteeEmail?: string;

  @ApiPropertyOptional({ enum: InviteType, default: InviteType.DIRECT })
  @IsOptional()
  @IsEnum(InviteType)
  type?: InviteType;

  @ApiPropertyOptional({ description: 'Personal message with invite' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @ApiPropertyOptional({ description: 'Max uses for link invites', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxUses?: number;

  @ApiPropertyOptional({ description: 'Expiration time in hours', minimum: 1, maximum: 168 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  expiresInHours?: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class RespondToInviteDto {
  @ApiProperty({ description: 'Accept or decline the invite' })
  accept: boolean;

  @ApiPropertyOptional({ description: 'Response message' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  message?: string;
}

export class JoinByCodeDto {
  @ApiProperty({ description: 'Party join code' })
  @IsString()
  @MaxLength(6)
  code: string;
}

export class JoinByTokenDto {
  @ApiProperty({ description: 'Invite token' })
  @IsString()
  @MaxLength(100)
  token: string;
}

export class BulkInviteDto {
  @ApiProperty({ description: 'List of user IDs to invite', type: [String] })
  @IsUUID('4', { each: true })
  userIds: string[];

  @ApiPropertyOptional({ description: 'Personal message with invite' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @ApiPropertyOptional({ description: 'Expiration time in hours', minimum: 1, maximum: 168 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  expiresInHours?: number;
}

export class CancelInviteDto {
  @ApiProperty({ description: 'Invite ID to cancel' })
  @IsUUID()
  inviteId: string;
}
