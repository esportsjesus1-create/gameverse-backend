export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpires: Date | null;
  kycStatus: KycStatus;
  kycVerifiedAt: Date | null;
  kycProvider: string | null;
  kycReference: string | null;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  anonymizedAt: Date | null;
}

export interface CreateUserProfileInput {
  email: string;
  username: string;
  displayName?: string;
  bio?: string;
}

export interface UpdateUserProfileInput {
  username?: string;
  displayName?: string;
  bio?: string;
  preferences?: Partial<UserPreferences>;
}

export interface UserPreferences {
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
  display: DisplayPreferences;
  locale: string;
  timezone: string;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  marketing: boolean;
  gameUpdates: boolean;
  friendRequests: boolean;
}

export interface PrivacyPreferences {
  profileVisibility: 'public' | 'friends' | 'private';
  showOnlineStatus: boolean;
  showGameActivity: boolean;
  allowFriendRequests: boolean;
}

export interface DisplayPreferences {
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  animationsEnabled: boolean;
}

export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected' | 'expired';

export interface KycStatusUpdate {
  status: KycStatus;
  provider?: string;
  reference?: string;
}

export interface BlockchainAddress {
  id: string;
  userId: string;
  chain: BlockchainChain;
  address: string;
  isPrimary: boolean;
  verifiedAt: Date | null;
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type BlockchainChain = 
  | 'ethereum'
  | 'polygon'
  | 'solana'
  | 'avalanche'
  | 'binance'
  | 'arbitrum'
  | 'optimism'
  | 'base';

export interface LinkBlockchainAddressInput {
  chain: BlockchainChain;
  address: string;
  signature: string;
  message: string;
  label?: string;
}

export interface GdprExportData {
  profile: UserProfile;
  blockchainAddresses: BlockchainAddress[];
  kycHistory: KycHistoryEntry[];
  exportedAt: Date;
  format: 'json' | 'csv';
}

export interface KycHistoryEntry {
  id: string;
  userId: string;
  status: KycStatus;
  provider: string | null;
  reference: string | null;
  createdAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AvatarUploadResult {
  url: string;
  thumbnailUrl: string;
  key: string;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  notifications: {
    email: true,
    push: true,
    marketing: false,
    gameUpdates: true,
    friendRequests: true,
  },
  privacy: {
    profileVisibility: 'public',
    showOnlineStatus: true,
    showGameActivity: true,
    allowFriendRequests: true,
  },
  display: {
    theme: 'system',
    compactMode: false,
    animationsEnabled: true,
  },
  locale: 'en-US',
  timezone: 'UTC',
};
