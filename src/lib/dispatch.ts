import { ServiceType } from '@prisma/client';
import { prisma } from './prisma';
import { distanceKm, estimateMinutes } from './geo';
import { findNearbyInCache, upsertTechnicianLocation } from './location-cache';

export type DispatchCandidate = {
  technicianUserId: string;
  technicianProfileId: string;
  name: string;
  phone: string;
  rating: number;
  distanceKm: number;
  estimatedMinutes: number;
};

export async function findNearbyTechnicians(input: {
  latitude: number;
  longitude: number;
  serviceType: ServiceType;
  maxRadiusKm?: number;
}): Promise<DispatchCandidate[]> {
  const maxRadiusKm = input.maxRadiusKm ?? 15;

  // Try Redis GEO cache first (fast path)
  try {
    const cached = await findNearbyInCache(
      input.latitude,
      input.longitude,
      maxRadiusKm,
      input.serviceType,
    );

    if (cached.length > 0) {
      // Hydrate profileId from DB only for the matched user IDs (single query)
      const profiles = await prisma.technicianProfile.findMany({
        where: { userId: { in: cached.map((c) => c.userId) } },
        select: { id: true, userId: true },
      });
      const profileMap = new Map(profiles.map((p) => [p.userId, p.id]));

      return cached.map((c) => ({
        technicianUserId: c.userId,
        technicianProfileId: profileMap.get(c.userId) ?? '',
        name: c.meta.name,
        phone: c.meta.phone,
        rating: c.meta.rating,
        distanceKm: c.distanceKm,
        estimatedMinutes: estimateMinutes(c.distanceKm),
      }));
    }
  } catch (err) {
    // Redis unavailable — fall through to PostgreSQL
    console.warn('[dispatch] Redis cache miss, falling back to DB:', (err as Error).message);
  }

  // Fallback: full PostgreSQL scan + warm Redis cache for next call
  const technicians = await prisma.technicianProfile.findMany({
    where: {
      isOnline: true,
      isAvailable: true,
      latitude: { not: null },
      longitude: { not: null },
      specialties: { has: input.serviceType },
    },
    include: { user: true },
  });

  const candidates = technicians
    .map((tech) => {
      const distance = distanceKm(
        { latitude: input.latitude, longitude: input.longitude },
        { latitude: tech.latitude!, longitude: tech.longitude! },
      );
      return {
        technicianUserId: tech.userId,
        technicianProfileId: tech.id,
        name: tech.user.name,
        phone: tech.user.phone,
        rating: tech.rating,
        distanceKm: Math.round(distance * 100) / 100,
        estimatedMinutes: estimateMinutes(distance),
        coverageRadiusKm: tech.coverageRadiusKm,
        latitude: tech.latitude!,
        longitude: tech.longitude!,
        specialties: tech.specialties as string[],
        isAvailable: tech.isAvailable,
      };
    })
    .filter(
      (c) => c.distanceKm <= Math.min(c.coverageRadiusKm, maxRadiusKm),
    )
    .sort((a, b) => {
      const etaDiff = a.estimatedMinutes - b.estimatedMinutes;
      return etaDiff !== 0 ? etaDiff : b.rating - a.rating;
    })
    .slice(0, 10);

  // Warm the cache asynchronously (don't block the response)
  void Promise.allSettled(
    candidates.map((c) =>
      upsertTechnicianLocation(c.technicianUserId, c.longitude, c.latitude, {
        isAvailable: c.isAvailable,
        specialties: c.specialties,
        rating: c.rating,
        coverageRadiusKm: c.coverageRadiusKm,
        name: c.name,
        phone: c.phone,
      }),
    ),
  );

  return candidates.map(
    ({ coverageRadiusKm: _c, latitude: _lat, longitude: _lng, specialties: _s, isAvailable: _ia, ...rest }) => rest,
  );
}
