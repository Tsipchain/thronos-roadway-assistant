import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis?: Redis | null };

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[Redis] REDIS_URL not set — Redis features disabled');
    return null;
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  client.on('error', (err) => {
    console.error('[Redis] connection error:', err.message);
  });

  return client;
}

export const redis: Redis | null =
  globalForRedis.redis !== undefined
    ? globalForRedis.redis
    : (globalForRedis.redis = createRedisClient());

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

if (typeof process !== 'undefined' && redis) {
  process.on('beforeExit', () => redis.disconnect());
}
