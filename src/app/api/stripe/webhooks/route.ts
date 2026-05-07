import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { handleStripeSubscriptionCreated } from "@/lib/payment-service";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") || "";

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.client_reference_id && session.subscription) {
          const subId = session.subscription as string;
          const subscription = await stripe.subscriptions.retrieve(subId);

          const endDate = new Date(
            (subscription.current_period_end || 0) * 1000
          );

          await handleStripeSubscriptionCreated(
            session.client_reference_id,
            subId,
            endDate
          );
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;

        if (subscription.client_reference_id) {
          const endDate = new Date(
            (subscription.current_period_end || 0) * 1000
          );

          await handleStripeSubscriptionCreated(
            subscription.client_reference_id,
            subscription.id,
            endDate
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        if (subscription.client_reference_id) {
          const endDate = new Date(
            (subscription.current_period_end || 0) * 1000
          );

          await prisma.subscription.updateMany({
            where: { stripeSubId: subscription.id },
            data: {
              endDate,
              isActive: subscription.status === "active",
            },
          });
        }
        break;
      }

      case "charge.succeeded": {
        const charge = event.data.object as Stripe.Charge;

        if (charge.metadata?.requestId && charge.metadata?.customerId) {
          await prisma.payment.update({
            where: { requestId: charge.metadata.requestId },
            data: {
              status: "COMPLETED",
              stripePaymentId: charge.id,
            },
          });
        }
        break;
      }

      case "charge.failed": {
        const charge = event.data.object as Stripe.Charge;

        if (charge.metadata?.requestId) {
          await prisma.payment.update({
            where: { requestId: charge.metadata.requestId },
            data: {
              status: "FAILED",
            },
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
