import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SERVICE_LABELS: Record<string, string> = {
  BATTERY_REPLACEMENT: "Αντικατάσταση Μπαταρίας",
  BATTERY_CHARGE:      "Φόρτιση Μπαταρίας",
  TIRE_CHANGE:         "Αλλαγή Λάστιχου",
  TIRE_REPAIR:         "Επισκευή Λάστιχου",
  DIAGNOSIS:           "Διάγνωση",
};

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; jobId: string } }
) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const tenant = await prisma.partnerCompany.findUnique({ where: { slug: params.slug } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const job = await prisma.serviceRequest.findFirst({
    where: { id: params.jobId, tenantId: tenant.id },
    include: {
      vehicle: { select: { licensePlate: true, make: true, model: true } },
    },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const amount = job.finalPrice ?? job.estimatedPrice;
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Price not set for this job" }, { status: 400 });
  }

  try {
    // Dynamic import so build doesn't fail if stripe pkg is missing
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20" as any,
    });

    // Reuse existing valid session if available
    const existingPayment = await prisma.payment.findUnique({
      where: { requestId: params.jobId },
      select: { stripePaymentId: true },
    });
    if (existingPayment?.stripePaymentId) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(existingPayment.stripePaymentId);
        if (existingSession.status === "open" && existingSession.url) {
          return NextResponse.json({ url: existingSession.url, type: "stripe" });
        }
      } catch {
        // Session not found or invalid, create a new one
      }
    }

    const base = process.env.NEXTAUTH_URL ?? "https://roadway-assistant.thronoschain.org";

    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: `${SERVICE_LABELS[job.serviceType] ?? job.serviceType} — ${tenant.name}`,
            description: `${job.vehicle.make} ${job.vehicle.model} (${job.vehicle.licensePlate})`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: "payment",
      payment_method_types: ["card"],
      success_url: `${base}/t/${params.slug}/track/${params.jobId}?paid=1`,
      cancel_url:  `${base}/t/${params.slug}/track/${params.jobId}`,
      metadata: { jobId: params.jobId, tenantId: tenant.id },
      ...(tenant.stripeCustomerId ? { customer: tenant.stripeCustomerId } : {}),
    });

    // Upsert a PENDING Payment record linked to this checkout session
    await prisma.payment.upsert({
      where:  { requestId: params.jobId },
      create: {
        requestId:      params.jobId,
        method:         "CARD",
        status:         "PENDING",
        amount,
        currency:       "EUR",
        stripePaymentId: session.id,
      },
      update: {
        stripePaymentId: session.id,
        amount,
        status: "PENDING",
        method: "CARD",
      },
    });

    return NextResponse.json({ url: session.url, type: "stripe" });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Payment service error" }, { status: 503 });
  }
}
