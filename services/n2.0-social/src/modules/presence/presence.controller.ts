import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PresenceService } from './presence.service';
import {
  SetPresenceStatusDto,
  SetCustomMessageDto,
  SetActivityDto,
  PresenceResponseDto,
} from './dto/presence.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Presence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('presence')
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Post('online')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'FR-4.1: Set online status' })
  @ApiResponse({ status: 200, description: 'Status set to online' })
  async setOnline(@CurrentUser('id') userId: string) {
    return this.presenceService.setOnline(userId);
  }

  @Post('offline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'FR-4.2: Set offline status' })
  @ApiResponse({ status: 200, description: 'Status set to offline' })
  async setOffline(@CurrentUser('id') userId: string) {
    return this.presenceService.setOffline(userId);
  }

  @Post('away')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'FR-4.3: Set away/idle status' })
  @ApiResponse({ status: 200, description: 'Status set to away' })
  async setAway(@CurrentUser('id') userId: string) {
    return this.presenceService.setAway(userId);
  }

  @Post('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set presence status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async setStatus(
    @CurrentUser('id') userId: string,
    @Body() dto: SetPresenceStatusDto,
  ) {
    return this.presenceService.setStatus(userId, dto);
  }

  @Post('message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'FR-4.4: Set custom status message' })
  @ApiResponse({ status: 200, description: 'Custom message set' })
  async setCustomMessage(
    @CurrentUser('id') userId: string,
    @Body() dto: SetCustomMessageDto,
  ) {
    return this.presenceService.setCustomMessage(userId, dto);
  }

  @Post('activity')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set current activity' })
  @ApiResponse({ status: 200, description: 'Activity updated' })
  async setActivity(
    @CurrentUser('id') userId: string,
    @Body() dto: SetActivityDto,
  ) {
    return this.presenceService.setActivity(userId, dto);
  }

  @Get('friends')
  @ApiOperation({ summary: 'FR-4.5: Get friends\' presence' })
  @ApiResponse({ status: 200, description: 'Friends presence list', type: [PresenceResponseDto] })
  async getFriendsPresence(@CurrentUser('id') userId: string): Promise<PresenceResponseDto[]> {
    return this.presenceService.getFriendsPresence(userId);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user presence' })
  @ApiResponse({ status: 200, description: 'User presence', type: PresenceResponseDto })
  async getPresence(@Param('userId') userId: string): Promise<PresenceResponseDto | null> {
    return this.presenceService.getPresence(userId);
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Send heartbeat to maintain online status' })
  @ApiResponse({ status: 204, description: 'Heartbeat received' })
  async heartbeat(@CurrentUser('id') userId: string) {
    await this.presenceService.heartbeat(userId);
  }
}
