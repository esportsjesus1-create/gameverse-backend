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
import { FriendService } from './friend.service';
import {
  SendFriendRequestDto,
  PaginationDto,
  FriendListResponseDto,
  FriendRequestResponseDto,
  SentFriendRequestResponseDto,
  PaginatedResponseDto,
} from './dto/friend.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Friends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  @Post('request')
  @ApiOperation({ summary: 'FR-1.1: Send friend request' })
  @ApiResponse({ status: 201, description: 'Friend request sent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 409,
    description: 'Already friends or request pending',
  })
  async sendFriendRequest(
    @CurrentUser('id') userId: string,
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.friendService.sendFriendRequest(userId, dto);
  }

  @Post('request/:requestId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'FR-1.2: Accept friend request' })
  @ApiResponse({ status: 200, description: 'Friend request accepted' })
  @ApiResponse({ status: 404, description: 'Friend request not found' })
  async acceptFriendRequest(
    @CurrentUser('id') userId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.friendService.acceptFriendRequest(userId, requestId);
  }

  @Post('request/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'FR-1.3: Reject friend request' })
  @ApiResponse({ status: 200, description: 'Friend request rejected' })
  @ApiResponse({ status: 404, description: 'Friend request not found' })
  async rejectFriendRequest(
    @CurrentUser('id') userId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.friendService.rejectFriendRequest(userId, requestId);
  }

  @Delete('request/:requestId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'FR-1.4: Cancel sent friend request' })
  @ApiResponse({ status: 204, description: 'Friend request cancelled' })
  @ApiResponse({ status: 404, description: 'Friend request not found' })
  async cancelFriendRequest(
    @CurrentUser('id') userId: string,
    @Param('requestId') requestId: string,
  ) {
    await this.friendService.cancelFriendRequest(userId, requestId);
  }

  @Delete(':friendId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'FR-1.5: Remove friend' })
  @ApiResponse({ status: 204, description: 'Friend removed' })
  @ApiResponse({ status: 404, description: 'Friendship not found' })
  async removeFriend(
    @CurrentUser('id') userId: string,
    @Param('friendId') friendId: string,
  ) {
    await this.friendService.removeFriend(userId, friendId);
  }

  @Get()
  @ApiOperation({ summary: 'FR-1.6: List friends with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Friends list',
    type: [FriendListResponseDto],
  })
  async getFriends(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<FriendListResponseDto>> {
    return this.friendService.getFriends(userId, pagination);
  }

  @Get('requests/incoming')
  @ApiOperation({ summary: 'FR-1.7: List pending friend requests (incoming)' })
  @ApiResponse({
    status: 200,
    description: 'Incoming friend requests',
    type: [FriendRequestResponseDto],
  })
  async getPendingFriendRequests(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<FriendRequestResponseDto>> {
    return this.friendService.getPendingFriendRequests(userId, pagination);
  }

  @Get('requests/outgoing')
  @ApiOperation({ summary: 'FR-1.8: List sent friend requests (outgoing)' })
  @ApiResponse({
    status: 200,
    description: 'Outgoing friend requests',
    type: [SentFriendRequestResponseDto],
  })
  async getSentFriendRequests(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<SentFriendRequestResponseDto>> {
    return this.friendService.getSentFriendRequests(userId, pagination);
  }

  @Get('mutual/:userId')
  @ApiOperation({ summary: 'Get mutual friends with another user' })
  @ApiResponse({ status: 200, description: 'Mutual friends list' })
  async getMutualFriends(
    @CurrentUser('id') currentUserId: string,
    @Param('userId') userId: string,
  ) {
    return this.friendService.getMutualFriends(currentUserId, userId);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get friend suggestions (2nd degree connections)' })
  @ApiResponse({ status: 200, description: 'Friend suggestions' })
  async getFriendSuggestions(@CurrentUser('id') userId: string) {
    return this.friendService.getFriendsOfFriends(userId);
  }
}
