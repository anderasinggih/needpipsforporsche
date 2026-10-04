import type {
  Bias,
  Direction,
  FibonacciLevel,
  HarmonicPattern,
  HarmonicPoint,
  MtfConfluence,
  MtfSummary,
  MtfVerdict,
  RiskPlan,
  TechnicalContext,
  VolatilityProfile,
  VolatilityRegime,
} from "./types";

// ---------------------------------------------------------------------------
// Technical engine: indicators, genuine swing structure, MTF confluence,
// volatility regime, adaptive risk plan, Fibonacci and harmonic geometry.
// Design rule: never invent structure. If the market does not show a valid
// swing / harmonic, return nothing instead of forcing a pretty drawing.
// ---------------------------------------------------------------------------

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Pivot {
  index: number;
  time: number;
  price: number;
  kind: "HIGH" | "LOW";
}

export interface SymbolSpec {
  isGold: boolean;
  pipValue: number; // price distance per pip
  pipLabel: string;
  minSlPips: number;
  maxSlPips: number;
  defaultSlPips: number;
}

export const SPECS: Record<string, SymbolSpec> = {
  GOLD: {
    isGold: true,
    pipValue: 0.1, // 1 price unit = 10 pips
    pipLabel: "$0.10",
    minSlPips: 30,
    maxSlPips: 50,
    defaultSlPips: 35,
  },
  DEFAULT: {
    isGold: false,
    pipValue: 1, // 1 price unit = 1 pip (BTC convention)
    pipLabel: "$1",
    minSlPips: 30,
    maxSlPips: 50,
    defaultSlPips: 35,
  },
};

export const getSpec = (symbol: string): SymbolSpec => {
  const s = (symbol || "").toUpperCase();
  return s.includes("XAU") || s.includes("GOLD") || s.includes("PAXG") ? SPECS.GOLD : SPECS.DEFAULT;
};

export const toPips = (priceDistance: number, spec: SymbolSpec) => priceDistance / spec.pipValue;
export const fromPips = (pips: number, spec: SymbolSpec) => pips * spec.pipValue;
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const round = (n: number, decimals = 2) => Number(n.toFixed(decimals));

// -------------------------------------------------------------- indicators --

export const sma = (values: number[], period: number): number => {
  if (!values.length) return 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
};

/** Wilder style RSI with proper smoothing over the full window. */
export const rsi = (closes: number[], period = 14): number => {
  if (closes.length < 3) return 50;
  let gain = 0;
  let loss = 0;
  const start = Math.max(1, closes.length - period);
  for (let i = start; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  if (gain === 0 && loss === 0) return 50;
  const rs = loss === 0 ? 100 : gain / loss;
  return 100 - 100 / (1 + rs);
};

export const atr = (candles: Candle[], period = 14): number => {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(
      Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close),
      ),
    );
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length);
};

export const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const atrSeries = (candles: Candle[], period = 14): number[] => {
  const out: number[] = [];
  for (let i = 2; i <= candles.length; i++) {
    out.push(atr(candles.slice(0, i), period));
  }
  return out;
};

// ---------------------------------------------------------- swing structure --

/**
 * Fractal swing detection with ATR significance filtering.
 * A pivot only counts if it is a real local extreme and stands out from its
 * neighbours, otherwise micro-noise becomes "structure".
 */
export const detectPivots = (candles: Candle[], opts: { lookback?: number; minAtrMultiple?: number } = {}): Pivot[] => {
  const { lookback = 2, minAtrMultiple = 0.3 } = opts;
  if (candles.length < lookback * 2 + 3) return [];

  const atrNow = atr(candles) || (candles[candles.length - 1].high - candles[candles.length - 1].low) || 1;
  const minGap = atrNow * minAtrMultiple;
  const raw: Pivot[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) isHigh = false;
      if (candles[j].low <= c.low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) raw.push({ index: i, time: c.time, price: c.high, kind: "HIGH" });
    if (isLow) raw.push({ index: i, time: c.time, price: c.low, kind: "LOW" });
  }

  // Enforce strict alternation + ATR significance, keeping the most recent structure.
  const filtered: Pivot[] = [];
  for (const pivot of raw) {
    const prev = filtered[filtered.length - 1];
    if (!prev) {
      filtered.push(pivot);
      continue;
    }
    if (prev.kind === pivot.kind) {
      // Same type: keep the more extreme one (higher high / lower low).
      const replace =
        pivot.kind === "HIGH" ? pivot.price > prev.price : pivot.price < prev.price;
      if (replace) filtered[filtered.length - 1] = pivot;
      continue;
    }
    if (Math.abs(pivot.price - prev.price) < minGap) continue; // noise leg
    filtered.push(pivot);
  }

  return filtered.slice(-8);
};

