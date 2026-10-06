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
  const requestedLimit = Math.min(Math.max(Number(searchParams.get("limit") || 1000), 50), 5000);

  const binanceSymbol = normalizeBinanceSymbol(rawSymbol);

  try {
    const allCandlesMap = new Map<number, any>();
    let currentEndTime: number | null = null;
    let remaining = requestedLimit;

    // Fetch in chunks of up to 1000 (Binance single-call limit)
    while (remaining > 0) {
      const chunkLimit = Math.min(remaining, 1000);
      const endTimeParam = currentEndTime ? `&endTime=${currentEndTime}` : "";
      const endpoints = [
        `https://data-api.binance.vision/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${chunkLimit}${endTimeParam}`,
        `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${chunkLimit}${endTimeParam}`,
      ];

      let rawKlines: any = null;
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

      if (!Array.isArray(rawKlines) || rawKlines.length === 0) break;

      for (const k of rawKlines) {
        const timeSec = Math.floor(Number(k[0]) / 1000);
        if (!allCandlesMap.has(timeSec)) {
          allCandlesMap.set(timeSec, {
            time: timeSec,
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
          });
        }
      }

      // Next chunk endTime is just before the earliest candle in this batch
      const earliestMs = Number(rawKlines[0][0]);
      currentEndTime = earliestMs - 1;
      remaining -= rawKlines.length;

      // If fewer returned than asked, we've reached the beginning of available history
      if (rawKlines.length < chunkLimit) break;
    }

    if (allCandlesMap.size === 0) {
      throw new Error("Unable to fetch candle data from Binance endpoints");
    }

    const sortedCandles = Array.from(allCandlesMap.values()).sort((a, b) => a.time - b.time);

    return NextResponse.json({
      symbol: rawSymbol,
      binanceSymbol,
      interval,
      candles: sortedCandles,
      totalCount: sortedCandles.length,
    });
  } catch (err: any) {
    console.error("Candles fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch candles", message: err.message }, { status: 500 });
  }
}
