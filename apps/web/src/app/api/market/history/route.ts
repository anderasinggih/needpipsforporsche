import { NextRequest, NextResponse } from "next/server";
import { readCandles } from "@/lib/market/candleStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeBinanceSymbol(symbol: string): string {
  const upper = symbol.toUpperCase().trim();
  if (upper === "XAUUSD" || upper === "GOLD") return "PAXGUSDT";
  if (upper.endsWith("USD") && !upper.endsWith("USDT")) return `${upper}T`;
  return upper;
}

/** GET /api/market/history?symbol=XAUUSD&interval=5m&limit=2000 — closed candles from the .dat store */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = normalizeBinanceSymbol(searchParams.get("symbol") || "BTCUSDT");
  const interval = searchParams.get("interval") || "1m";
  const limit = Math.min(Number(searchParams.get("limit") || 1000), 20000);
  const candles = readCandles(symbol, interval, limit);
  return NextResponse.json({ symbol, interval, count: candles.length, candles });
}
