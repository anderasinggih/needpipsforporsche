import {
  DESTRUCTIVE_STATES,
  EMOTION_META,
  clamp,
  normalizeEmotion,
} from "./emotions";
import type {
  AgentOpinion,
  Bias,
  ConsensusResult,
  Direction,
  Expectancy,
  MtfConfluence,
  MtfVerdict,
  VolatilityRegime,
} from "./types";

// ---------------------------------------------------------------------------
// Consensus + decision layer.
// Majority counting loses money. Votes are weighted by confidence, by how
// evidence-dense the reasoning is, by role relevance to the current market
// regime, and finally discounted by the psychology of the mind casting them
// (greed / impulse / overconfidence shrink or veto a vote).
// ---------------------------------------------------------------------------

export interface RoleProfile {
  role: string;
  mandate: string;
  edgeCriteria: string[];
  psychologyBrief: string;
  preferredEmotions: string[];
}

export interface ConsensusContext {
  mtfConfluence: MtfConfluence;
  regime: VolatilityRegime;
  rsi: number;
  structureBias: Bias;
  /** Roles that matter more than usual for the current regime. */
  roleWeights: Record<string, number>;
}

const REASONING_HINTS = [
  /\d+([.,]\d+)?\s*(pips?|pip|%|\$|x\b|r:|rasio|menit|candle|bar)/i,
  /(m1|m5|m15|h1|timeframe|konfluens|konfirmasi|confluence)/i,
  /(sl|stop|invalid|batal|support|resistance|level|harga|support)/i,
];

const VAGUE_HINTS = /(mungkin|sepertinya|agsi|agak|kira-?kira|potential|maybe|kemungkinan besar|ratanya)/i;

/** Heuristic 0-100 score for how verifiable / evidence-dense a mind's read is. */
export const scoreReasoningQuality = (input: {
  keyObservation: string;
  detailedAnalysis: string;
  evidence: string[];
  confidence: number;
  bias: Bias;
}): number => {
  const text = `${input.keyObservation} ${input.detailedAnalysis} ${input.evidence.join(" ")}`;
  const digits = (text.match(/\d/g) || []).length;
  const hintHits = REASONING_HINTS.filter((re) => re.test(text)).length;
  const evidenceCount = Math.min(input.evidence.length, 4);
  const length = text.trim().length;

  let score = 18;
  score += hintHits * 14;
  score += evidenceCount * 8;
  score += Math.min(18, digits * 1.4);
  if (length > 180) score += 10;
  if (length < 60) score -= 18;
  if (VAGUE_HINTS.test(text)) score -= 14;
  if (input.bias === "NEUTRAL" && input.confidence > 70) score -= 12; // confident but directionless
  if (input.evidence.length === 0) score -= 10;

  return Math.round(clamp(score));
};

export const computeVoteWeight = (opts: {
  agent: AgentOpinion;
  roleWeight: number;
}): { weight: number; vetoed: boolean; vetoReason?: string } => {
  const { agent, roleWeight } = opts;
  const meta = EMOTION_META[agent.emotion] || EMOTION_META.NEUTRAL;

  let weight =
    roleWeight *
    (0.55 + clamp(agent.confidence, 0, 100) / 145) *
    (0.6 + (agent.reasoningQuality / 100) * 0.55) *
    meta.voteFactor;

  // Psychology discounts: the closer a mind is to a destructive state, the less
  // its opinion counts.
  if (DESTRUCTIVE_STATES.includes(agent.emotion)) weight *= 0.75;
  if (agent.psychology.fomoResistance < 45) weight *= 0.85;
  if (agent.psychology.executionReadiness < 25) weight *= 0.9;

  // Hard veto: impulsivity and overconfidence are not tradable opinions.
  let vetoReason: string | undefined;
  const impulsive = agent.emotion === "IMPULSIVE" || agent.emotion === "AGGRESSIVE";
  const overconfident = agent.emotion === "OVERCONFIDENT";
  const revenge = agent.psychology.riskFlags.some((f) => /revenge/i.test(f));

  if (impulsive && agent.confidence > 60) {
    vetoReason = `Veto psikologis: emosi ${meta.label.toLowerCase()} membuat level entry(${agent.confidence}%) tidak dapat dipercaya.`;
  } else if (overconfident && agent.confidence > 70) {
    vetoReason = `Veto psikologis: overconfidence ${agent.confidence}% tanpa bukti proporsional.`;
  } else if (revenge) {
    vetoReason = "Veto psikologis: indikasi revenge trading, suara diabaikan.";
  }

  const vetoed = Boolean(vetoReason);
  if (vetoed) weight = 0;

  return { weight: Number(Math.max(0, weight).toFixed(3)), vetoed, vetoReason };
};

