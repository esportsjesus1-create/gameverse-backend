import { ProbabilityService } from '../services/probability.service';
import { Rarity, RarityRates, PityConfig, StatisticalValidationResult } from '../types';

const DEFAULT_PITY_CONFIG: PityConfig = {
  softPityStart: 74,
  hardPity: 90,
  softPityRateIncrease: 0.06,
  guaranteedFeaturedAfterLoss: true,
};

const DEFAULT_BASE_RATES: RarityRates = {
  [Rarity.COMMON]: 0.513,
  [Rarity.RARE]: 0.43,
  [Rarity.EPIC]: 0.051,
  [Rarity.LEGENDARY]: 0.006,
  [Rarity.MYTHIC]: 0,
};

const DEFAULT_FEATURED_RATE = 0.5;

interface SimulationConfig {
  totalPulls: number;
  baseRates: RarityRates;
  pityConfig: PityConfig;
  featuredRate: number;
  batchSize: number;
  reportInterval: number;
}

interface SimulationState {
  distribution: Record<Rarity, number>;
  featuredCount: number;
  softPityTriggers: number;
  hardPityTriggers: number;
  pullsToLegendary: number[];
  currentPity: number;
  guaranteedFeatured: boolean;
  pullsSinceLastLegendary: number;
}

function runSimulation(config: SimulationConfig): StatisticalValidationResult {
  const probabilityService = new ProbabilityService();

  const state: SimulationState = {
    distribution: {
      [Rarity.COMMON]: 0,
      [Rarity.RARE]: 0,
      [Rarity.EPIC]: 0,
      [Rarity.LEGENDARY]: 0,
      [Rarity.MYTHIC]: 0,
    },
    featuredCount: 0,
    softPityTriggers: 0,
    hardPityTriggers: 0,
    pullsToLegendary: [],
    currentPity: 0,
    guaranteedFeatured: false,
    pullsSinceLastLegendary: 0,
  };

    const startTime = Date.now();

  for (let i = 0; i < config.totalPulls; i++) {
    const { rates: adjustedRates, isSoftPity, isHardPity } = probabilityService.calculateAdjustedRates(
      config.baseRates,
      config.pityConfig,
      state.currentPity
    );

    const { rarity } = probabilityService.rollRarity(adjustedRates, isSoftPity, isHardPity);
    state.distribution[rarity]++;
    state.pullsSinceLastLegendary++;

    if (rarity === Rarity.LEGENDARY || rarity === Rarity.MYTHIC) {
      state.pullsToLegendary.push(state.pullsSinceLastLegendary);
      state.pullsSinceLastLegendary = 0;

      if (isSoftPity) state.softPityTriggers++;
      if (isHardPity) state.hardPityTriggers++;

      const isFeatured = probabilityService.rollFeatured(config.featuredRate, state.guaranteedFeatured);

      if (isFeatured) {
        state.featuredCount++;
        state.guaranteedFeatured = false;
      } else {
        state.guaranteedFeatured = config.pityConfig.guaranteedFeaturedAfterLoss;
      }

      state.currentPity = 0;
    } else {
      state.currentPity++;
    }

    if ((i + 1) % config.reportInterval === 0) {
      const currentTime = Date.now();
      const elapsed = (currentTime - startTime) / 1000;
      const pullsPerSecond = (i + 1) / elapsed;
      const progress = ((i + 1) / config.totalPulls * 100).toFixed(2);
      const eta = ((config.totalPulls - i - 1) / pullsPerSecond).toFixed(1);

            console.log(`Progress: ${progress}% | Pulls: ${i + 1}/${config.totalPulls} | Speed: ${pullsPerSecond.toFixed(0)} pulls/sec | ETA: ${eta}s`);
    }
  }

  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;

  state.pullsToLegendary.sort((a, b) => a - b);

  const legendaryCount = state.distribution[Rarity.LEGENDARY] + state.distribution[Rarity.MYTHIC];

  const averagePullsToLegendary = state.pullsToLegendary.length > 0
    ? state.pullsToLegendary.reduce((sum, val) => sum + val, 0) / state.pullsToLegendary.length
    : 0;

  const medianPullsToLegendary = state.pullsToLegendary.length > 0
    ? state.pullsToLegendary[Math.floor(state.pullsToLegendary.length / 2)]
    : 0;

  const percentile90PullsToLegendary = state.pullsToLegendary.length > 0
    ? state.pullsToLegendary[Math.floor(state.pullsToLegendary.length * 0.9)]
    : 0;

  const actualFeaturedRate = legendaryCount > 0 ? state.featuredCount / legendaryCount : 0;
  const pityTriggerRate = legendaryCount > 0 ? (state.softPityTriggers + state.hardPityTriggers) / legendaryCount : 0;

  const { chiSquare, pValue, isWithinTolerance } = probabilityService.calculateChiSquare(
    state.distribution,
    config.baseRates,
    config.totalPulls
  );

  console.log('\n========== SIMULATION COMPLETE ==========');
  console.log(`Total Pulls: ${config.totalPulls.toLocaleString()}`);
  console.log(`Total Time: ${totalTime.toFixed(2)}s`);
  console.log(`Speed: ${(config.totalPulls / totalTime).toFixed(0)} pulls/sec`);
  console.log('\n--- Rarity Distribution ---');

  for (const rarity of Object.values(Rarity)) {
    const count = state.distribution[rarity];
    const actualRate = count / config.totalPulls;
    const expectedRate = config.baseRates[rarity];
    const deviation = expectedRate > 0 ? ((actualRate - expectedRate) / expectedRate * 100).toFixed(2) : 'N/A';
    console.log(`${rarity}: ${count.toLocaleString()} (${(actualRate * 100).toFixed(4)}%) | Expected: ${(expectedRate * 100).toFixed(4)}% | Deviation: ${deviation}%`);
  }

  console.log('\n--- Pity Statistics ---');
  console.log(`Legendary Count: ${legendaryCount.toLocaleString()}`);
  console.log(`Average Pulls to Legendary: ${averagePullsToLegendary.toFixed(2)}`);
  console.log(`Median Pulls to Legendary: ${medianPullsToLegendary}`);
  console.log(`90th Percentile: ${percentile90PullsToLegendary}`);
  console.log(`Soft Pity Triggers: ${state.softPityTriggers.toLocaleString()} (${(state.softPityTriggers / legendaryCount * 100).toFixed(2)}%)`);
  console.log(`Hard Pity Triggers: ${state.hardPityTriggers.toLocaleString()} (${(state.hardPityTriggers / legendaryCount * 100).toFixed(2)}%)`);

  console.log('\n--- Featured Item Statistics ---');
  console.log(`Featured Count: ${state.featuredCount.toLocaleString()}`);
  console.log(`Actual Featured Rate: ${(actualFeaturedRate * 100).toFixed(2)}%`);
  console.log(`Expected Featured Rate: ${(config.featuredRate * 100).toFixed(2)}%`);

  console.log('\n--- Statistical Validation ---');
  console.log(`Chi-Square Value: ${chiSquare.toFixed(4)}`);
  console.log(`P-Value: ${pValue.toFixed(6)}`);
  console.log(`Within Tolerance: ${isWithinTolerance ? 'YES' : 'NO'}`);

  return {
    totalPulls: config.totalPulls,
    rarityDistribution: state.distribution,
    expectedDistribution: config.baseRates,
    chiSquareValue: chiSquare,
    pValue,
    isWithinTolerance,
    averagePullsToLegendary,
    medianPullsToLegendary,
    percentile90PullsToLegendary,
    featuredRate: actualFeaturedRate,
    expectedFeaturedRate: config.featuredRate,
    pityTriggerRate,
    softPityTriggerRate: legendaryCount > 0 ? state.softPityTriggers / legendaryCount : 0,
    hardPityTriggerRate: legendaryCount > 0 ? state.hardPityTriggers / legendaryCount : 0,
    timestamp: new Date(),
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const pullCount = args[0] ? parseInt(args[0], 10) : 1000000;

  console.log('========== GACHA STATISTICAL VALIDATION ==========');
  console.log(`Starting simulation with ${pullCount.toLocaleString()} pulls...`);
  console.log('');

  const config: SimulationConfig = {
    totalPulls: pullCount,
    baseRates: DEFAULT_BASE_RATES,
    pityConfig: DEFAULT_PITY_CONFIG,
    featuredRate: DEFAULT_FEATURED_RATE,
    batchSize: 10000,
    reportInterval: 100000,
  };

  const result = runSimulation(config);

  console.log('\n========== VALIDATION RESULT ==========');
  if (result.isWithinTolerance) {
    console.log('PASSED: Drop rates are within statistical tolerance');
  } else {
    console.log('FAILED: Drop rates deviate significantly from expected values');
  }

  process.exit(result.isWithinTolerance ? 0 : 1);
}

main();
