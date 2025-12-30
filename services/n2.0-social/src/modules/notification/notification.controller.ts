import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import {
  NotificationResponseDto,
  UnreadCountResponseDto,
  NotificationFilterDto,
} from './dto/notification.dto';
import { PaginationDto, PaginatedResponseDto } from '../friend/dto/friend.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications' })
  @ApiResponse({
    status: 200,
    description: 'Notifications list',
    type: [NotificationResponseDto],
  })
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
    @Query() filter: NotificationFilterDto,
  ): Promise<PaginatedResponseDto<NotificationResponseDto>> {
    return this.notificationService.getNotifications(
      userId,
      pagination,
      filter,
    );
  }

  @Post(':notificationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'FR-6.7: Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationService.markAsRead(userId, notificationId);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'FR-6.8: Mark all notifications as read' })
  @ApiResponse({ status: 204, description: 'All notifications marked as read' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    await this.notificationService.markAllAsRead(userId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'FR-6.9: Get unread notification count' })
  @ApiResponse({
    status: 200,
    description: 'Unread count',
    type: UnreadCountResponseDto,
  })
  async getUnreadCount(
    @CurrentUser('id') userId: string,
  ): Promise<UnreadCountResponseDto> {
    return this.notificationService.getUnreadCount(userId);
  }

  @Delete(':notificationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'FR-6.10: Delete notification' })
  @ApiResponse({ status: 204, description: 'Notification deleted' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async deleteNotification(
    @CurrentUser('id') userId: string,
    @Param('notificationId') notificationId: string,
  ) {
    await this.notificationService.deleteNotification(userId, notificationId);
  }
}
