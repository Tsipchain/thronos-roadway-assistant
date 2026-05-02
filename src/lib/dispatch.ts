import { ServiceType } from "@prisma/client";
import { prisma } from "./prisma";
import { distanceKm, estimateMinutes } from "./geo";

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

  return technicians
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
      };
    })
    .filter((candidate) => candidate.distanceKm <= Math.min(candidate.coverageRadiusKm, maxRadiusKm))
    .sort((a, b) => {
      const etaDiff = a.estimatedMinutes - b.estimatedMinutes;
      if (etaDiff !== 0) return etaDiff;
      return b.rating - a.rating;
    })
    .map(({ coverageRadiusKm: _coverageRadiusKm, ...candidate }) => candidate)
    .slice(0, 10);
}
