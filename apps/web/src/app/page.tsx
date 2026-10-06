"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TradingViewChart,
  AIMapping,
  AISignalOverlay,
  PositionBox,
} from "@/components/chart/TradingViewChart";
import { useMarketStream } from "@/hooks/useMarketStream";
import { resolveTradeOutcome } from "@/lib/trade/outcome";
import { SkillChecklistModal, TradingSkill } from "@/components/skills/SkillChecklistModal";
import { CouncilWarRoomChat } from "@/components/council/CouncilWarRoomChat";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Loader2,
  Activity,
  CheckCircle2,
  Key,
  Radio,
  Sparkles,
  Crosshair,
  Target,
  Compass,
  History,
  TrendingUp,
  Calculator,
  ChevronRight,
  ChevronDown,
  Clock,
  Users,
  Bot,
  BrainCircuit,
  MessageSquare,
  Scale,
  FileText,
  CheckCircle,
  AlertCircle,
  Zap,
} from "lucide-react";
import type {
  AgentOpinion,
  Bias,
  ConsensusResult,
  EmotionalState,
  Emotion,
  EmotionTone,
  EvaluationResult,
  Expectancy,
  ExecutionPlan,
  MtfConfluence,
  RiskPlan,
  TechnicalContext,
} from "@/lib/ai/types";

export type { AgentOpinion, EvaluationResult } from "@/lib/ai/types";

// Historic logs are persisted in localStorage, so every new field must stay optional.
export type EvaluationOutcome = "WIN" | "LOSE" | "WAIT" | "ACTIVE";

export type StoredEvaluation = Partial<EvaluationResult> & {
  id?: string;
  timestamp?: number;
  symbol?: string;
  timeframe?: string;
  signal?: "BUY" | "SELL" | "WAIT";
  confidence?: number;
  thesis?: string;
  riskInvalidation?: string;
  recommendation?: string;
  notes?: string;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  slPips?: number;
  tpPips?: number;
  agentOpinions?: AgentOpinion[];
  mtfMatrix?: Record<string, { tf: string; trend: "BULLISH" | "BEARISH"; rsi: number; smaFast: number; smaSlow: number; lastClose: number }>;
  outcome?: EvaluationOutcome;
  resolvedPrice?: number;
  resolvedAt?: number;
  /** Unix seconds the setup was created — the gate that ignores pre-trade price action. */
  anchorTime?: number;
  /** Market price when the setup was produced; equal to entryPrice for market entries. */
  setupPrice?: number;
  /** True once price actually traded the entry level. */
  entryFilled?: boolean;
};

/** Unix seconds the setup was created; falls back to predictiveTrajectory or positionBox or archive timestamp. */
const setupAnchorSec = (log: StoredEvaluation): number => {
  if (log.anchorTime && Number.isFinite(log.anchorTime)) return log.anchorTime;
  if (log.positionBox?.startTime && Number.isFinite(log.positionBox.startTime)) return log.positionBox.startTime;
  if (log.predictiveTrajectory && log.predictiveTrajectory.length > 0) {
    const minTraj = Math.min(...log.predictiveTrajectory.map((p) => p.time));
    if (Number.isFinite(minTraj)) return minTraj;
  }
  return Math.floor((log.timestamp ?? Date.now()) / 1000);
};

/**
 * Re-open archived logs whose outcome was marked LOSE prematurely.
 * If price never truly pierced or touched stopLoss, recover it to "ACTIVE"
 * so resolveTradeOutcome can track it honestly while the trade is breathing.
 */
const migrateLegacyOutcome = (log: StoredEvaluation): StoredEvaluation => {
  if (!log || typeof log !== "object") return log;
  if (!log.signal || log.signal === "WAIT") return log;
  if (!log.entryPrice || !log.stopLoss || !log.takeProfit) return log;

  const isLong = log.signal === "BUY";

  // Recover false LOSE:
  if (log.outcome === "LOSE") {
    // If resolvedPrice was recorded but didn't actually cross SL:
    if (log.resolvedPrice !== undefined) {
      const isTrueSlHit = isLong ? log.resolvedPrice <= log.stopLoss : log.resolvedPrice >= log.stopLoss;
      if (!isTrueSlHit) {
        const { resolvedPrice, resolvedAt, ...rest } = log;
        return { ...rest, outcome: "ACTIVE" };
      }
    }
  }

  return log;
};

const EMOTION_TONE_CLASS: Record<EmotionTone, string> = {
  constructive: "border-emerald-800/70 bg-emerald-950/30 text-emerald-300",
  neutral: "border-zinc-700 bg-zinc-900/70 text-zinc-300",
  caution: "border-amber-800/70 bg-amber-950/30 text-amber-300",
  destructive: "border-red-800/70 bg-red-950/30 text-red-300",
};

const METER_TONE_CLASS: Record<EmotionTone, string> = {
  constructive: "bg-emerald-400",
  neutral: "bg-zinc-400",
  caution: "bg-amber-400",
  destructive: "bg-red-400",
};

const MeterBar = ({
  value,
  tone = "neutral",
  className = "",
}: {
  value: number;
  tone?: EmotionTone;
  className?: string;
}) => (
  <div className={`h-1.5 w-full overflow-hidden rounded-full bg-zinc-800 ${className}`}>
    <div
      className={`h-full rounded-full ${METER_TONE_CLASS[tone]}`}
      style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
    />
  </div>
);

const BIAS_LABEL: Record<Bias, string> = {
  BULLISH: "Bullish",
  BEARISH: "Bearish",
  NEUTRAL: "Neutral",
};

