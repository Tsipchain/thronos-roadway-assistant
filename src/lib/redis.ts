import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis?: Redis };

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL environment variable is not set');
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

export const redis: Redis =
  globalForRedis.redis ?? (globalForRedis.redis = createRedisClient());

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => redis.disconnect());
}
