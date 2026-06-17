import Redis from 'ioredis';
import { env } from './env';

function buildRedisOptions() {
  const url = env.REDIS_URL;
  const parsed = new URL(url);
  const isTls = url.startsWith('rediss://');

  return {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port || (isTls ? '6380' : '6379'), 10),
    password: parsed.password || undefined,
    username: parsed.username && parsed.username !== 'default' ? parsed.username : undefined,
    ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
  };
}

// Used by BullMQ — must be a plain options object, not a URL string
export const redisConnection = buildRedisOptions();

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const opts = buildRedisOptions();
    redis = new Redis({
      ...opts,
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      // Log but don't crash — Redis is non-critical for most routes
      console.error('[Redis] Connection error:', err.message);
    });
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  try {
    const r = getRedis();
    await Promise.race([
      r.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    console.log('[Redis] Connected');
  } catch (err) {
    console.warn('[Redis] Could not connect — some features may be unavailable:', (err as Error).message);
  }
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
