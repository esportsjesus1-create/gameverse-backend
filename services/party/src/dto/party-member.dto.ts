import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MemberRole, MemberStatus, ReadyStatus } from '../entities/party-member.entity';

export class AddMemberDto {
  @ApiProperty({ description: 'User ID to add' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Username' })
  @IsString()
  @MaxLength(50)
  username: string;

  @ApiPropertyOptional({ description: 'Avatar URL' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatarUrl?: string;

  @ApiPropertyOptional({ enum: MemberRole, default: MemberRole.MEMBER })
  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;

  @ApiPropertyOptional({ description: 'User rank' })
  @IsOptional()
  @IsInt()
  @Min(0)
  rank?: number;

  @ApiPropertyOptional({ description: 'User level' })
  @IsOptional()
  @IsInt()
  @Min(0)
  level?: number;

  @ApiPropertyOptional({ description: 'Preferred game role' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  preferredRole?: string;

  @ApiPropertyOptional({ description: 'Game stats' })
  @IsOptional()
  gameStats?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Wallet verified status' })
  @IsOptional()
  @IsBoolean()
  walletVerified?: boolean;

  @ApiPropertyOptional({ description: 'Wallet balance' })
  @IsOptional()
  walletBalance?: string;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: MemberRole })
  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;

  @ApiPropertyOptional({ enum: MemberStatus })
  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;

  @ApiPropertyOptional({ enum: ReadyStatus })
  @IsOptional()
  @IsEnum(ReadyStatus)
  readyStatus?: ReadyStatus;

  @ApiPropertyOptional({ description: 'Preferred game role' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  preferredRole?: string;

  @ApiPropertyOptional({ description: 'Is muted' })
  @IsOptional()
  @IsBoolean()
  isMuted?: boolean;

  @ApiPropertyOptional({ description: 'Is deafened' })
  @IsOptional()
  @IsBoolean()
  isDeafened?: boolean;

  @ApiPropertyOptional({ description: 'Can invite others' })
  @IsOptional()
  @IsBoolean()
  canInvite?: boolean;

  @ApiPropertyOptional({ description: 'Can kick members' })
  @IsOptional()
  @IsBoolean()
  canKick?: boolean;

  @ApiPropertyOptional({ description: 'Can change settings' })
  @IsOptional()
  @IsBoolean()
  canChangeSettings?: boolean;

  @ApiPropertyOptional({ description: 'Can start matchmaking' })
  @IsOptional()
  @IsBoolean()
  canStartMatchmaking?: boolean;

  @ApiPropertyOptional({ description: 'Game stats' })
  @IsOptional()
  gameStats?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class TransferLeadershipDto {
  @ApiProperty({ description: 'New leader user ID' })
  @IsUUID()
  newLeaderId: string;
}

export class KickMemberDto {
  @ApiProperty({ description: 'User ID to kick' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ description: 'Reason for kick' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class SetReadyStatusDto {
  @ApiProperty({ enum: ReadyStatus })
  @IsEnum(ReadyStatus)
  readyStatus: ReadyStatus;
}

export class UpdateMemberPermissionsDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ description: 'Can invite others' })
  @IsOptional()
  @IsBoolean()
  canInvite?: boolean;

  @ApiPropertyOptional({ description: 'Can kick members' })
  @IsOptional()
  @IsBoolean()
  canKick?: boolean;

  @ApiPropertyOptional({ description: 'Can change settings' })
  @IsOptional()
  @IsBoolean()
  canChangeSettings?: boolean;

  @ApiPropertyOptional({ description: 'Can start matchmaking' })
  @IsOptional()
  @IsBoolean()
  canStartMatchmaking?: boolean;
}
