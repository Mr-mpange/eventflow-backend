import Redis from 'ioredis';
import { env } from './env';

export const redisConnection = {
  host: new URL(env.REDIS_URL).hostname || 'localhost',
  port: parseInt(new URL(env.REDIS_URL).port || '6379', 10),
  maxRetriesPerRequest: null as null,
};

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  await getRedis().ping();
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export const CACHE_TTL = {
  EVENT: 300,
  ANALYTICS: 600,
  USER: 180,
} as const;
