export interface Item {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  imageUrl: string | null;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateItemDto {
  name: string;
  description?: string;
  price: number;
  category?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

export interface UpdateItemDto {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

export interface Bundle {
  id: string;
  name: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  items?: BundleItem[];
}

export type DiscountType = 'percentage' | 'fixed';

export interface BundleItem {
  bundleId: string;
  itemId: string;
  quantity: number;
  item?: Item;
}

export interface CreateBundleDto {
  name: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  isActive?: boolean;
  items: { itemId: string; quantity: number }[];
}

export interface UpdateBundleDto {
  name?: string;
  description?: string;
  discountType?: DiscountType;
  discountValue?: number;
  isActive?: boolean;
  items?: { itemId: string; quantity: number }[];
}

export interface BundleWithPricing extends Bundle {
  originalPrice: number;
  finalPrice: number;
  savings: number;
}

export interface Inventory {
  id: string;
  itemId: string;
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
  item?: Item;
}

export interface CreateInventoryDto {
  itemId: string;
  quantity: number;
  lowStockThreshold?: number;
}

export interface UpdateInventoryDto {
  quantity?: number;
  lowStockThreshold?: number;
}

export interface ReserveInventoryDto {
  quantity: number;
  reason?: string;
}

export interface ReleaseInventoryDto {
  quantity: number;
  reason?: string;
}

export type InventoryChangeType = 'add' | 'remove' | 'reserve' | 'release';

export interface InventoryHistory {
  id: string;
  itemId: string;
  changeType: InventoryChangeType;
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string | null;
  createdAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SearchParams extends PaginationParams {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LowStockItem {
  itemId: string;
  itemName: string;
  currentQuantity: number;
  availableQuantity: number;
  threshold: number;
}
