import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveRate, buildQuote, MIN_BTC_ORDER, MAX_BTC_ORDER, QUOTE_TTL_MINUTES } from "@/lib/exchange";

// POST — create order from a live quote
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { btcAmount, destinationBtc, paymentMethod = "bank", tenantSlug } = await req.json();

  if (!btcAmount || btcAmount < MIN_BTC_ORDER || btcAmount > MAX_BTC_ORDER) {
    return NextResponse.json({ error: "Invalid btcAmount" }, { status: 400 });
  }
  if (!destinationBtc) {
    return NextResponse.json({ error: "destinationBtc required" }, { status: 400 });
  }

  // Fetch fresh rate and build quote
  const rate = await getLiveRate();
  const quote = buildQuote(parseFloat(btcAmount), rate);

  // Find tenant if provided
  let tenantId: string | null = null;
  if (tenantSlug) {
    const t = await prisma.partnerCompany.findUnique({ where: { slug: tenantSlug } });
    tenantId = t?.id ?? null;
  }

  const order = await prisma.p2POrder.create({
    data: {
      userId: session.user.id,
      tenantId,
      btcAmount: quote.btcAmount,
      eurAmount: quote.eurAmount,
      rateEurPerBtc: quote.rateEurPerBtc,
      feeEur: quote.feeEur,
      quoteExpiresAt: new Date(quote.expiresAt),
      destinationBtc,
      paymentMethod,
      status: "QUOTE",
    },
  });

  // Bank transfer reference
  const paymentRef = `THR-P2P-${order.id.slice(-8).toUpperCase()}`;
  await prisma.p2POrder.update({
    where: { id: order.id },
    data: { paymentRef },
  });

  const platformBank = {
    bank: process.env.P2P_BANK_NAME ?? "Thronos Chain",
    iban: process.env.P2P_BANK_IBAN ?? "GR00 0000 0000 0000 0000 0000 000",
    beneficiary: process.env.P2P_BANK_BENEFICIARY ?? "Thronos Chain IKE",
    ref: paymentRef,
  };

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    paymentRef,
    btcAmount: quote.btcAmount,
    eurAmount: quote.eurAmount,
    rateEurPerBtc: quote.rateEurPerBtc,
    feeEur: quote.feeEur,
    expiresAt: quote.expiresAt,
    destinationBtc,
    paymentMethod,
    bankDetails: paymentMethod === "bank" ? platformBank : null,
    status: "QUOTE",
  });
}

// GET — list orders for current user/tenant
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tenantSlug = searchParams.get("tenantSlug");

  const where: Record<string, unknown> = {};
  if (session.user.role === "SUPER_ADMIN") {
    if (tenantSlug) {
      const t = await prisma.partnerCompany.findUnique({ where: { slug: tenantSlug } });
      if (t) where.tenantId = t.id;
    }
  } else {
    where.userId = session.user.id;
  }

  const orders = await prisma.p2POrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(orders);
}
