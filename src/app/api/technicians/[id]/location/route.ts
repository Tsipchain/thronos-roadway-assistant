import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const locationSchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  isOnline: z.boolean().default(true),
  isAvailable: z.boolean().optional(),
});

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  try {
    const body = locationSchema.parse(await req.json());

    const profile = await prisma.technicianProfile.update({
      where: { userId: context.params.id },
      data: {
        latitude: body.latitude,
        longitude: body.longitude,
        isOnline: body.isOnline,
        ...(body.isAvailable === undefined ? {} : { isAvailable: body.isAvailable }),
        lastLocationAt: new Date(),
      },
      include: { user: true, company: true },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid location payload", details: error.flatten() }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update technician location" },
      { status: 500 },
    );
  }
}
