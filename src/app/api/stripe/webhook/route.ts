import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/webhook
 * Handles Stripe events.
 * Set in Stripe dashboard: endpoint = https://roadway.thronoschain.org/api/stripe/webhook
 * Events to enable: checkout.session.completed
 */
export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e: unknown) {
    console.error("[stripe webhook] signature verification failed", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoiceId;

    if (!invoiceId) {
      console.warn("[stripe webhook] checkout.session.completed without invoiceId metadata");
      return NextResponse.json({ received: true });
    }

    const invoice = await prisma.tenantInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.status === "PAID") {
      return NextResponse.json({ received: true });
    }

    await prisma.tenantInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        stripePaymentId: session.payment_intent as string ?? session.id,
        paymentMethod: "stripe",
      },
    });

    console.log(`[stripe webhook] Invoice ${invoice.number} marked PAID via Stripe`);
  }

  return NextResponse.json({ received: true });
}
