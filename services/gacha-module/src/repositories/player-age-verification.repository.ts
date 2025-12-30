import { Repository } from 'typeorm';
import { PlayerAgeVerification } from '../models';
import { getDataSource } from '../config/database';
import { AgeVerificationStatus } from '../types';
import { config } from '../config';

export class PlayerAgeVerificationRepository {
  private repository: Repository<PlayerAgeVerification>;

  constructor() {
    this.repository = getDataSource().getRepository(PlayerAgeVerification);
  }

  async getVerification(playerId: string): Promise<PlayerAgeVerification> {
    let verification = await this.repository.findOne({ where: { playerId } });

    if (!verification) {
      verification = this.repository.create({
        playerId,
        status: AgeVerificationStatus.UNVERIFIED,
        meetsMinimumAge: false,
        verificationAttempts: 0,
      });
      verification = await this.repository.save(verification);
    }

    return verification;
  }

  async submitVerification(
    playerId: string,
    dateOfBirth: Date,
    verificationMethod: string,
    documentId?: string,
    countryCode?: string
  ): Promise<{ verification: PlayerAgeVerification; meetsMinimumAge: boolean }> {
    let verification = await this.getVerification(playerId);

    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    const meetsMinimumAge = age >= config.regulatory.minAgeRequirement;

    verification.dateOfBirth = dateOfBirth;
    verification.calculatedAge = age;
    verification.meetsMinimumAge = meetsMinimumAge;
    verification.verificationMethod = verificationMethod;
    verification.documentId = documentId || null;
    verification.countryCode = countryCode || null;
    verification.verificationAttempts += 1;
    verification.lastAttemptAt = new Date();

    if (meetsMinimumAge) {
      verification.status = AgeVerificationStatus.VERIFIED;
      verification.verifiedAt = new Date();
    } else {
      verification.status = AgeVerificationStatus.REJECTED;
      verification.rejectionReason = `User does not meet minimum age requirement of ${config.regulatory.minAgeRequirement}`;
    }

    verification = await this.repository.save(verification);
    return { verification, meetsMinimumAge };
  }

  async setVerificationStatus(
    playerId: string,
    status: AgeVerificationStatus,
    rejectionReason?: string
  ): Promise<PlayerAgeVerification> {
    let verification = await this.getVerification(playerId);

    verification.status = status;
    if (status === AgeVerificationStatus.VERIFIED) {
      verification.verifiedAt = new Date();
      verification.rejectionReason = null;
    } else if (status === AgeVerificationStatus.REJECTED && rejectionReason) {
      verification.rejectionReason = rejectionReason;
    }

    verification = await this.repository.save(verification);
    return verification;
  }

  async isVerified(playerId: string): Promise<boolean> {
    const verification = await this.getVerification(playerId);
    return verification.status === AgeVerificationStatus.VERIFIED && verification.meetsMinimumAge;
  }

  async canPurchase(playerId: string): Promise<{ canPurchase: boolean; reason?: string }> {
    if (!config.regulatory.requireAgeVerification) {
      return { canPurchase: true };
    }

    const verification = await this.getVerification(playerId);

    if (verification.status === AgeVerificationStatus.UNVERIFIED) {
      return { canPurchase: false, reason: 'Age verification required' };
    }

    if (verification.status === AgeVerificationStatus.PENDING) {
      return { canPurchase: false, reason: 'Age verification pending' };
    }

    if (verification.status === AgeVerificationStatus.REJECTED) {
      return { canPurchase: false, reason: 'Age verification rejected' };
    }

    if (!verification.meetsMinimumAge) {
      return { canPurchase: false, reason: `Must be at least ${config.regulatory.minAgeRequirement} years old` };
    }

    return { canPurchase: true };
  }

  async findByStatus(status: AgeVerificationStatus): Promise<PlayerAgeVerification[]> {
    return this.repository.find({
      where: { status },
      order: { lastAttemptAt: 'DESC' },
    });
  }

  async countByStatus(status: AgeVerificationStatus): Promise<number> {
    return this.repository.count({ where: { status } });
  }

  async resetVerification(playerId: string): Promise<PlayerAgeVerification> {
    let verification = await this.getVerification(playerId);

    verification.status = AgeVerificationStatus.UNVERIFIED;
    verification.dateOfBirth = null;
    verification.calculatedAge = null;
    verification.meetsMinimumAge = false;
    verification.verifiedAt = null;
    verification.verificationMethod = null;
    verification.documentId = null;
    verification.rejectionReason = null;

    verification = await this.repository.save(verification);
    return verification;
  }
}
