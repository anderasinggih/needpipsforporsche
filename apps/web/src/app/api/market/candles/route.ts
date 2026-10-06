import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function normalizeBinanceSymbol(symbol: string): string {
  const upper = symbol.toUpperCase().trim();
  if (upper === "XAUUSD" || upper === "GOLD") return "PAXGUSDT";
  if (upper === "BTCUSD" || upper === "BTCUSDT") return "BTCUSDT";
  if (upper === "ETHUSD" || upper === "ETHUSDT") return "ETHUSDT";
  if (upper === "SOLUSD" || upper === "SOLUSDT") return "SOLUSDT";
  if (upper.endsWith("USD") && !upper.endsWith("USDT")) {
    return `${upper}T`;
  }
  return upper;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawSymbol = searchParams.get("symbol") || "BTCUSD";
  const interval = searchParams.get("interval") || "1m";
  const limit = Math.min(Number(searchParams.get("limit") || 1000), 1000);

  const binanceSymbol = normalizeBinanceSymbol(rawSymbol);

  try {
    let rawKlines: any = null;
    const endpoints = [
      `https://data-api.binance.vision/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`,
      `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`,
    ];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          rawKlines = await res.json();
          if (Array.isArray(rawKlines) && rawKlines.length > 0) break;
        }
      } catch (e) {}
    }

    if (!Array.isArray(rawKlines) || rawKlines.length === 0) {
      throw new Error("Unable to fetch candle data from Binance endpoints");
    }

    // Format into lightweight-charts format: { time: number (seconds), open, high, low, close, volume }
    const candles = rawKlines.map((k: any) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    return NextResponse.json({ symbol: rawSymbol, binanceSymbol, interval, candles });
  } catch (err: any) {
    console.error("Candles fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch candles", message: err.message }, { status: 500 });
  }
}
