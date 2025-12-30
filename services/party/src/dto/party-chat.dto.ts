import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsArray,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '../entities/party-chat-message.entity';

export class SendMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  @MaxLength(2000)
  content: string;

  @ApiPropertyOptional({ enum: MessageType, default: MessageType.TEXT })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({ description: 'Reply to message ID' })
  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @ApiPropertyOptional({ description: 'Mentioned user IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  mentions?: string[];

  @ApiPropertyOptional({ description: 'Attachments' })
  @IsOptional()
  @IsArray()
  attachments?: Array<{
    type: string;
    url: string;
    name: string;
    size: number;
  }>;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class EditMessageDto {
  @ApiProperty({ description: 'New message content' })
  @IsString()
  @MaxLength(2000)
  content: string;
}

export class AddReactionDto {
  @ApiProperty({ description: 'Reaction emoji or code' })
  @IsString()
  @MaxLength(50)
  reaction: string;
}

export class RemoveReactionDto {
  @ApiProperty({ description: 'Reaction emoji or code to remove' })
  @IsString()
  @MaxLength(50)
  reaction: string;
}

export class PinMessageDto {
  @ApiProperty({ description: 'Message ID to pin' })
  @IsUUID()
  messageId: string;
}

export class UnpinMessageDto {
  @ApiProperty({ description: 'Message ID to unpin' })
  @IsUUID()
  messageId: string;
}

export class GetMessagesQueryDto {
  @ApiPropertyOptional({ description: 'Number of messages to fetch', default: 50 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Cursor for pagination (message ID)' })
  @IsOptional()
  @IsUUID()
  before?: string;

  @ApiPropertyOptional({ description: 'Cursor for pagination (message ID)' })
  @IsOptional()
  @IsUUID()
  after?: string;

  @ApiPropertyOptional({ description: 'Filter by message type' })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({ description: 'Include deleted messages' })
  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean;
}

export class MarkAsReadDto {
  @ApiProperty({ description: 'Message IDs to mark as read', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  messageIds: string[];
}

export class SystemMessageDto {
  @ApiProperty({ description: 'System message content' })
  @IsString()
  @MaxLength(500)
  content: string;

  @ApiPropertyOptional({ enum: MessageType })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
