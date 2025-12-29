import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  IsArray,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePartySettingsDto {
  @ApiPropertyOptional({ description: 'Allow invites' })
  @IsOptional()
  @IsBoolean()
  allowInvites?: boolean;

  @ApiPropertyOptional({ description: 'Members can invite' })
  @IsOptional()
  @IsBoolean()
  membersCanInvite?: boolean;

  @ApiPropertyOptional({ description: 'Auto accept friends' })
  @IsOptional()
  @IsBoolean()
  autoAcceptFriends?: boolean;

  @ApiPropertyOptional({ description: 'Require approval for joins' })
  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;

  @ApiPropertyOptional({ description: 'Chat enabled' })
  @IsOptional()
  @IsBoolean()
  chatEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Voice chat enabled' })
  @IsOptional()
  @IsBoolean()
  voiceChatEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Push to talk mode' })
  @IsOptional()
  @IsBoolean()
  pushToTalk?: boolean;

  @ApiPropertyOptional({ description: 'Notifications enabled' })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Sounds enabled' })
  @IsOptional()
  @IsBoolean()
  soundsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Auto ready check' })
  @IsOptional()
  @IsBoolean()
  autoReadyCheck?: boolean;

  @ApiPropertyOptional({ description: 'Ready check timeout in seconds', minimum: 10, maximum: 120 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(120)
  readyCheckTimeout?: number;

  @ApiPropertyOptional({ description: 'Show member status' })
  @IsOptional()
  @IsBoolean()
  showMemberStatus?: boolean;

  @ApiPropertyOptional({ description: 'Show member rank' })
  @IsOptional()
  @IsBoolean()
  showMemberRank?: boolean;

  @ApiPropertyOptional({ description: 'Anonymous mode' })
  @IsOptional()
  @IsBoolean()
  anonymousMode?: boolean;

  @ApiPropertyOptional({ description: 'Strict rank matching' })
  @IsOptional()
  @IsBoolean()
  strictRankMatching?: boolean;

  @ApiPropertyOptional({ description: 'Rank tolerance', minimum: 0, maximum: 5000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  rankTolerance?: number;

  @ApiPropertyOptional({ description: 'Allow spectators' })
  @IsOptional()
  @IsBoolean()
  allowSpectators?: boolean;

  @ApiPropertyOptional({ description: 'Max spectators', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxSpectators?: number;

  @ApiPropertyOptional({ description: 'Stream mode' })
  @IsOptional()
  @IsBoolean()
  streamMode?: boolean;

  @ApiPropertyOptional({ description: 'Stream delay in seconds', minimum: 0, maximum: 300 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  streamDelay?: number;

  @ApiPropertyOptional({ description: 'Tournament mode' })
  @IsOptional()
  @IsBoolean()
  tournamentMode?: boolean;

  @ApiPropertyOptional({ description: 'Tournament ID' })
  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @ApiPropertyOptional({ description: 'Wager enabled' })
  @IsOptional()
  @IsBoolean()
  wagerEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Wager amount' })
  @IsOptional()
  @IsNumber()
  wagerAmount?: number;

  @ApiPropertyOptional({ description: 'Wager currency' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  wagerCurrency?: string;

  @ApiPropertyOptional({ description: 'Require wallet verification' })
  @IsOptional()
  @IsBoolean()
  requireWalletVerification?: boolean;

  @ApiPropertyOptional({ description: 'Minimum balance' })
  @IsOptional()
  @IsNumber()
  minimumBalance?: number;

  @ApiPropertyOptional({ description: 'Preferred servers' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredServers?: string[];

  @ApiPropertyOptional({ description: 'Blocked regions' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedRegions?: string[];

  @ApiPropertyOptional({ description: 'Max ping', minimum: 0, maximum: 500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  maxPing?: number;

  @ApiPropertyOptional({ description: 'Game specific settings' })
  @IsOptional()
  gameSpecificSettings?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Custom roles' })
  @IsOptional()
  customRoles?: Array<{
    name: string;
    permissions: string[];
    color: string;
  }>;

  @ApiPropertyOptional({ description: 'Chat filters' })
  @IsOptional()
  chatFilters?: {
    profanityFilter: boolean;
    linkFilter: boolean;
    spamFilter: boolean;
    customBlockedWords: string[];
  };

  @ApiPropertyOptional({ description: 'Matchmaking preferences' })
  @IsOptional()
  matchmakingPreferences?: {
    preferSimilarRank: boolean;
    preferSameRegion: boolean;
    preferSameLanguage: boolean;
    avoidRecentOpponents: boolean;
    prioritizeSpeed: boolean;
  };

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
