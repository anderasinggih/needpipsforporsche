import { appendCandles, INTERVAL_SECONDS, lastStoredTime, StoredCandle } from "./candleStore";

// Binance symbols used by the dashboard (XAUUSD is mapped to PAXGUSDT)
export const COLLECT_SYMBOLS = ["PAXGUSDT", "BTCUSDT", "ETHUSDT", "SOLUSDT"];
export const COLLECT_INTERVALS = ["1m", "5m", "15m", "1h"];
const BACKFILL_DAYS = Number(process.env.CANDLE_BACKFILL_DAYS || 7);
const POLL_MS = 60_000;
const ENDPOINTS = ["https://data-api.binance.vision", "https://api.binance.com"];

const fetchKlines = async (symbol: string, interval: string, startMs: number): Promise<any[]> => {
  for (const base of ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(
        `${base}/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startMs}&limit=1000`,
        { cache: "no-store", signal: controller.signal }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {}
  }
  return [];
};

/** Fetch & store only CLOSED candles from the last stored point (or backfill window) up to now. */
export const syncSymbolInterval = async (symbol: string, interval: string): Promise<number> => {
  const step = INTERVAL_SECONDS[interval];
  const nowSec = Math.floor(Date.now() / 1000);
  const last = lastStoredTime(symbol, interval);
  let startSec = last !== null ? last + step : nowSec - BACKFILL_DAYS * 86400;
  let written = 0;

  for (let page = 0; page < 30; page++) {
    const klines = await fetchKlines(symbol, interval, startSec * 1000);
    if (!klines.length) break;
    const closed: StoredCandle[] = klines
      .map((k: any) => ({
        time: Math.floor(Number(k[0]) / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }))
      .filter((c) => c.time + step <= nowSec); // drop the still-forming candle
    written += appendCandles(symbol, interval, closed);
    const lastKline = Math.floor(Number(klines[klines.length - 1][0]) / 1000);
    if (klines.length < 1000 || lastKline + step > nowSec) break;
    startSec = lastKline + step;
  }
  return written;
};

export const syncAll = async () => {
  for (const symbol of COLLECT_SYMBOLS) {
    for (const interval of COLLECT_INTERVALS) {
      try {
        await syncSymbolInterval(symbol, interval);
      } catch (e) {
        console.error(`[candle-collector] ${symbol} ${interval} failed:`, e);
      }
    }
  }
};

let started = false;
export const startCandleCollector = () => {
  if (started) return;
  started = true;
  console.log("[candle-collector] started (backfill days:", BACKFILL_DAYS, ")");
  syncAll().catch(() => {});
  setInterval(() => syncAll().catch(() => {}), POLL_MS);
};
