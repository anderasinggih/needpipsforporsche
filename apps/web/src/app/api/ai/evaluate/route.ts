import { NextRequest, NextResponse } from "next/server";

import {
  baselineDirection,
  computeExpectancy,
  deriveRoleWeights,
  normalizeModelOutput,
  runConsensus,
  scoreReasoningQuality,
  type RoleProfile,
} from "@/lib/ai/consensus";
import {
  EMOTION_META,
  buildEmotionalState,
  clamp,
  deriveEmotion,
  derivePsychology,
  psychologyFlagsFor,
} from "@/lib/ai/emotions";
import { CHIEF_ROLE, buildAgentPrompt, buildSynthesizerPrompt, roleAt } from "@/lib/ai/prompts";
import { callProviderWithRetry, sanitizeSlots, type KeySlotPayload } from "@/lib/ai/providers";
import {
  atr as calcAtr,
  atrSeries,
  buildFibonacci,
  classifyVolatility,
  detectHarmonic,
  detectPivots,
  findImpulseLeg,
  fromPips,
  getSpec,
  planRisk,
  readStructure,
  rsi as calcRsi,
  round,
  sma,
  toPips,
  computeMtfConfluence,
  type Candle,
  type ImpulseLeg,
  type Pivot,
  type SymbolSpec,
} from "@/lib/ai/technical";
import type {
  AgentOpinion,
  Bias,
  ConsensusResult,
  Direction,
  DiscussionMessage,
  EmotionalState,
  EvaluationResult,
  Expectancy,
  MtfConfluence,
  MtfSummary,
  RiskPlan,
  Signal,
  TechnicalContext,
} from "@/lib/ai/types";

// Re-exported so existing importers keep working.
export type {
  AgentOpinion,
  ConsensusResult,
  EmotionalState,
  EvaluationResult,
  FibonacciLevel,
  HarmonicPattern,
  HarmonicPoint,
  MtfSummary,
  TechnicalContext,
} from "@/lib/ai/types";

const MAX_CANDLES = 200;
const AGENT_TIMEOUT_MS = 16000;
const SYNTH_TIMEOUT_MS = 18000;
const STAGGER_MS = 450;
const BATCH_SIZE = 2;
const MTF_TIMEOUT_MS = 3500;
const MTF_MAX_DRIFT = 0.03;
const MTF_INTERVALS = ["1m", "5m", "15m", "1h"];

interface EvaluateRequest {
  symbol?: unknown;
  price?: unknown;
  direction?: unknown;
  checklistMet?: unknown;
  selectedSkill?: {
    title?: string;
    riskRewardMin?: number;
    rules?: Array<{ id: string; text: string; required: boolean }>;
  };
  indicatorsSummary?: unknown;
  timeframe?: unknown;
  candles?: unknown;
  keySlots?: unknown;
  targetRr?: unknown;
}

interface ParsedRequest {
  symbol: string;
  price: number;
  timeframe: string;
  candles: Candle[];
  checklistMet: boolean;
  selectedSkill?: {
    title: string;
    riskRewardMin: number;
    rules: Array<{ id: string; text: string; required: boolean }>;
  } | undefined;
  keySlots: KeySlotPayload[];
  currentUnix: number;
  targetRr?: number | undefined;
}

// ------------------------------------------------------------- validation ---

const sanitizeCandles = (raw: unknown): Candle[] => {
  if (!Array.isArray(raw)) return [];
  const out: Candle[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const time = Number(rec.time);
    const close = Number(rec.close);
    if (!Number.isFinite(time) || !Number.isFinite(close) || close <= 0) continue;
    const high = Number(rec.high);
    const low = Number(rec.low);
    const open = Number(rec.open);
    out.push({
      time,
      open: Number.isFinite(open) && open > 0 ? open : close,
      high: Number.isFinite(high) && high >= close ? high : close,
      low: Number.isFinite(low) && low > 0 && low <= close ? low : close,
      close,
      volume: Number.isFinite(Number(rec.volume)) ? Number(rec.volume) : 0,
    });
  }
  return out.slice(-MAX_CANDLES);
};

const parseTimeframeSeconds = (timeframe: string): number => {
  const m = /^(\d{1,2})\s*([smhd])$/i.exec(timeframe.trim());
  if (!m) return 60;
  const value = Math.max(1, parseInt(m[1], 10) || 1);
  const unit = m[2].toLowerCase();
  if (unit === "s") return value;
  if (unit === "m") return value * 60;
  if (unit === "h") return value * 3600;
  return value * 86400;
};

const parseRequest = (body: EvaluateRequest): { errors: string[]; payload: ParsedRequest | null } => {
  const errors: string[] = [];

  const symbol = String(body.symbol || "").trim().toUpperCase();
  if (!symbol || symbol.length > 24) errors.push("symbol wajib diisi dan maksimal 24 karakter.");
  else if (!/^[A-Z0-9]+$/.test(symbol)) errors.push("symbol hanya boleh huruf dan angka, contoh XAUUSD.");

  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) errors.push("price harus angka lebih besar dari nol.");

  const timeframe = String(body.timeframe || "1m").trim().toLowerCase();
  if (!/^\d{1,2}[smhd]$/.test(timeframe)) errors.push("timeframe tidak valid, contoh 1m, 5m, 15m, 1h.");

  const candles = sanitizeCandles(body.candles);

  if (errors.length) return { errors, payload: null };

  const targetRrNum = Number(body.targetRr);
  const targetRr = (Number.isFinite(targetRrNum) && targetRrNum >= 1 && targetRrNum <= 10) ? Number(targetRrNum.toFixed(1)) : undefined;

  const rawSkill = body.selectedSkill;
  const selectedSkill = rawSkill && typeof rawSkill === "object" && typeof rawSkill.title === "string"
    ? {
        title: String(rawSkill.title).trim(),
        riskRewardMin: Number(rawSkill.riskRewardMin) || 2.0,
        rules: Array.isArray(rawSkill.rules) ? rawSkill.rules : [],
      }
    : undefined;

  return {
    errors,
    payload: {
      symbol,
      price,
      timeframe,
      candles,
      checklistMet: body.checklistMet === false ? false : true,
      selectedSkill,
      keySlots: sanitizeSlots(body.keySlots),
      currentUnix: candles.length ? candles[candles.length - 1].time : Math.floor(Date.now() / 1000),
      targetRr,
    },
  };
};

// ----------------------------------------------------------- market data ----

const normalizeBinanceSymbol = (symbol: string): string => {
  if (symbol === "XAUUSD" || symbol === "GOLD") return "PAXGUSDT";
  if (symbol === "BTCUSD") return "BTCUSDT";
  if (symbol === "ETHUSD") return "ETHUSDT";
  if (symbol === "SOLUSD") return "SOLUSDT";
  if (symbol.endsWith("USD") && !symbol.endsWith("USDT")) return `${symbol}T`;
  return symbol;
};

