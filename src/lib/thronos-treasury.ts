/**
 * Thronos Treasury & Pytheia Governance Integration
 *
 * Platform wallet (Pytheia): THR24d877dd21c6b0c9d8a702f24842fc34052a5689
 *
 * This module monitors:
 * - AI Pool rewards distribution
 * - Treasury balance and metrics
 * - Governance decisions from Pytheia
 * - Attestation records for all transactions
 */

import { redis } from './redis';

const PLATFORM_WALLET = 'THR24d877dd21c6b0c9d8a702f24842fc34052a5689';
const THRONOS_NODE = process.env.THRONOS_NODE_URL || 'https://thrchain.up.railway.app';
const PYTHEIA_ENDPOINT = `${THRONOS_NODE}/api/governance/ai_overview`;
const ATTESTATION_ENDPOINT = process.env.THRONOS_ATTESTATION_ENDPOINT;
const ATTESTATION_API_KEY = process.env.THRONOS_ATTESTATION_API_KEY;

export interface TreasuryMetrics {
  platform_wallet: string;
  ai_pool_balance: number;
  total_ai_rewards: number;
  total_music_tips: number;
  iot_telemetry_txs_24h: number;
  music_tips_24h: number;
  miners_online: number;
  last_distribution_time: string;
  node_role: string;
  is_read_only: boolean;
  timestamp: string;
}

export interface AttestationPayload {
  type: string;
  wallet: string;
  amount?: number;
  details: Record<string, any>;
  timestamp: string;
}

/**
 * Fetch Pytheia governance metrics for treasury monitoring.
 */
export async function fetchTreasuryMetrics(): Promise<TreasuryMetrics | null> {
  try {
    const response = await fetch(PYTHEIA_ENDPOINT, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error(`[Pytheia] Status ${response.status}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    if (!data.ok) {
      console.error('[Pytheia] API error:', data.error);
      return null;
    }

    return {
      platform_wallet: PLATFORM_WALLET,
      ai_pool_balance: data.overview?.ai_pool_balance ?? 0,
      total_ai_rewards: data.overview?.total_ai_rewards ?? 0,
      total_music_tips: data.overview?.total_music_tips ?? 0,
      iot_telemetry_txs_24h: data.overview?.iot_telemetry_txs_last_24h ?? 0,
      music_tips_24h: data.overview?.music_tips_amount_last_24h ?? 0,
      miners_online: data.overview?.miners_online_estimate ?? 0,
      last_distribution_time: data.overview?.last_distribution_time ?? '',
      node_role: data.overview?.node_role ?? 'unknown',
      is_read_only: data.overview?.read_only ?? false,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[Pytheia] Fetch failed:', (err as Error).message);
    return null;
  }
}

/**
 * Cache treasury metrics in Redis (5 min TTL).
 */
export async function cacheTreasuryMetrics(
  metrics: TreasuryMetrics,
): Promise<void> {
  try {
    await redis.setex(
      'thronos:treasury:metrics',
      300, // 5 minutes
      JSON.stringify(metrics),
    );
  } catch (err) {
    console.warn('[Treasury Cache] Set failed:', (err as Error).message);
  }
}

/**
 * Get cached treasury metrics (or fetch fresh if expired).
 */
export async function getTreasuryMetrics(): Promise<TreasuryMetrics | null> {
  try {
    // Try cache first
    const cached = await redis.get('thronos:treasury:metrics');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn('[Treasury Cache] Get failed:', (err as Error).message);
  }

  // Fetch fresh from Pytheia
  const metrics = await fetchTreasuryMetrics();
  if (metrics) {
    await cacheTreasuryMetrics(metrics);
  }
  return metrics;
}

/**
 * Record attestation on-chain for treasury operations.
 */
export async function attestTreasuryTransaction(
  payload: AttestationPayload,
): Promise<string | null> {
  if (!ATTESTATION_ENDPOINT || !ATTESTATION_API_KEY) {
    console.warn('[Attestation] Endpoint or API key not configured');
    return null;
  }

  try {
    const response = await fetch(ATTESTATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ATTESTATION_API_KEY,
      },
      body: JSON.stringify({
        ...payload,
        wallet: PLATFORM_WALLET,
      }),
    });

    if (!response.ok) {
      console.error(`[Attestation] Status ${response.status}`);
      return null;
    }

    const data = await response.json();
    const txHash = data.tx_hash || data.txHash || data.hash;
    if (txHash) {
      console.log(`[Attestation] Recorded: ${txHash}`);
    }
    return txHash || null;
  } catch (err) {
    console.error('[Attestation] Failed:', (err as Error).message);
    return null;
  }
}

/**
 * Monitor treasury health (AI pool, rewards, etc.).
 * Call this periodically (e.g., every 5 minutes).
 */
export async function monitorTreasuryHealth(): Promise<{
  healthy: boolean;
  alerts: string[];
  metrics: TreasuryMetrics | null;
}> {
  const metrics = await getTreasuryMetrics();
  const alerts: string[] = [];

  if (!metrics) {
    return {
      healthy: false,
      alerts: ['Failed to fetch Pytheia metrics'],
      metrics: null,
    };
  }

  // Alert conditions
  if (metrics.ai_pool_balance < 10) {
    alerts.push(`Low AI pool balance: ${metrics.ai_pool_balance} THR`);
  }

  if (metrics.is_read_only && metrics.node_role === 'master') {
    alerts.push('Node is in read-only mode (unexpected for master)');
  }

  if (metrics.miners_online < 2) {
    alerts.push(`Low miner count: ${metrics.miners_online}`);
  }

  // Record attestation for health check
  if (metrics) {
    await attestTreasuryTransaction({
      type: 'treasury_health_check',
      wallet: PLATFORM_WALLET,
      details: {
        ai_pool_balance: metrics.ai_pool_balance,
        total_ai_rewards: metrics.total_ai_rewards,
        iot_telemetry_24h: metrics.iot_telemetry_txs_24h,
        miners_online: metrics.miners_online,
        alerts_count: alerts.length,
      },
      timestamp: new Date().toISOString(),
    });
  }

  return {
    healthy: alerts.length === 0,
    alerts,
    metrics,
  };
}

/**
 * Get platform wallet address.
 */
export function getPlatformWallet(): string {
  return PLATFORM_WALLET;
}