export interface StructureRead {
  label: string;
  bias: Bias;
  pivotQuality: number;
  lastSwingHigh?: Pivot;
  lastSwingLow?: Pivot;
}

export const readStructure = (pivots: Pivot[]): StructureRead => {
  const highs = pivots.filter((p) => p.kind === "HIGH").slice(-2);
  const lows = pivots.filter((p) => p.kind === "LOW").slice(-2);

  if (!highs.length || !lows.length) {
    return { label: "Belum ada struktur swing yang valid", bias: "NEUTRAL", pivotQuality: 0 };
  }

  const hh = highs.length > 1 && highs[1].price > highs[0].price;
  const hl = lows.length > 1 && lows[1].price > lows[0].price;
  const lh = highs.length > 1 && highs[1].price < highs[0].price;
  const ll = lows.length > 1 && lows[1].price < lows[0].price;

  let label = "RANGE / CHOP (tanpa arah)";
  let bias: Bias = "NEUTRAL";
  if (hh && hl) {
    label = "UPTREND (Higher High + Higher Low)";
    bias = "BULLISH";
  } else if (lh && ll) {
    label = "DOWNTREND (Lower High + Lower Low)";
    bias = "BEARISH";
  } else if (hl && lh) {
    label = "COMPRESSION (Higher Low, Lower High)";
    bias = "NEUTRAL";
  } else if (hh && ll) {
    label = "EXPANSION / VOLATILE (Higher High, Lower Low)";
    bias = "NEUTRAL";
  }

  const pivotQuality = Math.round(
    clamp(25 + (highs.length > 1 ? 25 : 0) + (lows.length > 1 ? 25 : 0) + pivots.length * 2.5, 0, 100),
  );

  return {
    label,
    bias,
    pivotQuality,
    lastSwingHigh: highs[highs.length - 1],
    lastSwingLow: lows[lows.length - 1],
  };
};

// --------------------------------------------------------- MTF confluence ---

const MTF_WEIGHT: Record<string, number> = { "1M": 0.1, "5M": 0.25, "15M": 0.35, "1H": 0.3 };

/**
 * Confluence (not mere alignment): every timeframe votes with its own score,
 * weighted by horizon importance. A partial agreement reads as PARTIAL, a
 * genuine tug-of-war reads as CONFLICT and must raise the bar for entry.
 */
export const computeMtfConfluence = (matrix: Record<string, MtfSummary>): MtfConfluence => {
  const entries = Object.values(matrix || {});
  if (!entries.length) {
    return {
      score: 0,
      verdict: "UNKNOWN",
      bias: "NEUTRAL",
      aligned: [],
      opposing: [],
      neutral: [],
      notes: ["Data multi-timeframe tidak tersedia, analisis confluence dilewati."],
    };
  }

  let bull = 0;
  let bear = 0;
  let total = 0;
  const aligned: string[] = [];
  const opposing: string[] = [];
  const neutral: string[] = [];
  const notes: string[] = [];

  for (const tf of entries) {
    const weight = MTF_WEIGHT[tf.tf] ?? 0.2;
    const trending = tf.smaFast !== tf.smaSlow;
    const separation = tf.smaFast === tf.smaSlow ? 0 : Math.abs(tf.smaFast - tf.smaSlow) / (tf.lastClose || 1);
    const momentumAligned = tf.trend === "BULLISH" ? tf.rsi >= 45 : tf.rsi <= 55;
    const exhausted = tf.trend === "BULLISH" ? tf.rsi >= 78 : tf.rsi <= 22;
    const flat = !trending;

    // Per-timeframe conviction: trend direction + SMA separation + RSI confirmation.
    let score = weight * (flat ? 0.35 : 1);
    score *= 0.6 + Math.min(1, separation * 120);
    if (momentumAligned) score *= 1.12;
    if (exhausted) score *= 0.55;

    total += weight;
    if (tf.trend === "BULLISH") bull += score;
    else bear += score;

    if (exhausted || flat) neutral.push(tf.tf);
    else if (tf.trend === "BULLISH") aligned.push(tf.tf);
    else opposing.push(tf.tf);

    if (exhausted) notes.push(`${tf.tf} RSI ${tf.rsi} sudah ekstrem, continuation berisiko fade.`);
    if (flat) notes.push(`${tf.tf} tanpa arah (SMA datar), tidak layak jadi dasar entry.`);
  }

  const net = bull - bear;
  const denom = Math.max(0.0001, bull + bear);
  const score = Math.round(clamp(Math.abs(net / denom) * 100, 0, 100));
  const bias: Bias = score < 15 ? "NEUTRAL" : net > 0 ? "BULLISH" : "BEARISH";

  let verdict: MtfVerdict;
  if (score >= 65) verdict = "STRONG_CONFLUENCE";
  else if (score >= 30) verdict = "PARTIAL";
  else verdict = "CONFLICT";

  if (aligned.length && opposing.length) {
    notes.push(`Pull of war: ${aligned.join("/")} vs ${opposing.join("/")} — butuh konfirmasi ekstra, bukan averaging.`);
  }
  if (!aligned.length && !opposing.length) notes.push("Seluruh timeframe flat, tidak ada directional edge.");
  if (entries.length < 3) notes.push(`Hanya ${entries.length} timeframe ter-sync, confidence confluence dipotong.`);
  if (total < 0.9) notes.push("Bobot horizon tinggi belum lengkap.");

  return { score, verdict, bias, aligned, opposing, neutral, notes };
};

