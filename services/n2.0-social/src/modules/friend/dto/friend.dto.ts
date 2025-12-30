import { IsUUID, IsOptional, IsString, MaxLength, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendFriendRequestDto {
  @ApiProperty({ description: 'User ID to send friend request to' })
  @IsUUID()
  addresseeId: string;

  @ApiPropertyOptional({ description: 'Optional message with the friend request' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class RespondToFriendRequestDto {
  @ApiProperty({ description: 'Friend request ID' })
  @IsUUID()
  requestId: string;
}

export class PaginationDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class FriendListResponseDto {
  @ApiProperty({ description: 'Friend user ID' })
  id: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'Display name' })
  displayName: string;

  @ApiPropertyOptional({ description: 'Avatar URL' })
  avatarUrl?: string;

  @ApiProperty({ description: 'Online status' })
  isOnline: boolean;

  @ApiPropertyOptional({ description: 'Current activity' })
  currentActivity?: string;

  @ApiProperty({ description: 'Friendship date' })
  friendsSince: Date;
}

export class FriendRequestResponseDto {
  @ApiProperty({ description: 'Request ID' })
  id: string;

  @ApiProperty({ description: 'Requester user ID' })
  requesterId: string;

  @ApiProperty({ description: 'Requester username' })
  requesterUsername: string;

  @ApiProperty({ description: 'Requester display name' })
  requesterDisplayName: string;

  @ApiPropertyOptional({ description: 'Requester avatar URL' })
  requesterAvatarUrl?: string;

  @ApiPropertyOptional({ description: 'Request message' })
  message?: string;

  @ApiProperty({ description: 'Request date' })
  createdAt: Date;
}

export class SentFriendRequestResponseDto {
  @ApiProperty({ description: 'Request ID' })
  id: string;

  @ApiProperty({ description: 'Addressee user ID' })
  addresseeId: string;

  @ApiProperty({ description: 'Addressee username' })
  addresseeUsername: string;

  @ApiProperty({ description: 'Addressee display name' })
  addresseeDisplayName: string;

  @ApiPropertyOptional({ description: 'Addressee avatar URL' })
  addresseeAvatarUrl?: string;

  @ApiPropertyOptional({ description: 'Request message' })
  message?: string;

  @ApiProperty({ description: 'Request date' })
  createdAt: Date;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Data items' })
  data: T[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  totalPages: number;
}
