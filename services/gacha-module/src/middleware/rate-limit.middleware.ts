import rateLimit from 'express-rate-limit';
import { config } from '../config';

export const generalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const pullRateLimiter = rateLimit({
  windowMs: config.rateLimit.pullWindowMs,
  max: config.rateLimit.pullMaxRequests,
  message: {
    success: false,
    error: 'Pull rate limit exceeded, please wait before pulling again',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body?.playerId || req.ip || 'unknown';
  },
});

export const currencyRateLimiter = rateLimit({
  windowMs: 60000,
  max: 30,
  message: {
    success: false,
    error: 'Currency operation rate limit exceeded',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body?.playerId || req.params?.playerId || req.ip || 'unknown';
  },
});

export const adminRateLimiter = rateLimit({
  windowMs: 60000,
  max: 100,
  message: {
    success: false,
    error: 'Admin rate limit exceeded',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});
