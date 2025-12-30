import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GamerstakeService } from './gamerstake.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class LinkGamerstakeDto {
  @ApiProperty({ description: 'Gamerstake user ID' })
  @IsString()
  gamerstakeUserId: string;
}

@ApiTags('Gamerstake Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gamerstake')
export class GamerstakeController {
  constructor(private readonly gamerstakeService: GamerstakeService) {}

  @Post('link')
  @ApiOperation({ summary: 'Link Gamerstake account' })
  @ApiResponse({ status: 200, description: 'Account linked successfully' })
  async linkAccount(
    @CurrentUser('id') userId: string,
    @Body() dto: LinkGamerstakeDto,
  ) {
    return this.gamerstakeService.linkGamerstakeAccount(userId, dto.gamerstakeUserId);
  }

  @Delete('link')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink Gamerstake account' })
  @ApiResponse({ status: 204, description: 'Account unlinked' })
  async unlinkAccount(@CurrentUser('id') userId: string) {
    await this.gamerstakeService.unlinkGamerstakeAccount(userId);
  }

  @Post('sync/friends')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger friend sync from Gamerstake' })
  @ApiResponse({ status: 200, description: 'Sync triggered' })
  async syncFriends() {
    await this.gamerstakeService.syncFriendGraph();
    return { success: true };
  }

  @Post('sync/presence')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger presence sync from Gamerstake' })
  @ApiResponse({ status: 200, description: 'Sync triggered' })
  async syncPresence() {
    await this.gamerstakeService.syncPresence();
    return { success: true };
  }

  @Post('sync/profiles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger profile sync from Gamerstake' })
  @ApiResponse({ status: 200, description: 'Sync triggered' })
  async syncProfiles() {
    await this.gamerstakeService.syncProfiles();
    return { success: true };
  }

  @Post('export/friends')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export friends to Gamerstake' })
  @ApiResponse({ status: 200, description: 'Friends exported' })
  async exportFriends(@CurrentUser('id') userId: string) {
    await this.gamerstakeService.exportFriendsToGamerstake(userId);
    return { success: true };
  }
}
