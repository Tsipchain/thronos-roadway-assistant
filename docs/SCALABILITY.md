# Scalability Plan — 10k Concurrent Users

## Architecture

### Multi-Instance Deployment
```
Railway LB
├─ Instance 1 (Next.js + Socket.IO) — 2xCPU, 2GB RAM
├─ Instance 2 (Next.js + Socket.IO) — 2xCPU, 2GB RAM
└─ Instance 3 (Async jobs) — 1xCPU, 1GB RAM

Database: Neon PostgreSQL + connection pooling (50 per instance)
Cache: Railway Redis 4GB (with eviction policy: allkeys-lru)
```

### Socket.IO Redis Adapter
```typescript
// For cross-instance real-time communication
import { createAdapter } from '@socket.io/redis-adapter';
const io = new Server(server);
io.adapter(createAdapter(redis, redis.duplicate()));
```

### Cache Layers
- **Technician locations**: Redis GEO (TTL: 2 min, ~5MB)
- **User sessions**: Redis (TTL: 24h, ~10MB per 1k users)
- **Rate limiting**: Sliding window (TTL: 1 min)
- **Treasury metrics**: JSON cache (TTL: 5 min, ~1MB)

## Database Pooling
```typescript
const pool = new Pool({
  max: 50,              // per instance
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Load Testing Targets
- API: 1,000 req/sec sustained
- WebSocket: 5,000 concurrent connections
- Redis: 10,000 ops/sec
- Database: 100 concurrent connections
