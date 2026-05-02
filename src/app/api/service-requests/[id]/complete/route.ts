import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { attestOnThronosNode, recordServiceOnThronos, vehicleToHash } from "@/lib/thronos";

const completeSchema = z.object({
  finalPrice: z.number().positive(),
  partsUsed: z.array(z.string()).default([]),
  technicianNotes: z.string().optional(),
  metadataUri: z.string().url().optional(),
  writeToChain: z.boolean().default(false),
  attestationMode: z.enum(["off", "sha256", "evm", "both"]).default("sha256"),
});

function serviceTypeToCode(serviceType: string): number {
  const codes: Record<string, number> = {
    BATTERY_REPLACEMENT: 1,
    BATTERY_CHARGE: 2,
    TIRE_CHANGE: 3,
    TIRE_REPAIR: 4,
    DIAGNOSIS: 5,
  };
  return codes[serviceType] ?? 0;
}

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  try {
    const body = completeSchema.parse(await req.json());

    const request = await prisma.serviceRequest.findUnique({
      where: { id: context.params.id },
      include: { vehicle: true, technician: true, customer: true },
    });

    if (!request) return NextResponse.json({ error: "Service request not found" }, { status: 404 });
    if (!request.technicianId) return NextResponse.json({ error: "No technician assigned" }, { status: 409 });

    const vehicleHash = vehicleToHash({
      licensePlate: request.vehicle.licensePlate,
      vin: request.vehicle.vin ?? undefined,
      make: request.vehicle.make,
      model: request.vehicle.model,
      year: request.vehicle.year,
    });

    const shouldUseSha256 = body.attestationMode === "sha256" || body.attestationMode === "both" || (!body.writeToChain && body.attestationMode !== "off");
    const shouldUseEvm = body.writeToChain || body.attestationMode === "evm" || body.attestationMode === "both";

    let blockchainTxHash: string | undefined;
    let attestationHash: string | undefined;
    let attestationTxId: string | undefined;
    let attestationRaw: unknown;
    let attestationPayloadJson: Record<string, unknown> = {};

    if (shouldUseSha256) {
      const attestationInput = {
        type: "roadside.service.completed",
        subjectId: request.id,
        payload: {
          requestId: request.id,
          vehicleHash,
          serviceType: request.serviceType,
          finalPrice: body.finalPrice,
          partsUsed: body.partsUsed,
          technicianUserId: request.technicianId,
          completedAt: new Date().toISOString(),
        },
        metadata: {
          app: "battery-roadside-assist",
          privacy: "vehicle/customer data hashed off-chain; no plate/vin stored in public payload",
        },
      };
      attestationPayloadJson = attestationInput;
      const attestation = await attestOnThronosNode(attestationInput);
      attestationHash = attestation.hash;
      attestationTxId = attestation.txId;
      attestationRaw = attestation.raw;
    }

    if (shouldUseEvm) {
      blockchainTxHash = await recordServiceOnThronos({
        requestId: request.id,
        vehicleHash,
        serviceTypeCode: serviceTypeToCode(request.serviceType),
        metadataUri: body.metadataUri ?? (attestationHash ? `sha256://${attestationHash}` : "ipfs://pending-metadata"),
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const serviceRecord = await tx.serviceRecord.create({
        data: {
          requestId: request.id,
          vehicleId: request.vehicleId,
          serviceType: request.serviceType,
          description: `${request.serviceType} completed`,
          partsUsed: body.partsUsed,
          technicianNotes: body.technicianNotes,
          blockchainTxHash,
          attestationHash,
          attestationTxId,
        },
      });

      const serviceRequest = await tx.serviceRequest.update({
        where: { id: request.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          finalPrice: body.finalPrice,
          completionTxHash: blockchainTxHash,
          attestationHash,
          attestationTxId,
        },
        include: { vehicle: true, customer: true, technician: true },
      });

      if (attestationHash || blockchainTxHash) {
        await tx.attestationRecord.create({
          data: {
            type: "roadside.service.completed",
            subjectId: request.id,
            mode: body.attestationMode,
            hash: attestationHash ?? vehicleHash,
            txId: attestationTxId,
            txHash: blockchainTxHash,
            payloadJson: attestationPayloadJson as any,
            rawJson: attestationRaw === undefined ? undefined : (attestationRaw as any),
          },
        });
      }

      await tx.technicianProfile.update({
        where: { userId: request.technicianId! },
        data: { isAvailable: true, totalJobs: { increment: 1 } },
      });

      return { serviceRequest, serviceRecord };
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}