// ------------------------------------------------------- volatility regime ---

const REGIME_LABEL: Record<VolatilityRegime, string> = {
  COMPRESSION: "Kompresi Volatilitas",
  NORMAL: "Volatilitas Normal",
  EXPANSION: "Ekspansi Volatilitas",
  CRISIS: "Krisis Volatilitas",
  UNKNOWN: "Volatilitas Tidak Diketahui",
};

const REGIME_ADVICE: Record<VolatilityRegime, string> = {
  COMPRESSION:
    "Harga terkompresi, energy tersimpan. SL boleh rapat (30-32 pips) tapi tunggu breakout dengan konfirmasi, jangan predict arah.",
  NORMAL:
    "Regime normal, SL standar 36-40 pips dan RR penuh bisa dipertahankan.",
  EXPANSION:
    "Volatilitas melebar, noise tinggi. Stop harus lebih lebar (44-46 pips) dan target dipangkas agar RR tetap masuk akal.",
  CRISIS:
    "Market liar, spread dan slippage tinggi. Hentikan trading, tunggu range terbentuk atau reduksi lot drastis.",

  UNKNOWN: "Data volatilitas terbatas, gunakan parameter default konservatif.",
};

export const classifyVolatility = (
  atrValue: number,
  price: number,
  historyAtr: number[],
): VolatilityProfile => {
  const atrPct = price > 0 ? (atrValue / price) * 100 : 0;
  const med = median(historyAtr.filter((v) => v > 0)) || atrValue || 1;
  const atrVsMedian = atrValue > 0 && med > 0 ? Number((atrValue / med).toFixed(2)) : 1;

  let regime: VolatilityRegime = "NORMAL";
  if (atrValue <= 0) regime = "UNKNOWN";
  else if (atrVsMedian < 0.7 && atrPct < 0.12) regime = "COMPRESSION";
  else if (atrVsMedian > 1.9 || atrPct > 0.55) regime = "CRISIS";
  else if (atrVsMedian > 1.3 || atrPct > 0.28) regime = "EXPANSION";

  return {
    regime,
    label: REGIME_LABEL[regime],
    atr: round(atrValue),
    atrPct: round(atrPct, 3),
    atrVsMedian,
    advice: REGIME_ADVICE[regime],
  };
};

/** Regime-driven stop budget, always inside the mandated 30-50 pip corridor. */
export const regimeSlPips = (regime: VolatilityRegime, spec: SymbolSpec): number => {
  switch (regime) {
    case "COMPRESSION":
      return clamp(spec.minSlPips + 2, spec.minSlPips, spec.maxSlPips);
    case "EXPANSION":
      return 45;
    case "CRISIS":
      return spec.maxSlPips;
    case "UNKNOWN":
      return spec.defaultSlPips;
    default:
      return 38;
  }
};

export const rrTargetFor = (verdict: MtfVerdict, regime: VolatilityRegime): number => {
  let rr = 2.5;
  if (verdict === "STRONG_CONFLUENCE") rr = 3;
  else if (verdict === "PARTIAL") rr = 2.5;
  else if (verdict === "CONFLICT") rr = 2;
  if (verdict === "UNKNOWN") rr = 2;
  if (regime === "EXPANSION") rr = Math.min(rr, 2.2);
  if (regime === "CRISIS") rr = 2;
  return rr;
};

