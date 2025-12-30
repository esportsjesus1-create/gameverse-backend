export enum Rarity {
  COMMON = 'COMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
  MYTHIC = 'MYTHIC',
}

export enum BannerType {
  STANDARD = 'STANDARD',
  LIMITED = 'LIMITED',
  EVENT = 'EVENT',
  BEGINNER = 'BEGINNER',
  WEAPON = 'WEAPON',
}

export enum ItemType {
  CHARACTER = 'CHARACTER',
  WEAPON = 'WEAPON',
  CONSUMABLE = 'CONSUMABLE',
  COSMETIC = 'COSMETIC',
  MATERIAL = 'MATERIAL',
  NFT = 'NFT',
}

export enum CurrencyType {
  PREMIUM = 'PREMIUM',
  FREE = 'FREE',
  EVENT = 'EVENT',
  TICKET = 'TICKET',
}

export enum TransactionType {
  PURCHASE = 'PURCHASE',
  PULL = 'PULL',
  REFUND = 'REFUND',
  REWARD = 'REWARD',
  ADMIN_GRANT = 'ADMIN_GRANT',
  ADMIN_DEDUCT = 'ADMIN_DEDUCT',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum AgeVerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum NFTRewardStatus {
  PENDING = 'PENDING',
  MINTING = 'MINTING',
  MINTED = 'MINTED',
  CLAIMED = 'CLAIMED',
  FAILED = 'FAILED',
}

export interface RarityRates {
  [Rarity.COMMON]: number;
  [Rarity.RARE]: number;
  [Rarity.EPIC]: number;
  [Rarity.LEGENDARY]: number;
  [Rarity.MYTHIC]: number;
}

export interface PityConfig {
  softPityStart: number;
  hardPity: number;
  softPityRateIncrease: number;
  guaranteedFeaturedAfterLoss: boolean;
  weaponPityEnabled?: boolean;
  weaponPityThreshold?: number;
}

export interface SpendingLimits {
  daily: number;
  weekly: number;
  monthly: number;
  customPeriodDays?: number;
  customPeriodLimit?: number;
}

export interface PoolConfig {
  id: string;
  name: string;
  items: string[];
  rarityWeights: RarityRates;
  isActive: boolean;
}

export interface BannerConfig {
  id: string;
  name: string;
  description: string;
  type: BannerType;
  baseRates: RarityRates;
  pityConfig: PityConfig;
  featuredItems: string[];
  itemPool: string[];
  featuredRate: number;
  startDate: Date;
  endDate: Date | null;
  pullCost: number;
  currencyType: CurrencyType;
  multiPullDiscount: number;
  multiPullCount: number;
  guaranteedRarityOnMulti?: Rarity;
  maxPullsPerDay?: number;
  requiresAgeVerification: boolean;
  nftRewardsEnabled: boolean;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PullResult {
  id: string;
  itemId: string;
  itemName: string;
  itemType: ItemType;
  rarity: Rarity;
  isFeatured: boolean;
  pityCount: number;
  isGuaranteed: boolean;
  isNew: boolean;
  nftReward?: NFTRewardInfo;
  timestamp: Date;
}

export interface NFTRewardInfo {
  tokenId?: string;
  contractAddress?: string;
  status: NFTRewardStatus;
  transactionHash?: string;
  metadata?: Record<string, unknown>;
}

export interface PlayerPityState {
  playerId: string;
  bannerType: BannerType;
  bannerId?: string;
  pityCounter: number;
  guaranteedFeatured: boolean;
  weaponPityCounter?: number;
  lastPullTimestamp: Date | null;
}

export interface PlayerCurrency {
  playerId: string;
  currencyType: CurrencyType;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt?: Date;
}

export interface PlayerInventoryItem {
  id: string;
  playerId: string;
  itemId: string;
  quantity: number;
  obtainedAt: Date;
  obtainedFrom: string;
  isLocked: boolean;
  nftTokenId?: string;
}

export interface PlayerSpendingRecord {
  playerId: string;
  dailySpent: number;
  weeklySpent: number;
  monthlySpent: number;
  lastDailyReset: Date;
  lastWeeklyReset: Date;
  lastMonthlyReset: Date;
  totalLifetimeSpent: number;
}

export interface PlayerAgeVerification {
  playerId: string;
  status: AgeVerificationStatus;
  dateOfBirth?: Date;
  verifiedAt?: Date;
  verificationMethod?: string;
  documentId?: string;
}

export interface PullRequest {
  playerId: string;
  bannerId: string;
  count?: number;
  useTicket?: boolean;
}

export interface PullResponse {
  success: boolean;
  results: PullResult[];
  updatedPity: PlayerPityState;
  totalCost: number;
  currencyType: CurrencyType;
  remainingBalance: number;
  newItems: string[];
  nftRewards: NFTRewardInfo[];
}

export interface CurrencyPurchaseRequest {
  playerId: string;
  currencyType: CurrencyType;
  amount: number;
  paymentMethod: string;
  paymentToken?: string;
}

export interface CurrencyPurchaseResponse {
  success: boolean;
  transactionId: string;
  currencyType: CurrencyType;
  amount: number;
  newBalance: number;
  status: TransactionStatus;
}

export interface DropRateDisclosure {
  bannerId: string;
  bannerName: string;
  rates: RarityRates;
  featuredRate: number;
  pitySystem: {
    softPityStart: number;
    hardPity: number;
    softPityRateIncrease: number;
    guaranteedFeatured: boolean;
  };
  featuredItems: Array<{
    id: string;
    name: string;
    rarity: Rarity;
    individualRate: number;
  }>;
  lastUpdated: Date;
}

export interface SpendingLimitStatus {
  playerId: string;
  dailyLimit: number;
  dailySpent: number;
  dailyRemaining: number;
  weeklyLimit: number;
  weeklySpent: number;
  weeklyRemaining: number;
  monthlyLimit: number;
  monthlySpent: number;
  monthlyRemaining: number;
  isLimitReached: boolean;
  nextResetTime: Date;
}

export interface BannerListResponse {
  banners: BannerConfig[];
  total: number;
}

export interface PullHistoryEntry {
  id: string;
  playerId: string;
  bannerId: string;
  bannerName: string;
  itemId: string;
  itemName: string;
  itemType: ItemType;
  rarity: Rarity;
  isFeatured: boolean;
  pityCount: number;
  isGuaranteed: boolean;
  cost: number;
  currencyType: CurrencyType;
  timestamp: Date;
  nftTokenId?: string;
}

export interface PullHistoryResponse {
  history: PullHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateBannerRequest {
  name: string;
  description?: string;
  type: BannerType;
  baseRates?: Partial<RarityRates>;
  pityConfig?: Partial<PityConfig>;
  featuredItems: string[];
  itemPool: string[];
  featuredRate?: number;
  startDate: string;
  endDate?: string;
  pullCost: number;
  currencyType?: CurrencyType;
  multiPullDiscount?: number;
  multiPullCount?: number;
  guaranteedRarityOnMulti?: Rarity;
  maxPullsPerDay?: number;
  requiresAgeVerification?: boolean;
  nftRewardsEnabled?: boolean;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateItemRequest {
  name: string;
  description?: string;
  rarity: Rarity;
  type: ItemType;
  isNFT?: boolean;
  nftMetadata?: Record<string, unknown>;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CreatePoolRequest {
  name: string;
  description?: string;
  items: string[];
  rarityWeights?: Partial<RarityRates>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StatisticalValidationResult {
  totalPulls: number;
  rarityDistribution: Record<Rarity, number>;
  expectedDistribution: Record<Rarity, number>;
  chiSquareValue: number;
  pValue: number;
  isWithinTolerance: boolean;
  averagePullsToLegendary: number;
  medianPullsToLegendary: number;
  percentile90PullsToLegendary: number;
  featuredRate: number;
  expectedFeaturedRate: number;
  pityTriggerRate: number;
  softPityTriggerRate: number;
  hardPityTriggerRate: number;
  timestamp: Date;
}

export interface GamerstakeNFTConfig {
  contractAddress: string;
  apiUrl: string;
  apiKey: string;
  chainId: number;
  gasLimit: number;
}

export interface NFTMintRequest {
  playerId: string;
  itemId: string;
  pullId: string;
  metadata: Record<string, unknown>;
}

export interface NFTMintResponse {
  success: boolean;
  tokenId?: string;
  transactionHash?: string;
  status: NFTRewardStatus;
  error?: string;
}
