/**
 * Redis GEO-based technician location cache.
 *
 * Key layout:
 *   tech:locations        – Redis GEO set (all online technicians)
 *   tech:meta:{userId}    – Hash with isAvailable, specialties, rating, coverageRadiusKm
 *
 * TTL: technician entries expire after LOCATION_TTL_SECONDS if not refreshed.
 */

import { redis } from './redis';

const GEO_KEY = 'tech:locations';
const META_PREFIX = 'tech:meta:';
const LOCATION_TTL_SECONDS = 120; // 2 minutes without a ping = offline

export type TechMeta = {
  userId: string;
  isAvailable: boolean;
  specialties: string[];
  rating: number;
  coverageRadiusKm: number;
  name: string;
  phone: string;
};

/** Update or add a technician's location and metadata. */
export async function upsertTechnicianLocation(
  userId: string,
  longitude: number,
  latitude: number,
  meta: Omit<TechMeta, 'userId'>,
): Promise<void> {
  const metaKey = META_PREFIX + userId;

  await Promise.all([
    redis.geoadd(GEO_KEY, longitude, latitude, userId),
    redis.hset(metaKey, {
      isAvailable: meta.isAvailable ? '1' : '0',
      specialties: JSON.stringify(meta.specialties),
      rating: String(meta.rating),
      coverageRadiusKm: String(meta.coverageRadiusKm),
      name: meta.name,
      phone: meta.phone,
      updatedAt: String(Date.now()),
    }),
    redis.expire(metaKey, LOCATION_TTL_SECONDS),
  ]);
}

/** Remove a technician from the location cache (went offline). */
export async function removeTechnicianLocation(userId: string): Promise<void> {
  await Promise.all([
    redis.zrem(GEO_KEY, userId),
    redis.del(META_PREFIX + userId),
  ]);
}

export type NearbyResult = {
  userId: string;
  distanceKm: number;
  meta: TechMeta;
};

/**
 * Find technicians within radiusKm of a point.
 * Filters by serviceType and isAvailable; sorts by distance.
 */
export async function findNearbyInCache(
  latitude: number,
  longitude: number,
  radiusKm: number,
  serviceType: string,
): Promise<NearbyResult[]> {
  // GEORADIUS returns [member, dist] pairs when WITHCOORD/WITHDIST used
  const raw = await redis.georadius(
    GEO_KEY,
    longitude,
    latitude,
    radiusKm,
    'km',
    'WITHDIST',
    'ASC',
    'COUNT',
    '50',
  ) as Array<[string, string]>;

  if (!raw || raw.length === 0) return [];

  const results: NearbyResult[] = [];

  await Promise.all(
    raw.map(async ([userId, distStr]) => {
      const metaKey = META_PREFIX + userId;
      const h = await redis.hgetall(metaKey);
      if (!h || !h.isAvailable) return; // expired or missing

      if (h.isAvailable !== '1') return;

      const specialties: string[] = JSON.parse(h.specialties ?? '[]');
      if (!specialties.includes(serviceType)) return;

      const coverageRadiusKm = parseFloat(h.coverageRadiusKm ?? '15');
      const distanceKm = parseFloat(distStr);
      if (distanceKm > coverageRadiusKm) return;

      results.push({
        userId,
        distanceKm: Math.round(distanceKm * 100) / 100,
        meta: {
          userId,
          isAvailable: true,
          specialties,
          rating: parseFloat(h.rating ?? '5'),
          coverageRadiusKm,
          name: h.name ?? '',
          phone: h.phone ?? '',
        },
      });
    }),
  );

  return results.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 10);
}
