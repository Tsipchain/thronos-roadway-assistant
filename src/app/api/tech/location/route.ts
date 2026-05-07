import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/tech/location
 * Technician updates their location for dispatch matching.
 * Called every 10 seconds from mobile app.
 * Body: { userId, latitude, longitude }
 */
export async function POST(req: NextRequest) {
  const { userId, latitude, longitude } = await req.json();

  if (!userId || !latitude || !longitude) {
    return NextResponse.json(
      { error: 'Missing fields' },
      { status: 400 },
    );
  }

  // Update technician profile
  const tech = await prisma.technicianProfile.findUnique({
    where: { userId },
  });

  if (!tech) {
    return NextResponse.json(
      { error: 'Technician not found' },
      { status: 404 },
    );
  }

  await prisma.technicianProfile.update({
    where: { userId },
    data: {
      latitude,
      longitude,
      lastLocationAt: new Date(),
      isOnline: true,
    },
  });

  // Also warm Redis cache (async, don't block)
  void (async () => {
    const { upsertTechnicianLocation } = await import('@/lib/location-cache');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        phone: true,
        id: true,
      },
    });
    if (user && tech) {
      await upsertTechnicianLocation(userId, longitude, latitude, {
        isAvailable: tech.isAvailable,
        specialties: tech.specialties as string[],
        rating: tech.rating,
        coverageRadiusKm: tech.coverageRadiusKm,
        name: user.name,
        phone: user.phone || '',
      });
    }
  })();

  return NextResponse.json({ ok: true });
}