export default function DashboardPage() {
  const [activeSymbol, setActiveSymbol] = useState<string>("XAUUSD");
  const [timeframe, setTimeframe] = useState<string>("1m");
  const [isClientLoaded, setIsClientLoaded] = useState(false);

  const { currentCandle, historicalCandles, positions, isConnected, lastTickTimestamp } =
    useMarketStream(activeSymbol, timeframe);

  const [selectedSkill, setSelectedSkill] = useState<TradingSkill | null>(null);
  const [checkedRules, setCheckedRules] = useState<Record<string, boolean>>({});
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [tradingMethod, setTradingMethod] = useState<string>("ALL");

  // Configurable Target Risk-Reward Ratio (e.g. 1.5, 2.0, 2.5, 3.0)
  const [targetRr, setTargetRr] = useState<number>(2.5);

  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Expanded collapse states for agents
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>("slot_1");
  const [isCouncilStripOpen, setIsCouncilStripOpen] = useState(true);
  const [councilViewTab, setCouncilViewTab] = useState<"chat" | "cards">("chat");

  // Persistent AI Evaluation History Log
  const [evalLogs, setEvalLogs] = useState<StoredEvaluation[]>([]);

  const rules = selectedSkill?.rules_checklist ?? [];
  const allRequiredMet =
    rules.length === 0 ||
    rules.filter((r) => r.required).every((r) => checkedRules[r.id]);

  useEffect(() => {
    setIsClientLoaded(true);
    if (typeof window !== "undefined") {
      const sym = localStorage.getItem("active_symbol");
      if (sym === "XAUUSD" || sym === "BTCUSD") {
        setActiveSymbol(sym);
      }
      const tf = localStorage.getItem("active_timeframe");
      if (tf) setTimeframe(tf);

      // Restore Target RR
      const savedRr = localStorage.getItem("ai_target_rr");
      if (savedRr) {
        const parsedRr = parseFloat(savedRr);
        if (!isNaN(parsedRr) && parsedRr > 0) {
          setTargetRr(parsedRr);
        }
      }

      // Restore Selected Strategy & Rules Checklist
      try {
        const savedSkill = localStorage.getItem("trading_selected_skill");
        if (savedSkill) {
          setSelectedSkill(JSON.parse(savedSkill));
        }
        const savedRules = localStorage.getItem("trading_checked_rules");
        if (savedRules) {
          setCheckedRules(JSON.parse(savedRules));
        }
        const savedMethod = localStorage.getItem("trading_method");
        if (savedMethod) {
          setTradingMethod(savedMethod);
        }
      } catch (e) {
        console.warn("Failed to restore strategy/checklist", e);
      }

      try {
        const savedLogs = localStorage.getItem("ai_evaluation_logs");
        if (savedLogs) {
          const parsed = JSON.parse(savedLogs);
          setEvalLogs(Array.isArray(parsed) ? parsed.map(migrateLegacyOutcome) : []);
        }
      } catch (e) {
        console.warn("Failed to load evaluation logs", e);
      }
    }
  }, []);

  // Live evaluation of trade outcomes (WIN / LOSE / ACTIVE / WAIT) when new market ticks arrive
  useEffect(() => {
    if (!currentCandle || evalLogs.length === 0) return;

    let hasChanges = false;
    const updated = evalLogs.map((log) => {
      // Only evaluate if it matches current symbol and is still active/unresolved
      if (log.symbol && log.symbol !== activeSymbol) return log;
      if (log.outcome && log.outcome !== "ACTIVE" && log.outcome !== "WAIT") return log;
      if (!log.entryPrice || !log.takeProfit || !log.stopLoss) return log;

      const directionSide = log.direction === "BULLISH" ? "BUY" : log.direction === "BEARISH" ? "SELL" : (log.signal === "BUY" ? "BUY" : "SELL");

      // Candles only make sense on the timeframe the setup was taken on.
      const onSameTimeframe = !log.timeframe || log.timeframe === timeframe;
      const state = resolveTradeOutcome(
        {
          signal: directionSide,
          entryPrice: log.entryPrice,
          stopLoss: log.stopLoss,
          takeProfit: log.takeProfit,
          anchorTime: setupAnchorSec(log),
          setupPrice: log.setupPrice,
        },
        onSameTimeframe ? historicalCandles : [],
        onSameTimeframe ? currentCandle : null,
      );

      // If entry has been filled (or price traded entry level), transition outcome from WAIT to ACTIVE or WIN/LOSE
      const nextOutcome: EvaluationOutcome = state.outcome !== "ACTIVE"
        ? state.outcome
        : state.entryFilled
        ? "ACTIVE"
        : log.signal === "WAIT"
        ? "WAIT"
        : "ACTIVE";

      if (nextOutcome === log.outcome && state.entryFilled === log.entryFilled) return log;

      hasChanges = true;
      return {
        ...log,
        outcome: nextOutcome,
        anchorTime: setupAnchorSec(log),
        entryFilled: state.entryFilled,
        resolvedPrice: state.resolvedPrice,
        resolvedAt: state.resolvedTime ? state.resolvedTime * 1000 : undefined,
      };
    });

    if (hasChanges) {
      setEvalLogs(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("ai_evaluation_logs", JSON.stringify(updated));
      }
      // Keep active evaluation in sync if it was updated
      if (evaluation?.id) {
        const activeMatch = updated.find((u) => u.id === evaluation.id);
        if (activeMatch) {
          setEvaluation((prev) => (prev ? { ...prev, ...activeMatch } : prev));
        }
      }
    }
  }, [currentCandle?.close, activeSymbol, timeframe, historicalCandles.length, evaluation?.id]);

  const handleSymbolChange = (sym: string) => {
    setActiveSymbol(sym);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_symbol", sym);
    }
    showToast(`Active Instrument: ${sym}`);
  };

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_timeframe", tf);
    }
    showToast(`Active Timeframe: ${tf.toUpperCase()}`);
  };

  const handleTargetRrChange = (rr: number) => {
    setTargetRr(rr);
    if (typeof window !== "undefined") {
      localStorage.setItem("ai_target_rr", rr.toString());
    }
    showToast(`Target Risk:Reward set to 1:${rr}`);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const toggleRule = (id: string) => {
    setCheckedRules((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      if (typeof window !== "undefined") {
        localStorage.setItem("trading_checked_rules", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleSkillSelect = (skill: TradingSkill) => {
    setSelectedSkill(skill);
    setCheckedRules({});
    if (typeof window !== "undefined") {
      localStorage.setItem("trading_selected_skill", JSON.stringify(skill));
      localStorage.removeItem("trading_checked_rules");
    }
    setIsSkillModalOpen(false);
    showToast(`Strategy selected: ${skill.title}`);
  };

  const toggleAgentCollapse = (id: string) => {
    setExpandedAgentId((prev) => (prev === id ? null : id));
  };

  const handleEvaluate = async () => {
    if (!currentCandle) {
      showToast("Waiting for live market data feed...");
      return;
    }
    try {
      setIsEvaluating(true);
      // Immediately clear previous evaluation session so War Room Chat switches to live pending mode
      setEvaluation(null);
      setCouncilViewTab("chat");
      setIsCouncilStripOpen(true);

      // Load 10-key slots from localStorage if available
      let keySlots = [];
      if (typeof window !== "undefined") {
        const savedSlots = localStorage.getItem("ai_council_keys_10");
        if (savedSlots) {
          try {
            keySlots = JSON.parse(savedSlots);
          } catch (e) {}
        }
      }

      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-key": localStorage.getItem("gemini_api_key") || "",
          "x-groq-key": localStorage.getItem("groq_api_key") || "",
          "x-openai-key": localStorage.getItem("openai_api_key") || "",
          "x-deepseek-key": localStorage.getItem("deepseek_api_key") || "",
          "x-openrouter-key": localStorage.getItem("openrouter_api_key") || "",
        },
        body: JSON.stringify({
          symbol: activeSymbol,
          price: currentCandle.close,
          timeframe,
          targetRr,
          tradingMethod,
          checklistMet: allRequiredMet,
          selectedSkill: selectedSkill ? {
            title: selectedSkill.title,
            riskRewardMin: selectedSkill.risk_reward_min,
            rules: selectedSkill.rules_checklist,
          } : undefined,
          indicatorsSummary: `${activeSymbol} ${timeframe.toUpperCase()} @ ${currentCandle.close.toFixed(2)}`,
          // Enough history for genuine swing structure, Fibonacci anchors and
          // harmonic ratio validation on the server side.
          candles: historicalCandles.slice(-120),
          keySlots,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(data?.details) ? data.details.join(", ") : data?.error;
        showToast(detail || "Council evaluation failed");
        return;
      }

      if (data.evaluation) {
        const initialOutcome: EvaluationOutcome =
          data.evaluation.signal === "WAIT" ? "WAIT" : "ACTIVE";

        const newRecord: EvaluationResult & { outcome: EvaluationOutcome } & StoredEvaluation = {
          ...(data.evaluation as EvaluationResult),
          id: `eval_${Date.now()}`,
          timestamp: Date.now(),
          symbol: activeSymbol,
          timeframe: timeframe,
          outcome: initialOutcome,
          setupPrice: currentCandle.close,
          anchorTime: setupAnchorSec(data.evaluation as StoredEvaluation),
        };
        setEvaluation(newRecord);
        setExpandedAgentId(newRecord.agentOpinions?.[0]?.agentId || "slot_1");

        const updatedLogs: StoredEvaluation[] = [newRecord, ...evalLogs.slice(0, 49)];
        setEvalLogs(updatedLogs);
        if (typeof window !== "undefined") {
          localStorage.setItem("ai_evaluation_logs", JSON.stringify(updatedLogs));
        }

        const verdict =
          newRecord.signal === "WAIT"
            ? `Council: WAIT (${newRecord.confidence}%) - ${newRecord.noTradeReasons?.length ?? 0} alasan menahan entry`
            : `Council: ${newRecord.signal} ${newRecord.confidence}% | ${newRecord.emotionalState?.dominantEmotionIcon ?? ""} ${
                newRecord.emotionalState?.dominantEmotionLabel ?? ""
              }`;
        showToast(verdict);
      }
    } catch (err) {
      console.error("Evaluation failed:", err);
      showToast("Council deliberation error");
    } finally {
      setIsEvaluating(false);
    }
  };

  const selectHistoricalLog = (item: StoredEvaluation) => {
    setEvaluation(item as EvaluationResult);
    if (item.symbol && item.symbol !== activeSymbol) {
      setActiveSymbol(item.symbol);
    }
    if (item.timeframe && item.timeframe !== timeframe) {
      setTimeframe(item.timeframe);
    }
    showToast(`Loaded evaluation log from ${new Date(item.timestamp || Date.now()).toLocaleTimeString()}`);
  };

  const clearLogs = () => {
    setEvalLogs([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("ai_evaluation_logs");
    }
    showToast("Evaluation history cleared");
  };

  const currentPriceFormatted = currentCandle ? currentCandle.close.toFixed(2) : "---.--";

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased selection:bg-zinc-800">
      {/* Top Navigation Bar - Responsive */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/90 px-3 sm:px-6 py-2 sm:py-2.5 backdrop-blur">
        <div className="mx-auto flex w-full items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1.5 sm:gap-2 font-mono font-semibold tracking-tight text-white text-xs sm:text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 text-[10px] font-bold text-white border border-zinc-700">
                P
              </span>
              NEEDPIPS<span className="text-zinc-600 font-normal">/</span>FORPORSCHE
            </div>

            <div className="hidden sm:flex items-center gap-2 border-l border-zinc-800 pl-4 text-xs font-mono">
              <div className="flex items-center rounded-md bg-zinc-950 p-0.5 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleSymbolChange("BTCUSD")}
                  className={`px-2.5 py-0.5 text-[11px] font-mono font-medium rounded transition-colors ${
                    activeSymbol === "BTCUSD"
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  BTCUSD
                </button>
                <button
                  type="button"
                  onClick={() => handleSymbolChange("XAUUSD")}
                  className={`px-2.5 py-0.5 text-[11px] font-mono font-medium rounded transition-colors ${
                    activeSymbol === "XAUUSD"
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  XAUUSD (Gold)
                </button>
              </div>
              <span className="text-zinc-700">·</span>
              <select
                value={tradingMethod}
                onChange={(e) => {
                  setTradingMethod(e.target.value);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("trading_method", e.target.value);
                  }
                }}
                className="rounded-md bg-zinc-950 border border-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-300 focus:outline-none hover:bg-zinc-900"
              >
                <option value="ALL">ALL</option>
                <option value="SMC">SMC</option>
                <option value="ICT">ICT</option>
                <option value="SNR">SNR</option>
                <option value="FIBONACCI">FIBONACCI</option>
                <option value="VOLUME">VOLUME &amp; ORDERFLOW</option>
              </select>
              <span className="text-zinc-700">·</span>
              <span className="font-semibold text-zinc-200 font-mono tracking-wide text-xs">
                ${currentPriceFormatted}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Badge
              variant="outline"
              className="flex items-center gap-1.5 py-0.5 sm:py-1 px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-mono border-zinc-800 bg-zinc-950 text-zinc-400"
            >
              <Radio className={`h-2.5 sm:h-3 w-2.5 sm:w-3 ${isConnected ? "text-emerald-400" : "text-zinc-500"}`} />
              <span>{isConnected ? "Live feed" : "Connecting"}</span>
            </Badge>

            {/* Owner key menu hidden from navbar as requested, accessible directly via /owner/key */}
          </div>
        </div>
      </header>

      {/* Main Full-Width Terminal Content - Responsive padding */}
      <div className="w-full px-2 sm:px-4 md:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4">
        {/* Full-Width TradingView Chart */}
        <Card className="border-zinc-800 bg-black p-0 shadow-none overflow-hidden">
          <TradingViewChart
            currentCandle={currentCandle}
            historicalCandles={historicalCandles}
            positions={positions}
            symbol={activeSymbol}
            timeframe={timeframe}
            lastTickTimestamp={lastTickTimestamp}
            onSymbolChange={handleSymbolChange}
            onTimeframeChange={handleTimeframeChange}
            aiMapping={
              evaluation?.chartMapping && (!evaluation.symbol || evaluation.symbol === activeSymbol) && (!evaluation.timeframe || evaluation.timeframe === timeframe)
                ? evaluation.chartMapping
                : null
            }
            aiSignal={
              evaluation?.signal && (!evaluation.symbol || evaluation.symbol === activeSymbol) && (!evaluation.timeframe || evaluation.timeframe === timeframe)
                ? {
                    signal: evaluation.signal,
                    direction: evaluation.direction,
                    entryPrice: evaluation.entryPrice,
                    stopLoss: evaluation.stopLoss,
                    takeProfit: evaluation.takeProfit,
                    slPips: evaluation.slPips,
                    tpPips: evaluation.tpPips,
                    riskRewardRatio: evaluation.riskRewardRatio,
                    positionBox: evaluation.positionBox,
                    predictiveTrajectory: evaluation.predictiveTrajectory,
                    possibilityScenarios: evaluation.possibilityScenarios,
                    orderType: evaluation.orderType,
                    entryTrigger: evaluation.entryTrigger,
                    setupPrice: (evaluation as any).setupPrice ?? evaluation.positionBox?.entryPrice,
                    note: evaluation.calculations,
                  }
                : null
            }
          />
        </Card>

        {/* Council strip: consensus verdict + collective emotional state */}
        {(isEvaluating || Boolean(evaluation?.agentOpinions?.length)) && (
          <Card className="border-zinc-800 bg-zinc-950 p-3.5 shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-zinc-800/80 pb-2.5 mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-zinc-200">
                  Multi-Agent Scalping Council
                </span>
                <span className="text-[10px] sm:text-[11px] text-zinc-500">
                  {isEvaluating
                    ? "(Sedang Bermusyawarah...)"
                    : `(${evaluation?.activeAgentCount ?? evaluation?.agentOpinions?.filter((a) => a.status === "active").length ?? 0} Aktif • ${evaluation?.offlineAgentCount ?? evaluation?.agentOpinions?.filter((a) => a.status === "not_contributed").length ?? 0} Offline)`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Interactive Target RR Selector */}
                <div className="flex items-center gap-1 rounded-md bg-black border border-zinc-800 p-0.5 sm:p-1">
                  <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500 uppercase px-1">RR:</span>
                  {[1.5, 2.0, 2.5, 3.0].map((rrVal) => (
                    <button
                      key={rrVal}
                      type="button"
                      onClick={() => handleTargetRrChange(rrVal)}
                      className={`px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-medium transition-colors ${
                        targetRr === rrVal
                          ? "bg-zinc-800 text-emerald-400 border border-zinc-700 shadow-sm"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      1:{rrVal.toFixed(1)}
                    </button>
                  ))}
                </div>

                {evaluation ? (() => {
                  const isFilled = (evaluation as any).entryFilled === true;
                  const isWaitPlan = evaluation.signal === "WAIT";
                  const activeDir = evaluation.direction === "BULLISH" ? "Buy" : evaluation.direction === "BEARISH" ? "Sell" : "Trade";
                  const badgeColor = isWaitPlan && !isFilled
                    ? "border-amber-800 text-amber-400"
                    : (evaluation.signal === "BUY" || evaluation.direction === "BULLISH")
                    ? "border-emerald-800 text-emerald-400"
                    : "border-red-800 text-red-400";

                  const labelText = isWaitPlan
                    ? isFilled
                      ? `● Triggered ${activeDir}`
                      : `Wait (${evaluation.confidence}%)`
                    : evaluation.signal === "BUY"
                    ? "Buy"
                    : evaluation.signal === "SELL"
                    ? "Sell"
                    : "Wait";

                  return (
                    <Badge
                      variant="outline"
                      className={`text-[10px] sm:text-[11px] font-mono ${badgeColor}`}
                    >
                      {labelText}{" "}
                      {isWaitPlan && isFilled ? `(Entry Terisi)` : `(${evaluation.confidence}%)`} &bull; SL {evaluation.slPips ?? 35}p &bull; {evaluation.riskRewardRatio ?? `1:${targetRr}`}
                    </Badge>
                  );
                })() : (
                  <Badge
                    variant="outline"
                    className="text-[10px] sm:text-[11px] font-mono border-amber-800/80 text-amber-400 animate-pulse"
                  >
                    Menganalisis Pasar...
                  </Badge>
                )}
                {/* View Switcher: War Room Chat vs Agent Cards */}
                <div className="flex items-center gap-1 bg-black p-0.5 rounded-md border border-zinc-800 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setCouncilViewTab("chat")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                      councilViewTab === "chat"
                        ? "bg-zinc-800 text-emerald-400 font-medium shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <MessageSquare className="h-3 w-3" />
                    <span>War Room Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCouncilViewTab("cards")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                      councilViewTab === "cards"
                        ? "bg-zinc-800 text-zinc-100 font-medium shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Users className="h-3 w-3" />
                    <span>Agent Cards</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCouncilStripOpen(!isCouncilStripOpen)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs font-mono flex items-center gap-1 ml-auto sm:ml-0"
                >
                  {isCouncilStripOpen ? "Minimize" : "Expand All"}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isCouncilStripOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>

            {evaluation?.emotionalState && (
              <div className="mb-3 grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                {/* Overall council emotion + meter */}
                <div className="rounded border border-zinc-800 bg-black p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">
                      State Emosi Dewan
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-mono ${
                        EMOTION_TONE_CLASS[evaluation.emotionalState.dominantEmotionTone]
                      }`}
                    >
                      {evaluation.emotionalState.dominantEmotionIcon}{" "}
                      {evaluation.emotionalState.dominantEmotionLabel}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl leading-none">
                      {evaluation.emotionalState.dominantEmotionIcon}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                        <span>Emotion meter</span>
                        <span className="text-zinc-300">{evaluation.emotionalState.emotionMeter}/100</span>
                      </div>
                      <MeterBar
                        value={evaluation.emotionalState.emotionMeter}
                        tone={evaluation.emotionalState.dominantEmotionTone}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "Mood", value: `${evaluation.emotionalState.moodIndex > 0 ? "+" : ""}${evaluation.emotionalState.moodIndex}` },
                      { label: "Kohesif", value: `${evaluation.emotionalState.coherence}%` },
                      { label: "Dispersi", value: `${evaluation.emotionalState.emotionSpread}%` },
                    ].map((m) => (
                      <div key={m.label} className="rounded bg-zinc-900/60 px-1 py-1">
                        <div className="text-[9px] font-mono text-zinc-500">{m.label}</div>
                        <div className="text-[11px] font-mono text-zinc-200">{m.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">
                    {evaluation.emotionalState.councilMood}
                  </p>
                </div>

                {/* Emotion distribution + psychology profile */}
                <div className="rounded border border-zinc-800 bg-black p-3">
                  <div className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">
                    Komposisi Emosi &amp; Profil Psikologis
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {evaluation.emotionalState.breakdown.map((entry) => (
                      <span
                        key={entry.emotion}
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-mono ${EMOTION_TONE_CLASS[entry.tone]}`}
                        title={`${entry.count} agen, intensitas rata-rata ${entry.avgIntensity}`}
                      >
                        {entry.icon} {entry.label} &middot; {entry.count} &middot; {entry.weight}%
                      </span>
                    ))}
                    {evaluation.emotionalState.breakdown.length === 0 && (
                      <span className="text-[10px] font-mono text-zinc-600">Tidak ada data emosi</span>
                    )}
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: "Disiplin", value: evaluation.emotionalState.psychology.discipline },
                      { label: "Kesabaran", value: evaluation.emotionalState.psychology.patience },
                      { label: "Anti FOMO", value: evaluation.emotionalState.psychology.fomoResistance },
                      { label: "Siap eksekusi", value: evaluation.emotionalState.psychology.executionReadiness },
                    ].map((m) => (
                      <div key={m.label}>
                        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
                          <span>{m.label}</span>
                          <span className="text-zinc-300">{m.value}</span>
                        </div>
                        <MeterBar
                          value={m.value}
                          tone={m.value >= 70 ? "constructive" : m.value >= 50 ? "neutral" : m.value >= 35 ? "caution" : "destructive"}
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">
                    {evaluation.emotionalState.psychology.summary}
                  </p>
                  {evaluation.emotionalState.warning && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-300/90">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{evaluation.emotionalState.warning}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {evaluation?.consensus && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-zinc-800 bg-black px-3 py-2 text-[10px] font-mono text-zinc-400">
                <span className="text-zinc-300">Weighted voting:</span>
                <span className="text-emerald-400">bull {evaluation.consensus.bullishWeight}</span>
                <span className="text-red-400">bear {evaluation.consensus.bearishWeight}</span>
                <span className="text-zinc-500">netral {evaluation.consensus.neutralWeight}</span>
                <span className="text-zinc-700">|</span>
                <span>kesesuaian {(evaluation.consensus.agreement * 100).toFixed(0)}%</span>
                <span className="text-zinc-700">|</span>
                <span>partisipasi {(evaluation.consensus.participation * 100).toFixed(0)}%</span>
                <span className="text-zinc-700">|</span>
                <span>veto {evaluation.consensus.vetoes.length}</span>
                {evaluation.expectancy && (
                  <>
                    <span className="text-zinc-700">|</span>
                    <span
                      className={
                        evaluation.expectancy.verdict === "POSITIVE_EDGE"
                          ? "text-emerald-400"
                          : evaluation.expectancy.verdict === "THIN_EDGE"
                          ? "text-amber-400"
                          : "text-red-400"
                      }
                    >
                      EV {evaluation.expectancy.expectedValuePips} pips @ WR{" "}
                      {(evaluation.expectancy.winProbability * 100).toFixed(0)}% (BE{" "}
                      {(evaluation.expectancy.breakEvenWinRate * 100).toFixed(0)}%)
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Smart Planned Order Card (Even if WAIT / PENDING RETEST) */}
            {evaluation?.plannedOrder && (
              <div className="mb-3 rounded border border-amber-900/60 bg-amber-950/20 px-3.5 py-2.5 font-mono text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-900/40 pb-1.5 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <span className="font-semibold text-amber-300">
                      {evaluation.plannedOrder.type === "BUY_LIMIT" ? "🎯 PLANNED BUY LIMIT" : "🎯 PLANNED SELL LIMIT"}
                    </span>
                    <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-400 border border-zinc-800">
                      {evaluation.signal === "WAIT" ? "Pending Pullback Trigger" : "Armed for Execution"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-zinc-400">Target RR:</span>
                    <span className="font-bold text-emerald-400">{evaluation.plannedOrder.rr}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
                  <div className="rounded bg-black/60 p-1.5 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 block">Pending Limit</span>
                    <span className="font-bold text-zinc-100">${evaluation.plannedOrder.price}</span>
                  </div>
                  <div className="rounded bg-black/60 p-1.5 border border-zinc-800/80">
                    <span className="text-[10px] text-red-400/90 block">Stop Loss</span>
                    <span className="font-bold text-red-300">${evaluation.plannedOrder.sl} ({evaluation.plannedOrder.slPips}p)</span>
                  </div>
                  <div className="rounded bg-black/60 p-1.5 border border-zinc-800/80">
                    <span className="text-[10px] text-emerald-400/90 block">Take Profit</span>
                    <span className="font-bold text-emerald-300">${evaluation.plannedOrder.tp} ({evaluation.plannedOrder.tpPips}p)</span>
                  </div>
                  <div className="rounded bg-black/60 p-1.5 border border-zinc-800/80 flex flex-col justify-center">
                    <span className="text-[9px] text-zinc-500 block">Status Trigger</span>
                    <span className="text-[10px] text-amber-400 truncate">{evaluation.entryTrigger || evaluation.plannedOrder.rationale}</span>
                  </div>
                </div>

                {evaluation.plannedOrder.rationale && (
                  <p className="mt-2 text-[10px] text-zinc-400 font-sans italic">
                    💡 Rationale Dewan: {evaluation.plannedOrder.rationale}
                  </p>
                )}
              </div>
            )}

            {isCouncilStripOpen && (
              <div className="space-y-3">
                {/* Mode 1: War Room Interactive Chat */}
                {councilViewTab === "chat" && (
                  <CouncilWarRoomChat
                    evaluationId={evaluation?.id}
                    discussion={evaluation?.councilDiscussion}
                    isEvaluating={isEvaluating}
                    symbol={activeSymbol}
                    timeframe={timeframe}
                    price={currentCandle?.close || evaluation?.entryPrice || 0}
                    agentOpinions={evaluation?.agentOpinions || []}
                    signal={evaluation?.signal || "WAIT"}
                  />
                )}

                {/* Mode 2: Multi-Agent Card Grid & Drawer */}
                {councilViewTab === "cards" && (
                  <div className="space-y-2.5">
                    {/* Agent grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {(evaluation?.agentOpinions || []).map((agent) => {
                        const isExpanded = expandedAgentId === agent.agentId;
                    const isChief = agent.agentId === "slot_1";
                    const isNotContributed = agent.status === "not_contributed";

                    return (
                      <div
                        key={agent.agentId}
                        onClick={() => toggleAgentCollapse(agent.agentId)}
                        className={`cursor-pointer rounded border p-2 text-xs transition-all select-none ${
                          isNotContributed
                            ? "border-zinc-900 bg-black/40 opacity-60 hover:opacity-100"
                            : isChief
                            ? isExpanded
                              ? "border-emerald-700 bg-emerald-950/25 ring-1 ring-emerald-600/40"
                              : "border-emerald-900/60 bg-emerald-950/10 hover:border-emerald-700"
                            : isExpanded
                            ? "border-zinc-600 bg-zinc-900 ring-1 ring-zinc-500/30"
                            : "border-zinc-800/90 bg-black hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] font-semibold text-zinc-200 truncate pr-1">
                            {agent.agentName}
                          </span>
                          {isNotContributed ? (
                            <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-zinc-900 text-amber-500 border border-amber-900/40">
                              Offline
                            </span>
                          ) : (
                            <span
                              className={`text-[9px] font-mono font-medium px-1.5 py-0.5 rounded ${
                                agent.bias === "BULLISH"
                                  ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/50"
                                  : agent.bias === "BEARISH"
                                  ? "bg-red-950/60 text-red-400 border border-red-900/50"
                                  : "bg-zinc-800 text-zinc-400"
                              }`}
                            >
                              {BIAS_LABEL[agent.bias]}
                            </span>
                          )}
                        </div>

                        {/* Emotion chip with intensity meter */}
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span
                            className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-mono ${
                              EMOTION_TONE_CLASS[agent.emotionTone || "neutral"]
                            }`}
                            title={agent.emotionReason || agent.emotionLabel}
                          >
                            <span className="text-[11px] leading-none">{agent.emotionIcon || "😐"}</span>
                            {agent.emotionLabel || "Netral"}
                          </span>
                          <div className="flex-1">
                            <MeterBar
                              value={agent.emotionIntensity ?? 0}
                              tone={agent.emotionTone || "neutral"}
                            />
                          </div>
                        </div>

                        <div className="text-[9px] font-mono text-zinc-500 mt-1 flex items-center justify-between">
                          <span className="truncate">{agent.provider}</span>
                          <span className="text-[8px] text-zinc-600 truncate">{agent.modelUsed}</span>
                        </div>

                        <p className="mt-1 text-[10px] text-zinc-400 leading-tight line-clamp-2">
                          {isNotContributed ? "Not Contributed (API Key empty/offline)" : agent.keyObservation}
                        </p>

                        <div className="mt-1.5 pt-1 border-t border-zinc-900 flex items-center justify-between text-[9px] font-mono text-zinc-500">
                          <span className="flex items-center gap-1.5">
                            {!isNotContributed && (
                              <span className="text-zinc-600">qual {agent.reasoningQuality ?? 0}</span>
                            )}
                            {agent.voteVetoed && <span className="text-red-400">veto</span>}
                            <span>{isNotContributed ? "Detail Offline" : isExpanded ? "Tutup" : "Detail"}</span>
                          </span>
                          <ChevronDown className={`h-2.5 w-2.5 transition-transform ${isExpanded ? "rotate-180 text-emerald-400" : ""}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Expanded Detail Drawer for Selected Agent */}
                {expandedAgentId && (() => {
                  const selectedAgent = evaluation?.agentOpinions?.find((a) => a.agentId === expandedAgentId);
                  if (!selectedAgent) return null;
                  const isChief = selectedAgent.agentId === "slot_1";
                  const isOffline = selectedAgent.status === "not_contributed";

                  return (
                    <div className={`rounded-lg border p-3.5 transition-all text-xs font-sans ${
                      isOffline
                        ? "border-amber-900/40 bg-zinc-950/90"
                        : isChief
                        ? "border-emerald-800/80 bg-black/95"
                        : "border-zinc-800 bg-black/95"
                    }`}>
                      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800/80 pb-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          {isOffline ? (
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                          ) : (
                            <Bot className={`h-4 w-4 ${isChief ? "text-emerald-400" : "text-zinc-400"}`} />
                          )}
                          <span className="font-semibold text-zinc-100 font-mono text-xs">
                            {selectedAgent.agentName}
                          </span>
                          <span className="text-zinc-500 font-mono text-[11px]">&bull; {selectedAgent.role}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono border-zinc-800 text-zinc-400">
                            {selectedAgent.provider} ({selectedAgent.modelUsed})
                          </Badge>
                          {isOffline ? (
                            <Badge className="text-[10px] font-mono font-medium bg-amber-950/40 text-amber-400 border border-amber-900/50">
                              Tidak Berkontribusi
                            </Badge>
                          ) : (
                            <>
                              <Badge className={`text-[10px] font-mono font-medium ${
                                selectedAgent.bias === "BULLISH"
                                  ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800"
                                  : selectedAgent.bias === "BEARISH"
                                  ? "bg-red-950/60 text-red-400 border border-red-800"
                                  : "bg-zinc-900 text-zinc-300"
                              }`}>
                                Bias: {BIAS_LABEL[selectedAgent.bias]} ({selectedAgent.confidence}%)
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-mono ${EMOTION_TONE_CLASS[selectedAgent.emotionTone || "neutral"]}`}
                              >
                                {selectedAgent.emotionIcon || "😐"} {selectedAgent.emotionLabel || "Netral"}{" "}
                                {selectedAgent.emotionIntensity ?? 0}%
                              </Badge>
                              {selectedAgent.voteVetoed && (
                                <Badge className="text-[10px] font-mono bg-red-950/60 text-red-300 border border-red-900/60">
                                  Vote Dibatalkan
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {!isOffline && selectedAgent.emotionReason && (
                          <div className="rounded border border-zinc-800 bg-zinc-950/60 px-2.5 py-2">
                            <div className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">
                              Why this emotion
                            </div>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-300">
                              {selectedAgent.emotionReason}
                            </p>
                          </div>
                        )}

                        <div>
                          <div className="text-[11px] text-zinc-500 mb-1">
                            {isOffline ? "Status Agen AI:" : "Analisis Mendalam Scalping:"}
                          </div>
                          <p className={`text-xs leading-relaxed ${isOffline ? "text-amber-300/80 font-mono" : "text-zinc-200"}`}>
                            {selectedAgent.detailedAnalysis || selectedAgent.keyObservation}
                          </p>
                        </div>

                        {!isOffline && selectedAgent.psychology && (
                          <div className="pt-2 border-t border-zinc-900">
                            <div className="text-[11px] text-zinc-500 mb-1.5 flex items-center gap-1.5">
                              <BrainCircuit className="h-3.5 w-3.5 text-cyan-400" />
                              Psikologi &amp; Disiplin Agen
                              {typeof selectedAgent.reasoningQuality === "number" && (
                                <span className="font-mono text-[10px] text-zinc-600">
                                  reasoning quality {selectedAgent.reasoningQuality}/100 &middot; bobot vote{" "}
                                  {selectedAgent.voteWeight ?? 0}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { label: "Disiplin", value: selectedAgent.psychology.discipline },
                                { label: "Kesabaran", value: selectedAgent.psychology.patience },
                                { label: "Anti FOMO", value: selectedAgent.psychology.fomoResistance },
                                { label: "Siap eksekusi", value: selectedAgent.psychology.executionReadiness },
                              ].map((m) => (
                                <div key={m.label} className="rounded bg-zinc-950 border border-zinc-900 p-2">
                                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                                    <span>{m.label}</span>
                                    <span className="text-zinc-300">{m.value}</span>
                                  </div>
                                  <MeterBar
                                    value={m.value}
                                    tone={m.value >= 70 ? "constructive" : m.value >= 50 ? "neutral" : m.value >= 35 ? "caution" : "destructive"}
                                    className="mt-1"
                                  />
                                </div>
                              ))}
                            </div>
                            {selectedAgent.psychology.read && (
                              <p className="mt-2 text-[11px] leading-relaxed text-zinc-300">
                                {selectedAgent.psychology.read}
                              </p>
                            )}
                            {selectedAgent.psychology.riskFlags?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {selectedAgent.psychology.riskFlags.map((flag, i) => (
                                  <span
                                    key={i}
                                    className="rounded border border-amber-900/50 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-mono text-amber-300"
                                  >
                                    {flag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {selectedAgent.vetoReason && (
                              <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-red-300/90">
                                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                                <span>{selectedAgent.vetoReason}</span>
                              </p>
                            )}
                          </div>
                        )}

                        {selectedAgent.evidence && selectedAgent.evidence.length > 0 && (
                          <div className="pt-2 border-t border-zinc-900">
                            <div className="text-[11px] text-zinc-500 mb-1.5">
                              Bukti &amp; Dasar Pertimbangan:
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              {selectedAgent.evidence.map((ev, i) => (
                                <div key={i} className="flex items-start gap-2 rounded bg-zinc-950 border border-zinc-900 p-2 text-[11px] text-zinc-300">
                                  {isOffline ? (
                                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                  ) : (
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                  )}
                                  <span>{ev}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
              </div>
            )}
          </Card>
        )}

        {/* Analytical Workspace Layout */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left Column: AI Technical Breakdown & Analysis (7 cols) */}
          <div className="space-y-4 lg:col-span-7">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="p-3 bg-zinc-950 border-zinc-800 shadow-none">
                <div className="text-[11px] text-zinc-500">
                  SL Adaptif
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-red-400">
                  {evaluation?.slPips ?? 35} Pips
                </div>
                <div className="text-[10px] font-mono text-zinc-600 truncate">
                  {evaluation?.riskPlan?.slBasis ?? "Regime volatilitas + struktur swing"}
                </div>
              </Card>
              <Card className="p-3 bg-zinc-950 border-zinc-800 shadow-none">
                <div className="text-[11px] text-zinc-500">
                  TP &amp; Rasio Risiko
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-emerald-400">
                  {evaluation?.tpPips ?? 88} Pips ({evaluation?.riskRewardRatio ?? "1:2.5"})
                </div>
                <div className="text-[10px] font-mono text-zinc-600">
                  EV{" "}
                  <span
                    className={
                      (evaluation?.expectancy?.expectedValuePips ?? 0) > 0 ? "text-emerald-500" : "text-red-500"
                    }
                  >
                    {evaluation?.expectancy?.expectedValuePips ?? "-"} pips
                  </span>
                </div>
              </Card>
              <Card className="p-3 bg-zinc-950 border-zinc-800 shadow-none">
                <div className="text-[11px] text-zinc-500">
                  Regime Volatilitas
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-zinc-200">
                  {evaluation?.technicalContext?.volatility?.regime ?? "-"}
                </div>
                <div className="text-[10px] font-mono text-zinc-600">
                  ATR {evaluation?.technicalContext?.atrPips ?? "-"} pips
                </div>
              </Card>
              <Card className="p-3 bg-zinc-950 border-zinc-800 shadow-none">
                <div className="text-[11px] text-zinc-500">
                  Dewan &amp; Veto
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-zinc-200">
                  {evaluation ? `${evaluation.activeAgentCount ?? 0} aktif` : "Menunggu"}
                </div>
                <div className="text-[10px] font-mono text-zinc-600">
                  veto psikologis {evaluation?.consensus?.vetoes.length ?? 0}
                </div>
              </Card>
            </div>

            {/* AI Technical Analysis & Evaluation Card */}
            <Card className="border-zinc-800 bg-zinc-950 p-4 shadow-none">
              <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-zinc-800">
                <CardTitle className="text-xs font-semibold text-zinc-200">
                  Scalping Execution Plan (Synthesized by Council)
                </CardTitle>
                {evaluation?.signal && (
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs font-medium ${
                      evaluation.signal === "BUY"
                        ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60"
                        : evaluation.signal === "SELL"
                        ? "bg-red-950/40 text-red-400 border-red-900/60"
                        : "bg-zinc-900 text-zinc-300 border-zinc-800"
                    }`}
                  >
                    Signal: Scalp {evaluation.signal === "BUY" ? "Buy" : evaluation.signal === "SELL" ? "Sell" : "Wait"} &bull; Conf {evaluation.confidence}%
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="p-0 pt-3">
                {evaluation ? (
                  <div className="space-y-3 text-xs leading-relaxed">
                    {/* Multi-Timeframe Alignment Matrix (M1, M5, M15, H1) */}
                    {evaluation.mtfMatrix && Object.keys(evaluation.mtfMatrix).length > 0 && (
                      <div className="p-2.5 rounded-lg bg-black border border-zinc-800">
                        <div className="flex items-center justify-between text-[11px] mb-2 font-mono">
                          <span className="text-zinc-400 font-semibold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                            Multi-Timeframe Trend Matrix
                          </span>
                          <span className="text-zinc-500 text-[10px]">
                            Live Binance Sync &bull; M1 &bull; M5 &bull; M15 &bull; H1
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {["1M", "5M", "15M", "1H"].map((tfKey) => {
                            const data = evaluation.mtfMatrix?.[tfKey];
                            const isBull = data?.trend === "BULLISH";
                            const isActiveTF = timeframe.toUpperCase() === tfKey;
                            return (
                              <div
                                key={tfKey}
                                className={`p-2 rounded border text-center transition-all ${
                                  isActiveTF
                                    ? "border-zinc-500 bg-zinc-900/90 shadow-sm"
                                    : "border-zinc-800/80 bg-zinc-950"
                                }`}
                              >
                                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-0.5">
                                  <span className="font-semibold text-zinc-200">{tfKey}</span>
                                  {isActiveTF && (
                                    <span className="text-[9px] text-cyan-400 font-normal">Active</span>
                                  )}
                                </div>
                                <div
                                  className={`text-[11px] font-semibold font-mono ${
                                    isBull ? "text-emerald-400" : "text-red-400"
                                  }`}
                                >
                                  {data ? (isBull ? "BULLISH" : "BEARISH") : "SYNCING"}
                                </div>
                                <div className="text-[9px] text-zinc-500 font-mono mt-0.5">
                                  RSI: {data?.rsi ?? 50}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bounded Entry, SL, and TP Level Metrics with Exact Pips */}
                    {evaluation.entryPrice && evaluation.signal !== "WAIT" && (
                      <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-black border border-zinc-800 font-mono">
                        <div className="text-center border-r border-zinc-800 pr-2">
                          <span className="text-[10px] text-zinc-500 uppercase flex items-center justify-center gap-1">
                            {evaluation.orderType === "LIMIT" ? "⏳ Limit / Retest Entry" : "⚡ Suggested Entry"}
                          </span>
                          <div className="text-sm font-semibold text-zinc-100 mt-0.5">
                            ${evaluation.entryPrice.toFixed(2)}
                          </div>
                          {evaluation.entryTrigger && (
                            <span className="text-[9px] block text-cyan-400/90 font-normal truncate mt-0.5" title={evaluation.entryTrigger}>
                              {evaluation.orderType === "LIMIT" ? "Pending Pullback" : "Market Execution"}
                            </span>
                          )}
                        </div>
                        <div className="text-center border-r border-zinc-800 pr-2">
                          <span className="text-[10px] text-red-400 uppercase">Stop Loss (SL)</span>
                          <div className="text-sm font-semibold text-red-400 mt-0.5">
                            ${evaluation.stopLoss?.toFixed(2)}
                            {evaluation.slPips && (
                              <span className="text-[10px] block text-red-400/80 font-normal">
                                (-{evaluation.slPips} pips)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] text-emerald-400 uppercase">Take Profit (TP)</span>
                          <div className="text-sm font-semibold text-emerald-400 mt-0.5">
                            ${evaluation.takeProfit?.toFixed(2)}
                            {evaluation.tpPips && (
                              <span className="text-[10px] block text-emerald-400/80 font-normal">
                                (+{evaluation.tpPips} pips / RR {evaluation.riskRewardRatio ?? `1:${targetRr}`})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ALASAN MENAHAN DIRI / NO-TRADE REASONS (KETIKA STATUS WAIT) */}
                    {evaluation.signal === "WAIT" && (
                      <div className="rounded-lg border border-amber-800/80 bg-amber-950/20 p-3.5 space-y-2">
                        <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-semibold pb-1.5 border-b border-amber-900/40">
                          <AlertCircle className="h-4 w-4" />
                          <span>Status: MENAHAN DIRI (WAIT) — Jangan Masuk Pasar</span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                          AI secara cerdas memilih <strong className="text-amber-300">TIDAK MEMAKSAKAN ENTRY</strong> karena kondisi saat ini belum memiliki edge probabilitas tinggi.
                        </p>
                        {evaluation.noTradeReasons && evaluation.noTradeReasons.length > 0 && (
                          <div className="mt-2 space-y-1.5 pt-1">
                            <div className="text-[11px] font-mono text-zinc-400">Penyebab Belum Ada Setup:</div>
                            <div className="grid grid-cols-1 gap-1.5">
                              {evaluation.noTradeReasons.map((reason, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-[11px] font-mono text-amber-200/90 bg-black/50 border border-amber-900/30 rounded p-2">
                                  <span className="text-amber-400 font-bold">•</span>
                                  <span>{reason}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mathematical Calculations & Volatility Metrics */}
                    {evaluation.calculations && (
                      <div className="rounded border border-zinc-800 bg-black p-3">
                        <div className="font-semibold text-zinc-400 font-mono text-[11px]">
                          Quantitative Calculations &amp; Pip Multipliers
                        </div>
                        <p className="mt-1 font-mono text-zinc-300 text-[11px] leading-relaxed">
                          {evaluation.calculations}
                        </p>
                      </div>
                    )}

                    {/* KESIMPULAN MENDALAM DARI AI PENYIMPUL */}
                    {evaluation.detailedVerdict && (
                      <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/10 p-3.5">
                        <div className="font-semibold text-emerald-400 font-mono text-[11px] pb-1 border-b border-emerald-900/40">
                          Kesimpulan Akhir &amp; Putusan AI Penyimpul
                        </div>
                        <p className="mt-2 text-zinc-200 text-xs leading-relaxed font-sans">
                          {evaluation.detailedVerdict}
                        </p>
                      </div>
                    )}

                    {/* Detailed Indonesian Market Thesis Synthesized by Council */}
                    <div className="rounded border border-zinc-800 bg-black p-3">
                      <div className="font-semibold text-zinc-400 font-mono text-[11px]">
                        Tesis Konsensus Dewan AI ({activeSymbol} &bull; {timeframe.toUpperCase()})
                      </div>
                      <p className="mt-1 text-zinc-200 leading-relaxed">{evaluation.thesis}</p>
                    </div>

                    {/* SL & TP Detailed Justification Reasons */}
                    {(evaluation.slReason || evaluation.tpReason) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {evaluation.slReason && (
                          <div className="rounded border border-zinc-800 bg-black p-3">
                            <div className="font-semibold text-red-400 font-mono text-[11px]">
                              Alasan Penempatan Stop Loss
                            </div>
                            <p className="mt-1 text-zinc-300 text-[11px] leading-relaxed">
                              {evaluation.slReason}
                            </p>
                          </div>
                        )}
                        {evaluation.tpReason && (
                          <div className="rounded border border-zinc-800 bg-black p-3">
                            <div className="font-semibold text-emerald-400 font-mono text-[11px]">
                              Alasan Penempatan Take Profit
                            </div>
                            <p className="mt-1 text-zinc-300 text-[11px] leading-relaxed">
                              {evaluation.tpReason}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Risk Invalidation & Tactical Instructions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded border border-zinc-800 bg-black p-3">
                        <div className="font-semibold text-zinc-400 font-mono text-[11px]">
                          Level Pembatalan Skenario (Invalidation)
                        </div>
                        <p className="mt-1 font-mono text-zinc-300 text-[11px]">
                          {evaluation.riskInvalidation}
                        </p>
                      </div>
                      <div className="rounded border border-zinc-800 bg-black p-3">
                        <div className="font-semibold text-zinc-400 font-mono text-[11px]">
                          Instruksi Eksekusi Scalping
                        </div>
                        <p className="mt-1 text-zinc-200 text-[11px]">
                          {evaluation.recommendation}
                        </p>
                      </div>
                    </div>

                    {/* Chart Mapping Coordinates Notice */}
                    {evaluation.chartMapping && (
                      <div className="rounded border border-zinc-800 bg-zinc-900/40 p-2.5 text-[11px] font-mono text-zinc-300 flex items-center justify-between">
                        <span className="text-zinc-400">Scalping Segment Lines Overlaid on Chart</span>
                        <span>
                          Support: <strong className="text-zinc-200">${evaluation.chartMapping.supportLevel}</strong> &bull; Resistance: <strong className="text-zinc-200">${evaluation.chartMapping.resistanceLevel}</strong>
                        </span>
                      </div>
                    )}

                    {evaluation.notes && (
                      <div className="rounded border border-zinc-800 bg-black p-3">
                        <div className="font-semibold text-zinc-500 font-mono text-[11px]">
                          Catatan Manajemen Lot 0.01 &amp; Psikologi
                        </div>
                        <p className="mt-1 text-zinc-300 font-mono text-[11px]">{evaluation.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <BrainCircuit className="mx-auto h-8 w-8 text-zinc-600" />
                    <p className="mt-2 text-xs text-zinc-300 font-medium">Ready for 10-Agent Scalping Deliberation</p>
                    <p className="mt-1 text-[11px] text-zinc-500 max-w-sm mx-auto">
                      10 distinct AI minds evaluate microstructure, liquidity sweeps, and pip risks in parallel, then synthesize a 30-50 pip scalping setup.
                    </p>
                    <Button
                      onClick={handleEvaluate}
                      disabled={isEvaluating}
                      className="mt-4 bg-zinc-100 text-black hover:bg-white font-medium text-xs border-0 shadow-none px-5"
                    >
                      {isEvaluating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          10 Minds Deliberating &amp; Synthesizing...
                        </>
                      ) : (
                        <>
                          <Compass className="h-3.5 w-3.5 mr-1.5" />
                          Start 10-Agent Scalping Deliberation
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Execution Rules & Persistent Historical Analysis Log (5 cols) */}
          <div className="space-y-4 lg:col-span-5">
            {/* Strategy Checklist */}
            <Card className="border-zinc-800 bg-zinc-950 p-4 shadow-none">
              <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-zinc-800">
                <CardTitle className="text-xs font-semibold text-zinc-200">
                  Discipline Checklist &amp; Strategy
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSkillModalOpen(true)}
                  className="h-7 text-[11px] px-2.5 bg-black border-zinc-800 hover:bg-zinc-900 text-zinc-300 hover:text-white"
                >
                  Select Strategy
                </Button>
              </CardHeader>

              {!selectedSkill ? (
                <div className="py-6 text-center">
                  <p className="text-xs text-zinc-500">No active strategy selected.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSkillModalOpen(true)}
                    className="mt-3 text-xs border-zinc-800 bg-black hover:bg-zinc-900 text-zinc-300"
                  >
                    Open Quantitative Strategy Library
                  </Button>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="rounded border border-zinc-800 bg-black p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-200 text-xs">{selectedSkill.title}</span>
                      <Badge variant="outline" className="text-[10px] font-mono border-zinc-800 text-zinc-400">
                        {selectedSkill.timeframes?.join(", ") || "M1 / M5"}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-[11px] text-zinc-400 leading-normal">
                      {selectedSkill.description}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] text-zinc-500">
                      Validation Rules ({Object.values(checkedRules).filter(Boolean).length}/{rules.length})
                    </div>
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        onClick={() => toggleRule(rule.id)}
                        className={`flex cursor-pointer items-start gap-2.5 rounded border p-2.5 text-xs transition-colors ${
                          checkedRules[rule.id]
                            ? "border-zinc-700 bg-zinc-900 text-zinc-100"
                            : "border-zinc-800 bg-black text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            checkedRules[rule.id]
                              ? "border-zinc-600 bg-zinc-700 text-white"
                              : "border-zinc-800 bg-zinc-950"
                          }`}
                        >
                          {checkedRules[rule.id] && <CheckCircle2 className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>
                        <div className="leading-tight">
                          <span>{rule.text}</span>
                          {rule.required && (
                            <span className="ml-1 text-[10px] text-zinc-400 font-mono font-medium">[Required]</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={handleEvaluate}
                      disabled={isEvaluating}
                      className="w-full flex items-center justify-center gap-2 bg-zinc-100 text-black hover:bg-white font-medium text-xs shadow-none border-0"
                    >
                      {isEvaluating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Deliberating Active AI Minds...</span>
                        </>
                      ) : (
                        <span>Run Multi-Agent Deliberation (Up to 20 Minds)</span>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Persistent AI Generation History Log */}
            <Card className="border-zinc-800 bg-zinc-950 p-4 shadow-none">
              <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xs font-semibold text-zinc-200">
                    Analysis History Log ({evalLogs.length})
                  </CardTitle>
                  {(() => {
                    const decidedLogs = evalLogs.filter(
                      (l) => l.outcome === "WIN" || l.outcome === "LOSE"
                    );
                    const wins = evalLogs.filter((l) => l.outcome === "WIN").length;
                    const losses = evalLogs.filter((l) => l.outcome === "LOSE").length;
                    const activeCount = evalLogs.filter(
                      (l) => l.outcome === "ACTIVE" || (!l.outcome && l.signal && l.signal !== "WAIT")
                    ).length;
                    const winrate =
                      decidedLogs.length > 0
                        ? Math.round((wins / decidedLogs.length) * 100)
                        : null;

                    return (
                      <div className="flex items-center gap-1.5">
                        {winrate !== null ? (
                          <Badge
                            className={`px-1.5 py-0.5 text-[10px] font-mono font-bold border ${
                              winrate >= 50
                                ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                                : "bg-red-950/60 text-red-400 border-red-800"
                            }`}
                          >
                            Winrate: {winrate}% ({wins}W / {losses}L)
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="px-1.5 py-0.5 text-[10px] font-mono border-zinc-800 text-zinc-400"
                          >
                            Winrate: Pending ({activeCount} active)
                          </Badge>
                        )}
                      </div>
                    );
                  })()}
                </div>
                {evalLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={clearLogs}
                    className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Clear History
                  </button>
                )}
              </CardHeader>

              <CardContent className="p-0 pt-3">
                {evalLogs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-zinc-500">
                    No generated analyses logged yet. Each evaluation will automatically be archived here with live WIN / LOSE / WAIT tracking.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {evalLogs.map((log) => {
                      const isCurrent = evaluation?.id === log.id;
                      const dateStr = log.timestamp
                        ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : "Recent";

                      const outcomeStatus: EvaluationOutcome =
                        log.outcome || (log.signal === "WAIT" ? "WAIT" : "ACTIVE");
                      // Armed but price has not traded the entry level yet.
                      const awaitingEntry =
                        outcomeStatus === "ACTIVE" &&
                        log.signal !== "WAIT" &&
                        log.entryFilled !== true;

                      return (
                        <div
                          key={log.id}
                          onClick={() => selectHistoricalLog(log)}
                          className={`group cursor-pointer rounded border p-2.5 text-xs transition-colors ${
                            isCurrent
                              ? "border-zinc-700 bg-zinc-900"
                              : "border-zinc-800/80 bg-black hover:border-zinc-700 hover:bg-zinc-950"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {/* Signal Badge */}
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold border ${
                                  log.signal === "BUY"
                                    ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60"
                                    : log.signal === "SELL"
                                    ? "bg-red-950/40 text-red-400 border-red-900/60"
                                    : "bg-zinc-900 text-zinc-400 border-zinc-800"
                                }`}
                              >
                                {log.signal}
                              </span>

                              {/* WIN / LOSE / ACTIVE / WAIT Outcome Status Badge */}
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold border tracking-wider ${
                                  outcomeStatus === "WIN"
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                                    : outcomeStatus === "LOSE"
                                    ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.2)]"
                                    : outcomeStatus === "ACTIVE"
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse"
                                    : "bg-zinc-900 text-zinc-400 border-zinc-800"
                                }`}
                              >
                                {outcomeStatus === "WIN"
                                  ? "✓ WIN"
                                  : outcomeStatus === "LOSE"
                                  ? "✕ LOSE"
                                  : outcomeStatus === "ACTIVE"
                                  ? awaitingEntry
                                    ? "◦ MENUNGGU ENTRY"
                                    : (() => {
                                        // Hitung floating pips real-time jika simbol cocok dengan currentCandle
                                        const isSameSym = !log.symbol || log.symbol === activeSymbol;
                                        if (isSameSym && currentCandle && log.entryPrice) {
                                          const isGold = (log.symbol || activeSymbol).toUpperCase().includes("XAU") || (log.symbol || activeSymbol).toUpperCase().includes("GOLD");
                                          const pipDiv = isGold ? 0.1 : 1;
                                          const diff = log.signal === "BUY"
                                            ? (currentCandle.close - log.entryPrice) / pipDiv
                                            : (log.entryPrice - currentCandle.close) / pipDiv;
                                          const pips = Math.round(diff);
                                          const sign = pips >= 0 ? "+" : "";
                                          return `● RUNNING (${sign}${pips}p)`;
                                        }
                                        return "● RUNNING";
                                      })()
                                  : "— WAIT"}
                              </span>

                              <span className="font-mono text-xs font-semibold text-zinc-200">
                                {log.symbol || activeSymbol} &bull; {(log.timeframe || timeframe).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                              <Clock className="h-3 w-3" />
                              <span>{dateStr}</span>
                            </div>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                            <div>
                              Entry: <span className="text-zinc-200">${log.entryPrice?.toFixed(2)}</span> &bull; SL: <span className="text-red-400">${log.stopLoss?.toFixed(2)} ({log.slPips ? `-${log.slPips}p` : ""})</span> &bull; TP: <span className="text-emerald-400">${log.takeProfit?.toFixed(2)} ({log.tpPips ? `+${log.tpPips}p` : ""})</span>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <SkillChecklistModal
        isOpen={isSkillModalOpen}
        onClose={() => setIsSkillModalOpen(false)}
        onSkillSelect={handleSkillSelect}
      />

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-200 shadow-xl font-mono">
          {toast}
        </div>
      )}
    </div>
  );
}
