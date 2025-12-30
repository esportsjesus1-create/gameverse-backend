import { IsUUID, IsOptional, IsString, MaxLength, IsEnum, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeedEventType, FeedEventVisibility } from '../../../database/entities/social-feed-event.entity';

export class CreatePostDto {
  @ApiProperty({ description: 'Post content' })
  @IsString()
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ description: 'Post visibility', enum: FeedEventVisibility })
  @IsOptional()
  @IsEnum(FeedEventVisibility)
  visibility?: FeedEventVisibility = FeedEventVisibility.FRIENDS;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateCommentDto {
  @ApiProperty({ description: 'Comment content' })
  @IsString()
  @MaxLength(2000)
  content: string;

  @ApiPropertyOptional({ description: 'Parent comment ID for replies' })
  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}

export class ShareAchievementDto {
  @ApiProperty({ description: 'Achievement ID' })
  @IsString()
  achievementId: string;

  @ApiProperty({ description: 'Achievement name' })
  @IsString()
  @MaxLength(200)
  achievementName: string;

  @ApiPropertyOptional({ description: 'Achievement description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Game ID' })
  @IsOptional()
  @IsString()
  gameId?: string;

  @ApiPropertyOptional({ description: 'Game name' })
  @IsOptional()
  @IsString()
  gameName?: string;

  @ApiPropertyOptional({ description: 'Achievement icon URL' })
  @IsOptional()
  @IsString()
  iconUrl?: string;

  @ApiPropertyOptional({ description: 'Post visibility', enum: FeedEventVisibility })
  @IsOptional()
  @IsEnum(FeedEventVisibility)
  visibility?: FeedEventVisibility = FeedEventVisibility.FRIENDS;
}

export class ShareGameResultDto {
  @ApiProperty({ description: 'Game ID' })
  @IsString()
  gameId: string;

  @ApiProperty({ description: 'Game name' })
  @IsString()
  @MaxLength(200)
  gameName: string;

  @ApiProperty({ description: 'Result (win/loss/draw)' })
  @IsString()
  result: string;

  @ApiPropertyOptional({ description: 'Score' })
  @IsOptional()
  @IsString()
  score?: string;

  @ApiPropertyOptional({ description: 'Match duration in seconds' })
  @IsOptional()
  duration?: number;

  @ApiPropertyOptional({ description: 'Additional game metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Post visibility', enum: FeedEventVisibility })
  @IsOptional()
  @IsEnum(FeedEventVisibility)
  visibility?: FeedEventVisibility = FeedEventVisibility.FRIENDS;
}

export class FeedEventResponseDto {
  @ApiProperty({ description: 'Event ID' })
  id: string;

  @ApiProperty({ description: 'Author ID' })
  authorId: string;

  @ApiProperty({ description: 'Author username' })
  authorUsername: string;

  @ApiProperty({ description: 'Author display name' })
  authorDisplayName: string;

  @ApiPropertyOptional({ description: 'Author avatar URL' })
  authorAvatarUrl?: string;

  @ApiProperty({ description: 'Event type', enum: FeedEventType })
  eventType: FeedEventType;

  @ApiProperty({ description: 'Content' })
  content: string;

  @ApiPropertyOptional({ description: 'Metadata' })
  metadata?: Record<string, unknown>;

  @ApiProperty({ description: 'Visibility', enum: FeedEventVisibility })
  visibility: FeedEventVisibility;

  @ApiProperty({ description: 'Like count' })
  likeCount: number;

  @ApiProperty({ description: 'Comment count' })
  commentCount: number;

  @ApiProperty({ description: 'Whether current user liked this post' })
  isLikedByCurrentUser: boolean;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;
}

export class CommentResponseDto {
  @ApiProperty({ description: 'Comment ID' })
  id: string;

  @ApiProperty({ description: 'Author ID' })
  authorId: string;

  @ApiProperty({ description: 'Author username' })
  authorUsername: string;

  @ApiProperty({ description: 'Author display name' })
  authorDisplayName: string;

  @ApiPropertyOptional({ description: 'Author avatar URL' })
  authorAvatarUrl?: string;

  @ApiProperty({ description: 'Content' })
  content: string;

  @ApiPropertyOptional({ description: 'Parent comment ID' })
  parentCommentId?: string;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;
}
