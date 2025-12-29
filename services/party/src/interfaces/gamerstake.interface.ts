export interface GamerstakeUser {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  rank?: number;
  level?: number;
  region?: string;
  language?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GamerstakeProfile {
  userId: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  rank: number;
  level: number;
  experience: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  preferredGames: string[];
  achievements: Array<{
    id: string;
    name: string;
    unlockedAt: Date;
  }>;
  socialLinks?: Record<string, string>;
  isVerified: boolean;
  isPremium: boolean;
  status: 'online' | 'offline' | 'away' | 'busy' | 'in_game';
  lastOnline: Date;
}

export interface GamerstakeWallet {
  userId: string;
  address: string;
  balance: string;
  currency: string;
  isVerified: boolean;
  chain: string;
  balances: Array<{
    currency: string;
    amount: string;
    usdValue: string;
  }>;
  transactions: Array<{
    id: string;
    type: 'deposit' | 'withdrawal' | 'wager' | 'reward';
    amount: string;
    currency: string;
    status: 'pending' | 'completed' | 'failed';
    createdAt: Date;
  }>;
}

export interface GamerstakeFriend {
  userId: string;
  friendId: string;
  username: string;
  avatarUrl?: string;
  status: 'online' | 'offline' | 'away' | 'busy' | 'in_game';
  addedAt: Date;
}

export interface GamerstakeAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  userId: string;
}

export interface IGamerstakeService {
  validateToken(token: string): Promise<GamerstakeUser | null>;
  getUser(userId: string): Promise<GamerstakeUser | null>;
  getProfile(userId: string): Promise<GamerstakeProfile | null>;
  getWallet(userId: string): Promise<GamerstakeWallet | null>;
  verifyWalletBalance(userId: string, minBalance: string, currency: string): Promise<boolean>;
  getFriends(userId: string): Promise<GamerstakeFriend[]>;
  areFriends(userId1: string, userId2: string): Promise<boolean>;
  sendNotification(userId: string, notification: {
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }): Promise<boolean>;
}