export const planRisk = (opts: {
  price: number;
  direction: Direction;
  atrValue: number;
  volatility: VolatilityProfile;
  mtfVerdict: MtfVerdict;
  structuralSlPips: number | null;
  spec: SymbolSpec;
  targetRr?: number | undefined;
}): RiskPlan => {
  const { price, direction, atrValue, volatility, mtfVerdict, structuralSlPips, spec, targetRr } = opts;
  const notes: string[] = [];

  const regimeTarget = regimeSlPips(volatility.regime, spec);
  const atrPips = toPips(atrValue, spec);

  let structural = structuralSlPips;
  if (structural != null && !Number.isFinite(structural)) structural = null;

  // Volatility floor: the stop must never be tighter than real noise.
  const noiseFloorPips = Math.max(spec.minSlPips, Math.ceil(atrPips * 1.1));
  if (noiseFloorPips > regimeTarget) {
    notes.push(
      `ATR ${round(atrPips)} pips memaksa SL minimal ${noiseFloorPips} pips agar tidak tersapu noise.`,
    );
  }

  const candidates = [regimeTarget, noiseFloorPips];
  if (structural != null && structural > 0) candidates.push(Math.ceil(structural));

  let slPips = Math.max(...candidates);
  let slBasis = `Regime ${volatility.label} (${regimeTarget} pips)`;

  if (slPips < spec.minSlPips) {
    slPips = spec.minSlPips;
    slBasis = `Floor risiko minimal ${spec.minSlPips} pips`;
  }
  if (structural != null && structural > spec.maxSlPips) {
    notes.push(
      `Struktur demanding SL ${Math.ceil(structural)} pips, melebihi budget ${spec.maxSlPips} pips. Edge tidak layak dieksekusi dengan risiko ini → WAIT.`,
    );
    slBasis += `; struktur ${Math.ceil(structural)} pips > batas risiko`;
  }
  slPips = clamp(Math.round(slPips), spec.minSlPips, spec.maxSlPips);
  if (structural != null && structural >= regimeTarget && structural <= spec.maxSlPips) {
    slBasis = `Di balik swing struktural (${Math.ceil(structural)} pips) + buffer ATR`;
  }

  let rr = (typeof targetRr === "number" && targetRr >= 1) ? targetRr : rrTargetFor(mtfVerdict, volatility.regime);
  let tpPips = Math.round(slPips * rr);

  // Feasibility cap: do not ask for a move the market cannot deliver in scope.
  const maxFeasibleTp = Math.max(Math.round(slPips * 1.5), Math.round(atrPips * 4.5));
  if (tpPips > maxFeasibleTp && !targetRr) {
    tpPips = maxFeasibleTp;
    notes.push(
      `TP dikoreksi ke ${tpPips} pips karena ATR ${round(atrPips)} pips tidak mendukung target ${slPips * rr} pips dalam window scalping.`,
    );
  }
  const minFeasibleTp = Math.round(slPips * 1.5);
  if (tpPips < minFeasibleTp) tpPips = minFeasibleTp;

  rr = Number((tpPips / slPips).toFixed(2));

  const slDistance = fromPips(slPips, spec);
  const tpDistance = fromPips(tpPips, spec);
  const long = direction === "BULLISH";

  return {
    slPips,
    tpPips,
    slPrice: round(long ? price - slDistance : price + slDistance),
    tpPrice: round(long ? price + tpDistance : price - tpDistance),
    rr,
    slBasis,
    structuralSlPips: structural != null ? Math.round(structural) : null,
    regimeSlPips: regimeTarget,
    notes,
  };
};

// ------------------------------------------------------------- fibonacci -----

export interface ImpulseLeg {
  direction: Direction;
  from: { time: number; price: number };
  to: { time: number; price: number };
  sizePips: number;
}

/** The most recent significant impulse leg — retracements are measured from it. */
export const findImpulseLeg = (
  pivots: Pivot[],
  atrValue: number,
  spec: SymbolSpec,
): ImpulseLeg | undefined => {
  if (pivots.length < 2) return undefined;
  for (let i = pivots.length - 1; i >= 1; i--) {
    const from = pivots[i - 1];
    const to = pivots[i];
    const size = Math.abs(to.price - from.price);
    if (size >= atrValue * 1.5) {
      return {
        direction: to.price > from.price ? "BULLISH" : "BEARISH",
        from: { time: from.time, price: from.price },
        to: { time: to.time, price: to.price },
        sizePips: Math.round(toPips(size, spec)),
      };
    }
  }
  return undefined;
};

