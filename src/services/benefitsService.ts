import { pool } from '../config/database';
import { CACHE_KEYS, CACHE_TTL, cacheGet, cacheSet, cacheDelete } from '../config/redis';
import { PartyBenefit, BenefitType, CalculatedBenefits } from '../types';
import { partyService } from './partyService';

export class BenefitsService {
  async getAllBenefits(): Promise<PartyBenefit[]> {
    const result = await pool.query(
      'SELECT * FROM party_benefits WHERE is_active = true ORDER BY min_party_size ASC, type ASC'
    );

    return result.rows.map((row: Record<string, unknown>) => this.mapBenefitRow(row));
  }

  async getBenefit(benefitId: string): Promise<PartyBenefit | null> {
    const result = await pool.query(
      'SELECT * FROM party_benefits WHERE id = $1',
      [benefitId]
    );

    if (result.rows.length === 0) return null;
    return this.mapBenefitRow(result.rows[0]);
  }

  async getApplicableBenefits(partySize: number): Promise<PartyBenefit[]> {
    const result = await pool.query(
      `SELECT * FROM party_benefits 
       WHERE is_active = true 
         AND min_party_size <= $1 
         AND (max_party_size IS NULL OR max_party_size >= $1)
       ORDER BY type ASC, value DESC`,
      [partySize]
    );

    return result.rows.map((row: Record<string, unknown>) => this.mapBenefitRow(row));
  }

  async calculatePartyBenefits(partyId: string): Promise<CalculatedBenefits> {
    const cached = await cacheGet<CalculatedBenefits>(CACHE_KEYS.PARTY_BENEFITS(partyId));
    if (cached) return cached;

    const party = await partyService.getParty(partyId);
    if (!party) {
      throw new Error('Party not found');
    }

    const memberCount = await partyService.getPartyMemberCount(partyId);
    const applicableBenefits = await this.getApplicableBenefits(memberCount);

    const benefits: CalculatedBenefits = {
      xpMultiplier: 1.0,
      lootBonus: 0,
      achievementBonus: 0,
      dropRateBonus: 0,
      exclusiveRewards: [],
      totalBonusPercentage: 0,
    };

    for (const benefit of applicableBenefits) {
      switch (benefit.type) {
        case BenefitType.XP_MULTIPLIER:
          if (benefit.value > benefits.xpMultiplier) {
            benefits.xpMultiplier = benefit.value;
          }
          break;
        case BenefitType.LOOT_BONUS:
          benefits.lootBonus += benefit.value;
          break;
        case BenefitType.ACHIEVEMENT_BONUS:
          benefits.achievementBonus += benefit.value;
          break;
        case BenefitType.DROP_RATE_BONUS:
          benefits.dropRateBonus += benefit.value;
          break;
        case BenefitType.EXCLUSIVE_REWARD:
          benefits.exclusiveRewards.push(benefit.name);
          break;
      }
    }

    benefits.totalBonusPercentage = 
      ((benefits.xpMultiplier - 1) * 100) +
      (benefits.lootBonus * 100) +
      (benefits.achievementBonus * 100) +
      (benefits.dropRateBonus * 100);

    await cacheSet(CACHE_KEYS.PARTY_BENEFITS(partyId), benefits, CACHE_TTL.PARTY_BENEFITS);
    return benefits;
  }

  async getPartyBenefitsSummary(partyId: string): Promise<{
    partySize: number;
    benefits: CalculatedBenefits;
    applicableBenefits: PartyBenefit[];
    nextTierBenefits: PartyBenefit[];
  }> {
    const party = await partyService.getParty(partyId);
    if (!party) {
      throw new Error('Party not found');
    }

    const memberCount = await partyService.getPartyMemberCount(partyId);
    const benefits = await this.calculatePartyBenefits(partyId);
    const applicableBenefits = await this.getApplicableBenefits(memberCount);
    const nextTierBenefits = await this.getNextTierBenefits(memberCount);

    return {
      partySize: memberCount,
      benefits,
      applicableBenefits,
      nextTierBenefits,
    };
  }

  async getNextTierBenefits(currentSize: number): Promise<PartyBenefit[]> {
    const result = await pool.query(
      `SELECT * FROM party_benefits 
       WHERE is_active = true AND min_party_size > $1
       ORDER BY min_party_size ASC, type ASC`,
      [currentSize]
    );

    const benefits = result.rows.map((row: Record<string, unknown>) => this.mapBenefitRow(row));
    
    if (benefits.length === 0) return [];

    const nextMinSize = benefits[0].minPartySize;
    return benefits.filter((b: PartyBenefit) => b.minPartySize === nextMinSize);
  }