const fetchMtfMatrix = async (symbol: string): Promise<Record<string, MtfSummary>> => {
  const binanceSymbol = normalizeBinanceSymbol(symbol);
  const matrix: Record<string, MtfSummary> = {};

  const results = await Promise.all(
    MTF_INTERVALS.map(async (interval) => {
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=60`,
          { cache: "no-store", signal: AbortSignal.timeout(MTF_TIMEOUT_MS) },
        );
        if (!res.ok) return null;
        const klines = await res.json();
        if (!Array.isArray(klines) || klines.length < 10) return null;
        const closes = klines.map((k: any) => parseFloat(k[4])).filter((n: number) => Number.isFinite(n));
        if (closes.length < 10) return null;
        return {
          tf: interval.toUpperCase(),
          trend: (sma(closes, 5) >= sma(closes, 15) ? "BULLISH" : "BEARISH") as "BULLISH" | "BEARISH",
          rsi: Math.round(calcRsi(closes)),
          smaFast: round(sma(closes, 5)),
          smaSlow: round(sma(closes, 15)),
          lastClose: closes[closes.length - 1],
        } as MtfSummary;
      } catch {
        return null;
      }
    }),
  );

  for (const r of results) if (r) matrix[r.tf] = r;
  return matrix;
};

const formatMtfText = (matrix: Record<string, MtfSummary>, confluence: MtfConfluence): string => {
  const summary =
    Object.values(matrix)
      .map((v) => `${v.tf}: ${v.trend} (RSI ${v.rsi}, SMA ${v.smaFast} vs ${v.smaSlow})`)
      .join(" | ") || "1M: FLAT | 5M: FLAT | 15M: FLAT | 1H: FLAT";
  const verdict =
    `Confluence ${confluence.verdict} ${confluence.score}/100, bias ${confluence.bias}, ` +
    `selaras ${confluence.aligned.join("/") || "-"}, melawan ${confluence.opposing.join("/") || "-"}`;
  return `${summary} || ${verdict}`;
};

// ---------------------------------------------------------------- council ---

const defaultSlots = (request: NextRequest): KeySlotPayload[] => {
  const gemini = request.headers.get("x-gemini-key") || "";
  const groq = request.headers.get("x-groq-key") || "";
  const openai = request.headers.get("x-openai-key") || "";
  const deepseek = request.headers.get("x-deepseek-key") || "";
  const openrouter = request.headers.get("x-openrouter-key") || "";
  return [
    { id: "slot_1", label: "Agent 1 (Chief Synthesizer)", provider: "gemini", model: "gemini-2.5-flash", apiKey: gemini },
    { id: "slot_2", label: "Agent 2 (Market Structure)", provider: "gemini", model: "gemini-2.5-flash", apiKey: gemini },
    { id: "slot_3", label: "Agent 3 (Liquidity Hunter)", provider: "openai", model: "gpt-4o-mini", apiKey: openai },
    { id: "slot_4", label: "Agent 4 (Momentum & Trend)", provider: "groq", model: "llama-3.3-70b-versatile", apiKey: groq },
    { id: "slot_5", label: "Agent 5 (Volatility & Risk)", provider: "gemini", model: "gemini-2.5-pro", apiKey: gemini },
    { id: "slot_6", label: "Agent 6 (Harmonic & XABCD)", provider: "groq", model: "llama3-8b-8192", apiKey: groq },
    { id: "slot_7", label: "Agent 7 (Fibonacci Retracement)", provider: "openai", model: "gpt-4o-mini", apiKey: openai },
    { id: "slot_8", label: "Agent 8 (Multi-TF Matrix)", provider: "deepseek", model: "deepseek-chat", apiKey: deepseek },
    { id: "slot_9", label: "Agent 9 (Volume Profile)", provider: "openrouter", model: "auto", apiKey: openrouter },
    { id: "slot_10", label: "Agent 10 (Dynamic Backup)", provider: "gemini", model: "gemini-2.0-flash", apiKey: gemini },
  ];
};

const offlineAgent = (slot: KeySlotPayload, profile: RoleProfile, message: string): AgentOpinion => {
  const meta = EMOTION_META.NEUTRAL;
  return {
    agentId: slot.id,
    agentName: slot.label,
    role: profile.role,
    modelUsed: slot.model,
    provider: slot.provider,
    bias: "NEUTRAL",
    confidence: 0,
    keyObservation: message,
    detailedAnalysis:
      "Agen ini tidak berkontribusi pada sesi ini. Dewan tetap berjalan dengan suara yang valid.",
    evidence: ["Tidak ada input valid dari agen ini"],
    status: "not_contributed",
    errorMessage: message,
    emotion: "NEUTRAL",
    emotionIcon: meta.icon,
    emotionLabel: meta.label,
    emotionTone: meta.tone,
    emotionIntensity: 10,
    emotionReason: "Agen mati, jadi tidak ada emosi pasar yang masuk ke frontline dewan.",
    psychology: {
      discipline: 60,
      patience: 70,
      fomoResistance: 70,
      executionReadiness: 0,
      riskFlags: ["Agen offline"],
      read: "Netral karena tidak ada data.",
    },
    reasoningQuality: 0,
    voteWeight: 0,
    voteVetoed: false,
  };
};

interface OpinionContext {
  regime: string;
  mtfVerdict: string;
  structure: string;
  slPips: number;
  tpPips: number;
  atrPips: number;
}

const buildAgentOpinion = (opts: {
  slot: KeySlotPayload;
  profile: RoleProfile;
  raw: any;
  ctx: OpinionContext;
}): AgentOpinion => {
  const { slot, profile, raw, ctx } = opts;
  const parsed = normalizeModelOutput(raw);
  const modelProvidedEmotion = typeof raw?.emotion === "string" && Number.isFinite(Number(raw?.emotionIntensity));

  const derived = deriveEmotion({
    bias: parsed.bias,
    confidence: parsed.confidence,
    mtfVerdict: ctx.mtfVerdict,
    regime: ctx.regime,
  });

  const emotion = modelProvidedEmotion ? parsed.emotion : derived.emotion;
  const intensity = modelProvidedEmotion ? parsed.emotionIntensity : derived.intensity;
  const meta = EMOTION_META[emotion] || EMOTION_META.NEUTRAL;

  const fallbackPsych = derivePsychology({
    bias: parsed.bias,
    confidence: parsed.confidence,
    emotion,
    mtfVerdict: ctx.mtfVerdict,
    regime: ctx.regime,
  });

  const modelPsych = parsed.psychology;
  const psychology = {
    discipline: modelPsych?.discipline ?? fallbackPsych.discipline,
    patience: modelPsych?.patience ?? fallbackPsych.patience,
    fomoResistance: modelPsych?.fomoResistance ?? fallbackPsych.fomoResistance,
    executionReadiness: modelPsych?.executionReadiness ?? fallbackPsych.executionReadiness,
    riskFlags: modelPsych?.riskFlags?.length ? modelPsych.riskFlags : fallbackPsych.riskFlags,
    read: modelPsych?.read || fallbackPsych.read,
  };

  const keyObservation =
    (typeof raw?.keyObservation === "string" && raw.keyObservation.trim().slice(0, 400)) ||
    `${profile.role} ${parsed.bias} tanpa observasi tertulis.`;
  const detailedAnalysis =
    (typeof raw?.detailedAnalysis === "string" && raw.detailedAnalysis.trim().slice(0, 1400)) ||
    `Evaluasi ${profile.role}: bias ${parsed.bias} dengan confidence ${Math.round(
      parsed.confidence,
    )}%, struktur ${ctx.structure}, SL ${ctx.slPips} pips dan TP ${ctx.tpPips} pips.`;

  const modelEvidence = Array.isArray(raw?.evidence)
    ? raw.evidence
        .filter((e: unknown) => typeof e === "string" && e.trim())
        .slice(0, 4)
        .map((e: string) => e.trim().slice(0, 220))
    : [];
  const evidence = modelEvidence.length
    ? modelEvidence
    : [
        `Confluence ${ctx.mtfVerdict}, ATR ${ctx.atrPips} pips`,
        `Struktur ${ctx.structure}`,
        `SL ${ctx.slPips} pips / TP ${ctx.tpPips} pips`,
      ];

  return {
    agentId: slot.id,
    agentName: slot.label,
    role: profile.role,
    modelUsed: slot.model,
    provider: slot.provider,
    bias: parsed.bias,
    confidence: Math.round(parsed.confidence),
    keyObservation,
    detailedAnalysis,
    evidence,
    debateRebuttal: typeof (parsed as any).debateRebuttal === "string" ? (parsed as any).debateRebuttal.trim() : undefined,
    status: "active",
    emotion,
    emotionIcon: meta.icon,
    emotionLabel: meta.label,
    emotionTone: meta.tone,
    emotionIntensity: Math.round(intensity),
    emotionReason:
      parsed.emotionReason ||
      `${meta.label} karena confidence ${Math.round(parsed.confidence)}% pada struktur ${ctx.structure}.`,
    psychology,
    reasoningQuality: scoreReasoningQuality({
      keyObservation,
      detailedAnalysis,
      evidence,
      confidence: parsed.confidence,
      bias: parsed.bias,
    }),
    voteWeight: 0,
    voteVetoed: false,
  };
};

// ------------------------------------------------------- narrative helpers --

const defaultThesis = (o: {
  direction: Direction;
  consensus: ConsensusResult;
  confluence: MtfConfluence;
  symbol: string;
  timeframe: string;
}) =>
  `Arah dasar ${o.direction} pada ${o.symbol} ${o.timeframe.toUpperCase()} dengan confluence ${o.confluence.verdict} ` +
  `${o.confluence.score}/100. Kesesuaian antar-agen ${Math.round(
    o.consensus.agreement * 100,
  )}% menghasilkan confidence gabungan ${o.consensus.confidence}% dari ${o.consensus.quorum} agen aktif. ` +
  `Level diambil dari swing nyata dan koridor risiko 30-50 pips, bukan dari angka template.`;

const defaultEdge = (o: {
  confluence: MtfConfluence;
  fib?: ReturnType<typeof buildFibonacci> | undefined;
  harmonic?: ReturnType<typeof detectHarmonic>;
  ctx: TechnicalContext;
  direction: Direction;
}) => {
  const parts: string[] = [];
  if (o.confluence.verdict === "STRONG_CONFLUENCE") parts.push(`confluence M1-H1 ${o.confluence.score}/100`);
  if (o.fib?.goldenPocket?.priceInside) parts.push("harga sudah berada di zona Golden Pocket 0.5-0.618");
  if (o.harmonic) parts.push(`pola ${o.harmonic.name} dengan rasio XABCD terukur`);
  if (o.ctx.structureBias === o.direction) parts.push(`struktur mendukung (${o.ctx.structure})`);
  if (o.ctx.volatility.regime === "COMPRESSION") parts.push("volatilitas kompresi, risiko SL bisa rapat");
  if (!parts.length) {
    return "Edge tipis dan marginal. Karena itu ambang vote dinaikkan dan setup cenderung berakhir WAIT.";
  }
  return `Keunggulan berasal dari ${parts.join(", ")}. Semua level dihitung dari swing dan rasio nyata, bukan dari asumsi.`;
};

const defaultRecommendation = (o: {
  consensus: ConsensusResult;
  direction: Direction;
  price: number;
  risk: RiskPlan;
  spec: SymbolSpec;
}) => {
  if (o.consensus.decision === "WAIT") {
    return `JANGAN entry di $${round(o.price)} sekarang. Arah dasar ${o.direction}, tetapi ${o.consensus.reasoning}`;
  }
  const riskNote = o.spec.isGold
    ? `risiko per 0.01 lot tetap di kisaran $${(o.risk.slPips / 10).toFixed(2)}`
    : `risiko $${o.risk.slPrice && o.risk.slPips} pip per unit`;
  return `Eksekusi ${o.consensus.decision} di $${round(o.price)} dengan SL ${o.risk.slPips} pips (${riskNote}) dan TP ${
    o.risk.tpPips
  } pips (RR 1:${o.risk.rr}). Jangan tambah posisi dan jangan gerakkan SL.`;
};

const defaultNotes = (o: {
  risk: RiskPlan;
  expectancy: Expectancy;
  emotional: EmotionalState;
}) =>
  `Lot 0.01 dengan SL ${o.risk.slPips} pips (${o.risk.slBasis}). ${o.expectancy.note} ` +
  `Psikologi dewan: ${o.emotional.psychology.summary}`;

const buildExecutionPlan = (o: {
  consensus: ConsensusResult;
  direction: Direction;
  price: number;
  risk: RiskPlan;
  tfSeconds: number;
  fib?: ReturnType<typeof buildFibonacci> | undefined;
  confluence: MtfConfluence;
}) => {
  const wait = o.consensus.decision === "WAIT";
  const pocket = o.fib?.goldenPocket;
  const trigger = wait
    ? pocket
      ? `Tunggu harga masuk zona Golden Pocket $${pocket.zoneLow} - $${pocket.zoneHigh}, lalu ${
          pocket.direction === "BULLISH" ? "tunggu candle close bullish" : "tunggu candle close bearish"
        }.`
      : `Tunggu konfirmasi ${
          o.confluence.verdict === "CONFLICT" ? "timeframe tinggi" : "struktur"
        } searah ${o.direction} sebelum entry.`
    : `Entry market di $${round(o.price)} sekarang, atau lebih baik limit di $${round(
        o.price,
      )} saat harga retest level ini.`;

  const timeStopMinutes = Math.max(3, Math.round((o.tfSeconds * 12) / 60));

  return {
    trigger,
    entry: round(o.price),
    sl: o.risk.slPrice,
    tp: o.risk.tpPrice,
    timeStopMinutes,
    breakevenMoveAtPips: Math.round(o.risk.slPips * 0.6),
    partials: [
      "Tutup 50% di TP1 sekitar 1.5R, lalu pindahkan SL ke break-even.",
      "Sisa posisi memakai trailing mengikuti swing terbaru, bukan angka tetap.",
      "Jangan menambah posisi setelah SL tersentuh.",
    ],
    steps: [
      { phase: "Pra-trade", action: "Pastikan checklist terpenuhi dan lot dihitung dari SL, bukan sebaliknya." },
      { phase: "Entry", action: trigger },
      {
        phase: "Manajemen",
        action: `Time stop ${timeStopMinutes} menit. Tanpa respons harga dalam window itu, setup dianggap gagal.`,
      },
      { phase: "Exit", action: `TP ${o.risk.tpPips} pips dengan RR 1:${o.risk.rr}. SL tidak boleh dijauhkan.` },
    ],
  };
};

const buildCouncilDiscussion = (o: {
  agentOpinions: AgentOpinion[];
  consensus: ConsensusResult;
  direction: Direction;
  price: number;
  synthRaw?: any;
  currentUnix: number;
}): DiscussionMessage[] => {
  const msgs: DiscussionMessage[] = [];
  const active = o.agentOpinions.filter((a) => a.status === "active");
  let t = o.currentUnix - 45;

  // Round 1: Opening Pitches from Active Specialist Agents (slots 2..N)
  for (const agent of active) {
    if (agent.agentId === "slot_1") continue;
    msgs.push({
      id: `disc_pitch_${agent.agentId}_${Date.now()}`,
      agentId: agent.agentId,
      agentName: agent.agentName,
      role: agent.role,
      bias: agent.bias,
      avatarIcon: agent.emotionIcon || (agent.bias === "BULLISH" ? "🟢" : agent.bias === "BEARISH" ? "🔴" : "⚖️"),
      round: "pitch",
      message: `${agent.keyObservation} ${agent.detailedAnalysis ? agent.detailedAnalysis.slice(0, 240) : ""}`.trim(),
      timestamp: (t += 4),
    });
  }

  // Round 2: Real AI Rebuttals (from actual model debateRebuttal generated during Round 2)
  const agentsWithRebuttal = active.filter((a) => a.debateRebuttal && a.agentId !== "slot_1");
  for (const agent of agentsWithRebuttal) {
    msgs.push({
      id: `disc_rebuttal_${agent.agentId}_${Date.now()}`,
      agentId: agent.agentId,
      agentName: agent.agentName,
      role: agent.role,
      bias: agent.bias,
      avatarIcon: agent.emotionIcon || "⚡",
      round: "rebuttal",
      replyToAgentName: agent.replyToAgentName,
      message: agent.debateRebuttal!.trim(),
      timestamp: (t += 5),
    });
  }

  // If models returned structured discussion in synthRaw, incorporate any extra debate rounds
  const rawSynthList = Array.isArray(o.synthRaw?.councilDiscussion) ? o.synthRaw.councilDiscussion : [];
  for (let i = 0; i < rawSynthList.length; i++) {
    const item = rawSynthList[i];
    if (!item || typeof item.message !== "string" || !item.message.trim()) continue;
    if (item.round === "pitch" && msgs.some((m) => m.round === "pitch" && m.agentName === item.agentName)) {
      continue; // Skip duplicate pitches
    }
    const matchedAgent = o.agentOpinions.find(
      (a) =>
        a.agentName.toLowerCase().includes((item.agentName || "").toLowerCase()) ||
        a.role.toLowerCase().includes((item.agentName || "").toLowerCase()),
    ) || o.agentOpinions[i % o.agentOpinions.length];

    msgs.push({
      id: `disc_synth_${i}_${Date.now()}`,
      agentId: matchedAgent?.agentId || `slot_${i + 1}`,
      agentName: item.agentName || matchedAgent?.agentName || `Agent ${i + 1}`,
      role: matchedAgent?.role || "Specialist",
      bias: matchedAgent?.bias || (o.direction === "BULLISH" ? "BULLISH" : "BEARISH"),
      avatarIcon: matchedAgent?.emotionIcon || "💬",
      round: item.round === "rebuttal" || item.round === "ruling" ? item.round : "rebuttal",
      replyToAgentName: item.replyToAgentName,
      message: item.message.trim(),
      timestamp: (t += 5),
    });
  }

  // Round 3: Chief Synthesizer Final Ruling (from actual Chief agent analysis / synth verdict)
  const chief = o.agentOpinions.find((a) => a.agentId === "slot_1") || o.agentOpinions[0];
  if (chief) {
    msgs.push({
      id: `disc_ruling_${Date.now()}`,
      agentId: chief.agentId,
      agentName: chief.agentName,
      role: chief.role,
      bias: o.consensus.decision === "WAIT" ? "NEUTRAL" : o.direction === "BULLISH" ? "BULLISH" : "BEARISH",
      avatarIcon: chief.emotionIcon || "⚖️",
      round: "ruling",
      message:
        (typeof o.synthRaw?.detailedVerdict === "string" && o.synthRaw.detailedVerdict.trim()) ||
        chief.detailedAnalysis ||
        chief.keyObservation,
      timestamp: (t += 6),
    });
  }

  return msgs;
};

const buildTrajectory = (o: {
  price: number;
  direction: Direction;
  slDistance: number;
  tpDistance: number;
  currentUnix: number;
  tfSeconds: number;
}) => {
  const steps = 6;
  const long = o.direction === "BULLISH";
  const target = long ? o.price + o.tpDistance : o.price - o.tpDistance;
  const traj: Array<{ time: number; price: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const wiggle = i === 1 ? (long ? -o.slDistance * 0.15 : o.slDistance * 0.15) : 0;
    traj.push({
      time: o.currentUnix + Math.floor((o.tfSeconds * 12 * i) / steps),
      price: round(o.price + (target - o.price) * progress + wiggle),
    });
  }
  return traj;
};

const buildChartMapping = (o: {
  candles: Candle[];
  pivots: Pivot[];
  price: number;
  direction: Direction;
  fib?: ReturnType<typeof buildFibonacci> | undefined;
  harmonic?: ReturnType<typeof detectHarmonic>;
  currentUnix: number;
  atrValue: number;
}) => {
  const highs = o.pivots.filter((p) => p.kind === "HIGH");
  const lows = o.pivots.filter((p) => p.kind === "LOW");
  const candleHighs = o.candles.map((c) => c.high).filter(Number.isFinite);
  const candleLows = o.candles.map((c) => c.low).filter(Number.isFinite);

  const highest = highs.length ? Math.max(...highs.map((p) => p.price)) : Math.max(o.price, ...candleHighs);
  const lowest = lows.length ? Math.min(...lows.map((p) => p.price)) : Math.min(o.price, ...candleLows);

  const long = o.direction === "BULLISH";
  const anchor = long ? lows[lows.length - 1] : highs[highs.length - 1];

  const mapping: Record<string, any> = {
    supportLevel: round(Math.min(lowest - o.atrValue * 0.4, o.price)),
    resistanceLevel: round(Math.max(highest + o.atrValue * 0.4, o.price)),
    trendDirection: long ? "UPTREND" : "DOWNTREND",
    trendlineStart: anchor
      ? { time: anchor.time, price: anchor.price }
      : { time: o.currentUnix - 600, price: round(o.price) },
    trendlineEnd: { time: o.currentUnix, price: round(o.price) },
  };

  if (o.fib) {
    mapping.fibonacciRetracement = { high: o.fib.high, low: o.fib.low, levels: o.fib.levels };
  }
  if (o.harmonic) mapping.harmonicPattern = o.harmonic;

  return mapping;
};

const buildCalculations = (o: {
  symbol: string;
  spec: SymbolSpec;
  atrValue: number;
  volatility: ReturnType<typeof classifyVolatility>;
  confluence: MtfConfluence;
  structure: string;
  risk: RiskPlan;
  consensus: ConsensusResult;
  activeCount: number;
  offlineCount: number;
  expectancy: Expectancy;
}) =>
  `${o.symbol} | ATR ${round(o.atrValue)} (${Math.round(toPips(o.atrValue, o.spec))} pips, regime ${
    o.volatility.regime
  } x${o.volatility.atrVsMedian}) | Confluence ${o.confluence.verdict} ${o.confluence.score}/100 | Struktur ${
    o.structure
  } | SL ${o.risk.slPips} pips (${o.risk.slBasis}) | TP ${o.risk.tpPips} pips (RR 1:${o.risk.rr}) | EV ${
    o.expectancy.expectedValuePips
  } pips pada win rate ${Math.round(o.expectancy.winProbability * 100)}% | Dewan: ${
    o.activeCount
  } aktif, ${o.offlineCount} offline | Putusan: ${o.consensus.decision}`;

const confluenceFallback = (
  matrix: Record<string, MtfSummary>,
  candles: Candle[],
  structureBias: Bias,
): MtfConfluence => {
  const base = computeMtfConfluence(matrix);
  if (base.verdict !== "UNKNOWN") return base;

  const closes = candles.map((c) => c.close);
  if (closes.length < 5) return base;

  const last = closes[closes.length - 1];
  const fast = sma(closes, 5);
  const slow = sma(closes, Math.min(15, closes.length));
  const spread = Math.abs(fast - slow) / (last || 1);
  const score = Math.round(clamp(40 + spread * 150, 0, 100));
  const bias: Bias = structureBias !== "NEUTRAL" ? structureBias : fast >= slow ? "BULLISH" : "BEARISH";

  const scoredFrom = Object.values(matrix)
    .map((t) => t.tf)
    .filter(Boolean);
  const neutralList = scoredFrom.length ? scoredFrom : ["1M", "5M", "15M", "1H"];

  return {
    score,
    verdict: score >= 65 ? "STRONG_CONFLUENCE" : score >= 30 ? "PARTIAL" : "CONFLICT",
    bias,
    aligned: [],
    opposing: [],
    neutral: neutralList,
    notes: [
      `Matrix Binance gagal di-sync, confluence dihitung dari timeframe aktif saja sehingga confidence dipotong.`,
      ...base.notes,
    ],
  };
};

const structuralStopPips = (
  pivots: Pivot[],
  price: number,
  direction: Direction,
  atrValue: number,
  pipValue: number,
): number | null => {
  const long = direction === "BULLISH";
  const pivot = [...pivots].reverse().find((p) => (long ? p.kind === "LOW" : p.kind === "HIGH"));
  if (!pivot) return null;
  return Math.ceil((Math.abs(price - pivot.price) + atrValue * 0.25) / pipValue);
};

// -------------------------------------------------------------------- POST --

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const warnings: string[] = [];

  let body: EvaluateRequest;
  try {
    body = (await request.json()) as EvaluateRequest;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const { errors, payload } = parseRequest(body);
  if (errors.length || !payload) {
    return NextResponse.json({ error: "Permintaan tidak valid.", details: errors }, { status: 400 });
  }

  const { symbol, price, timeframe, candles, checklistMet, selectedSkill, keySlots, currentUnix, targetRr } = payload;
  const spec = getSpec(symbol);
  const tfSeconds = parseTimeframeSeconds(timeframe);

  try {
    const rawMtfMatrix = await fetchMtfMatrix(symbol).catch(() => ({}) as Record<string, MtfSummary>);

    // A proxied Binance feed (PAXGUSDT standing in for XAUUSD, for example) can sit
    // far away from the broker price the client is charting. Confluence built on
    // that drift would poison the whole vote, so it is discarded instead of trusted.
    const mtfEntries = Object.values(rawMtfMatrix);
    const referenceClose = mtfEntries.length ? mtfEntries[mtfEntries.length - 1].lastClose : null;
    const mtfDriftPct =
      referenceClose && price ? Math.abs(referenceClose - price) / (price || 1) : null;
    const mtfUsable = mtfDriftPct != null && mtfDriftPct <= MTF_MAX_DRIFT;
    const mtfMatrix = mtfUsable ? rawMtfMatrix : ({} as Record<string, MtfSummary>);

    const closes = candles.map((c) => c.close);
    const atrValue = candles.length >= 5 ? calcAtr(candles) : spec.isGold ? 0.35 : 8.5;
    const volatility = classifyVolatility(
      atrValue,
      price,
      atrSeries(candles).filter((v) => v > 0),
    );
    const pivots = detectPivots(candles);
    const structure = readStructure(pivots);
    const confluence = confluenceFallback(mtfMatrix, candles, structure.bias);

    if (!Object.keys(mtfMatrix).length) {
      warnings.push(
        mtfDriftPct != null
          ? `Feed Binance ${normalizeBinanceSymbol(symbol)} ($${round(
              referenceClose as number,
            )}) menyimpang ${(mtfDriftPct * 100).toFixed(1)}% dari harga broker $${price}; confluence MTF diabaikan agar tidak menyesatkan.`
          : "Matrix multi-timeframe gagal di-sync, confluence hanya dari timeframe aktif.",
      );
    }

    // Fibonacci must be anchored on STRUCTURAL swings, not lower-timeframe noise.
    // Aggregate the active candles into a structural timeframe (minimum M3) and
    // detect the impulse leg there. Levels are still drawn on the active chart.
    const structuralSeconds = Math.max(180, tfSeconds);
    const structuralCandles: Candle[] = (() => {
      if (structuralSeconds <= tfSeconds) return candles;
      const buckets = new Map<number, Candle>();
      for (const c of candles) {
        const key = Math.floor(c.time / structuralSeconds) * structuralSeconds;
        const b = buckets.get(key);
        if (!b) {
          buckets.set(key, { ...c, time: key });
        } else {
          b.high = Math.max(b.high, c.high);
          b.low = Math.min(b.low, c.low);
          b.close = c.close;
        }
      }
      return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
    })();
    const useStructural = structuralCandles.length >= 15;
    const fibCandles = useStructural ? structuralCandles : candles;
    const fibAtr = fibCandles.length >= 5 ? calcAtr(fibCandles) : atrValue;
    const fibPivots = useStructural
      ? detectPivots(fibCandles, { lookback: 3, minAtrMultiple: 1.2 })
      : pivots;

    const impulseLeg: ImpulseLeg | undefined =
      findImpulseLeg(fibPivots, fibAtr, spec) ?? findImpulseLeg(pivots, atrValue, spec);
    const fib = impulseLeg ? buildFibonacci({ leg: impulseLeg, price, spec }) : undefined;
    const harmonic = candles.length >= 30 ? detectHarmonic(candles, pivots, price) : undefined;

    const baselineDirectionValue = baselineDirection(confluence, structure.bias);

    // Provisional plan is only used to give agents concrete numbers to reason
    // about; the final plan is recomputed once the weighted vote picks a side.
    const provisionalRisk = planRisk({
      price,
      direction: baselineDirectionValue,
      atrValue,
      volatility,
      mtfVerdict: confluence.verdict,
      structuralSlPips: structuralStopPips(pivots, price, baselineDirectionValue, atrValue, spec.pipValue),
      spec,
      targetRr,
    });

    const activeRsi = closes.length >= 5 ? calcRsi(closes) : 50;
    const atrPips = Math.round(toPips(atrValue, spec));
    const mtfSummaryText = formatMtfText(mtfMatrix, confluence);

    const fibText = fib
      ? `anchor high $${fib.high.price} dan low $${fib.low.price}, Golden Pocket $${fib.goldenPocket.zoneLow} - $${fib.goldenPocket.zoneHigh} (${
          fib.goldenPocket.priceInside ? "harga sudah di dalam zona" : "harga di luar zona"
        })`
      : "belum ada impulse leg yang cukup untuk Fibonacci";
    const harmonicText = harmonic
      ? `${harmonic.name} ${harmonic.type}, D diproyeksikan di $${harmonic.points[4]?.price ?? "-"} (B retrace ${
          harmonic.ratios?.bRetrace ?? "-"
        }, C projection ${harmonic.ratios?.cProjection ?? "-"}, quality ${harmonic.quality ?? "-"})`
      : "tidak ada pola harmonik valid saat ini";

    const slots = keySlots.length ? keySlots : defaultSlots(request);

    const runSlot = async (
      slot: KeySlotPayload,
      index: number,
      extra?: { rebuttalTarget?: { agentName: string; bias: string; keyObservation: string }; debateTranscript?: string },
    ): Promise<AgentOpinion> => {
      const profile = roleAt(index);
      if (slot.enabled === false) {
        return offlineAgent(slot, profile, "Agen dinonaktifkan oleh trader di /owner/key (Toggle OFF).");
      }
      if (!slot.apiKey.trim()) {
        return offlineAgent(slot, profile, "API Key tidak terpasang di /owner/key.");
      }

      const prompt = buildAgentPrompt({
        agentName: slot.label,
        role: profile,
        symbol,
        price,
        timeframe,
        isGold: spec.isGold,
        mtfSummaryText,
        mtfConfluenceText: `${confluence.verdict} ${confluence.score}/100, bias ${confluence.bias}`,
        atrPips,
        volatilityText: volatility.label,
        structureText: structure.label,
        slPips: provisionalRisk.slPips,
        tpPips: provisionalRisk.tpPips,
        rr: `1:${provisionalRisk.rr}`,
        directionHint: `${baselineDirectionValue} dari confluence dan struktur`,
        fibText,
        harmonicText,
        checklistMet,
        strategySkill: selectedSkill,
        rebuttalTarget: extra?.rebuttalTarget,
        debateTranscript: extra?.debateTranscript,
      });

      try {
        const raw = await callProviderWithRetry(slot, prompt, { timeoutMs: AGENT_TIMEOUT_MS });
        const op = buildAgentOpinion({
          slot,
          profile,
          raw,
          ctx: {
            regime: volatility.regime,
            mtfVerdict: confluence.verdict,
            structure: structure.label,
            slPips: provisionalRisk.slPips,
            tpPips: provisionalRisk.tpPips,
            atrPips,
          },
        });
        if (extra?.rebuttalTarget) {
          op.replyToAgentName = extra.rebuttalTarget.agentName;
        }
        return op;
      } catch (err) {
        const message = String((err as Error)?.message || "Offline").slice(0, 160);
        const opinion = offlineAgent(slot, profile, `Request gagal: ${message}`);
        opinion.errorMessage = message;
        return opinion;
      }
    };

    // ROUND 1: Opening Pitches from specialists (slots 2..N)
    const councilResults: AgentOpinion[] = [];
    const slotsToRun = slots.slice(1);
    for (let i = 0; i < slotsToRun.length; i += BATCH_SIZE) {
      const batch = slotsToRun.slice(i, i + BATCH_SIZE);
      const settled = await Promise.all(batch.map((slot, offset) => runSlot(slot, i + offset + 1)));
      councilResults.push(...settled);
      if (i + BATCH_SIZE < slotsToRun.length) {
        await new Promise((resolve) => setTimeout(resolve, STAGGER_MS));
      }
    }

    // ROUND 2: Genuine Multi-Agent Cross-Rebuttal (Up to 3 pairs of debating agents)
    const activeRound1 = councilResults.filter((a) => a.status === "active");
    if (activeRound1.length >= 2) {
      const bulls = activeRound1.filter((a) => a.bias === "BULLISH");
      const bears = activeRound1.filter((a) => a.bias === "BEARISH");
      const neutrals = activeRound1.filter((a) => a.bias === "NEUTRAL");

      // Build debate pairs: Bulls vs Bears, or Contrarian/Auditor challenging strong bias
      const pairs: Array<{ challenger: AgentOpinion; target: AgentOpinion }> = [];

      if (bulls.length > 0 && bears.length > 0) {
        pairs.push({ challenger: bears[0], target: bulls[0] });
        if (bulls.length > 1 && bears.length > 1) {
          pairs.push({ challenger: bulls[1], target: bears[1] });
        }
      } else {
        // If all agree, have a risk officer or auditor challenge the consensus
        const primary = activeRound1[0];
        const riskChallenger = activeRound1.find(
          (a) => a.agentId !== primary.agentId && (a.role.includes("Auditor") || a.role.includes("Risk") || a.role.includes("Advocate") || a.bias === "NEUTRAL")
        ) || activeRound1[activeRound1.length - 1];

        if (riskChallenger && riskChallenger.agentId !== primary.agentId) {
          pairs.push({ challenger: riskChallenger, target: primary });
        }
      }

      // Execute up to 2-3 genuine cross-rebuttals concurrently
      await Promise.all(
        pairs.slice(0, 3).map(async ({ challenger, target }) => {
          const challengerSlotIndex = slots.findIndex((s) => s.id === challenger.agentId);
          if (challengerSlotIndex > 0) {
            const challengerSlot = slots[challengerSlotIndex];
            try {
              const rebuttalOpinion = await runSlot(challengerSlot, challengerSlotIndex, {
                rebuttalTarget: {
                  agentName: target.agentName,
                  bias: target.bias,
                  keyObservation: target.keyObservation,
                },
              });
              if (rebuttalOpinion.status === "active") {
                const existingIdx = councilResults.findIndex((a) => a.agentId === challenger.agentId);
                if (existingIdx !== -1) {
                  councilResults[existingIdx] = {
                    ...rebuttalOpinion,
                    replyToAgentName: target.agentName,
                    debateRebuttal: rebuttalOpinion.debateRebuttal || rebuttalOpinion.keyObservation,
                  };
                }
              }
            } catch (e) {
              console.warn("Cross-rebuttal error:", e);
            }
          }
        })
      );
    }

    const activeAgents = councilResults.filter((a) => a.status === "active");
    const offlineAgents = councilResults.filter((a) => a.status === "not_contributed");

    if (activeAgents.length === 0) {
      warnings.push("Tidak ada agen AI yang merespons. Fallback kuantitatif aktif, arah sepenuhnya dari algoritma.");
    } else if (activeAgents.length < 5) {
      warnings.push(`Hanya ${activeAgents.length} agen berkontribusi, konsensus kurang representatif.`);
    }

    const consensus = runConsensus({
      agents: councilResults,
      ctx: {
        mtfConfluence: confluence,
        regime: volatility.regime,
        rsi: activeRsi,
        structureBias: structure.bias,
        roleWeights: deriveRoleWeights({
          mtfConfluence: confluence,
          regime: volatility.regime,
          rsi: activeRsi,
          structureBias: structure.bias,
        }),
      },
      checklistMet,
    });

    const direction: Direction = consensus.direction;
    let decision: Signal = consensus.decision;

    // Smart Entry Level Determination (Limit / Pullback vs Market):
    // Rather than blindly executing at current candle close (which is aggressive & causes bad fills),
    // calculate if market is stretched or if optimal entry requires a pullback to Golden Pocket / key pivot.
    let targetEntryPrice = round(price);
    let orderType: "MARKET" | "LIMIT" | "PULLBACK" = "MARKET";
    let entryTrigger = `Market Execution @ $${round(price)}`;

    if (decision !== "WAIT") {
      const isLong = direction === "BULLISH";
      const pocket = fib?.goldenPocket;

      if (pocket) {
        if (pocket.priceInside) {
          // Price is currently inside Golden Pocket (0.5 - 0.618) -> Valid immediate entry!
          targetEntryPrice = round(price);
          orderType = "MARKET";
          entryTrigger = `Market Entry: Harga sudah berada di dalam Golden Pocket 0.5 - 0.618 ($${pocket.zoneLow} - $${pocket.zoneHigh})`;
        } else {
          // Price is outside Golden Pocket. Check distance.
          const distToPocket = isLong
            ? price - pocket.zoneHigh
            : pocket.zoneLow - price;
          const distPips = toPips(Math.abs(distToPocket), spec);

          // If price is extended > 8 pips away from golden pocket in trend direction,
          // don't chase aggressively! Set LIMIT / PULLBACK order at the edge of Golden Pocket.
          if (distToPocket > 0 && distPips >= 8 && distPips <= 60) {
            targetEntryPrice = round(isLong ? pocket.zoneHigh : pocket.zoneLow);
            orderType = "LIMIT";
            entryTrigger = `Limit / Retest Order: Tunggu harga pullback ke Golden Pocket Fib ($${targetEntryPrice}) sebelum masuk`;
          } else if (distPips > 60) {
            // Price is overextended (> 60 pips away) without pullback -> Force WAIT!
            decision = "WAIT";
            entryTrigger = `Overextended: Harga sudah bergerak terlalu jauh (${Math.round(distPips)} pips) dari anchor Fibonacci`;
          }
        }
      }
    }

    const riskPlan = planRisk({
      price: targetEntryPrice,
      direction,
      atrValue,
      volatility,
      mtfVerdict: confluence.verdict,
      structuralSlPips: structuralStopPips(pivots, targetEntryPrice, direction, atrValue, spec.pipValue),
      spec,
      targetRr,
    });

    if (riskPlan.structuralSlPips > spec.maxSlPips) {
      warnings.push(
        `Jarak SL struktural ${riskPlan.structuralSlPips} pips melampaui budget ${spec.maxSlPips} pips, risiko tidak sebanding dengan edge.`,
      );
    }
    if (confluence.verdict === "CONFLICT") {
      warnings.push("Multi-timeframe berkonflik, ambang kesesuaian vote otomatis dinaikkan.");
    }
    if (volatility.regime === "CRISIS") {
      warnings.push("Regime volatilitas kritis, risiko slippage berada di luar kendali model.");
    }
    riskPlan.notes.forEach((note) => warnings.push(note));

    const expectancy = computeExpectancy({
      confidence: consensus.confidence,
      slPips: riskPlan.slPips,
      tpPips: riskPlan.tpPips,
      mtfConfluence: confluence,
      regime: volatility.regime,
      agreement: consensus.agreement,
    });

    const noTradeReasons: string[] = [];
    if (decision === "WAIT") {
      if (consensus.agreement < 0.2) {
        noTradeReasons.push(`Kesesuaian antar-agen dewan hanya ${Math.round(consensus.agreement * 100)}% (pasar terpecah tanpa konsensus jelas).`);
      }
      if (consensus.confidence < 58) {
        noTradeReasons.push(`Confidence gabungan ${consensus.confidence}% masih di bawah ambang minimal (58%). Momentum belum valid.`);
      }
      if (!checklistMet) noTradeReasons.push("Checklist disiplin trading belum terpenuhi, menahan diri demi proteksi modal.");
      if (confluence.verdict === "CONFLICT") noTradeReasons.push("Timeframe tinggi (M5/M15/H1) masih berlawanan arah dengan arah candle lokal.");
      if (volatility.regime === "CRISIS") noTradeReasons.push("Volatilitas pasar sedang krisis (spread & slippage lebar), harga tidak layak dikejar.");
      if (expectancy.verdict === "NEGATIVE_EDGE") noTradeReasons.push("Perhitungan ekspektansi matematika negatif pada setup ini.");
      if (riskPlan.structuralSlPips > spec.maxSlPips) {
        noTradeReasons.push(`Swing struktural pengaman (${riskPlan.structuralSlPips} pips) terlalu jauh dari budget risiko.`);
      }
      if (fib && !fib.goldenPocket.priceInside && Math.abs(toPips(price - fib.goldenPocket.zoneHigh, spec)) > 60) {
        noTradeReasons.push("Harga sedang overextended (jauh dari zona diskon Golden Pocket), risiko buy di pucuk / sell di dasar sangat tinggi.");
      }
      if (consensus.vetoes.length) {
        noTradeReasons.push(`${consensus.vetoes.length} suara dibatalkan oleh veto psikologis dewan AI.`);
      }
      if (!noTradeReasons.length) {
        noTradeReasons.push("Kondisi market saat ini tidak ideal untuk entry (belum ada momen / konfirmasi teruji). AI memutuskan menahan posisi (WAIT).");
      }
    }

    // Chief synthesizer: narrative layer, never allowed to overrule the gate.
    const chiefSlot = slots[0];
    const chiefEmotion = decision === "WAIT" ? "DISCIPLINED" : consensus.confidence >= 78 ? "CONFIDENT" : "CAUTIOUS";
    const chiefMeta = EMOTION_META[chiefEmotion];

    let synthRaw: any = null;
    if (chiefSlot?.apiKey?.trim()) {
      try {
        synthRaw = await callProviderWithRetry(
          chiefSlot,
          buildSynthesizerPrompt({
            symbol,
            price,
            timeframe,
            decision,
            direction,
            entry: round(price),
            sl: riskPlan.slPrice,
            tp: riskPlan.tpPrice,
            slPips: riskPlan.slPips,
            tpPips: riskPlan.tpPips,
            rr: `1:${riskPlan.rr}`,
            confluence: `${confluence.verdict} ${confluence.score}/100`,
            volatility: `${volatility.label}, ATR ${atrPips} pips`,
            expectancy: expectancy.note,
            agentLines: councilResults.map(
              (a) =>
                `- ${a.agentName} [${a.bias} ${a.confidence}% ${a.emotionIcon}] ${a.keyObservation}${
                  a.voteVetoed ? " [VETO]" : ""
                }`,
            ),
            noTradeReasons,
            vetoLines: consensus.vetoes,
            emotionSummary: "isi blok emotionalState pada response",
            psychologySummary: "isi profil psikologis Hitung di blok emotionalState response",
          }),
          { timeoutMs: SYNTH_TIMEOUT_MS },
        );
      } catch {
        warnings.push("Chief synthesizer tidak merespons, narasi diambil dari algoritma.");
      }
    } else {
      warnings.push("Slot chief synthesizer tanpa API key, narasi diambil dari algoritma.");
    }

    const chief: AgentOpinion = {
      agentId: chiefSlot?.id || "slot_1",
      agentName: chiefSlot?.label || "Agent 1 (Chief Synthesizer)",
      role: CHIEF_ROLE,
      modelUsed: chiefSlot?.model || "-",
      provider: chiefSlot?.provider || "quant",
      bias: decision === "WAIT" ? "NEUTRAL" : direction === "BULLISH" ? "BULLISH" : "BEARISH",
      confidence: consensus.confidence,
      keyObservation: `Putusan council ${decision}: arah ${direction}, confidence ${consensus.confidence}%, kesesuaian antar-agen ${Math.round(
        consensus.agreement * 100,
      )}%. SL ${riskPlan.slPips} pips, TP ${riskPlan.tpPips} pips, RR 1:${riskPlan.rr}.`,
      detailedAnalysis:
        (typeof synthRaw?.detailedVerdict === "string" && synthRaw.detailedVerdict.trim().slice(0, 1400)) ||
        `Dewan ${activeAgents.length + 1} suara aktif. Confluence ${confluence.verdict} ${confluence.score}/100, struktur ${
          structure.label
        }, ATR ${atrPips} pips (${volatility.regime}). SL ${riskPlan.slPips} pips berbasis ${riskPlan.slBasis}. ${expectancy.note}`,
      evidence: [
        `Weighted vote bullish ${consensus.bullishWeight} vs bearish ${consensus.bearishWeight} dari ${consensus.quorum} agen`,
        `Confluence M1-H1 ${confluence.verdict} ${confluence.score}/100`,
        expectancy.note,
        consensus.vetoes.length
          ? `Veto psikologis aktif pada ${consensus.vetoes.length} suara`
          : "Tidak ada veto psikologis pada sesi ini",
      ],
      suggestedLevel: {
        entry: round(price),
        sl: riskPlan.slPrice,
        tp: riskPlan.tpPrice,
        slPips: riskPlan.slPips,
        tpPips: riskPlan.tpPips,
      },
      status: "active",
      emotion: chiefEmotion,
      emotionIcon: chiefMeta.icon,
      emotionLabel: chiefMeta.label,
      emotionTone: chiefMeta.tone,
      emotionIntensity: decision === "WAIT" ? 45 : Math.round(clamp(30 + consensus.confidence / 2)),
      emotionReason:
        decision === "WAIT"
          ? "Menahan godaan entry karena evidence belum memenuhi gate."
          : `Setup lolos seluruh gate dengan confidence ${consensus.confidence}%.`,
      psychology: {
        discipline: decision === "WAIT" ? 92 : 78,
        patience: decision === "WAIT" ? 88 : 70,
        fomoResistance: decision === "WAIT" ? 90 : 72,
        executionReadiness: decision === "WAIT" ? 30 : Math.round(clamp(expectancy.winProbability * 110)),
        riskFlags: decision === "WAIT" ? ["Godaan FOMO masuk sebelum trigger"] : [],
        read:
          decision === "WAIT"
            ? "Tetap wait lebih murah daripada entry tanpa confluence."
            : "Eksekusi hanya pada trigger yang ditentukan, bukan pada harga saat analisis.",
      },
      reasoningQuality: Math.round(
        clamp(40 + consensus.agreement * 40 + confluence.score * 0.2 + (synthRaw ? 10 : 0)),
      ),
      voteWeight: 0,
      voteVetoed: false,
    };

    const agentOpinions: AgentOpinion[] = [chief, ...councilResults];
    const emotionalState = buildEmotionalState(agentOpinions);
    if (emotionalState.warning) warnings.push(emotionalState.warning);

    const technicalContext: TechnicalContext = {
      atr: round(atrValue),
      atrPips,
      atrPct: volatility.atrPct,
      rsi: round(activeRsi),
      smaFast: round(closes.length >= 5 ? sma(closes, 5) : price),
      smaSlow: round(closes.length >= 15 ? sma(closes, 15) : price),
      volatility,
      mtfConfluence: confluence,
      structure: structure.label,
      structureBias: structure.bias,
      pivotQuality: structure.pivotQuality,
      goldenPocket: fib?.goldenPocket,
      impulseLeg,
      structuralSlPips: riskPlan.structuralSlPips || undefined,
    };

    const evaluation: EvaluationResult = {
      symbol,
      timeframe,
      signal: decision,
      direction,
      setupStatus:
        decision === "WAIT" ? "WAITING_FOR_TRIGGER" : activeAgents.length === 0 ? "DEGRADED_QUANT_FALLBACK" : "ARMED",
      orderType,
      entryTrigger,
      entryPrice: targetEntryPrice,
      stopLoss: riskPlan.slPrice,
      takeProfit: riskPlan.tpPrice,
      slPips: riskPlan.slPips,
      tpPips: riskPlan.tpPips,
      riskRewardRatio: `1:${riskPlan.rr}`,
      confidence: consensus.confidence,
      agentOpinions,
      councilDiscussion: buildCouncilDiscussion({
        agentOpinions,
        consensus,
        direction,
        price,
        synthRaw,
        currentUnix,
      }),
      activeAgentCount: activeAgents.length + 1,
      offlineAgentCount: offlineAgents.length,
      mtfMatrix,
      mtfConfluence: confluence,
      thesis:
        (typeof synthRaw?.thesis === "string" && synthRaw.thesis.trim().slice(0, 800)) ||
        defaultThesis({ direction, consensus, confluence, symbol, timeframe }),
      detailedVerdict: chief.detailedAnalysis,
      riskInvalidation:
        (typeof synthRaw?.riskInvalidation === "string" && synthRaw.riskInvalidation.trim().slice(0, 600)) ||
        `Setup batal jika harga menembus ${
          direction === "BULLISH" ? "bawah" : "atas"
        } $${riskPlan.slPrice} (${riskPlan.slPips} pips), atau jika struktur berubah menjadi ${structure.label}.`,
      slReason:
        (typeof synthRaw?.slReason === "string" && synthRaw.slReason.trim().slice(0, 400)) ||
        `SL ${riskPlan.slPips} pips, ${riskPlan.slBasis}.`,
      tpReason:
        (typeof synthRaw?.tpReason === "string" && synthRaw.tpReason.trim().slice(0, 400)) ||
        `TP ${riskPlan.tpPips} pips dengan RR 1:${riskPlan.rr}, disesuaikan confluence ${confluence.verdict}.`,
      edge:
        (typeof synthRaw?.edge === "string" && synthRaw.edge.trim().slice(0, 600)) ||
        defaultEdge({ confluence, fib, harmonic, ctx: technicalContext, direction }),
      calculations: buildCalculations({
        symbol,
        spec,
        atrValue,
        volatility,
        confluence,
        structure: structure.label,
        risk: riskPlan,
        consensus,
        activeCount: activeAgents.length + 1,
        offlineCount: offlineAgents.length,
        expectancy,
      }),
      chartMapping: buildChartMapping({
        candles,
        pivots,
        price,
        direction,
        fib,
        harmonic,
        currentUnix,
        atrValue,
      }),
      positionBox: {
        startTime: currentUnix,
        endTime: currentUnix + tfSeconds * 12,
        entryPrice: targetEntryPrice,
        stopLoss: riskPlan.slPrice,
        takeProfit: riskPlan.tpPrice,
      },
      predictiveTrajectory: buildTrajectory({
        price,
        direction,
        slDistance: fromPips(riskPlan.slPips, spec),
        tpDistance: fromPips(riskPlan.tpPips, spec),
        currentUnix,
        tfSeconds,
      }),
      recommendation:
        (typeof synthRaw?.recommendation === "string" && synthRaw.recommendation.trim().slice(0, 800)) ||
        defaultRecommendation({ consensus, direction, price, risk: riskPlan, spec }),
      notes:
        (typeof synthRaw?.notes === "string" && synthRaw.notes.trim().slice(0, 800)) ||
        (typeof synthRaw?.psychologyWarning === "string" && synthRaw.psychologyWarning.trim().slice(0, 400)) ||
        defaultNotes({ risk: riskPlan, expectancy, emotional: emotionalState }),
      emotionalState,
      consensus,
      technicalContext,
      riskPlan,
      expectancy,
      executionPlan: buildExecutionPlan({
        consensus,
        direction,
        price,
        risk: riskPlan,
        tfSeconds,
        fib,
        confluence,
      }),
      psychologyCheck: psychologyFlagsFor(agentOpinions),
      noTradeReasons,
      warnings,
      quality: {
        avgReasoningQuality: activeAgents.length
          ? Math.round(activeAgents.reduce((sum, a) => sum + a.reasoningQuality, 0) / activeAgents.length)
          : 0,
        degraded: activeAgents.length === 0,
        durationMs: Date.now() - startedAt,
        modelsUsed: Array.from(
          new Set(
            agentOpinions
              .filter((a) => a.status === "active")
              .map((a) => `${a.provider}/${a.modelUsed}`),
          ),
        ),
      },
    };

    return NextResponse.json({ evaluation });
  } catch (error) {
    console.error("Multi-agent council evaluation error:", error);
    return NextResponse.json(
      { error: "Gagal menjalankan evaluasi council AI.", detail: String((error as Error)?.message || error) },
      { status: 500 },
    );
  }
}
