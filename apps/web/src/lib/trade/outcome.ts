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

  const touchedEntry = (high: number, low: number) => (isLong ? high >= entryPrice : low <= entryPrice);
  const touchedTp = (high: number, low: number) => (isLong ? high >= takeProfit : low <= takeProfit);
  const touchedSl = (high: number, low: number) => (isLong ? low <= stopLoss : high >= stopLoss);

  let extremeHigh = -Infinity;
  let extremeLow = Infinity;
  let entryFilled = false;
  let filledTime: number | undefined;
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
      const outcome = tp && sl ? nearestLevelWins(entryPrice, takeProfit, stopLoss) : tp ? "WIN" : "LOSE";
      resolvedAt = { outcome, price: outcome === "WIN" ? takeProfit : stopLoss, time };
    }
  };

  // A setup whose entry IS the market price at evaluation is a market entry: it
  // is filled the moment the council speaks, so it must not sit waiting for a
  // retest that will never come.
  const setupPrice = levels.setupPrice;
  if (setupPrice !== undefined && Math.abs(setupPrice - entryPrice) <= 0.05) {
    entryFilled = true;
    filledTime = anchorTime;
  }

  const ordered = bars
    .filter(isUsableBar)
    .filter((b) => b.time > anchorTime)
    .sort((a, b) => a.time - b.time);

  for (const bar of ordered) {
    if (resolvedAt) break;
    track(bar.high, bar.low, bar.time);
  }

  // The bar that is forming right now. When it opened AFTER the anchor its full
  // range is post-setup, otherwise only its close is trustworthy — the rest of
  // its range happened before the trade existed.
  if (!resolvedAt && isUsableBar(liveBar)) {
    if (liveBar!.time > anchorTime) {
      track(liveBar!.high, liveBar!.low, liveBar!.time);
    } else {
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
