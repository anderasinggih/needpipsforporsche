// ---------------------------------------------------------------------------
// Trade lifecycle resolver — shared by the dashboard history log and the chart
// position box so both agree on when a setup is actually running and when it
// really resolved.
//
// Two rules make the difference between an honest WIN/LOSE ledger and noise:
//   1. Anchor gate — nothing that happened BEFORE the setup exists can resolve
//      it. A pullback buy whose stop sits under the swing that price just came
//      down from would otherwise be "stopped out" instantly by history.
//   2. Fill gate — TP/SL only count after price actually traded the entry.
//      Until then the setup is armed, not dead.
// ---------------------------------------------------------------------------

export type TradeOutcome = "WIN" | "LOSE" | "WAIT" | "ACTIVE";

export interface OutcomeBar {
  time: number; // unix seconds
  high: number;
  low: number;
  close: number;
}

export interface OutcomeLevels {
  signal: "BUY" | "SELL";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  /** Unix seconds the setup was created. Bars at or before it are pre-trade. */
  anchorTime: number;
  /** Market price when the council produced the setup. */
  setupPrice?: number;
}

export interface OutcomeState {
  outcome: TradeOutcome;
  /** TP or SL price the setup resolved at. */
  resolvedPrice?: number;
  /** Unix seconds of the bar that resolved the setup. */
  resolvedTime?: number;
  /** True once price traded through the entry level. */
  entryFilled: boolean;
  /** Unix seconds the entry was filled, when it happened. */
  filledTime?: number;
  /** Extreme price traded while the trade was live. */
  extremeHigh: number;
  extremeLow: number;
}

/**
 * When one bar's range swallows both TP and SL the intrabar order is unknowable
 * from OHLC alone. Price has to cross the level nearest the entry first, so the
 * nearer level is treated as the one that resolved the trade.
 */
const nearestLevelWins = (entry: number, tp: number, sl: number): "WIN" | "LOSE" =>
  Math.abs(tp - entry) <= Math.abs(entry - sl) ? "WIN" : "LOSE";

const isUsableBar = (bar: OutcomeBar | null | undefined): bar is OutcomeBar =>
  Boolean(bar) && typeof bar!.time === "number" && Number.isFinite(bar!.time);

export const resolveTradeOutcome = (
  levels: OutcomeLevels,
  bars: OutcomeBar[] = [],
  liveBar?: OutcomeBar | null,
): OutcomeState => {
  const isLong = levels.signal === "BUY";
  const { entryPrice, stopLoss, takeProfit, anchorTime } = levels;

  // For a BUY/Long pullback order (setupPrice >= entryPrice): price must drop to or below entry (low <= entryPrice).
  // For a BUY/Long breakout order (setupPrice < entryPrice): price must rise to or above entry (high >= entryPrice).
  // For a SELL/Short pullback order (setupPrice <= entryPrice): price must bounce up to or above entry (high >= entryPrice).
  // For a SELL/Short breakdown order (setupPrice > entryPrice): price must drop to or below entry (low <= entryPrice).
  const isPullback = levels.setupPrice !== undefined
    ? (isLong ? levels.setupPrice >= entryPrice : levels.setupPrice <= entryPrice)
    : false;

  const touchedEntry = (high: number, low: number) => {
    if (isLong) {
      return isPullback ? low <= entryPrice : high >= entryPrice;
    } else {
      return isPullback ? high >= entryPrice : low <= entryPrice;
    }
  };

  const touchedTp = (high: number, low: number) => (isLong ? high >= takeProfit : low <= takeProfit);
  const touchedSl = (high: number, low: number) => (isLong ? low <= stopLoss : high >= stopLoss);

  let extremeHigh = -Infinity;
  let extremeLow = Infinity;
  // A setup is only considered filled at inception if market price was essentially already touching entry price
  // AND it wasn't a designated pullback/limit order waiting away from current market price.
  let entryFilled = levels.setupPrice !== undefined
    ? Math.abs(levels.setupPrice - entryPrice) <= Math.max(0.1, entryPrice * 0.0003)
    : false;
  let filledTime: number | undefined = entryFilled ? anchorTime : undefined;
  let resolvedAt: { outcome: "WIN" | "LOSE"; price: number; time: number } | undefined;

  const track = (high: number, low: number, time: number) => {
    if (!entryFilled) {
      if (!touchedEntry(high, low)) return;
      entryFilled = true;
      filledTime = time;
    }
    if (high > extremeHigh) extremeHigh = high;
    if (low < extremeLow) extremeLow = low;

    const tp = touchedTp(high, low);
    const sl = touchedSl(high, low);
    if (tp || sl) {
      // If both TP and SL are touched in the same bar, nearest level wins
      const outcome = tp && sl ? nearestLevelWins(entryPrice, takeProfit, stopLoss) : tp ? "WIN" : "LOSE";
      resolvedAt = { outcome, price: outcome === "WIN" ? takeProfit : stopLoss, time };
    }
  };

  // 1. Historical completed bars:
  // ONLY bars STRICTLY AFTER anchorTime (time > anchorTime) represent market action
  // that took place after the trade was generated!
  // Any bar where time <= anchorTime occurred before or during setup creation;
  // evaluating its historical high/low leaks pre-setup wicks into the trade lifecycle.
  const ordered = bars
    .filter(isUsableBar)
    .filter((b) => b.time > anchorTime)
    .sort((a, b) => a.time - b.time);

  for (const bar of ordered) {
    if (resolvedAt) break;
    track(bar.high, bar.low, bar.time);
  }

  // 2. The live forming bar / current tick:
  // If the live candle opened strictly after anchorTime:
  // we check the live price (close) and extreme wicks.
  // If the live candle is the anchor candle itself (time === anchorTime), ONLY its live close/current price
  // matters — its low/high from earlier minutes before the user clicked evaluate is pre-trade history!
  if (!resolvedAt && isUsableBar(liveBar)) {
    if (liveBar!.time > anchorTime) {
      track(liveBar!.high, liveBar!.low, liveBar!.time);
    } else if (liveBar!.time === anchorTime) {
      // Only track current price (close) of the anchor bar, NEVER its prior wick
      track(liveBar!.close, liveBar!.close, liveBar!.time);
    }
  }

  return {
    outcome: resolvedAt ? resolvedAt.outcome : "ACTIVE",
    resolvedPrice: resolvedAt?.price,
    resolvedTime: resolvedAt?.time,
    entryFilled,
    filledTime,
    extremeHigh: Number.isFinite(extremeHigh) ? extremeHigh : entryPrice,
    extremeLow: Number.isFinite(extremeLow) ? extremeLow : entryPrice,
  };
};
