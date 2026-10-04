// ---------------------------------------------------------------------------
// Shared trading-AI domain types.
// Imported by both the /api/ai/evaluate route and the dashboard UI so the
// contract can never drift apart again.
// ---------------------------------------------------------------------------

export type Bias = "BULLISH" | "BEARISH" | "NEUTRAL";
export type Signal = "BUY" | "SELL" | "WAIT";
export type Direction = "BULLISH" | "BEARISH";
export type AgentStatus = "active" | "not_contributed";

export type SetupStatus =
  | "ARMED"
  | "WAITING_FOR_TRIGGER"
  | "NO_TRADE"
  | "DEGRADED_QUANT_FALLBACK";

export type RiskFlags = string[];

/** Psychology + emotion engine vocabulary for every council mind. */
export type Emotion =
  | "NEUTRAL"
  | "CONFIDENT"
  | "CAUTIOUS"
  | "GREEDY"
  | "FEARFUL"
  | "AGGRESSIVE"
  | "PATIENT"
  | "ANXIOUS"
  | "DISCIPLINED"
  | "IMPULSIVE"
  | "CALM"
  | "EXCITED"
  | "WARY"
  | "FOCUSED"
  | "FRUSTRATED"
  | "OVERCONFIDENT"
  | "OPTIMISTIC";

export type EmotionTone = "constructive" | "neutral" | "caution" | "destructive";

export interface EmotionMeta {
  emotion: Emotion;
  icon: string;
  label: string;
  tone: EmotionTone;
  /** -1 (fear/despair) .. +1 (greed/triumph) */
  valence: number;
  /** 0 (ice cold) .. 100 (maximally activated) */
  arousal: number;
  /** Multiplier applied to this agent's consensus vote weight. */
  voteFactor: number;
}

export interface AgentEmotion {
  emotion: Emotion;
  emotionIcon: string;
  emotionLabel: string;
  emotionTone: EmotionTone;
  /** 0-100 how activated / how strongly this feeling is driving the read. */
  emotionIntensity: number;
  /** One short sentence: why the council feels this way right now. */
  emotionReason: string;
}

export interface AgentPsychology {
  /** 0-100 adherence to rules, SL discipline, plan execution. */
  discipline: number;
  /** 0-100 willingness to wait for confluence instead of forcing a trade. */
  patience: number;
  /** 0-100 resistance to FOMO / chasing. */
  fomoResistance: number;
  /** 0-100 readiness to pull the trigger *now*. */
  executionReadiness: number;
  riskFlags: string[];
  read: string;
}

export interface FibonacciLevel {
  ratio: number;
  label: string;
  price: number;
}

export interface HarmonicPoint {
  label: "X" | "A" | "B" | "C" | "D";
  time: number;
  price: number;
}

export interface HarmonicPattern {
  name: string;
  type: "BULLISH" | "BEARISH";
  points: HarmonicPoint[];
  /** Measured ratios behind the pattern (B retrace, C projection, CD extension). */
  ratios?: Record<string, number>;
  /** D is a projected completion, price has not arrived there yet. */
  completionPending?: boolean;
  /** Confidence that the pattern is genuinely valid (0-100). */
  quality?: number;
}

export interface AgentOpinion {
  agentId: string;
  agentName: string;
  role: string;
  modelUsed: string;
  provider: string;
  bias: Bias;
  confidence: number;
  keyObservation: string;
  detailedAnalysis: string;
  evidence: string[];
  suggestedLevel?: { entry: number; sl: number; tp: number; slPips?: number; tpPips?: number };
  status: AgentStatus;
  errorMessage?: string;

  // ---- psychology / emotion layer (new, additive) ----
  emotion: Emotion;
  emotionIcon: string;
  emotionLabel: string;
  emotionTone: EmotionTone;
  emotionIntensity: number;
  emotionReason: string;
  psychology: AgentPsychology;
  /** 0-100 how evidence-dense / verifiable the reasoning is. */
  reasoningQuality: number;
  /** Consensus weight this mind actually carried (post psychology discount). */
  voteWeight: number;
  /** True when psychology (impulse, greed, overconfidence) vetoed the vote. */
  voteVetoed: boolean;
  vetoReason?: string;
}

export interface CouncilEmotionEntry {
  emotion: Emotion;
  icon: string;
  label: string;
  tone: EmotionTone;
  count: number;
  avgIntensity: number;
  /** Share of total emotional weight, 0-100. */
  weight: number;
}

export interface EmotionalState {
  dominantEmotion: Emotion;
  dominantEmotionIcon: string;
  dominantEmotionLabel: string;
  dominantEmotionTone: EmotionTone;
  /** 0-100 composite activation of the whole council. */
  emotionMeter: number;
  /** -100 (fear) .. +100 (greed). */
  moodIndex: number;
  /** One line narrative of the council's collective state. */
  councilMood: string;
  /** 0-100 how emotionally aligned the council is. */
  coherence: number;
  /** 0-100 how scattered the council's emotions are. */
  emotionSpread: number;
  breakdown: CouncilEmotionEntry[];
  psychology: {
    discipline: number;
    patience: number;
    fomoResistance: number;
    executionReadiness: number;
    averageIntensity: number;
    summary: string;
    flags: string[];
  };
  warning?: string;
}

