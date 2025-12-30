import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import {
  UpdateProfileDto,
  SetVisibilityDto,
  UpdatePrivacySettingsDto,
  AddGamingPlatformDto,
  ProfileResponseDto,
  FullProfileResponseDto,
  UserSearchResultDto,
} from './dto/profile.dto';
import { PaginationDto, PaginatedResponseDto } from '../friend/dto/friend.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  @ApiOperation({ summary: 'FR-5.1: Get own profile' })
  @ApiResponse({
    status: 200,
    description: 'Own profile',
    type: FullProfileResponseDto,
  })
  async getOwnProfile(
    @CurrentUser('id') userId: string,
  ): Promise<FullProfileResponseDto> {
    return this.profileService.getOwnProfile(userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'FR-5.2: Update profile (bio, avatar, etc.)' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(userId, dto);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: "FR-5.3: Get other user's profile" })
  @ApiResponse({
    status: 200,
    description: 'User profile',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Cannot view this profile' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getUserProfile(
    @CurrentUser('id') currentUserId: string,
    @Param('userId') targetUserId: string,
  ): Promise<ProfileResponseDto | FullProfileResponseDto> {
    return this.profileService.getUserProfile(currentUserId, targetUserId);
  }

  @Put('visibility')
  @ApiOperation({
    summary: 'FR-5.4: Set profile visibility (public/friends/private)',
  })
  @ApiResponse({ status: 200, description: 'Visibility updated' })
  async setVisibility(
    @CurrentUser('id') userId: string,
    @Body() dto: SetVisibilityDto,
  ) {
    return this.profileService.setVisibility(userId, dto);
  }

  @Put('privacy')
  @ApiOperation({ summary: 'Update privacy settings' })
  @ApiResponse({ status: 200, description: 'Privacy settings updated' })
  async updatePrivacySettings(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePrivacySettingsDto,
  ) {
    return this.profileService.updatePrivacySettings(userId, dto);
  }

  @Post('gaming-platform')
  @ApiOperation({ summary: 'FR-5.5: Add gaming platform' })
  @ApiResponse({ status: 201, description: 'Gaming platform added' })
  @ApiResponse({ status: 409, description: 'Platform already added' })
  async addGamingPlatform(
    @CurrentUser('id') userId: string,
    @Body() dto: AddGamingPlatformDto,
  ) {
    return this.profileService.addGamingPlatform(userId, dto);
  }

  @Delete('gaming-platform/:platform')
  @ApiOperation({ summary: 'FR-5.6: Remove gaming platform' })
  @ApiResponse({ status: 200, description: 'Gaming platform removed' })
  @ApiResponse({ status: 404, description: 'Platform not found' })
  async removeGamingPlatform(
    @CurrentUser('id') userId: string,
    @Param('platform') platform: string,
  ) {
    return this.profileService.removeGamingPlatform(userId, platform);
  }

  @Get('me/statistics')
  @ApiOperation({ summary: 'FR-5.7: Display game statistics' })
  @ApiResponse({ status: 200, description: 'Game statistics' })
  async getGameStatistics(@CurrentUser('id') userId: string) {
    return this.profileService.getGameStatistics(userId);
  }

  @Get('me/achievements')
  @ApiOperation({ summary: 'FR-5.8: Display achievements' })
  @ApiResponse({ status: 200, description: 'Achievements' })
  async getAchievements(@CurrentUser('id') userId: string) {
    return this.profileService.getAchievements(userId);
  }

  @Get('search')
  @ApiOperation({ summary: 'FR-5.10: Search users by username' })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    type: [UserSearchResultDto],
  })
  async searchUsers(
    @CurrentUser('id') userId: string,
    @Query('query') query: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<UserSearchResultDto>> {
    return this.profileService.searchUsers(userId, query, pagination);
  }
}
