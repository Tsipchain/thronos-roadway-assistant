# Phase 6: Deployment & Polish

Production deployment guide for Thronos Roadway MVP to Railway infrastructure.

## Pre-Deployment Checklist

### Environment Setup
- [ ] `.env.production` configured with all required variables
- [ ] Stripe webhook endpoint registered at `https://{domain}/api/stripe/webhooks`
- [ ] Thronos chain RPC endpoints accessible and tested
- [ ] PostgreSQL database migrated and seeded
- [ ] Redis instance configured for session and location cache

### Required Environment Variables

```
# Next.js
NEXTAUTH_URL=https://thronos-roadway.railway.app
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>

# Database
DATABASE_URL=postgresql://user:pass@host:5432/thronos_roadway
REDIS_URL=redis://host:port

# Stripe
STRIPE_PUBLIC_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_ANNUAL_PRICE_ID=price_xxx

# Thronos Chain
THRONOS_EVM_RPC_URL=https://thronos-rpc.example.com
THRONOS_CHAIN_ID=9999
THRONOS_ATTESTATION_API_KEY=xxx
THRONOS_PLATFORM_WALLET=THR24d877dd21c6b0c9d8a702f24842fc34052a5689

# Google Maps
GOOGLE_DISTANCE_MATRIX_KEY=xxx

# NextAuth Providers (optional)
GITHUB_ID=xxx
GITHUB_SECRET=xxx
```

## Deployment Steps

### 1. Database Migration

```bash
# Push Prisma schema to production
npm run db:push

# Optional: Generate migration file for version control
npx prisma migrate dev --name init
npx prisma migrate deploy
```

### 2. Build Verification

```bash
# Full build to catch any TypeScript/Next.js errors
npm run build

# Test production build locally
npm run start
```

### 3. Load Testing (Target: 1000 req/sec, 5000 concurrent WebSocket connections)

```bash
# Using k6 for load testing (install: https://k6.io/docs/getting-started/installation/)
k6 run scripts/load-test.js

# Key scenarios:
# - 100 concurrent customers creating requests
# - 50 concurrent technicians accepting/declining
# - 500 WebSocket connections for real-time updates
# - Dispatch matching with 5-second timeout escalation
```

### 4. Railway Deployment

#### Option A: CLI Deployment
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Create new project
railway init

# Link existing project
railway link <project-id>

# Deploy
railway up

# View logs
railway logs

# Set production env vars
railway env:set NEXTAUTH_URL=https://thronos-roadway.railway.app
railway env:set DATABASE_URL=postgresql://...
# ... set all variables from .env.production
```

#### Option B: GitHub Integration
1. Push to GitHub repository
2. Connect Railway to GitHub repo
3. Enable auto-deploy on push
4. Set environment variables in Railway dashboard
5. Railway automatically builds and deploys on each push

### 5. Post-Deployment Verification

```bash
# Health check endpoints
curl https://thronos-roadway.railway.app/api/health
# Expected response: { "ok": true, "timestamp": "..." }

# Test authentication flow
curl -X POST https://thronos-roadway.railway.app/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"xxx"}'

# Test dispatch creation
curl -X POST https://thronos-roadway.railway.app/api/dispatch/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"serviceType":"BATTERY_REPLACEMENT","latitude":37.98,"longitude":23.72}'

# Verify WebSocket connectivity
wscat -c wss://thronos-roadway.railway.app/socket.io/?EIO=4&transport=websocket
```

## Monitoring & Observability

### Key Metrics to Monitor

```
Application Metrics:
- Request latency (p50, p95, p99)
- Error rate (4xx, 5xx)
- WebSocket connection count and churn
- Dispatch matching success rate
- Payment processing latency
- Database connection pool usage
- Redis cache hit rate

Business Metrics:
- Requests created per minute
- Dispatch success rate (% accepted on first attempt)
- Average technician response time
- Customer satisfaction (review ratings)
- Revenue per completed request
```

### Setup Monitoring with Railway

1. **Logs**: Railway automatically captures stdout/stderr
   - View in dashboard or via `railway logs`
   - Set up log streaming to external service (e.g., Papertrail)

2. **Metrics**: Enable Railway monitoring
   - CPU usage
   - Memory usage
   - Network I/O
   - Build duration

3. **Custom Metrics**: Integrate APM service
   ```bash
   npm install @sentry/nextjs
   npm install datadog-browser-rum datadog-logs
   ```

### Error Handling & Alerts

```bash
# Example Sentry integration
npm install @sentry/nextjs

# In next.config.js:
const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(
  {
    // ... existing config
  },
  {
    org: "your-org",
    project: "thronos-roadway",
    authToken: process.env.SENTRY_AUTH_TOKEN,
  }
);
```

## Scaling Strategy

### Horizontal Scaling (Multiple Instances)

```
Architecture:
┌─────────────┐
│  Load       │
│  Balancer   │
└──────┬──────┘
       │
   ┌───┴────┬───────────┬───────────┐
   │        │           │           │
┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐
│ API │ │ API │ │ API │ │ API │  (n instances)
│ #1  │ │ #2  │ │ #3  │ │ #4  │
└──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘
   │        │      │       │
   └────────┼──────┼───────┘
        ┌───▼──────▼──┐
        │ Redis       │ (shared cache + Socket.IO adapter)
        │ Adapter     │
        └───┬──────┬──┘
            │      │
    ┌───────▼──┐┌──▼──────┐
    │PostgreSQL││Redis    │
    │Database  ││Cache    │
    └──────────┘└─────────┘