/** Which council minds deserve extra hearing in this exact market regime. */
export const deriveRoleWeights = (ctx: Omit<ConsensusContext, "roleWeights">): Record<string, number> => {
  const weights: Record<string, number> = {};
  const add = (frag: RegExp, w: number) => {
    for (const key of Object.keys(ROLE_PATTERNS)) {
      if (key.match(frag)) weights[key] = w;
    }
  };

  add(/risk|volatil|arbiter/i, 1);
  add(/multi.*tf|timeframe/i, 1);
  add(/structure|smart money/i, 1);
  add(/harmonic/i, 1);
  add(/volume|liquidity/i, 1);

  if (ctx.mtfConfluence.verdict === "CONFLICT") {
    add(/multi.*tf|timeframe/i, 1.55);
    add(/structure|smart money/i, 1.3);
    add(/harmonic/i, 0.75);
  }
  if (ctx.mtfConfluence.verdict === "STRONG_CONFLUENCE") {
    add(/momentum|trend/i, 1.35);
    add(/fibonacci/i, 1.2);
  }
  if (ctx.regime === "CRISIS" || ctx.regime === "EXPANSION") {
    add(/risk|volatil|arbiter/i, 1.45);
    add(/volume|liquidity/i, 1.15);
    add(/harmonic/i, 0.7);
  }
  if (ctx.regime === "COMPRESSION") {
    add(/volatil|risk/i, 1.25);
    add(/volume|liquidity/i, 1.2);
  }
  if (ctx.rsi >= 72 || ctx.rsi <= 28) {
    add(/momentum|trend/i, 0.8); // fading exhaustion, not chasing
    add(/retracement|fibonacci/i, 1.25);
  }
  return weights;
};

export const ROLE_PATTERNS: Record<string, RegExp> = {
  chief: /chief|arbiter|synthes/i,
  structure: /structure|smart money/i,
  liquidity: /liquidity|volume/i,
  momentum: /momentum|trend/i,
  risk: /risk|volatil/i,
  harmonic: /harmonic|xabcd/i,
  fibonacci: /fibonacci|retracement/i,
  mtf: /multi|tf|confirmation/i,
  volume: /volume|profile/i,
  quant: /quant|invalidation|backup/i,
};

export const roleWeightFor = (role: string, roleWeights: Record<string, number>): number => {
  let best = 1;
  let found = false;
  for (const [key, weight] of Object.entries(roleWeights)) {
    if (role.match(ROLE_PATTERNS[key])) {
      if (!found || weight > best) {
        best = weight;
        found = true;
      }
    }
  }
  return found ? best : 1;
};

/**
 * Weighted council vote + no-trade logic.
 * Returns BUY / SELL / WAIT — WAIT is a first class, money-preserving outcome.
 */
