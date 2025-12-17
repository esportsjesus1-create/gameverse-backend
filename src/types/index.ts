export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  IN_GAME = 'in_game',
  AWAY = 'away'
}

export interface Party {
  id: string;
  name: string;
  leaderId: string;
  maxSize: number;
  isPrivate: boolean;
  status: PartyStatus;
  voiceChannelId?: string;
  gameMode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum PartyStatus {
  ACTIVE = 'active',
  IN_GAME = 'in_game',
  IDLE = 'idle',
  DISBANDED = 'disbanded'
}

export interface PartyMember {
  id: string;
  partyId: string;
  userId: string;
  role: PartyRole;
  joinedAt: Date;
  isReady: boolean;
  isMuted: boolean;
}

export enum PartyRole {
  LEADER = 'leader',
  OFFICER = 'officer',
  MEMBER = 'member'
}

export interface PartyInvite {
  id: string;
  partyId: string;
  senderId: string;
  recipientId: string;
  status: InviteStatus;
  message?: string;
  expiresAt: Date;
  createdAt: Date;
  respondedAt?: Date;
}

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export interface VoiceChannel {
  id: string;
  partyId: string;
  name: string;
  maxParticipants: number;
  isActive: boolean;
  createdAt: Date;
}

export interface VoiceParticipant {
  id: string;
  channelId: string;
  userId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  joinedAt: Date;
}

export interface PartyBenefit {
  id: string;
  name: string;
  description: string;
  type: BenefitType;
  value: number;
  minPartySize: number;
  maxPartySize?: number;
  isActive: boolean;
}

export enum BenefitType {
  XP_MULTIPLIER = 'xp_multiplier',
  LOOT_BONUS = 'loot_bonus',
  ACHIEVEMENT_BONUS = 'achievement_bonus',
  EXCLUSIVE_REWARD = 'exclusive_reward',
  DROP_RATE_BONUS = 'drop_rate_bonus'
}

export interface AppliedBenefit {
  benefitId: string;
  partyId: string;
  appliedValue: number;
  appliedAt: Date;
}

export interface CreatePartyRequest {
  name: string;
  maxSize?: number;
  isPrivate?: boolean;
  gameMode?: string;
}

export interface UpdatePartyRequest {
  name?: string;
  maxSize?: number;
  isPrivate?: boolean;
  gameMode?: string;
}

export interface SendInviteRequest {
  recipientId: string;
  message?: string;
  expiresInMinutes?: number;
}

export interface BulkInviteRequest {
  recipientIds: string[];
  message?: string;
  expiresInMinutes?: number;
}

export interface JoinVoiceRequest {
  channelId: string;
}

export interface UpdateVoiceStatusRequest {
  isMuted?: boolean;
  isDeafened?: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CalculatedBenefits {
  xpMultiplier: number;
  lootBonus: number;
  achievementBonus: number;
  dropRateBonus: number;
  exclusiveRewards: string[];
  totalBonusPercentage: number;
}
