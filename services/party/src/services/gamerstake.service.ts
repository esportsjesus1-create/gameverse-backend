import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  IGamerstakeService,
  GamerstakeUser,
  GamerstakeProfile,
  GamerstakeWallet,
  GamerstakeFriend,
} from '../interfaces/gamerstake.interface';

@Injectable()
export class GamerstakeService implements IGamerstakeService {
  private readonly logger = new Logger(GamerstakeService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GAMERSTAKE_API_KEY', '');
    const baseURL = this.configService.get<string>('GAMERSTAKE_API_URL', 'https://api.gamerstake.com/v1');

    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
    });
  }

  async validateToken(token: string): Promise<GamerstakeUser | null> {
    try {
      const response = await this.client.get('/auth/validate', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.user;
    } catch (error) {
      this.logger.error(`Failed to validate token: ${error}`);
      return null;
    }
  }

  async getUser(userId: string): Promise<GamerstakeUser | null> {
    try {
      const response = await this.client.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get user ${userId}: ${error}`);
      return null;
    }
  }

  async getProfile(userId: string): Promise<GamerstakeProfile | null> {
    try {
      const response = await this.client.get(`/users/${userId}/profile`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get profile for user ${userId}: ${error}`);
      return null;
    }
  }

  async getWallet(userId: string): Promise<GamerstakeWallet | null> {
    try {
      const response = await this.client.get(`/users/${userId}/wallet`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get wallet for user ${userId}: ${error}`);
      return null;
    }
  }

  async verifyWalletBalance(userId: string, minBalance: string, currency: string): Promise<boolean> {
    try {
      const wallet = await this.getWallet(userId);
      if (!wallet || !wallet.isVerified) {
        return false;
      }

      const balance = wallet.balances.find((b) => b.currency === currency);
      if (!balance) {
        return false;
      }

      return parseFloat(balance.amount) >= parseFloat(minBalance);
    } catch (error) {
      this.logger.error(`Failed to verify wallet balance for user ${userId}: ${error}`);
      return false;
    }
  }

  async getFriends(userId: string): Promise<GamerstakeFriend[]> {
    try {
      const response = await this.client.get(`/users/${userId}/friends`);
      return response.data.friends || [];
    } catch (error) {
      this.logger.error(`Failed to get friends for user ${userId}: ${error}`);
      return [];
    }
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    try {
      const response = await this.client.get(`/users/${userId1}/friends/${userId2}`);
      return response.data.isFriend === true;
    } catch (error) {
      this.logger.error(`Failed to check friendship between ${userId1} and ${userId2}: ${error}`);
      return false;
    }
  }

  async sendNotification(
    userId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      data?: Record<string, unknown>;
    },
  ): Promise<boolean> {
    try {
      await this.client.post(`/users/${userId}/notifications`, notification);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send notification to user ${userId}: ${error}`);
      return false;
    }
  }

  async getUsersByIds(userIds: string[]): Promise<GamerstakeUser[]> {
    try {
      const response = await this.client.post('/users/batch', { userIds });
      return response.data.users || [];
    } catch (error) {
      this.logger.error(`Failed to get users by IDs: ${error}`);
      return [];
    }
  }

  async searchUsers(query: string, limit = 20): Promise<GamerstakeUser[]> {
    try {
      const response = await this.client.get('/users/search', {
        params: { q: query, limit },
      });
      return response.data.users || [];
    } catch (error) {
      this.logger.error(`Failed to search users: ${error}`);
      return [];
    }
  }

  async getOnlineFriends(userId: string): Promise<GamerstakeFriend[]> {
    try {
      const friends = await this.getFriends(userId);
      return friends.filter((f) => f.status === 'online' || f.status === 'away');
    } catch (error) {
      this.logger.error(`Failed to get online friends for user ${userId}: ${error}`);
      return [];
    }
  }

  async blockUser(userId: string, blockedUserId: string): Promise<boolean> {
    try {
      await this.client.post(`/users/${userId}/blocked`, { blockedUserId });
      return true;
    } catch (error) {
      this.logger.error(`Failed to block user ${blockedUserId} for user ${userId}: ${error}`);
      return false;
    }
  }

  async isBlocked(userId: string, targetUserId: string): Promise<boolean> {
    try {
      const response = await this.client.get(`/users/${userId}/blocked/${targetUserId}`);
      return response.data.isBlocked === true;
    } catch (error) {
      this.logger.error(`Failed to check if ${targetUserId} is blocked by ${userId}: ${error}`);
      return false;
    }
  }

  async getGameStats(userId: string, gameId: string): Promise<Record<string, unknown> | null> {
    try {
      const response = await this.client.get(`/users/${userId}/games/${gameId}/stats`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get game stats for user ${userId}, game ${gameId}: ${error}`);
      return null;
    }
  }

  async updateUserStatus(userId: string, status: string): Promise<boolean> {
    try {
      await this.client.patch(`/users/${userId}/status`, { status });
      return true;
    } catch (error) {
      this.logger.error(`Failed to update status for user ${userId}: ${error}`);
      return false;
    }
  }
}