```

### Auto-Scaling Configuration (Railway)

```yaml
# railway.yaml for auto-scaling
scaling:
  minInstances: 2
  maxInstances: 10
  targetCPUUtilization: 70
  targetMemoryUtilization: 80
  scaleDownCooldown: 300
  scaleUpCooldown: 60
```

### Connection Pooling

```env
# Prisma connection pool settings (auto-configured for Railway)
DATABASE_URL="postgresql://user:pass@host/db?pgbouncer=true&connection_limit=20"

# Redis connection limits
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=100
```

## Backup & Recovery

### Database Backups

```bash
# PostgreSQL on Neon (automatic daily backups)
# - Automatic retention: 7 days
# - Point-in-time recovery available
# - Neon console: postgres.neon.tech

# Manual backup
pg_dump postgresql://user:pass@host:5432/db > backup-$(date +%Y%m%d).sql

# Restore from backup
psql postgresql://user:pass@host:5432/db < backup-20260507.sql
```

### Data Consistency

```bash
# Verify data integrity
npm run verify:data

# Check Thronos chain synchronization
npm run chain:verify-sync

# Audit payment reconciliation
npm run audit:payments
```

## Performance Optimization

### Frontend (Next.js)

```javascript
// next.config.js
module.exports = {
  // Enable SWR for API caching
  swcMinify: true,
  
  // Image optimization
  images: {
    domains: ['cdn.example.com'],
    formats: ['image/webp'],
  },
  
  // Compression
  compress: true,
  
  // HTTP/2 Server Push for critical resources
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react'],
  },
};
```

### Database Optimization

```sql
-- Key indexes for dispatch matching
CREATE INDEX idx_technician_location 
  ON "TechnicianProfile"(latitude, longitude, "isOnline", "isAvailable");

CREATE INDEX idx_service_request_status 
  ON "ServiceRequest"(status, "tenantId", "createdAt" DESC);

CREATE INDEX idx_dispatch_attempt_tech 
  ON "DispatchAttempt"("technicianId", status, "notifiedAt" DESC);

-- Analyze query performance
ANALYZE;
EXPLAIN ANALYZE SELECT ...;
```

### Redis Optimization

```
Max Memory Policy: allkeys-lru
Eviction: LRU eviction when 80% capacity reached
Connection Pooling: 50 max connections per instance
```

## Security Hardening

### CORS & Headers

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  return response;
}

export const config = {
  matcher: ['/((?!public|_next).*)'],
};
```

### Rate Limiting

```typescript
// lib/rate-limit.ts
import Ratelimit from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 h'),
});

// Usage in API routes
export async function POST(req: NextRequest) {
  const { success } = await ratelimit.limit(req.ip || '');
  if (!success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }
  // ... handler
}
```

## Rollback Procedures

### If Deployment Fails

```bash
# Railway automatic rollback
railway rollback <commit-sha>

# Or redeploy previous version
git reset --hard <previous-commit>
git push origin main  # Triggers new deployment
```

### Data Consistency After Rollback

```bash
# Verify no orphaned transactions
npm run verify:consistency

# Sync blockchain state if needed
npm run chain:sync
```

## Customer Onboarding

### First Customer Setup

1. **Create Tenant Account**
   ```bash
   curl -X POST /api/tenants \
     -d '{"name":"First Cust","slug":"first-cust"}'
   ```

2. **Add Admin User**
   ```bash
   curl -X POST /api/users \
     -d '{"email":"admin@firstcust.com","role":"ADMIN"}'
   ```

3. **Configure Service Areas**
   - Import from docs/sample-service-areas.json

4. **Set Pricing Rules**
   - Import default pricing from docs/default-pricing.json

5. **Add Team Members**
   - Bulk import from CSV file

## Monitoring Checklist

After deployment, monitor these for 24 hours:

- [ ] API response time < 500ms (p95)
- [ ] Error rate < 0.1%
- [ ] WebSocket connection stability
- [ ] Database query performance
- [ ] Redis cache hit rate > 80%
- [ ] Dispatch success rate > 95%
- [ ] Payment processing < 2s
- [ ] Memory usage stable
- [ ] CPU utilization < 70%
- [ ] No unhandled exceptions in logs

## Success Criteria

MVP is production-ready when:

1. **Performance**: <500ms p95 latency, 1000 req/sec throughput
2. **Reliability**: 99.5% uptime, <0.1% error rate
3. **Functionality**: All 6 phases complete and tested
4. **Scale**: 5000 concurrent WebSocket connections
5. **Security**: All OWASP top 10 mitigated
6. **Data**: PostgreSQL + Redis sync verified
7. **Monitoring**: Logs, metrics, alerts configured
8. **Documentation**: API docs, admin guide, user manual complete

## Support & Maintenance

### Scheduled Maintenance Windows

- Database maintenance: Sundays 02:00-03:00 UTC
- Deployment freeze: Friday PM - Monday AM
- Patch schedule: Every other Wednesday

### On-Call Escalation

1. Alert triggered → Pager duty notification
2. Check logs & metrics
3. If critical: Rollback previous version
4. Post-mortem within 24 hours

See `/docs/MAINTENANCE.md` for detailed runbooks.
