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
  const limit = searchParams.get("limit") || "150";

  const binanceSymbol = normalizeBinanceSymbol(rawSymbol);

  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      throw new Error(`Binance responded with ${res.status}`);
    }

    const rawKlines = await res.json();
    if (!Array.isArray(rawKlines) || rawKlines.length === 0) {
      throw new Error("Invalid klines format");
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
