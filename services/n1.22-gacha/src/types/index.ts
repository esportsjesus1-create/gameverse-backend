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
}

export enum ItemType {
  CHARACTER = 'CHARACTER',
  WEAPON = 'WEAPON',
  CONSUMABLE = 'CONSUMABLE',
  COSMETIC = 'COSMETIC',
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
}

export interface BannerConfig {
  id: string;
  name: string;
  type: BannerType;
  baseRates: RarityRates;
  pityConfig: PityConfig;
  featuredItems: string[];
  itemPool: string[];
  featuredRate: number;
  startDate: Date;
  endDate: Date | null;
  pullCost: number;
  multiPullDiscount: number;
}

export interface PullResult {
  itemId: string;
  itemName: string;
  rarity: Rarity;
  isFeatured: boolean;
  pityCount: number;
  isGuaranteed: boolean;
}

export interface PlayerPityState {
  playerId: string;
  bannerType: BannerType;
  pityCounter: number;
  guaranteedFeatured: boolean;
  lastPullTimestamp: Date | null;
}

export interface PullRequest {
  playerId: string;
  bannerId: string;
  count?: number;
}

export interface PullResponse {
  success: boolean;
  results: PullResult[];
  updatedPity: PlayerPityState;
  totalCost: number;
}

export interface BannerListResponse {
  banners: BannerConfig[];
  total: number;
}

export interface PullHistoryEntry {
  id: string;
  playerId: string;
  bannerId: string;
  itemId: string;
  itemName: string;
  rarity: Rarity;
  isFeatured: boolean;
  pityCount: number;
  timestamp: Date;
}

export interface PullHistoryResponse {
  history: PullHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateBannerRequest {
  name: string;
  type: BannerType;
  baseRates?: Partial<RarityRates>;
  pityConfig?: Partial<PityConfig>;
  featuredItems: string[];
  itemPool: string[];
  featuredRate?: number;
  startDate: string;
  endDate?: string;
  pullCost: number;
  multiPullDiscount?: number;
}

export interface CreateItemRequest {
  name: string;
  rarity: Rarity;
  type: ItemType;
  metadata?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