export const runConsensus = (opts: {
  agents: AgentOpinion[];
  ctx: ConsensusContext;
  checklistMet: boolean;
}): ConsensusResult => {
  const { agents, ctx, checklistMet } = opts;
  const active = agents.filter((a) => a.status === "active");
  const vetoes: string[] = [];
  const dissenters: string[] = [];

  let bull = 0;
  let bear = 0;
  let neutral = 0;
  let totalPossible = 0;

  for (const agent of active) {
    const roleWeight = roleWeightFor(agent.role, ctx.roleWeights);
    const { weight, vetoed, vetoReason } = computeVoteWeight({ agent, roleWeight });
    agent.voteWeight = weight;
    agent.voteVetoed = vetoed;
    agent.vetoReason = vetoReason;
    if (vetoReason) vetoes.push(`${agent.agentName}: ${vetoReason}`);

    totalPossible += weight;
    if (vetoed) continue;
    if (agent.bias === "BULLISH") bull += weight;
    else if (agent.bias === "BEARISH") bear += weight;
    else {
      neutral += weight;
      // A neutral mind still leans slightly to the side it did not reject.
      const leaned = ctx.mtfConfluence.bias === "BEARISH" ? bull : bear;
      if (leaned >= 0) {
        const contribution = weight * 0.25;
        if (ctx.mtfConfluence.bias === "BEARISH") bear += contribution;
        else bull += contribution;
      }
    }
  }

  const sideTotal = bull + bear;
  const direction: Direction = bull >= bear ? "BULLISH" : "BEARISH";
  const agreement = sideTotal > 0 ? Math.abs(bull - bear) / sideTotal : 0;
  const participation = totalPossible > 0 ? sideTotal / totalPossible : 0;

  for (const agent of active) {
    if (agent.voteVetoed) continue;
    const aligns = (agent.bias === "BULLISH" && direction === "BULLISH") ||
      (agent.bias === "BEARISH" && direction === "BEARISH") ||
      (agent.bias === "NEUTRAL" && agent.voteWeight > 0);
    if (!aligns) dissenters.push(agent.agentName);
  }

  const confidence = Math.round(
    clamp(38 + agreement * 42 + participation * 18 + (ctx.mtfConfluence.score - 50) * 0.12),
  );

  const gate = agreementGate(ctx.mtfConfluence.verdict);
  const noTrade: string[] = [];
  if (active.length === 0) noTrade.push("Tidak ada agen aktif, tidak ada edge yang bisa dihitung.");
  if (agreement < gate) {
    noTrade.push(
      `Kesesuaian antar-agen hanya ${Math.round(agreement * 100)}% (butuh ${Math.round(gate * 100)}%) untuk confluence ${ctx.mtfConfluence.verdict}.`,
    );
  }
  if (participation < 0.5) {
    noTrade.push(`Partisipasi suara rendah (${Math.round(participation * 100)}%), majority tipis.`);
  }
  if (confidence < 55) noTrade.push(`Confidence gabungan ${confidence}% di bawah ambang 55%.`);
  if (!checklistMet) noTrade.push("Checklist disiplin trading belum terpenuhi, eksekusi dibatalkan.");
  if (ctx.regime === "CRISIS") noTrade.push("Regime volatilitas KRISIS, entry di harga sekarang tidak layak dikejar.");
  if (ctx.mtfConfluence.verdict === "CONFLICT" && confidence < 62) {
    noTrade.push("Multi-timeframe berkonflik dan confidence belum cukup untuk mengabaikannya.");
  }
  if (vetoes.length >= 3) noTrade.push(`${vetoes.length} suara dibatalkan oleh veto psikologis.`);

  const decision = noTrade.length === 0 ? (direction === "BULLISH" ? "BUY" : "SELL") : "WAIT";

  return {
    method: "confidence x reasoning-quality x role-relevance x psychology-adjusted weighted voting",
    bullishWeight: Number(bull.toFixed(2)),
    bearishWeight: Number(bear.toFixed(2)),
    neutralWeight: Number(neutral.toFixed(2)),
    weightedBull: Number(bull.toFixed(2)),
    weightedBear: Number(bear.toFixed(2)),
    agreement: Number(agreement.toFixed(3)),
    participation: Number(participation.toFixed(3)),
    quorum: active.length,
    direction,
    decision,
    confidence,
    vetoes,
    dissenters,
    reasoning: buildConsensusNarrative({
      direction,
      bull,
      bear,
      agreement,
      confidence,
      active: active.length,
      mtf: ctx.mtfConfluence,
      decision,
      vetoes: vetoes.length,
    }),
  };
};

export const agreementGate = (verdict: MtfVerdict): number => {
  switch (verdict) {
    case "STRONG_CONFLUENCE":
      return 0.14;
    case "PARTIAL":
      return 0.2;
    case "CONFLICT":
      return 0.32;
    default:
      return 0.3;
  }
};

const buildConsensusNarrative = (o: {
  direction: Direction;
  bull: number;
  bear: number;
  agreement: number;
  confidence: number;
  active: number;
  mtf: MtfConfluence;
  decision: string;
  vetoes: number;
}) =>
  `${o.active} agen aktif, bobot ${o.direction === "BULLISH" ? "bullish" : "bearish"} ${Number(
    (o.direction === "BULLISH" ? o.bull : o.bear).toFixed(2),
  )} vs ${Number((o.direction === "BULLISH" ? o.bear : o.bull).toFixed(2))}, kesesuaian ${Math.round(
    o.agreement * 100,
  )}%, confidence gabungan ${o.confidence}% (confluence M1-H1: ${o.mtf.verdict} ${o.mtf.score}/100). ` +
  `${o.vetoes} suara dibatalkan veto psikologis. Putusan sementara: ${o.decision}.`;

