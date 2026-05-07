export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initiateCardPayment } from "@/lib/payment-service";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId, amount } = await req.json();

    if (!requestId || !amount) {
      return NextResponse.json(
        { error: "Missing requestId or amount" },
        { status: 400 }
      );
    }

    // Verify user owns this request
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.customerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Ensure payment record exists
    let payment = await prisma.payment.findUnique({
      where: { requestId },
    });

    if (!payment) {
      payment = await prisma.payment.create({
        data: {
          requestId,
          method: "CARD",
          amount,
          status: "PENDING",
        },
      });
    }

    // Create Stripe payment intent
    const { clientSecret, paymentIntentId } = await initiateCardPayment({
      customerId: session.user.id || "",
      requestId,
      amount,
      currency: "EUR",
    });

    return NextResponse.json({
      ok: true,
      clientSecret,
      paymentIntentId,
    });
  } catch (error) {
    console.error("Card payment error:", error);
    return NextResponse.json(
      { error: "Payment initiation failed" },
      { status: 500 }
    );
  }
}
