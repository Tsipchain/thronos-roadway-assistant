export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCryptoPayment, completeCryptoPayment } from "@/lib/payment-service";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { requestId, action } = body;

    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    }

    // Verify user owns this request
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.customerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "initiate") {
      // Get final price from request
      const finalPrice = request.finalPrice || request.estimatedPrice || 0;

      if (finalPrice <= 0) {
        return NextResponse.json(
          { error: "Invalid price" },
          { status: 400 }
        );
      }

      // Ensure payment record exists
      const payment = await prisma.payment.findUnique({
        where: { requestId },
      });

      if (!payment) {
        await prisma.payment.create({
          data: {
            requestId,
            method: "CRYPTO",
            amount: finalPrice,
            status: "PENDING",
          },
        });
      }

      // Create escrow for crypto payment
      const crypto = await createCryptoPayment({
        customerId: session.user.id || "",
        requestId,
        amount: finalPrice,
        currency: "EUR",
      });

      return NextResponse.json({
        ok: true,
        escrowAddress: crypto.escrowAddress,
        txHash: crypto.txHash,
        expiresAt: crypto.expiresAt,
      });
    } else if (action === "complete") {
      const { txHash } = body;

      if (!txHash) {
        return NextResponse.json({ error: "Missing txHash" }, { status: 400 });
      }

      const success = await completeCryptoPayment(requestId, txHash);

      return NextResponse.json({
        ok: success,
        message: success
          ? "Payment completed successfully"
          : "Failed to complete payment",
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Thronos payment error:", error);
    return NextResponse.json(
      { error: "Payment processing failed" },
      { status: 500 }
    );
  }
}
