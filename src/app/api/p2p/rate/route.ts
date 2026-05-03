import { NextResponse } from "next/server";
import { getLiveRate, buildQuote, MIN_BTC_ORDER, MAX_BTC_ORDER, QUOTE_TTL_MINUTES } from "@/lib/exchange";

export const revalidate = 30; // cache 30s at edge

export async function GET() {
  try {
    const rate = await getLiveRate();
    const exampleQuote = buildQuote(0.011, rate); // example for the pledge amount
    return NextResponse.json({
      ok: true,
      btcEur: rate.btcEur,
      askEur: rate.askEur,
      bidEur: rate.bidEur,
      source: rate.source,
      fetchedAt: rate.fetchedAt,
      quoteTtlMinutes: QUOTE_TTL_MINUTES,
      minBtc: MIN_BTC_ORDER,
      maxBtc: MAX_BTC_ORDER,
      pledgeExampleEur: exampleQuote.eurAmount, // how much 0.011 BTC costs right now
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 502 });
  }
}
