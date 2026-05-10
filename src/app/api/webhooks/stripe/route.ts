import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
      const { jobId } = session.metadata ?? {};

      if (jobId) {
        const paidAmount = session.amount_total ? session.amount_total / 100 : undefined;

        await prisma.payment.updateMany({
          where: { requestId: jobId, stripePaymentId: session.id },
          data: {
            status: "COMPLETED",
            stripePaymentId: session.payment_intent ?? session.id,
            ...(paidAmount ? { amount: paidAmount } : {}),
          },
        });

        if (paidAmount) {
          await prisma.serviceRequest.update({
            where: { id: jobId },
            data: { finalPrice: paidAmount },
          });

          // Create payout record for the tenant
          const job = await prisma.serviceRequest.findUnique({
            where: { id: jobId },
            select: {
              tenantId: true,
              tenant: {
                select: {
                  plan: true,
                  planActiveUntil: true,
                  payoutMethod: true,
                  platformFeePercent: true,
                },
              },
            },
          });

          if (job?.tenantId && job.tenant) {
            const { plan, planActiveUntil, payoutMethod, platformFeePercent } = job.tenant;
            const hasActiveSub = planActiveUntil ? planActiveUntil > new Date() : false;
            const planUpper = plan.toUpperCase();
            const isSubscribed = hasActiveSub && (planUpper === "PRO" || planUpper === "ENTERPRISE");

            const feePercent = isSubscribed ? 0 : (platformFeePercent ?? 8);
            const feeAmount = Math.round(paidAmount * feePercent) / 100;
            const netAmount = paidAmount - feeAmount;
            const method = isSubscribed ? "SUBSCRIPTION_OFFSET" : (payoutMethod ?? "BANK_TRANSFER");
            const status = isSubscribed ? "OFFSET" : "PENDING";

            await prisma.tenantPayout.create({
              data: {
                tenantId: job.tenantId,
                jobId,
                grossAmountEur: paidAmount,
                feePercent,
                feeAmountEur: feeAmount,
                netAmountEur: netAmount,
                method,
                status,
              },
            });
          }
        }
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as any;
      const jobId = session.metadata?.jobId;
      if (jobId) {
        await prisma.payment.updateMany({
          where: { requestId: jobId, stripePaymentId: session.id, status: "PENDING" },
          data: { status: "FAILED" },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