  async applyXPBonus(partyId: string, baseXP: number): Promise<{ baseXP: number; bonusXP: number; totalXP: number; multiplier: number }> {
    const benefits = await this.calculatePartyBenefits(partyId);
    const bonusXP = Math.floor(baseXP * (benefits.xpMultiplier - 1));
    const totalXP = baseXP + bonusXP;

    return {
      baseXP,
      bonusXP,
      totalXP,
      multiplier: benefits.xpMultiplier,
    };
  }

  async applyLootBonus(partyId: string, baseLootChance: number): Promise<{ baseChance: number; bonusChance: number; totalChance: number }> {
    const benefits = await this.calculatePartyBenefits(partyId);
    const bonusChance = baseLootChance * benefits.lootBonus;
    const totalChance = Math.min(baseLootChance + bonusChance, 1.0);

    return {
      baseChance: baseLootChance,
      bonusChance,
      totalChance,
    };
  }

  async applyDropRateBonus(partyId: string, baseDropRate: number): Promise<{ baseRate: number; bonusRate: number; totalRate: number }> {
    const benefits = await this.calculatePartyBenefits(partyId);
    const bonusRate = baseDropRate * benefits.dropRateBonus;
    const totalRate = Math.min(baseDropRate + bonusRate, 1.0);

    return {
      baseRate: baseDropRate,
      bonusRate,
      totalRate,
    };
  }

  async applyAchievementBonus(partyId: string, baseProgress: number): Promise<{ baseProgress: number; bonusProgress: number; totalProgress: number }> {
    const benefits = await this.calculatePartyBenefits(partyId);
    const bonusProgress = baseProgress * benefits.achievementBonus;
    const totalProgress = baseProgress + bonusProgress;

    return {
      baseProgress,
      bonusProgress,
      totalProgress,
    };
  }

  async getExclusiveRewards(partyId: string): Promise<string[]> {
    const benefits = await this.calculatePartyBenefits(partyId);
    return benefits.exclusiveRewards;
  }

  async invalidatePartyBenefitsCache(partyId: string): Promise<void> {
    await cacheDelete(CACHE_KEYS.PARTY_BENEFITS(partyId));
  }

  async createBenefit(benefit: Omit<PartyBenefit, 'id'>): Promise<PartyBenefit> {
    const result = await pool.query(
      `INSERT INTO party_benefits (name, description, type, value, min_party_size, max_party_size, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [benefit.name, benefit.description, benefit.type, benefit.value, benefit.minPartySize, benefit.maxPartySize || null, benefit.isActive]
    );

    return this.mapBenefitRow(result.rows[0]);
  }

  async updateBenefit(benefitId: string, updates: Partial<Omit<PartyBenefit, 'id'>>): Promise<PartyBenefit> {
    const existing = await this.getBenefit(benefitId);
    if (!existing) {
      throw new Error('Benefit not found');
    }

    const updateFields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.type !== undefined) {
      updateFields.push(`type = $${paramIndex++}`);
      values.push(updates.type);
    }
    if (updates.value !== undefined) {
      updateFields.push(`value = $${paramIndex++}`);
      values.push(updates.value);
    }
    if (updates.minPartySize !== undefined) {
      updateFields.push(`min_party_size = $${paramIndex++}`);
      values.push(updates.minPartySize);
    }
    if (updates.maxPartySize !== undefined) {
      updateFields.push(`max_party_size = $${paramIndex++}`);
      values.push(updates.maxPartySize);
    }
    if (updates.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (updateFields.length === 0) {
      return existing;
    }

    values.push(benefitId);

    const result = await pool.query(
      `UPDATE party_benefits SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return this.mapBenefitRow(result.rows[0]);
  }

  async deleteBenefit(benefitId: string): Promise<void> {
    await pool.query('DELETE FROM party_benefits WHERE id = $1', [benefitId]);
  }

  async toggleBenefitActive(benefitId: string, isActive: boolean): Promise<PartyBenefit> {
    const result = await pool.query(
      'UPDATE party_benefits SET is_active = $1 WHERE id = $2 RETURNING *',
      [isActive, benefitId]
    );

    if (result.rows.length === 0) {
      throw new Error('Benefit not found');
    }

    return this.mapBenefitRow(result.rows[0]);
  }

  private mapBenefitRow(row: Record<string, unknown>): PartyBenefit {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      type: row.type as BenefitType,
      value: parseFloat(row.value as string),
      minPartySize: row.min_party_size as number,
      maxPartySize: row.max_party_size as number | undefined,
      isActive: row.is_active as boolean,
    };
  }
}

export const benefitsService = new BenefitsService();