/**
 * Expectancy in pips — the only number that decides whether a scalp is worth
 * taking. Also returns the break-even win rate the trader must actually hit.
 */
export const computeExpectancy = (opts: {
  confidence: number;
  slPips: number;
  tpPips: number;
  mtfConfluence: MtfConfluence;
  regime: VolatilityRegime;
  agreement: number;
}): Expectancy => {
  const { confidence, slPips, tpPips, mtfConfluence, regime, agreement } = opts;

  const confluenceAdj = (mtfConfluence.score - 50) / 320;
  const agreementAdj = (agreement - 0.2) * 0.25;
  const regimePenalty = regime === "CRISIS" ? -0.08 : regime === "EXPANSION" ? -0.04 : regime === "COMPRESSION" ? -0.02 : 0;

  const winProbability = clamp(confidence / 100 + confluenceAdj + agreementAdj + regimePenalty, 0.15, 0.85);
  const expectedValuePips = Number((winProbability * tpPips - (1 - winProbability) * slPips).toFixed(2));
  const breakEvenWinRate = Number((slPips / (slPips + tpPips)).toFixed(3));
  const expectancyPct = Number((expectedValuePips / slPips).toFixed(3));

  const verdict: Expectancy["verdict"] =
    expectedValuePips >= 0.25 * slPips ? "POSITIVE_EDGE" : expectedValuePips > 0 ? "THIN_EDGE" : "NEGATIVE_EDGE";

  const note =
    verdict === "POSITIVE_EDGE"
      ? `Win rate ${Math.round(winProbability * 100)}% > break-even ${Math.round(breakEvenWinRate * 100)}%, EV +${expectedValuePips} pips per trade.`
      : verdict === "THIN_EDGE"
      ? `EV hanya +${expectedValuePips} pips, nyaris impas. Cukup 1-2 loss beruntun menghapus keunggulan ini.`
      : `EV ${expectedValuePips} pips, setup ini negatif expectancy meski terlihat menarik. Hindari.`;

  return { winProbability, slPips, tpPips, expectedValuePips, breakEvenWinRate, expectancyPct, verdict, note };
};

/** Base directional bias used to seed the council before any AI vote lands. */
export const baselineDirection = (m: MtfConfluence, structureBias: Bias): Direction => {
  if (m.bias !== "NEUTRAL") return m.bias;
  if (structureBias !== "NEUTRAL") return structureBias;
  return "BULLISH";
};

export const normalizeModelOutput = (raw: any): {
  bias: Bias;
  confidence: number;
  emotion: ReturnType<typeof normalizeEmotion>;
  emotionIntensity: number;
  psychology?: Partial<{
    discipline: number;
    patience: number;
    fomoResistance: number;
    executionReadiness: number;
    riskFlags: string[];
    read: string;
  }>;
  emotionReason: string;
} => {
  const bias: Bias =
    raw?.bias === "BULLISH" || raw?.bias === "BEARISH" || raw?.bias === "NEUTRAL" ? raw.bias : "NEUTRAL";
  const confidence = clamp(Number(raw?.confidence ?? 55), 0, 100);
  return {
    bias,
    confidence,
    emotion: normalizeEmotion(raw?.emotion),
    emotionIntensity: clamp(Number(raw?.emotionIntensity ?? 50), 0, 100),
    emotionReason: typeof raw?.emotionReason === "string" ? raw.emotionReason.slice(0, 220) : "",
    psychology:
      raw?.psychology && typeof raw.psychology === "object"
        ? {
            discipline: clamp(Number(raw.psychology.discipline ?? 60), 0, 100),
            patience: clamp(Number(raw.psychology.patience ?? 60), 0, 100),
            fomoResistance: clamp(Number(raw.psychology.fomoResistance ?? 60), 0, 100),
            executionReadiness: clamp(Number(raw.psychology.executionReadiness ?? 50), 0, 100),
            riskFlags: Array.isArray(raw.psychology.riskFlags)
              ? raw.psychology.riskFlags.filter((f: unknown) => typeof f === "string").slice(0, 4).map((f: string) => f.slice(0, 90))
              : [],
            read: typeof raw.psychology.read === "string" ? raw.psychology.read.slice(0, 240) : undefined,
          }
        : undefined,
  };
};