/**
 * Fibonacci anchored to the real impulse leg, applied in the correct direction:
 * after an UP leg (low → high) retracements measure DOWN from the high,
 * after a DOWN leg (high → low) retracements measure UP from the low.
 */
export const buildFibonacci = (opts: {
  leg: ImpulseLeg;
  price: number;
  spec: SymbolSpec;
}): { high: { time: number; price: number }; low: { time: number; price: number }; levels: FibonacciLevel[]; goldenPocket: NonNullable<TechnicalContext["goldenPocket"]> } => {
  const { leg, price, spec } = opts;
  const high = leg.direction === "BULLISH" ? leg.to : leg.from;
  const low = leg.direction === "BULLISH" ? leg.from : leg.to;
  const range = Math.max(spec.pipValue, Math.abs(high.price - low.price));

  const ratios = [
    { ratio: 0.236, label: "0.236" },
    { ratio: 0.382, label: "0.382" },
    { ratio: 0.5, label: "0.500 (Eq)" },
    { ratio: 0.618, label: "0.618 (Golden Pocket)" },
    { ratio: 0.786, label: "0.786" },
  ];

  const levels: FibonacciLevel[] = ratios.map((r) => {
    const price =
      leg.direction === "BULLISH" ? high.price - range * r.ratio : low.price + range * r.ratio;
    return { ratio: r.ratio, label: r.label, price: round(price) };
  });

  const pocketLow =
    leg.direction === "BULLISH" ? high.price - range * 0.618 : low.price + range * 0.5;
  const pocketHigh =
    leg.direction === "BULLISH" ? high.price - range * 0.5 : low.price + range * 0.618;
  const zoneLow = Math.min(pocketLow, pocketHigh);
  const zoneHigh = Math.max(pocketLow, pocketHigh);
  const priceInside = price >= zoneLow && price <= zoneHigh;

  return {
    high,
    low,
    levels,
    goldenPocket: {
      zoneLow: round(zoneLow),
      zoneHigh: round(zoneHigh),
      direction: leg.direction,
      priceInside,
      distancePips: Math.round(toPips(Math.min(Math.abs(price - zoneLow), Math.abs(price - zoneHigh)), spec)),
    },
  };
};

// -------------------------------------------------------------- harmonic -----

interface HarmonicSpec {
  name: string;
  bMin: number;
  bMax: number;
  tolerance: number;
  dFactor: number;
  dOf: "XA_MINUS_AB" | "BC";
}

const HARMONIC_SPECS: HarmonicSpec[] = [
  { name: "Gartley", bMin: 0.55, bMax: 0.68, tolerance: 0.06, dFactor: 1, dOf: "XA_MINUS_AB" },
  { name: "Bat", bMin: 0.34, bMax: 0.92, tolerance: 0.11, dFactor: 0.886, dOf: "BC" },
  { name: "Butterfly", bMin: 0.74, bMax: 0.82, tolerance: 0.06, dFactor: 1.27, dOf: "XA_MINUS_AB" },
  { name: "Deep Crab", bMin: 0.78, bMax: 0.9, tolerance: 0.11, dFactor: 1.618, dOf: "XA_MINUS_AB" },
];

/**
 * Genuine harmonic detection with real ratio validation.
 * Requires strict X<A<B<C<D time order, alternating swing types, B retrace and
 * C projection inside the pattern's own ratio band. Returns undefined when the
 * market does not actually print the pattern instead of forcing one.
 */
