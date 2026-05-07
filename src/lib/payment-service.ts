import Stripe from "stripe";
import { prisma } from "./prisma";
import { redis } from "./redis";
import { attestTreasuryTransaction } from "./thronos-treasury";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

export interface PaymentRequest {
  customerId: string;
  requestId: string;
  amount: number;
  currency?: string;
}

export interface SubscriptionCheckout {
  sessionId: string;
  url: string;
}

export interface CryptoPayment {
  txHash: string;
  escrowAddress: string;
  expiresAt: Date;
}

export async function createStripeSubscription(
  userId: string,
  email: string
): Promise<SubscriptionCheckout> {
  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    client_reference_id: userId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: process.env.STRIPE_ANNUAL_PRICE_ID || "",
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXTAUTH_URL}/customer/subscription?success=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/customer/subscription?cancelled=true`,
  });

  return {
    sessionId: session.id,
    url: session.url || "",
  };
}

export async function handleStripeSubscriptionCreated(
  customerId: string,
  stripeSubId: string,
  expiresAt: Date
): Promise<void> {
  await prisma.subscription.create({
    data: {
      userId: customerId,
      plan: "annual",
      priceEur: 30,
      stripeSubId,
      startDate: new Date(),
      endDate: expiresAt,
    },
  });
}

export async function getActiveSubscription(userId: string) {
  return prisma.subscription.findFirst({
    where: {
      userId,
      isActive: true,
      endDate: { gt: new Date() },
    },
  });
}

export async function createCryptoPayment(
  payment: PaymentRequest
): Promise<CryptoPayment> {
  const { customerId, requestId, amount, currency = "EUR" } = payment;

  // Get request for blockchain attestation
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: { customer: true },
  });

  if (!request) {
    throw new Error(`Service request ${requestId} not found`);
  }

  // Create escrow address (simulated - in production, call Thronos API)
  const escrowAddress = `ESC_${requestId.slice(0, 20)}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minute timeout

  // Store escrow in cache
  await redis.setex(
    `escrow:${requestId}`,
    1800, // 30 minutes
    JSON.stringify({
      customerId,
      amount,
      currency,
      escrowAddress,
      createdAt: new Date().toISOString(),
    })
  );

  // Update payment record with escrow info
  await prisma.payment.update({
    where: { requestId },
    data: {
      status: "ESCROWED",
      escrowAddress,
      cryptoTxHash: escrowAddress, // placeholder for actual tx hash
    },
  });

  // Attest escrow creation on Thronos
  try {
    await attestTreasuryTransaction({
      type: "ESCROW_CREATED",
      subjectId: requestId,
      amount,
      description: `Escrow for service request ${requestId}`,
      operatingCustomer: customerId,
    } as any);
  } catch (error) {
    console.error("Failed to attest escrow creation:", error);
  }

  return {
    txHash: escrowAddress,
    escrowAddress,
    expiresAt,
  };
}

export async function completeCryptoPayment(
  requestId: string,
  txHash: string
): Promise<boolean> {
  try {
    // Verify tx hash on Thronos chain (in production, call Thronos RPC)
    const escrowData = await redis.get(`escrow:${requestId}`);
    if (!escrowData) {
      throw new Error("Escrow not found");
    }

    const escrow = JSON.parse(escrowData);

    // Mark payment as completed
    await prisma.payment.update({
      where: { requestId },
      data: {
        status: "COMPLETED",
        cryptoTxHash: txHash,
      },
    });

    // Attest payment completion on Thronos
    await attestTreasuryTransaction({
      type: "PAYMENT_COMPLETED",
      subjectId: requestId,
      amount: escrow.amount,
      description: `Payment completed for service request ${requestId}`,
      txHash,
    } as any);

    // Clean up escrow cache
    await redis.del(`escrow:${requestId}`);

    return true;
  } catch (error) {
    console.error("Failed to complete crypto payment:", error);
    return false;
  }
}

export async function initiateCardPayment(
  payment: PaymentRequest
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const { customerId, requestId, amount, currency = "EUR" } = payment;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // convert to cents
    currency: currency.toLowerCase(),
    metadata: {
      customerId,
      requestId,
    },
  });

  // Store payment intent in database
  await prisma.payment.update({
    where: { requestId },
    data: {
      method: "CARD",
      stripePaymentId: paymentIntent.id,
    },
  });

  return {
    clientSecret: paymentIntent.client_secret || "",
    paymentIntentId: paymentIntent.id,
  };
}

export async function verifyPaymentCompletion(
  paymentIntentId: string
): Promise<boolean> {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent.status === "succeeded";
  } catch (error) {
    console.error("Failed to verify payment:", error);
    return false;
  }
}

export async function refundPayment(
  requestId: string,
  reason: string
): Promise<boolean> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { requestId },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.method === "CARD" && payment.stripePaymentId) {
      await stripe.refunds.create({
        payment_intent: payment.stripePaymentId,
        reason: "requested_by_customer",
        metadata: {
          requestId,
          customReason: reason,
        },
      });
    } else if (payment.method === "CRYPTO" && payment.cryptoTxHash) {
      // Thronos refund logic (in production)
      await redis.set(
        `refund:${requestId}`,
        JSON.stringify({
          reason,
          requestedAt: new Date().toISOString(),
        }),
        "EX",
        3600
      );
    }

    await prisma.payment.update({
      where: { requestId },
      data: { status: "REFUNDED" },
    });

    // Attest refund on Thronos
    await attestTreasuryTransaction({
      type: "PAYMENT_REFUNDED",
      subjectId: requestId,
      amount: payment.amount,
      description: `Refund for service request ${requestId}: ${reason}`,
    } as any);

    return true;
  } catch (error) {
    console.error("Failed to refund payment:", error);
    return false;
  }
}
