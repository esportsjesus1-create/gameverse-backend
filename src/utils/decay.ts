import { DecayConfig } from '../types/leaderboard';

const DEFAULT_DECAY_CONFIG: DecayConfig = {
  halfLifeDays: 30,
  minScore: 0,
  decayIntervalHours: 1,
};

export const calculateDecayedScore = (
  rawScore: number,
  submittedAt: Date,
  currentTime: Date = new Date(),
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): number => {
  const elapsedMs = currentTime.getTime() - submittedAt.getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  
  if (elapsedDays <= 0) {
    return rawScore;
  }

  const decayFactor = Math.pow(0.5, elapsedDays / config.halfLifeDays);
  const decayedScore = rawScore * decayFactor;

  return Math.max(decayedScore, config.minScore);
};

export const calculateDecayFactor = (
  elapsedDays: number,
  halfLifeDays: number = DEFAULT_DECAY_CONFIG.halfLifeDays
): number => {
  if (elapsedDays <= 0) {
    return 1;
  }
  return Math.pow(0.5, elapsedDays / halfLifeDays);
};

export const getTimeUntilHalfDecay = (
  halfLifeDays: number = DEFAULT_DECAY_CONFIG.halfLifeDays
): number => {
  return halfLifeDays * 24 * 60 * 60 * 1000;
};

export const shouldApplyDecay = (
  lastDecayAt: Date,
  currentTime: Date = new Date(),
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): boolean => {
  const elapsedMs = currentTime.getTime() - lastDecayAt.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  return elapsedHours >= config.decayIntervalHours;
};

export const getDecayConfig = (): DecayConfig => {
  return {
    halfLifeDays: parseFloat(process.env.DECAY_HALF_LIFE_DAYS || '30'),
    minScore: parseFloat(process.env.DECAY_MIN_SCORE || '0'),
    decayIntervalHours: parseFloat(process.env.DECAY_INTERVAL_HOURS || '1'),
  };
};
