import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Disable body parsing — stripe needs raw body for signature verification
export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any });

    const event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const { jobId, tenantId } = session.metadata ?? {};

      if (jobId) {
        const paidAmount = session.amount_total ? session.amount_total / 100 : undefined;

        // Mark payment as completed
        await prisma.payment.updateMany({
          where: { requestId: jobId, stripePaymentId: session.id },
          data: {
            status:         "COMPLETED",
            stripePaymentId: session.payment_intent ?? session.id,
            ...(paidAmount ? { amount: paidAmount } : {}),
          },
        });

        // Store final price on the service request
        if (paidAmount) {
          await prisma.serviceRequest.update({
            where: { id: jobId },
            data:  { finalPrice: paidAmount },
          });
        }
      }
    }

    if (event.type === "checkout.session.expired") {
      // Clean up expired pending payment so customer can try again
      const session = event.data.object as any;
      const jobId = session.metadata?.jobId;
      if (jobId) {
        await prisma.payment.updateMany({
          where: { requestId: jobId, stripePaymentId: session.id, status: "PENDING" },
          data:  { status: "FAILED" },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