export const detectHarmonic = (
  candles: Candle[],
  pivots: Pivot[],
  price: number,
): HarmonicPattern | undefined => {
  if (candles.length < 30 || pivots.length < 4) return undefined;

  const window = pivots.slice(-5);
  const lastPivot = pivots[pivots.length - 1];

  for (let i = window.length - 4; i >= 0; i--) {
    const [x, a, b, c] = window.slice(i, i + 4);
    if (!x || !a || !b || !c) continue;
    if (!(x.time < a.time && a.time < b.time && b.time < c.time)) continue;
    if (x.kind === a.kind || a.kind === b.kind || b.kind === c.kind) continue;

    const type: "BULLISH" | "BEARISH" = x.kind === "LOW" ? "BULLISH" : "BEARISH";
    const xa = Math.abs(a.price - x.price);
    const ab = Math.abs(b.price - a.price);
    const bc = Math.abs(c.price - b.price);
    if (xa <= 0 || ab <= 0 || bc <= 0) continue;

    const bRetrace = ab / xa;
    const cProjection = bc / xa;
    // C must extend XA, B must not exceed X.
    if (cProjection < 1.05 || cProjection > 1.75) continue;

    for (const spec of HARMONIC_SPECS) {
      const center = (spec.bMin + spec.bMax) / 2;
      const inBand = bRetrace >= spec.bMin - spec.tolerance && bRetrace <= spec.bMax + spec.tolerance;
      const centered = Math.abs(bRetrace - center) <= spec.tolerance * 1.8;
      if (!inBand || !centered) continue;

      const legSize = spec.dOf === "BC" ? bc * spec.dFactor : Math.max(0, xa - ab);
      if (legSize <= 0) continue;

      const dPrice = type === "BULLISH" ? c.price - legSize : c.price + legSize;
      if (!Number.isFinite(dPrice)) continue;
      // D must complete beyond C in the trade direction.
      if (type === "BULLISH" ? dPrice >= c.price : dPrice <= c.price) continue;

      const cdExtension = Math.abs(dPrice - c.price) / xa;
      const distToPrice = Math.abs(price - dPrice) / Math.max(1e-9, price);
      const quality = Math.round(
        clamp(
          100 -
            Math.abs(bRetrace - center) * 220 -
            Math.max(0, cProjection - 1.45) * 60 -
            distToPrice * 120,
          20,
          98,
        ),
      );
      if (quality < 45) continue;

      return {
        name: spec.name,
        type,
        points: [
          { label: "X", time: x.time, price: round(x.price) },
          { label: "A", time: a.time, price: round(a.price) },
          { label: "B", time: b.time, price: round(b.price) },
          { label: "C", time: c.time, price: round(c.price) },
          { label: "D", time: Math.max(c.time + 1, lastPivot.time), price: round(dPrice) },
        ],
        ratios: {
          bRetrace: Number(bRetrace.toFixed(3)),
          cProjection: Number(cProjection.toFixed(3)),
          cdExtension: Number(cdExtension.toFixed(3)),
        },
        completionPending: distToPrice > 0.0015,
        quality,
      };
    }
  }

  return undefined;
};

// ------------------------------------------------------------- structure -----

export const buildTechnicalContext = (opts: {
  symbol: string;
  price: number;
  timeframe: string;
  candles: Candle[];
  mtfMatrix: Record<string, MtfSummary>;
  direction: Direction;
}): TechnicalContext => {
  const { price, candles, mtfMatrix, direction } = opts;
  const spec = getSpec(opts.symbol);

  const closes = candles.map((c) => c.close);
  const currentRsi = closes.length >= 5 ? rsi(closes) : 50;
  const smaFast = closes.length >= 5 ? sma(closes, 5) : price;
  const smaSlow = closes.length >= 15 ? sma(closes, 15) : sma(closes, Math.max(1, closes.length));

  const atrValue = candles.length >= 5 ? atr(candles) : (spec.isGold ? 0.35 : 8.5);
  const history = atrSeries(candles).filter((v) => v > 0);
  const volatility = classifyVolatility(atrValue, price, history);

  const pivots = detectPivots(candles);
  const structure = readStructure(pivots);
  const mtfConfluence = computeMtfConfluence(mtfMatrix);

  const long = direction === "BULLISH";
  const protectivePivot = long
    ? [...pivots].reverse().find((p) => p.kind === "LOW")
    : [...pivots].reverse().find((p) => p.kind === "HIGH");
  const buffer = atrValue * 0.25;
  const structuralSlPips = protectivePivot
    ? Math.ceil(toPips(Math.abs(price - protectivePivot.price) + buffer, spec))
    : null;

  const leg = findImpulseLeg(pivots, atrValue, spec);
  const fib = leg ? buildFibonacci({ leg, price, spec }) : undefined;

  return {
    atr: round(atrValue),
    atrPips: Math.round(toPips(atrValue, spec)),
    atrPct: volatility.atrPct,
    rsi: round(currentRsi),
    smaFast: round(smaFast),
    smaSlow: round(smaSlow),
    volatility,
    mtfConfluence,
    structure: structure.label,
    structureBias: structure.bias,
    pivotQuality: structure.pivotQuality,
    goldenPocket: fib?.goldenPocket,
    impulseLeg: leg,
    structuralSlPips: structuralSlPips ?? undefined,
  };
};
