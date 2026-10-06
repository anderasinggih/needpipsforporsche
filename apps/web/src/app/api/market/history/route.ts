import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { readCandles } from "@/lib/market/candleStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeBinanceSymbol(symbol: string): string {
  const upper = symbol.toUpperCase().trim();
  if (upper === "XAUUSD" || upper === "GOLD") return "PAXGUSDT";
  if (upper.endsWith("USD") && !upper.endsWith("USDT")) return `${upper}T`;
  return upper;
}

/** GET /api/market/history?symbol=XAUUSD&interval=5m&limit=2000 — closed candles from PostgreSQL database */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = normalizeBinanceSymbol(searchParams.get("symbol") || "BTCUSDT");
  const interval = searchParams.get("interval") || "1m";
  const limit = Math.min(Number(searchParams.get("limit") || 1000), 20000);

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT EXTRACT(EPOCH FROM time)::BIGINT as time, open, high, low, close, volume
         FROM market_candles
         WHERE symbol = $1 AND timeframe = $2
         ORDER BY time DESC
         LIMIT $3`,
        [symbol, interval, limit]
      );

      if (result.rows && result.rows.length > 0) {
        const candles = result.rows.reverse().map((r) => ({
          time: Number(r.time),
          open: parseFloat(r.open),
          high: parseFloat(r.high),
          low: parseFloat(r.low),
          close: parseFloat(r.close),
          volume: parseFloat(r.volume),
        }));
        return NextResponse.json({ symbol, interval, count: candles.length, candles, source: "postgresql" });
      }
    } finally {
      client.release();
    }
  } catch (dbErr) {
    console.warn("PostgreSQL candle query error, falling back to store:", dbErr);
  }

  // Fallback to local candle store if PostgreSQL table is still backfilling
  const candles = readCandles(symbol, interval, limit);
  return NextResponse.json({ symbol, interval, count: candles.length, candles, source: "store" });
}
