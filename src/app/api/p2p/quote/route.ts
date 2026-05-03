import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLiveRate, buildQuote, MIN_BTC_ORDER, MAX_BTC_ORDER } from "@/lib/exchange";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { btcAmount, destinationBtc } = await req.json();

  if (!btcAmount || isNaN(btcAmount)) {
    return NextResponse.json({ error: "btcAmount required" }, { status: 400 });
  }
  if (btcAmount < MIN_BTC_ORDER) {
    return NextResponse.json({ error: `Minimum ${MIN_BTC_ORDER} BTC` }, { status: 400 });
  }
  if (btcAmount > MAX_BTC_ORDER) {
    return NextResponse.json({ error: `Maximum ${MAX_BTC_ORDER} BTC per order` }, { status: 400 });
  }
  if (!destinationBtc) {
    return NextResponse.json({ error: "destinationBtc address required" }, { status: 400 });
  }

  const rate = await getLiveRate();
  const quote = buildQuote(parseFloat(btcAmount), rate);

  return NextResponse.json({ ok: true, quote, destinationBtc });
}
