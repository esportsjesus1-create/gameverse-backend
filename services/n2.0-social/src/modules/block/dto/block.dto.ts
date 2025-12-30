import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlockUserDto {
  @ApiProperty({ description: 'User ID to block' })
  @IsUUID()
  blockedId: string;

  @ApiPropertyOptional({ description: 'Reason for blocking' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UnblockUserDto {
  @ApiProperty({ description: 'User ID to unblock' })
  @IsUUID()
  blockedId: string;
}

export class BlockedUserResponseDto {
  @ApiProperty({ description: 'Block record ID' })
  id: string;

  @ApiProperty({ description: 'Blocked user ID' })
  blockedId: string;

  @ApiProperty({ description: 'Blocked user username' })
  blockedUsername: string;

  @ApiProperty({ description: 'Blocked user display name' })
  blockedDisplayName: string;

  @ApiPropertyOptional({ description: 'Blocked user avatar URL' })
  blockedAvatarUrl?: string;

  @ApiPropertyOptional({ description: 'Block reason' })
  reason?: string;

  @ApiProperty({ description: 'Block date' })
  createdAt: Date;
}

export class IsBlockedResponseDto {
  @ApiProperty({ description: 'Whether the user is blocked' })
  isBlocked: boolean;

  @ApiPropertyOptional({ description: 'Block direction if blocked' })
  direction?: 'blocker' | 'blocked' | 'mutual';
}