export interface MtfSummary {
  tf: string;
  trend: "BULLISH" | "BEARISH";
  rsi: number;
  smaFast: number;
  smaSlow: number;
  lastClose: number;
}

export type MtfVerdict = "STRONG_CONFLUENCE" | "PARTIAL" | "CONFLICT" | "UNKNOWN";

export interface MtfConfluence {
  score: number;
  verdict: MtfVerdict;
  bias: Bias;
  aligned: string[];
  opposing: string[];
  neutral: string[];
  notes: string[];
}

export type VolatilityRegime = "COMPRESSION" | "NORMAL" | "EXPANSION" | "CRISIS" | "UNKNOWN";

export interface VolatilityProfile {
  regime: VolatilityRegime;
  label: string;
  atr: number;
  atrPct: number;
  /** atr / median atr — how stretched current volatility is. */
  atrVsMedian: number;
  advice: string;
}

export interface TechnicalContext {
  atr: number;
  atrPips: number;
  atrPct: number;
  rsi: number;
  smaFast: number;
  smaSlow: number;
  volatility: VolatilityProfile;
  mtfConfluence: MtfConfluence;
  structure: string;
  structureBias: Bias;
  pivotQuality: number;
  goldenPocket?: {
    zoneLow: number;
    zoneHigh: number;
    direction: Direction;
    priceInside: boolean;
    distancePips: number;
  };
  impulseLeg?: {
    direction: Direction;
    from: { time: number; price: number };
    to: { time: number; price: number };
    sizePips: number;
  };
  /** Pips required to place the stop beyond the protective swing + ATR buffer. */
  structuralSlPips?: number;
}

export interface RiskPlan {
  slPips: number;
  tpPips: number;
  slPrice: number;
  tpPrice: number;
  rr: number;
  slBasis: string;
  /** Structural stop distance in pips; null when price has no clean swing yet. */
  structuralSlPips: number | null;
  regimeSlPips: number;
  notes: string[];
}

export interface ConsensusResult {
  method: string;
  bullishWeight: number;
  bearishWeight: number;
  neutralWeight: number;
  agreement: number;
  participation: number;
  quorum: number;
  direction: Direction;
  decision: Signal;
  confidence: number;
  vetoes: string[];
  dissenters: string[];
  reasoning: string;
}

export interface Expectancy {
  winProbability: number;
  slPips: number;
  tpPips: number;
  expectedValuePips: number;
  breakEvenWinRate: number;
  expectancyPct: number;
  verdict: "POSITIVE_EDGE" | "THIN_EDGE" | "NEGATIVE_EDGE";
  note: string;
}

export interface ExecutionStep {
  phase: string;
  action: string;
}

export interface ExecutionPlan {
  trigger: string;
  entry: number;
  sl: number;
  tp: number;
  timeStopMinutes: number;
  breakevenMoveAtPips: number;
  partials: string[];
  steps: ExecutionStep[];
}

export interface DiscussionMessage {
  id: string;
  agentId: string;
  agentName: string;
  role: string;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  avatarIcon?: string;
  round: "pitch" | "rebuttal" | "ruling";
  replyToAgentName?: string;
  message: string;
  timestamp: number;
}

export interface EvaluationResult {
  /** Client-side archive id, assigned by the dashboard after each run. */
  id?: string;
  /** Client-side archive timestamp (epoch ms), assigned by the dashboard. */
  timestamp?: number;
  symbol: string;
  timeframe: string;
  signal: Signal;
  direction: Direction;
  setupStatus: SetupStatus;
  orderType?: "MARKET" | "LIMIT" | "PULLBACK";
  entryTrigger?: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  slPips: number;
  tpPips: number;
  riskRewardRatio: string;
  confidence: number;
  agentOpinions: AgentOpinion[];
  councilDiscussion?: DiscussionMessage[];
  activeAgentCount: number;
  offlineAgentCount: number;
  mtfMatrix: Record<string, MtfSummary>;
  mtfConfluence: MtfConfluence;
  thesis: string;
  detailedVerdict: string;
  riskInvalidation: string;
  slReason: string;
  tpReason: string;
  edge: string;
  calculations: string;
  chartMapping: Record<string, any>;
  positionBox: {
    startTime: number;
    endTime: number;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
  };
  predictiveTrajectory: Array<{ time: number; price: number }>;
  recommendation: string;
  notes: string;
  emotionalState: EmotionalState;
  consensus: ConsensusResult;
  technicalContext: TechnicalContext;
  riskPlan: RiskPlan;
  expectancy: Expectancy;
  executionPlan: ExecutionPlan;
  psychologyCheck: string[];
  noTradeReasons: string[];
  warnings: string[];
  quality: {
    avgReasoningQuality: number;
    degraded: boolean;
    durationMs: number;
    modelsUsed: string[];
  };
}
