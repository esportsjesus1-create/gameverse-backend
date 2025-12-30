import { IsUUID, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotificationType,
  NotificationPriority,
} from '../../../database/entities/notification.entity';

export class MarkAsReadDto {
  @ApiProperty({ description: 'Notification ID' })
  @IsUUID()
  notificationId: string;
}

export class MarkMultipleAsReadDto {
  @ApiProperty({ description: 'Notification IDs' })
  @IsArray()
  @IsUUID('4', { each: true })
  notificationIds: string[];
}

export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification ID' })
  id: string;

  @ApiProperty({ description: 'Notification type', enum: NotificationType })
  type: NotificationType;

  @ApiProperty({ description: 'Title' })
  title: string;

  @ApiProperty({ description: 'Message' })
  message: string;

  @ApiPropertyOptional({ description: 'Sender ID' })
  senderId?: string;

  @ApiPropertyOptional({ description: 'Sender username' })
  senderUsername?: string;

  @ApiPropertyOptional({ description: 'Sender display name' })
  senderDisplayName?: string;

  @ApiPropertyOptional({ description: 'Sender avatar URL' })
  senderAvatarUrl?: string;

  @ApiPropertyOptional({ description: 'Metadata' })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Action URL' })
  actionUrl?: string;

  @ApiProperty({ description: 'Priority', enum: NotificationPriority })
  priority: NotificationPriority;

  @ApiProperty({ description: 'Is read' })
  isRead: boolean;

  @ApiPropertyOptional({ description: 'Read at' })
  readAt?: Date;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;
}

export class UnreadCountResponseDto {
  @ApiProperty({ description: 'Unread notification count' })
  count: number;
}

export class NotificationFilterDto {
  @ApiPropertyOptional({
    description: 'Filter by type',
    enum: NotificationType,
  })
  @IsOptional()
  type?: NotificationType;

  @ApiPropertyOptional({ description: 'Filter by read status' })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}
