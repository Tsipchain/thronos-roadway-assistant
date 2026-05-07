import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { triggerDispatch } from '@/lib/dispatch-service';
import { calculatePrice } from '@/lib/pricing';

/**
 * POST /api/dispatch/create
 * Customer creates a new service request.
 * Body: { serviceType, latitude, longitude, description?, vehicleId?, licensePlate? }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { vehicles: { take: 1 } },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { serviceType, latitude, longitude, description, vehicleId, licensePlate } =
    await req.json();

  if (!serviceType || !latitude || !longitude) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 },
    );
  }

  // Resolve vehicleId: use provided, fall back to first vehicle, or create a default
  let resolvedVehicleId = vehicleId as string | undefined;

  if (!resolvedVehicleId) {
    if (user.vehicles.length > 0) {
      resolvedVehicleId = user.vehicles[0].id;
    } else {
      // Auto-create a placeholder vehicle so dispatch can proceed
      const plate = (licensePlate as string | undefined)?.toUpperCase().replace(/[^A-ZΑ-Ω0-9]/g, '') || 'UNKNOWN';
      const newVehicle = await prisma.vehicle.create({
        data: {
          userId: user.id,
          licensePlate: plate,
          make: 'Άγνωστο',
          model: 'Άγνωστο',
          year: new Date().getFullYear(),
        },
      });
      resolvedVehicleId = newVehicle.id;
    }
  }

  // Calculate estimated price
  const pricing = await calculatePrice({
    serviceType,
    distanceKm: 0, // Will be refined after matching
  });

  // Create service request
  const request = await prisma.serviceRequest.create({
    data: {
      customerId: user.id,
      vehicleId: resolvedVehicleId,
      serviceType,
      latitude,
      longitude,
      description,
      status: 'PENDING',
      estimatedPrice: pricing.totalPrice,
    },
  });

  // Trigger dispatch (find nearby technicians)
  await triggerDispatch({
    requestId: request.id,
    customerId: user.id,
    latitude,
    longitude,
    serviceType,
    estimatedPrice: pricing.totalPrice,
    description,
  });

  return NextResponse.json({
    ok: true,
    requestId: request.id,
    estimatedPrice: pricing.totalPrice,
  });
}
