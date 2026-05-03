// Exchange API client — real-time BTC/EUR rate + optional order execution
// Supports: Binance (default), Kraken, CoinGecko (rate-only fallback)

const EXCHANGE = process.env.EXCHANGE_PROVIDER ?? "binance"; // binance | kraken | coingecko
const BINANCE_API = "https://api.binance.com";
const KRAKEN_API = "https://api.kraken.com";
const COINGECKO_API = "https://api.coingecko.com/api/v3";

// Platform spread on top of market rate (default 1.5%)
const PLATFORM_SPREAD = parseFloat(process.env.P2P_SPREAD_PCT ?? "1.5") / 100;
// Flat fee in EUR per order
const FLAT_FEE_EUR = parseFloat(process.env.P2P_FLAT_FEE_EUR ?? "2");
// Quote valid for N minutes
export const QUOTE_TTL_MINUTES = parseInt(process.env.P2P_QUOTE_TTL_MIN ?? "15");
// Minimum BTC purchase
export const MIN_BTC_ORDER = parseFloat(process.env.P2P_MIN_BTC ?? "0.001");
// Maximum BTC purchase per order (KYC gate above this)
export const MAX_BTC_ORDER = parseFloat(process.env.P2P_MAX_BTC ?? "0.5");

export interface ExchangeRate {
  btcEur: number;       // mid-market price
  askEur: number;       // best ask (platform buys at this to refill)
  bidEur: number;       // best bid
  source: string;
  fetchedAt: string;
}

export interface P2PQuote {
  btcAmount: number;
  eurAmount: number;    // what the buyer pays
  rateEurPerBtc: number; // locked customer rate (mid + spread)
  feeEur: number;
  spreadPct: number;
  expiresAt: string;   // ISO
  source: string;
}

async function rateFromBinance(): Promise<ExchangeRate> {
  const res = await fetch(`${BINANCE_API}/api/v3/ticker/bookTicker?symbol=BTCEUR`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error("binance error");
  const d = await res.json();
  const bid = parseFloat(d.bidPrice);
  const ask = parseFloat(d.askPrice);
  return {
    btcEur: (bid + ask) / 2,
    askEur: ask,
    bidEur: bid,
    source: "binance",
    fetchedAt: new Date().toISOString(),
  };
}

async function rateFromKraken(): Promise<ExchangeRate> {
  const res = await fetch(`${KRAKEN_API}/0/public/Ticker?pair=XBTEUR`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error("kraken error");
  const d = await res.json();
  const pair = d.result?.XXBTZEUR;
  if (!pair) throw new Error("kraken no data");
  const bid = parseFloat(pair.b[0]);
  const ask = parseFloat(pair.a[0]);
  return {
    btcEur: (bid + ask) / 2,
    askEur: ask,
    bidEur: bid,
    source: "kraken",
    fetchedAt: new Date().toISOString(),
  };
}

async function rateFromCoinGecko(): Promise<ExchangeRate> {
  const res = await fetch(
    `${COINGECKO_API}/simple/price?ids=bitcoin&vs_currencies=eur`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error("coingecko error");
  const d = await res.json();
  const price = d.bitcoin?.eur;
  if (!price) throw new Error("coingecko no data");
  return {
    btcEur: price,
    askEur: price * 1.001,
    bidEur: price * 0.999,
    source: "coingecko",
    fetchedAt: new Date().toISOString(),
  };
}

export async function getLiveRate(): Promise<ExchangeRate> {
  try {
    if (EXCHANGE === "kraken") return await rateFromKraken();
    if (EXCHANGE === "coingecko") return await rateFromCoinGecko();
    return await rateFromBinance(); // default
  } catch {
    // fallback chain
    try { return await rateFromKraken(); } catch {}
    try { return await rateFromCoinGecko(); } catch {}
    throw new Error("All exchange sources failed");
  }
}

export function buildQuote(btcAmount: number, rate: ExchangeRate): P2PQuote {
  // Customer pays: mid-price + spread + flat fee
  const customerRate = rate.btcEur * (1 + PLATFORM_SPREAD);
  const eurBase = btcAmount * customerRate;
  const feeEur = FLAT_FEE_EUR;
  const eurAmount = parseFloat((eurBase + feeEur).toFixed(2));

  const expiresAt = new Date(
    Date.now() + QUOTE_TTL_MINUTES * 60 * 1000
  ).toISOString();

  return {
    btcAmount,
    eurAmount,
    rateEurPerBtc: parseFloat(customerRate.toFixed(2)),
    feeEur,
    spreadPct: PLATFORM_SPREAD * 100,
    expiresAt,
    source: rate.source,
  };
}
