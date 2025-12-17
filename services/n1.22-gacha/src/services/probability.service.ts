import crypto from 'crypto';
import { Rarity, RarityRates, PityConfig } from '../types';

export interface ProbabilityResult {
  rarity: Rarity;
  roll: number;
  adjustedRates: RarityRates;
}

export class ProbabilityService {
  private generateSecureRandom(): number {
    const buffer = crypto.randomBytes(4);
    const value = buffer.readUInt32BE(0);
    return value / 0xffffffff;
  }

  calculateAdjustedRates(
    baseRates: RarityRates,
    pityConfig: PityConfig,
    currentPity: number
  ): RarityRates {
    const adjustedRates = { ...baseRates };

    if (currentPity >= pityConfig.hardPity - 1) {
      adjustedRates[Rarity.LEGENDARY] = 1.0;
      adjustedRates[Rarity.EPIC] = 0;
      adjustedRates[Rarity.RARE] = 0;
      adjustedRates[Rarity.COMMON] = 0;
      adjustedRates[Rarity.MYTHIC] = 0;
      return adjustedRates;
    }

    if (currentPity >= pityConfig.softPityStart) {
      const pullsIntoSoftPity = currentPity - pityConfig.softPityStart + 1;
      const additionalRate = pullsIntoSoftPity * pityConfig.softPityRateIncrease;
      const newLegendaryRate = Math.min(
        baseRates[Rarity.LEGENDARY] + additionalRate,
        1.0
      );

      const rateIncrease = newLegendaryRate - baseRates[Rarity.LEGENDARY];
      adjustedRates[Rarity.LEGENDARY] = newLegendaryRate;

      const totalNonLegendary =
        baseRates[Rarity.COMMON] +
        baseRates[Rarity.RARE] +
        baseRates[Rarity.EPIC] +
        baseRates[Rarity.MYTHIC];

      if (totalNonLegendary > 0) {
        const scaleFactor = (totalNonLegendary - rateIncrease) / totalNonLegendary;
        adjustedRates[Rarity.COMMON] = Math.max(0, baseRates[Rarity.COMMON] * scaleFactor);
        adjustedRates[Rarity.RARE] = Math.max(0, baseRates[Rarity.RARE] * scaleFactor);
        adjustedRates[Rarity.EPIC] = Math.max(0, baseRates[Rarity.EPIC] * scaleFactor);
        adjustedRates[Rarity.MYTHIC] = Math.max(0, baseRates[Rarity.MYTHIC] * scaleFactor);
      }
    }

    return this.normalizeRates(adjustedRates);
  }

  private normalizeRates(rates: RarityRates): RarityRates {
    const total = Object.values(rates).reduce((sum, rate) => sum + rate, 0);

    if (Math.abs(total - 1.0) < 0.0001) {
      return rates;
    }

    const normalized: RarityRates = {
      [Rarity.COMMON]: rates[Rarity.COMMON] / total,
      [Rarity.RARE]: rates[Rarity.RARE] / total,
      [Rarity.EPIC]: rates[Rarity.EPIC] / total,
      [Rarity.LEGENDARY]: rates[Rarity.LEGENDARY] / total,
      [Rarity.MYTHIC]: rates[Rarity.MYTHIC] / total,
    };

    return normalized;
  }

  rollRarity(adjustedRates: RarityRates): ProbabilityResult {
    const roll = this.generateSecureRandom();

    const rarityOrder: Rarity[] = [
      Rarity.MYTHIC,
      Rarity.LEGENDARY,
      Rarity.EPIC,
      Rarity.RARE,
      Rarity.COMMON,
    ];

    let cumulative = 0;
    for (const rarity of rarityOrder) {
      cumulative += adjustedRates[rarity];
      if (roll < cumulative) {
        return { rarity, roll, adjustedRates };
      }
    }

    return { rarity: Rarity.COMMON, roll, adjustedRates };
  }

  rollFeatured(featuredRate: number, guaranteedFeatured: boolean): boolean {
    if (guaranteedFeatured) {
      return true;
    }

    const roll = this.generateSecureRandom();
    return roll < featuredRate;
  }

  selectRandomItem<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot select from empty item pool');
    }

    const index = Math.floor(this.generateSecureRandom() * items.length);
    return items[index];
  }

  selectWeightedItem<T extends { weight?: number }>(items: T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot select from empty item pool');
    }

    const totalWeight = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
    let roll = this.generateSecureRandom() * totalWeight;

    for (const item of items) {
      roll -= item.weight ?? 1;
      if (roll <= 0) {
        return item;
      }
    }

    return items[items.length - 1];
  }

  calculateExpectedPulls(
    baseRate: number,
    pityConfig: PityConfig
  ): { average: number; median: number; percentile90: number } {
    const simulations = 10000;
    const results: number[] = [];

    for (let i = 0; i < simulations; i++) {
      let pulls = 0;
      let pity = 0;

      while (true) {
        pulls++;
        pity++;

        const adjustedRate = this.calculateSinglePullRate(baseRate, pityConfig, pity);
        const roll = this.generateSecureRandom();

        if (roll < adjustedRate) {
          results.push(pulls);
          break;
        }

        if (pity >= pityConfig.hardPity) {
          results.push(pulls);
          break;
        }
      }
    }

    results.sort((a, b) => a - b);

    const average = results.reduce((sum, val) => sum + val, 0) / results.length;
    const median = results[Math.floor(results.length / 2)];
    const percentile90 = results[Math.floor(results.length * 0.9)];

    return { average, median, percentile90 };
  }

  private calculateSinglePullRate(
    baseRate: number,
    pityConfig: PityConfig,
    currentPity: number
  ): number {
    if (currentPity >= pityConfig.hardPity) {
      return 1.0;
    }

    if (currentPity >= pityConfig.softPityStart) {
      const pullsIntoSoftPity = currentPity - pityConfig.softPityStart + 1;
      return Math.min(baseRate + pullsIntoSoftPity * pityConfig.softPityRateIncrease, 1.0);
    }

    return baseRate;
  }

  validateRates(rates: RarityRates): { valid: boolean; error?: string } {
    const total = Object.values(rates).reduce((sum, rate) => sum + rate, 0);

    if (Math.abs(total - 1.0) > 0.01) {
      return { valid: false, error: `Rates must sum to 1.0, got ${total}` };
    }

    for (const [rarity, rate] of Object.entries(rates)) {
      if (rate < 0 || rate > 1) {
        return { valid: false, error: `Invalid rate for ${rarity}: ${rate}` };
      }
    }

    return { valid: true };
  }
}
