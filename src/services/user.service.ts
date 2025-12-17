import {
  UserProfile,
  CreateUserProfileInput,
  UpdateUserProfileInput,
  KycStatusUpdate,
  KycHistoryEntry,
  PaginationParams,
  PaginatedResult,
  GdprExportData,
} from '../types';
import { UserRepository, userRepository } from '../repositories/user.repository';
import {
  BlockchainAddressRepository,
  blockchainAddressRepository,
} from '../repositories/blockchain-address.repository';
import { CacheService, cacheService } from '../config/redis';
import { logger } from '../utils/logger';
import { stringify } from 'csv-stringify/sync';

export class UserService {
  constructor(
    private userRepo: UserRepository = userRepository,
    private addressRepo: BlockchainAddressRepository = blockchainAddressRepository,
    private cache: CacheService = cacheService
  ) {}

  async createUser(input: CreateUserProfileInput): Promise<UserProfile> {
    const emailExists = await this.userRepo.emailExists(input.email);
    if (emailExists) {
      throw new Error('Email already exists');
    }

    const usernameExists = await this.userRepo.usernameExists(input.username);
    if (usernameExists) {
      throw new Error('Username already exists');
    }

    const user = await this.userRepo.create(input);
    await this.cache.set(this.cache.generateUserKey(user.id), user);
    return user;
  }

  async getUserById(id: string): Promise<UserProfile | null> {
    const cached = await this.cache.get<UserProfile>(this.cache.generateUserKey(id));
    if (cached) {
      return cached;
    }

    const user = await this.userRepo.findById(id);
    if (user) {
      await this.cache.set(this.cache.generateUserKey(id), user);
    }
    return user;
  }

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    return this.userRepo.findByEmail(email);
  }

  async getUserByUsername(username: string): Promise<UserProfile | null> {
    return this.userRepo.findByUsername(username);
  }

  async updateUser(id: string, input: UpdateUserProfileInput): Promise<UserProfile | null> {
    if (input.username) {
      const existing = await this.userRepo.findByUsername(input.username);
      if (existing && existing.id !== id) {
        throw new Error('Username already exists');
      }
    }

    const user = await this.userRepo.update(id, input);
    if (user) {
      await this.cache.invalidateUserCache(id);
      await this.cache.set(this.cache.generateUserKey(id), user);
    }
    return user;
  }

  async updateAvatar(id: string, avatarUrl: string): Promise<UserProfile | null> {
    const user = await this.userRepo.updateAvatar(id, avatarUrl);
    if (user) {
      await this.cache.invalidateUserCache(id);
      await this.cache.set(this.cache.generateUserKey(id), user);
    }
    return user;
  }

  async verifyEmail(token: string): Promise<UserProfile | null> {
    const user = await this.userRepo.findByVerificationToken(token);
    if (!user) {
      return null;
    }

    const verified = await this.userRepo.verifyEmail(user.id);
    if (verified) {
      await this.cache.invalidateUserCache(user.id);
    }
    return verified;
  }

  async resendVerificationEmail(userId: string): Promise<UserProfile | null> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      return null;
    }

    if (user.emailVerified) {
      throw new Error('Email already verified');
    }

    const updated = await this.userRepo.regenerateVerificationToken(userId);
    if (updated) {
      await this.cache.invalidateUserCache(userId);
      logger.info('Verification email resent', { userId });
    }
    return updated;
  }

  async updateKycStatus(id: string, update: KycStatusUpdate): Promise<UserProfile | null> {
    const user = await this.userRepo.updateKycStatus(id, update);
    if (user) {
      await this.cache.invalidateUserCache(id);
    }
    return user;
  }

  async getKycHistory(userId: string): Promise<KycHistoryEntry[]> {
    return this.userRepo.getKycHistory(userId);
  }

  async deleteUser(id: string): Promise<boolean> {
    const deleted = await this.userRepo.softDelete(id);
    if (deleted) {
      await this.cache.invalidateUserCache(id);
    }
    return deleted;
  }

  async anonymizeUser(id: string): Promise<boolean> {
    const anonymized = await this.userRepo.anonymize(id);
    if (anonymized) {
      await this.cache.invalidateUserCache(id);
    }
    return anonymized;
  }

  async getAllUsers(params: PaginationParams): Promise<PaginatedResult<UserProfile>> {
    return this.userRepo.findAll(params);
  }

  async exportUserData(userId: string, format: 'json' | 'csv'): Promise<GdprExportData | string> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const addresses = await this.addressRepo.findAllByUserId(userId);
    const kycHistory = await this.userRepo.getKycHistory(userId);

    const exportData: GdprExportData = {
      profile: user,
      blockchainAddresses: addresses,
      kycHistory,
      exportedAt: new Date(),
      format,
    };

    if (format === 'json') {
      return exportData;
    }

    return this.convertToCsv(exportData);
  }

  private convertToCsv(data: GdprExportData): string {
    const sections: string[] = [];

    sections.push('=== USER PROFILE ===');
    sections.push(
      stringify(
        [
          [
            'ID',
            'Email',
            'Username',
            'Display Name',
            'Bio',
            'Email Verified',
            'KYC Status',
            'Created At',
          ],
          [
            data.profile.id,
            data.profile.email,
            data.profile.username,
            data.profile.displayName ?? '',
            data.profile.bio ?? '',
            data.profile.emailVerified.toString(),
            data.profile.kycStatus,
            data.profile.createdAt.toISOString(),
          ],
        ],
        { header: false }
      )
    );

    sections.push('\n=== BLOCKCHAIN ADDRESSES ===');
    const addressRows = data.blockchainAddresses.map((addr) => [
      addr.id,
      addr.chain,
      addr.address,
      addr.isPrimary.toString(),
      addr.label ?? '',
      addr.verifiedAt?.toISOString() ?? '',
      addr.createdAt.toISOString(),
    ]);
    sections.push(
      stringify(
        [
          ['ID', 'Chain', 'Address', 'Is Primary', 'Label', 'Verified At', 'Created At'],
          ...addressRows,
        ],
        { header: false }
      )
    );

    sections.push('\n=== KYC HISTORY ===');
    const kycRows = data.kycHistory.map((entry) => [
      entry.id,
      entry.status,
      entry.provider ?? '',
      entry.reference ?? '',
      entry.createdAt.toISOString(),
    ]);
    sections.push(
      stringify([['ID', 'Status', 'Provider', 'Reference', 'Created At'], ...kycRows], {
        header: false,
      })
    );

    sections.push('\n=== PREFERENCES ===');
    sections.push(JSON.stringify(data.profile.preferences, null, 2));

    sections.push(`\n=== EXPORTED AT: ${data.exportedAt.toISOString()} ===`);

    return sections.join('\n');
  }

  async userExists(id: string): Promise<boolean> {
    return this.userRepo.exists(id);
  }
}

export const userService = new UserService();
