import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:     ["ACCEPTED", "CANCELLED"],
  ACCEPTED:    ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE:    ["ARRIVED",  "CANCELLED"],
  ARRIVED:     ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED",   "CANCELLED"],
};

export async function PATCH(
  req: Request,
  { params }: { params: { requestId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "TECHNICIAN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    status,
    // EN_ROUTE: tech updates their own ETA estimate
    estimatedMinutes,
    // COMPLETED: completion details
    finalPrice,
    paymentMethod, // "CASH" | "CARD"
    batteryAh,     // 45 | 55 | 65 | null
    batteryBrand,  // free text, e.g. "Varta Blue Dynamic"
    technicianNotes,
  } = body;

  const request = await prisma.serviceRequest.findUnique({
    where: { id: params.requestId },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = VALID_TRANSITIONS[request.status] ?? [];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Invalid transition: ${request.status} → ${status}` },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {
    status,
    technicianId: request.technicianId ?? session.user.id,
  };

  if (status === "ACCEPTED")  updateData.acceptedAt  = new Date();
  if (status === "ARRIVED")   updateData.arrivedAt   = new Date();
  if (status === "COMPLETED") updateData.completedAt = new Date();
  if (status === "CANCELLED") updateData.cancelledAt = new Date();

  // Tech provides their own ETA when departing
  if (status === "EN_ROUTE" && typeof estimatedMinutes === "number" && estimatedMinutes >= 1) {
    updateData.estimatedMinutes = Math.max(1, Math.min(180, estimatedMinutes));
    updateData.acceptedAt = new Date(); // reset countdown from departure
  }

  // Save final price if tech confirmed it at completion
  if (status === "COMPLETED" && typeof finalPrice === "number" && finalPrice > 0) {
    updateData.finalPrice = finalPrice;
  }

  const updated = await prisma.serviceRequest.update({
    where: { id: params.requestId },
    data: updateData as any,
  });

  if (status === "COMPLETED") {
    const techUserId = updated.technicianId ?? session.user.id;

    // Build parts list
    const partsUsed: string[] = [];
    if (batteryAh) {
      const label = batteryBrand
        ? `${batteryBrand} ${batteryAh}Ah`
        : `Μπαταρία ${batteryAh}Ah`;
      partsUsed.push(label);
    }

    // Create service record (skip if already exists)
    const existing = await prisma.serviceRecord.findUnique({ where: { requestId: updated.id } });
    if (!existing) {
      await prisma.serviceRecord.create({
        data: {
          requestId:      updated.id,
          vehicleId:      updated.vehicleId,
          serviceType:    updated.serviceType,
          description:    technicianNotes || "Ολοκλήρωση εργασίας",
          partsUsed,
          technicianNotes: technicianNotes || null,
        },
      });
    }

    let stripeCheckoutUrl: string | null = null;

    // Record payment
    if (paymentMethod && finalPrice && finalPrice > 0) {
      if (paymentMethod === "CARD") {
        // Card payment: create Stripe checkout session, keep payment PENDING until customer pays
        const tenant = updated.tenantId
          ? await prisma.partnerCompany.findUnique({
              where: { id: updated.tenantId },
              select: { id: true, name: true, slug: true, stripeCustomerId: true },
            })
          : null;

        if (tenant && process.env.STRIPE_SECRET_KEY) {
          try {
            const Stripe = (await import("stripe")).default;
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any });
            const base = process.env.NEXTAUTH_URL ?? "https://roadway-assistant.thronoschain.org";

            const session = await stripe.checkout.sessions.create({
              line_items: [{
                price_data: {
                  currency: "eur",
                  product_data: { name: `Πληρωμή Εργασίας — ${tenant.name}` },
                  unit_amount: Math.round(finalPrice * 100),
                },
                quantity: 1,
              }],
              mode: "payment",
              payment_method_types: ["card"],
              success_url: `${base}/t/${tenant.slug}/track/${updated.id}?paid=1`,
              cancel_url:  `${base}/t/${tenant.slug}/track/${updated.id}`,
              metadata: { jobId: updated.id, tenantId: tenant.id },
              ...(tenant.stripeCustomerId ? { customer: tenant.stripeCustomerId } : {}),
            });

            stripeCheckoutUrl = session.url;

            await prisma.payment.upsert({
              where:  { requestId: updated.id },
              create: { requestId: updated.id, method: "CARD", status: "PENDING", amount: finalPrice, currency: "EUR", stripePaymentId: session.id },
              update: { method: "CARD", status: "PENDING", amount: finalPrice, stripePaymentId: session.id },
            });
          } catch (e) {
            console.error("Stripe session creation failed:", e);
            await prisma.payment.upsert({
              where:  { requestId: updated.id },
              create: { requestId: updated.id, method: "CARD", status: "PENDING", amount: finalPrice, currency: "EUR" },
              update: { method: "CARD", status: "PENDING", amount: finalPrice },
            });
          }
        } else {
          await prisma.payment.upsert({
            where:  { requestId: updated.id },
            create: { requestId: updated.id, method: "CARD", status: "PENDING", amount: finalPrice, currency: "EUR" },
            update: { method: "CARD", status: "PENDING", amount: finalPrice },
          });
        }
      } else {
        // Cash payment: mark as completed immediately
        await prisma.payment.upsert({
          where:  { requestId: updated.id },
          create: { requestId: updated.id, method: "CASH", status: "COMPLETED", amount: finalPrice, currency: "EUR" },
          update: { method: "CASH", status: "COMPLETED", amount: finalPrice },
        });
      }
    }

    // Increment technician's total jobs
    await prisma.technicianProfile.updateMany({
      where: { userId: techUserId },
      data:  { totalJobs: { increment: 1 } },
    });
  }

  return NextResponse.json({
    ok: true,
    status: updated.status,
    finalPrice: updated.finalPrice,
    estimatedMinutes: updated.estimatedMinutes,
    stripeCheckoutUrl,
  });
}
