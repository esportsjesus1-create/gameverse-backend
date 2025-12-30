import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
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
import { BlockService } from './block.service';
import {
  BlockUserDto,
  BlockedUserResponseDto,
  IsBlockedResponseDto,
} from './dto/block.dto';
import { PaginationDto, PaginatedResponseDto } from '../friend/dto/friend.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Block')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('block')
export class BlockController {
  constructor(private readonly blockService: BlockService) {}

  @Post()
  @ApiOperation({ summary: 'FR-2.1: Block user' })
  @ApiResponse({ status: 201, description: 'User blocked successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User already blocked' })
  async blockUser(
    @CurrentUser('id') userId: string,
    @Body() dto: BlockUserDto,
  ) {
    return this.blockService.blockUser(userId, dto);
  }

  @Delete(':blockedId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'FR-2.2: Unblock user' })
  @ApiResponse({ status: 204, description: 'User unblocked' })
  @ApiResponse({ status: 404, description: 'Block record not found' })
  async unblockUser(
    @CurrentUser('id') userId: string,
    @Param('blockedId') blockedId: string,
  ) {
    await this.blockService.unblockUser(userId, blockedId);
  }

  @Get()
  @ApiOperation({ summary: 'FR-2.3: List blocked users' })
  @ApiResponse({
    status: 200,
    description: 'Blocked users list',
    type: [BlockedUserResponseDto],
  })
  async getBlockedUsers(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<BlockedUserResponseDto>> {
    return this.blockService.getBlockedUsers(userId, pagination);
  }

  @Get('check/:userId')
  @ApiOperation({ summary: 'FR-2.4: Check if user is blocked' })
  @ApiResponse({
    status: 200,
    description: 'Block status',
    type: IsBlockedResponseDto,
  })
  async checkIfBlocked(
    @CurrentUser('id') currentUserId: string,
    @Param('userId') userId: string,
  ): Promise<IsBlockedResponseDto> {
    return this.blockService.isBlocked(currentUserId, userId);
  }
}
