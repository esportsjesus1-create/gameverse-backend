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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SocialFeedService } from './social-feed.service';
import {
  CreatePostDto,
  CreateCommentDto,
  ShareAchievementDto,
  ShareGameResultDto,
  FeedEventResponseDto,
  CommentResponseDto,
} from './dto/social-feed.dto';
import { PaginationDto, PaginatedResponseDto } from '../friend/dto/friend.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Social Feed')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feed')
export class SocialFeedController {
  constructor(private readonly socialFeedService: SocialFeedService) {}

  @Post('post')
  @ApiOperation({ summary: 'FR-3.1: Post status update' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  async createPost(@CurrentUser('id') userId: string, @Body() dto: CreatePostDto) {
    return this.socialFeedService.createPost(userId, dto);
  }

  @Delete('post/:postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'FR-3.2: Delete own status' })
  @ApiResponse({ status: 204, description: 'Post deleted' })
  @ApiResponse({ status: 403, description: 'Cannot delete another user\'s post' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async deletePost(
    @CurrentUser('id') userId: string,
    @Param('postId') postId: string,
  ) {
    await this.socialFeedService.deletePost(userId, postId);
  }

  @Post('post/:postId/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'FR-3.3: Like a post' })
  @ApiResponse({ status: 200, description: 'Post liked' })
  @ApiResponse({ status: 400, description: 'Already liked' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async likePost(
    @CurrentUser('id') userId: string,
    @Param('postId') postId: string,
  ) {
    await this.socialFeedService.likePost(userId, postId);
    return { success: true };
  }

  @Delete('post/:postId/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'FR-3.4: Unlike a post' })
  @ApiResponse({ status: 204, description: 'Post unliked' })
  @ApiResponse({ status: 404, description: 'Like not found' })
  async unlikePost(
    @CurrentUser('id') userId: string,
    @Param('postId') postId: string,
  ) {
    await this.socialFeedService.unlikePost(userId, postId);
  }

  @Post('post/:postId/comment')
  @ApiOperation({ summary: 'FR-3.5: Comment on a post' })
  @ApiResponse({ status: 201, description: 'Comment created' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async commentOnPost(
    @CurrentUser('id') userId: string,
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.socialFeedService.commentOnPost(userId, postId, dto);
  }

  @Delete('comment/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'FR-3.6: Delete own comment' })
  @ApiResponse({ status: 204, description: 'Comment deleted' })
  @ApiResponse({ status: 403, description: 'Cannot delete another user\'s comment' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async deleteComment(
    @CurrentUser('id') userId: string,
    @Param('commentId') commentId: string,
  ) {
    await this.socialFeedService.deleteComment(userId, commentId);
  }

  @Get()
  @ApiOperation({ summary: 'FR-3.7: Get feed (friends\' posts)' })
  @ApiResponse({ status: 200, description: 'Feed retrieved', type: [FeedEventResponseDto] })
  async getFeed(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<FeedEventResponseDto>> {
    return this.socialFeedService.getFeed(userId, pagination);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'FR-3.8: Get user\'s posts' })
  @ApiResponse({ status: 200, description: 'User posts retrieved', type: [FeedEventResponseDto] })
  async getUserPosts(
    @CurrentUser('id') currentUserId: string,
    @Param('userId') targetUserId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<FeedEventResponseDto>> {
    return this.socialFeedService.getUserPosts(currentUserId, targetUserId, pagination);
  }

  @Post('achievement')
  @ApiOperation({ summary: 'FR-3.9: Share achievement to feed' })
  @ApiResponse({ status: 201, description: 'Achievement shared' })
  async shareAchievement(
    @CurrentUser('id') userId: string,
    @Body() dto: ShareAchievementDto,
  ) {
    return this.socialFeedService.shareAchievement(userId, dto);
  }

  @Post('game-result')
  @ApiOperation({ summary: 'FR-3.10: Share game result to feed' })
  @ApiResponse({ status: 201, description: 'Game result shared' })
  async shareGameResult(
    @CurrentUser('id') userId: string,
    @Body() dto: ShareGameResultDto,
  ) {
    return this.socialFeedService.shareGameResult(userId, dto);
  }

  @Get('post/:postId/comments')
  @ApiOperation({ summary: 'Get comments for a post' })
  @ApiResponse({ status: 200, description: 'Comments retrieved', type: [CommentResponseDto] })
  async getPostComments(
    @CurrentUser('id') userId: string,
    @Param('postId') postId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<CommentResponseDto>> {
    return this.socialFeedService.getPostComments(userId, postId, pagination);
  }
}
