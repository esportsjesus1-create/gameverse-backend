import {
  IsString,
  IsOptional,
  IsEnum,
  IsUrl,
  MaxLength,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProfileVisibility } from '../../../database/entities/social-profile.entity';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Display name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ description: 'Bio' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ description: 'Avatar URL' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Banner URL' })
  @IsOptional()
  @IsUrl()
  bannerUrl?: string;

  @ApiPropertyOptional({ description: 'Location' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ description: 'Website URL' })
  @IsOptional()
  @IsUrl()
  website?: string;
}

export class SetVisibilityDto {
  @ApiProperty({ description: 'Profile visibility', enum: ProfileVisibility })
  @IsEnum(ProfileVisibility)
  visibility: ProfileVisibility;
}

export class UpdatePrivacySettingsDto {
  @ApiPropertyOptional({ description: 'Allow friend requests' })
  @IsOptional()
  @IsBoolean()
  allowFriendRequests?: boolean;

  @ApiPropertyOptional({ description: 'Show online status' })
  @IsOptional()
  @IsBoolean()
  showOnlineStatus?: boolean;

  @ApiPropertyOptional({ description: 'Show game activity' })
  @IsOptional()
  @IsBoolean()
  showGameActivity?: boolean;
}

export class GamingPlatformDto {
  @ApiProperty({
    description: 'Platform name (e.g., Steam, Xbox, PlayStation)',
  })
  @IsString()
  @MaxLength(50)
  platform: string;

  @ApiProperty({ description: 'Username on the platform' })
  @IsString()
  @MaxLength(100)
  username: string;

  @ApiPropertyOptional({ description: 'Profile URL on the platform' })
  @IsOptional()
  @IsUrl()
  profileUrl?: string;
}

export class AddGamingPlatformDto {
  @ApiProperty({ description: 'Gaming platform details' })
  @ValidateNested()
  @Type(() => GamingPlatformDto)
  platform: GamingPlatformDto;
}

export class RemoveGamingPlatformDto {
  @ApiProperty({ description: 'Platform name to remove' })
  @IsString()
  platform: string;
}

export class SearchUsersDto {
  @ApiProperty({ description: 'Search query' })
  @IsString()
  @MaxLength(100)
  query: string;
}

export class ProfileResponseDto {
  @ApiProperty({ description: 'Profile ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'Display name' })
  displayName: string;

  @ApiPropertyOptional({ description: 'Bio' })
  bio?: string;

  @ApiPropertyOptional({ description: 'Avatar URL' })
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Banner URL' })
  bannerUrl?: string;

  @ApiPropertyOptional({ description: 'Location' })
  location?: string;

  @ApiPropertyOptional({ description: 'Website' })
  website?: string;

  @ApiProperty({ description: 'Profile visibility', enum: ProfileVisibility })
  visibility: ProfileVisibility;

  @ApiProperty({ description: 'Gaming platforms' })
  gamingPlatforms: GamingPlatformDto[];

  @ApiProperty({ description: 'Friend count' })
  friendCount: number;

  @ApiProperty({ description: 'Is verified' })
  isVerified: boolean;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;
}

export class FullProfileResponseDto extends ProfileResponseDto {
  @ApiProperty({ description: 'Game statistics' })
  gameStatistics: Array<{
    gameId: string;
    gameName: string;
    hoursPlayed: number;
    wins: number;
    losses: number;
    rank?: string;
    lastPlayed: Date;
  }>;

  @ApiProperty({ description: 'Achievements' })
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    iconUrl?: string;
    unlockedAt: Date;
    gameId?: string;
    gameName?: string;
    rarity?: string;
  }>;

  @ApiProperty({ description: 'Allow friend requests' })
  allowFriendRequests: boolean;

  @ApiProperty({ description: 'Show online status' })
  showOnlineStatus: boolean;

  @ApiProperty({ description: 'Show game activity' })
  showGameActivity: boolean;
}

export class UserSearchResultDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'Display name' })
  displayName: string;

  @ApiPropertyOptional({ description: 'Avatar URL' })
  avatarUrl?: string;

  @ApiProperty({ description: 'Is verified' })
  isVerified: boolean;

  @ApiProperty({ description: 'Mutual friend count' })
  mutualFriendCount: number;
}
