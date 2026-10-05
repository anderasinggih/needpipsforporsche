import fs from "fs";
import path from "path";

/**
 * Binary candle store (.dat), one file per symbol+interval.
 * Record layout (48 bytes, little-endian): time(sec), open, high, low, close, volume — all float64.
 */
export interface StoredCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const RECORD_SIZE = 48;
const DATA_DIR = process.env.CANDLE_DATA_DIR || path.join(process.cwd(), "data", "candles");

export const INTERVAL_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
};

const fileFor = (symbol: string, interval: string) =>
  path.join(DATA_DIR, `${symbol.toUpperCase()}_${interval}.dat`);

const encode = (c: StoredCandle): Buffer => {
  const buf = Buffer.alloc(RECORD_SIZE);
  buf.writeDoubleLE(c.time, 0);
  buf.writeDoubleLE(c.open, 8);
  buf.writeDoubleLE(c.high, 16);
  buf.writeDoubleLE(c.low, 24);
  buf.writeDoubleLE(c.close, 32);
  buf.writeDoubleLE(c.volume, 40);
  return buf;
};

const decode = (buf: Buffer, off: number): StoredCandle => ({
  time: buf.readDoubleLE(off),
  open: buf.readDoubleLE(off + 8),
  high: buf.readDoubleLE(off + 16),
  low: buf.readDoubleLE(off + 24),
  close: buf.readDoubleLE(off + 32),
  volume: buf.readDoubleLE(off + 40),
});

const ensureDir = () => fs.mkdirSync(DATA_DIR, { recursive: true });

/** Read last `limit` candles (all if omitted). */
export const readCandles = (symbol: string, interval: string, limit?: number): StoredCandle[] => {
  const file = fileFor(symbol, interval);
  if (!fs.existsSync(file)) return [];
  const size = fs.statSync(file).size;
  const total = Math.floor(size / RECORD_SIZE);
  const count = limit ? Math.min(limit, total) : total;
  if (count <= 0) return [];
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(count * RECORD_SIZE);
    fs.readSync(fd, buf, 0, buf.length, (total - count) * RECORD_SIZE);
    const out: StoredCandle[] = [];
    for (let i = 0; i < count; i++) out.push(decode(buf, i * RECORD_SIZE));
    return out;
  } finally {
    fs.closeSync(fd);
  }
};

export const lastStoredTime = (symbol: string, interval: string): number | null => {
  const last = readCandles(symbol, interval, 1);
  return last.length ? last[0].time : null;
};

/**
 * Append candles (must be closed candles, sorted ascending). Candles with time <= last stored time
 * are skipped, so calls are idempotent. Returns number of records written.
 */
export const appendCandles = (symbol: string, interval: string, candles: StoredCandle[]): number => {
  if (!candles.length) return 0;
  ensureDir();
  const lastTime = lastStoredTime(symbol, interval) ?? -Infinity;
  const fresh = candles.filter((c) => c.time > lastTime).sort((a, b) => a.time - b.time);
  if (!fresh.length) return 0;
  fs.appendFileSync(fileFor(symbol, interval), Buffer.concat(fresh.map(encode)));
  return fresh.length;
};
