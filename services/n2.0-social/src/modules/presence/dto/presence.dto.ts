import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PresenceStatus } from '../../../database/entities/user-presence.entity';

export class SetPresenceStatusDto {
  @ApiProperty({ description: 'Presence status', enum: PresenceStatus })
  @IsEnum(PresenceStatus)
  status: PresenceStatus;
}

export class SetCustomMessageDto {
  @ApiPropertyOptional({ description: 'Custom status message' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customMessage?: string;
}

export class SetActivityDto {
  @ApiPropertyOptional({ description: 'Current activity' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  currentActivity?: string;

  @ApiPropertyOptional({ description: 'Current game ID' })
  @IsOptional()
  @IsString()
  currentGameId?: string;

  @ApiPropertyOptional({ description: 'Current game name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  currentGameName?: string;
}

export class PresenceResponseDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'Display name' })
  displayName: string;

  @ApiPropertyOptional({ description: 'Avatar URL' })
  avatarUrl?: string;

  @ApiProperty({ description: 'Presence status', enum: PresenceStatus })
  status: PresenceStatus;

  @ApiPropertyOptional({ description: 'Custom status message' })
  customMessage?: string;

  @ApiPropertyOptional({ description: 'Current activity' })
  currentActivity?: string;

  @ApiPropertyOptional({ description: 'Current game name' })
  currentGameName?: string;

  @ApiProperty({ description: 'Last seen timestamp' })
  lastSeenAt: Date;
}

export class BulkPresenceResponseDto {
  @ApiProperty({ description: 'User presences', type: [PresenceResponseDto] })
  presences: PresenceResponseDto[];
}
