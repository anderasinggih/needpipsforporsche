"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TradingViewChart,
  AIMapping,
  AISignalOverlay,
  PositionBox,
} from "@/components/chart/TradingViewChart";
import { LiveOrderbookTape } from "@/components/chart/LiveOrderbookTape";
import { LiquidityHeatmapRadar } from "@/components/chart/LiquidityHeatmapRadar";
import { useMarketStream } from "@/hooks/useMarketStream";
import { resolveTradeOutcome } from "@/lib/trade/outcome";
import { SkillChecklistModal, TradingSkill } from "@/components/skills/SkillChecklistModal";
import { CouncilWarRoomChat } from "@/components/council/CouncilWarRoomChat";
import { QuantumTorusManifold } from "@/components/council/QuantumTorusManifold";
import { PossibilityMonteCarloChart } from "@/components/chart/PossibilityMonteCarloChart";
import { PossibilityScenario } from "@/lib/ai/types";
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
  Layers,
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
 * If price never filled entry (entryFilled === false), or price never truly
 * pierced stopLoss, recover it to "WAIT" or "ACTIVE" so resolveTradeOutcome
 * can track it honestly while the trade is pending or breathing.
 */
const migrateLegacyOutcome = (log: StoredEvaluation): StoredEvaluation => {
  if (!log || typeof log !== "object") return log;
  if (!log.entryPrice || !log.stopLoss || !log.takeProfit) return log;

  const isLong = log.signal === "BUY" || log.direction === "BULLISH";

  // Recover false LOSE:
  if (log.outcome === "LOSE") {
    // 1. If entry was NEVER filled, it could never be a trade LOSS!
    if (log.entryFilled === false) {
      const { resolvedPrice, resolvedAt, ...rest } = log;
      return { ...rest, outcome: log.signal === "WAIT" ? "WAIT" : "WAIT", entryFilled: false };
    }

    // 2. If resolvedPrice was recorded but didn't actually cross SL:
    if (log.resolvedPrice !== undefined) {
      const isTrueSlHit = isLong ? log.resolvedPrice <= log.stopLoss : log.resolvedPrice >= log.stopLoss;
      if (!isTrueSlHit) {
        const { resolvedPrice, resolvedAt, ...rest } = log;
        return { ...rest, outcome: log.entryFilled ? "ACTIVE" : "WAIT" };
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

  const { currentCandle, historicalCandles, positions, recentTrades, marketDepth, isConnected, lastTickTimestamp } =
    useMarketStream(activeSymbol, timeframe);

  const [showSidePanel, setShowSidePanel] = useState<boolean>(true);
  const [sidePanelTab, setSidePanelTab] = useState<"tape" | "heatmap">("heatmap");

  const [selectedSkill, setSelectedSkill] = useState<TradingSkill | null>(null);
  const [checkedRules, setCheckedRules] = useState<Record<string, boolean>>({});
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [tradingMethod, setTradingMethod] = useState<string>("ALL");

  // Configurable Target Risk-Reward Ratio (e.g. 1.5, 2.0, 2.5, 3.0)
  const [targetRr, setTargetRr] = useState<number>(2.5);

  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  type WorkspaceView = "chart" | "forecast" | "warroom" | "agents" | "journal";

  // Active Workspace View (Single source of truth)
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("chart");
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>("slot_1");

  const switchWorkspaceView = (view: WorkspaceView) => {
    setWorkspaceView(view);
    if (typeof window !== "undefined") {
      const newUrl = view === "chart" ? window.location.pathname : `${window.location.pathname}?view=${view}`;
      window.history.replaceState({}, "", newUrl);
    }
  };

  // Persistent AI Evaluation History Log
  const [evalLogs, setEvalLogs] = useState<StoredEvaluation[]>([]);

  // Current Logged-in User (role: owner | admin | member | viewer)
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string; role: string } | null>(null);

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

      // Check URL query param for initial view
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get("view");
      if (viewParam === "forecast" || viewParam === "warroom" || viewParam === "agents" || viewParam === "chart" || viewParam === "journal") {
        setWorkspaceView(viewParam as WorkspaceView);
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

      // Fetch active user session
      fetch("/api/auth")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.authenticated && data?.user) {
            setCurrentUser(data.user);
          }
        })
        .catch(() => {});
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
      const nextOutcome: EvaluationOutcome = state.outcome;

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
    if (currentUser?.role === "viewer") {
      showToast("Akun Anda berstatus [VIEWER / READ-ONLY]. Tidak dapat men-generate evaluasi AI.");
      return;
    }
    if (!currentCandle) {
      showToast("Waiting for live market data feed...");
      return;
    }
    try {
      setIsEvaluating(true);
      // Immediately clear previous evaluation session and switch to War Room Chat
      setEvaluation(null);
      switchWorkspaceView("warroom");

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

  // Multi-branch possibility trajectories (real stochastic scenarios or AI consensus projections)
  const possibilityScenarios: PossibilityScenario[] = React.useMemo(() => {
    if (evaluation?.possibilityScenarios && evaluation.possibilityScenarios.length > 0) {
      return evaluation.possibilityScenarios;
    }
    const curPrice = currentCandle?.close || (activeSymbol === "BTCUSD" ? 64000 : 2650);
    const curTime = currentCandle?.time || Math.floor(Date.now() / 1000);
    const intervalSec = 60;
    const atr = curPrice * 0.0035;

    return [
      {
        id: "primary",
        name: "Scenario 1: Primary Continuation",
        probability: 62,
        color: "#06B6D4",
        description: "Impulsive structure expansion reaching next key liquidity pool and expansion target.",
        points: [
          { time: curTime, price: curPrice },
          { time: curTime + intervalSec * 3, price: Number((curPrice + atr * 0.4).toFixed(2)) },
          { time: curTime + intervalSec * 7, price: Number((curPrice + atr * 1.1).toFixed(2)) },
          { time: curTime + intervalSec * 12, price: Number((curPrice + atr * 2.2).toFixed(2)) },
        ],
      },
      {
        id: "alternative_sweep",
        name: "Scenario 2: Liquidity Sweep & Mean-Revert",
        probability: 26,
        color: "#F59E0B",
        description: "False breakdown sweeping stop losses below swing low before aggressive mean-reversion.",
        points: [
          { time: curTime, price: curPrice },
          { time: curTime + intervalSec * 2, price: Number((curPrice - atr * 0.8).toFixed(2)) },
          { time: curTime + intervalSec * 5, price: Number((curPrice - atr * 0.95).toFixed(2)) },
          { time: curTime + intervalSec * 9, price: Number((curPrice + atr * 0.6).toFixed(2)) },
          { time: curTime + intervalSec * 14, price: Number((curPrice + atr * 1.8).toFixed(2)) },
        ],
      },
      {
        id: "invalidation",
        name: "Scenario 3: Adversarial Invalidation",
        probability: 12,
        color: "#EF4444",
        description: "Structural invalidation breaching support pivot and cascading market stop-outs.",
        points: [
          { time: curTime, price: curPrice },
          { time: curTime + intervalSec * 3, price: Number((curPrice - atr * 0.5).toFixed(2)) },
          { time: curTime + intervalSec * 6, price: Number((curPrice - atr * 1.4).toFixed(2)) },
          { time: curTime + intervalSec * 11, price: Number((curPrice - atr * 2.5).toFixed(2)) },
        ],
      },
    ];
  }, [evaluation?.possibilityScenarios, currentCandle, activeSymbol]);

  const currentPriceFormatted = currentCandle ? currentCandle.close.toFixed(2) : "---.--";

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased selection:bg-zinc-800">
      {/* Top Navigation Bar - Single Clean Row Without Duplicate Links */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/90 px-3 sm:px-6 py-2 backdrop-blur">
        <div className="mx-auto flex w-full items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          {/* Brand & Market Controls (Never Wraps) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-1.5 font-mono font-bold tracking-tight text-white text-xs sm:text-sm shrink-0">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 text-[10px] font-bold text-white border border-zinc-700">
                P
              </span>
              NEEDPIPS<span className="text-zinc-600 font-normal">/</span>PORSCHE
            </div>

            <div className="flex items-center gap-2 border-l border-zinc-850 pl-2.5 sm:pl-3 text-xs font-mono shrink-0">
              <div className="flex items-center rounded-md bg-zinc-950 p-0.5 border border-zinc-800 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSymbolChange("BTCUSD")}
                  className={`px-2 py-0.5 text-[11px] font-mono font-medium rounded transition-colors ${
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
                  className={`px-2 py-0.5 text-[11px] font-mono font-medium rounded transition-colors ${
                    activeSymbol === "XAUUSD"
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  XAUUSD
                </button>
              </div>

              <select
                value={tradingMethod}
                onChange={(e) => {
                  setTradingMethod(e.target.value);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("trading_method", e.target.value);
                  }
                }}
                className="hidden md:inline-block rounded-md bg-zinc-950 border border-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-300 focus:outline-none hover:bg-zinc-900 shrink-0"
              >
                <option value="ALL">ALL METHODS</option>
                <option value="SMC">SMC</option>
                <option value="ICT">ICT</option>
                <option value="SNR">SNR</option>
                <option value="FIBONACCI">FIBONACCI</option>
                <option value="VOLUME">VOLUME &amp; ORDERFLOW</option>
              </select>

              <span className="font-semibold text-zinc-200 font-mono tracking-wide text-xs shrink-0">
                ${currentPriceFormatted}
              </span>
            </div>
          </div>

          {/* Right Controls: Side Panel Toggle & Live Status (Strict 1-Row) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Side Panel Toggle (Heatmap / Tape / Close) */}
            <div className="flex items-center bg-black border border-zinc-800 rounded p-0.5 text-[11px] font-mono shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowSidePanel(true);
                  setSidePanelTab("heatmap");
                }}
                className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                  showSidePanel && sidePanelTab === "heatmap"
                    ? "bg-zinc-800 text-cyan-400 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="L2 Liquidity Heatmap Radar"
              >
                <Layers className="h-3 w-3 text-cyan-400" />
                <span className="hidden sm:inline">HEATMAP</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSidePanel(true);
                  setSidePanelTab("tape");
                }}
                className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                  showSidePanel && sidePanelTab === "tape"
                    ? "bg-zinc-800 text-emerald-400 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Live Running Trades Orderbook Tape"
              >
                <Activity className="h-3 w-3 text-emerald-400" />
                <span className="hidden sm:inline">TAPE</span>
              </button>
              {showSidePanel && (
                <button
                  type="button"
                  onClick={() => setShowSidePanel(false)}
                  className="px-1.5 py-0.5 text-zinc-500 hover:text-red-400"
                  title="Close Side Panel for Fullscreen Chart"
                >
                  ✕
                </button>
              )}
            </div>

            <Badge
              variant="outline"
              className="flex items-center gap-1.5 py-0.5 px-2 text-[10px] sm:text-[11px] font-mono border-zinc-800 bg-zinc-950 text-zinc-400 shrink-0"
            >
              <Radio className={`h-2.5 w-2.5 ${isConnected ? "text-emerald-400" : "text-zinc-500"}`} />
              <span>{isConnected ? "LIVE" : "SYNC"}</span>
            </Badge>

            {currentUser && (
              <Badge
                variant="outline"
                className={`py-0.5 px-2 text-[10px] font-mono uppercase shrink-0 border ${
                  currentUser.role === "viewer"
                    ? "bg-amber-950/40 text-amber-300 border-amber-800/80"
                    : currentUser.role === "owner"
                    ? "bg-purple-950/40 text-purple-300 border-purple-800/80"
                    : "bg-zinc-900 text-zinc-300 border-zinc-800"
                }`}
                title={`Logged in as ${currentUser.username} (${currentUser.role})`}
              >
                {currentUser.role === "viewer" ? "👁️ VIEWER" : currentUser.username}
              </Badge>
            )}

            {/* Logout button */}
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "logout" }),
                });
                window.location.href = "/login";
              }}
              className="px-2 py-0.5 rounded text-[10px] font-mono border border-zinc-800 hover:border-red-800 text-zinc-400 hover:text-red-300 hover:bg-red-950/30 transition-colors shrink-0"
              title="Logout from Terminal"
            >
              Exit
            </button>
          </div>
        </div>
      </header>

            {/* Main Spacious Institutional Workspace - Max Width 1780px */}
      <div className="w-full max-w-[1780px] mx-auto px-3 sm:px-6 py-4 space-y-4">
        {/* Unified Institutional Workspace Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950 border border-zinc-800/90 rounded-xl p-2.5">
          {/* Main 5 Workspace Tabs (Single Source of Truth) */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => switchWorkspaceView("chart")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all shrink-0 ${
                workspaceView === "chart"
                  ? "bg-zinc-800 text-emerald-400 font-semibold shadow-sm border border-zinc-700"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
            >
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              <span>LIVE CHART</span>
            </button>

            <button
              type="button"
              onClick={() => switchWorkspaceView("forecast")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all shrink-0 ${
                workspaceView === "forecast"
                  ? "bg-cyan-950/70 text-cyan-300 font-semibold shadow-sm border border-cyan-800"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
              <span>QUANT FORECAST</span>
            </button>

            <button
              type="button"
              onClick={() => switchWorkspaceView("warroom")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all shrink-0 ${
                workspaceView === "warroom"
                  ? "bg-zinc-800 text-zinc-100 font-semibold shadow-sm border border-zinc-700"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
              <span>WAR ROOM CHAT</span>
            </button>

            <button
              type="button"
              onClick={() => switchWorkspaceView("agents")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all shrink-0 ${
                workspaceView === "agents"
                  ? "bg-purple-950/70 text-purple-300 font-semibold shadow-sm border border-purple-800"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
            >
              <Users className="h-3.5 w-3.5 text-purple-400" />
              <span>AI COUNCIL &amp; PLAN</span>
            </button>

            <button
              type="button"
              onClick={() => switchWorkspaceView("journal")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all shrink-0 ${
                workspaceView === "journal"
                  ? "bg-amber-950/60 text-amber-300 font-semibold shadow-sm border border-amber-800"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-amber-400" />
              <span>TRADE JOURNAL ({evalLogs.length})</span>
            </button>
          </div>

          {/* Right Action: Target RR + Quick Verdict + Single Deliberate Trigger */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {/* Target RR Selector */}
            <div className="flex items-center gap-1 rounded-md bg-black border border-zinc-800 p-1 text-xs font-mono">
              <span className="text-zinc-500 text-[10px] uppercase px-1">RR:</span>
              {[1.5, 2.0, 2.5, 3.0].map((rrVal) => (
                <button
                  key={rrVal}
                  type="button"
                  onClick={() => handleTargetRrChange(rrVal)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
                    targetRr === rrVal
                      ? "bg-zinc-800 text-emerald-400 border border-zinc-700"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  1:{rrVal.toFixed(1)}
                </button>
              ))}
            </div>

            {/* Quick Verdict Badge */}
            {evaluation?.signal && (
              <Badge
                variant="outline"
                className={`text-xs font-mono px-2.5 py-1 ${
                  evaluation.signal === "BUY"
                    ? "border-emerald-800 text-emerald-400 bg-emerald-950/30"
                    : evaluation.signal === "SELL"
                    ? "border-red-800 text-red-400 bg-red-950/30"
                    : "border-amber-800 text-amber-400 bg-amber-950/30"
                }`}
              >
                {evaluation.signal} ({evaluation.confidence}%) &bull; SL {evaluation.slPips}p &bull; TP {evaluation.tpPips}p
              </Badge>
            )}

            {/* Single Prominent Deliberate Button */}
            <Button
              size="sm"
              onClick={() => handleEvaluate()}
              disabled={isEvaluating}
              className="h-8 px-3 text-xs font-mono font-semibold bg-emerald-600 hover:bg-emerald-500 text-black border-0 shadow-lg shadow-emerald-950/40"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ANALYZING...
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5 mr-1.5 fill-black" />
                  DELIBERATE
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 1. LIVE CHART VIEW (Clean, Spacious, Zero Underneath Clutter) */}
        {workspaceView === "chart" && (
          <div className="space-y-3">
            {/* Planned Order Status Strip (If exists) */}
            {evaluation?.plannedOrder && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <span className="font-bold text-amber-300">
                    {evaluation.plannedOrder.type === "BUY_LIMIT" ? "PLANNED BUY LIMIT" : "PLANNED SELL LIMIT"}
                  </span>
                  <span className="text-zinc-200 font-semibold">${evaluation.plannedOrder.price}</span>
                  <span className="text-red-400">SL: ${evaluation.plannedOrder.sl} (-{evaluation.plannedOrder.slPips}p)</span>
                  <span className="text-emerald-400">TP: ${evaluation.plannedOrder.tp} (+{evaluation.plannedOrder.tpPips}p)</span>
                  <span className="text-zinc-400">RR: {evaluation.plannedOrder.rr}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-amber-200/90">{evaluation.plannedOrder.status || evaluation.entryTrigger || "ARMED"}</span>
                  <button
                    type="button"
                    onClick={() => switchWorkspaceView("agents")}
                    className="text-cyan-400 hover:underline font-semibold"
                  >
                    View Plan &amp; Council &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* TradingView Chart + Optional Side Panel */}
            <div className={`grid grid-cols-1 ${showSidePanel ? "lg:grid-cols-4" : "lg:grid-cols-1"} gap-4`}>
              <div className={showSidePanel ? "lg:col-span-3" : "w-full"}>
                <Card className="border-zinc-800 bg-black p-0 shadow-none overflow-hidden h-[700px]">
                  <TradingViewChart
                    currentCandle={currentCandle}
                    historicalCandles={historicalCandles}
                    symbol={activeSymbol}
                    timeframe={timeframe}
                    onTimeframeChange={handleTimeframeChange}
                    positions={positions}
                    lastTickTimestamp={lastTickTimestamp}
                    aiMapping={(evaluation?.chartMapping as AIMapping | null) ?? null}
                    aiSignal={
                      evaluation
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
                            setupPrice: (evaluation as any).setupPrice ?? evaluation.entryPrice,
                            note: evaluation.notes,
                          }
                        : null
                    }
                  />
                </Card>
              </div>

              {/* Integrated Side Panel (Tape or Heatmap) */}
              {showSidePanel && (
                <div className="lg:col-span-1 h-[700px] flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <div className="flex items-center gap-2 text-xs font-mono font-medium text-zinc-300">
                      {sidePanelTab === "tape" ? (
                        <>
                          <Activity className="h-3.5 w-3.5 text-emerald-400" />
                          <span>LIVE L2 ORDERFLOW TAPE</span>
                        </>
                      ) : (
                        <>
                          <Layers className="h-3.5 w-3.5 text-cyan-400" />
                          <span>LIQUIDITY HEATMAP RADAR</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSidePanelTab(sidePanelTab === "tape" ? "heatmap" : "tape")}
                        className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white"
                      >
                        {sidePanelTab === "tape" ? "Show Heatmap" : "Show Tape"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSidePanel(false)}
                        className="p-1 text-zinc-500 hover:text-zinc-300 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-zinc-850 bg-black">
                    {sidePanelTab === "tape" ? (
                      <LiveOrderbookTape
                        trades={recentTrades}
                        symbol={activeSymbol}
                        currentPrice={currentCandle?.close}
                      />
                    ) : (
                      <LiquidityHeatmapRadar
                        depth={marketDepth}
                        currentPrice={currentCandle?.close || (activeSymbol === "BTCUSD" ? 64000 : 2650)}
                        symbol={activeSymbol}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. QUANT FORECAST VIEW (Monte Carlo Simulation & Scenarios) */}
        {workspaceView === "forecast" && (
          <div className="space-y-4">
            <Card className="border-zinc-800 bg-black p-0 shadow-none overflow-hidden h-[620px]">
              <PossibilityMonteCarloChart
                candles={historicalCandles || []}
                currentPrice={currentCandle?.close || (activeSymbol === "BTCUSD" ? 64000 : 2650)}
                scenarios={possibilityScenarios}
                symbol={activeSymbol}
                timeframe={timeframe}
              />
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {possibilityScenarios.map((sc) => (
                <Card key={sc.id} className="border-zinc-800 bg-zinc-950 p-3.5 shadow-none space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-zinc-200">{sc.name}</span>
                    <Badge
                      variant="outline"
                      className="font-mono text-[11px]"
                      style={{ color: sc.color, borderColor: `${sc.color}40`, backgroundColor: `${sc.color}15` }}
                    >
                      {sc.probability}% Prob
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">{sc.description}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 3. WAR ROOM CHAT VIEW (Live Council Discussion) */}
        {workspaceView === "warroom" && (
          <Card className="border-zinc-800 bg-black p-0 shadow-none overflow-hidden h-[750px]">
            <CouncilWarRoomChat
              evaluationId={evaluation?.id}
              discussion={evaluation?.councilDiscussion}
              isEvaluating={isEvaluating}
              symbol={activeSymbol}
              timeframe={timeframe}
              price={currentCandle?.close || 0}
              agentOpinions={evaluation?.agentOpinions}
              signal={evaluation?.signal}
            />
          </Card>
        )}

        {/* 4. AI COUNCIL & PLAN VIEW (Synthesis, Specialist Breakdown & Rationale) */}
        {workspaceView === "agents" && (
          <div className="space-y-4">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="p-3 bg-zinc-950 border-zinc-800 shadow-none">
                <div className="text-[11px] text-zinc-500">SL Adaptif</div>
                <div className="mt-1 font-mono text-xs font-semibold text-red-400">
                  {evaluation?.slPips ?? 35} Pips
                </div>
                <div className="text-[10px] font-mono text-zinc-600 truncate">
                  {evaluation?.riskPlan?.slBasis ?? "Regime volatilitas + struktur swing"}
                </div>
              </Card>
              <Card className="p-3 bg-zinc-950 border-zinc-800 shadow-none">
                <div className="text-[11px] text-zinc-500">TP &amp; Rasio Risiko</div>
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
                <div className="text-[11px] text-zinc-500">Regime Volatilitas</div>
                <div className="mt-1 font-mono text-xs font-semibold text-zinc-200">
                  {evaluation?.technicalContext?.volatility?.regime ?? "-"}
                </div>
                <div className="text-[10px] font-mono text-zinc-600">
                  ATR {evaluation?.technicalContext?.atrPips ?? "-"} pips
                </div>
              </Card>
              <Card className="p-3 bg-zinc-950 border-zinc-800 shadow-none">
                <div className="text-[11px] text-zinc-500">Dewan &amp; Veto</div>
                <div className="mt-1 font-mono text-xs font-semibold text-zinc-200">
                  {evaluation ? `${evaluation.activeAgentCount ?? 0} aktif` : "Menunggu"}
                </div>
                <div className="text-[10px] font-mono text-zinc-600">
                  veto psikologis {evaluation?.consensus?.vetoes.length ?? 0}
                </div>
              </Card>
            </div>

            {/* Smart Planned Order Card */}
            {evaluation?.plannedOrder && (
              <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 font-mono text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-900/40 pb-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    <span className="font-bold text-sm text-amber-300">
                      {evaluation.plannedOrder.type === "BUY_LIMIT" ? "🎯 PLANNED BUY LIMIT" : "🎯 PLANNED SELL LIMIT"}
                    </span>
                    <span className="rounded bg-black/60 px-2 py-0.5 text-xs text-zinc-400 border border-zinc-800">
                      {evaluation.signal === "WAIT" ? "Pending Pullback Retest Trigger" : "Armed for Execution"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-400">Target RR:</span>
                    <span className="font-bold text-emerald-400">{evaluation.plannedOrder.rr}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded bg-black/60 p-2 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 block">Pending Limit Price</span>
                    <span className="font-bold text-zinc-100">${evaluation.plannedOrder.price}</span>
                  </div>
                  <div className="rounded bg-black/60 p-2 border border-zinc-800/80">
                    <span className="text-[10px] text-red-400 block">Stop Loss</span>
                    <span className="font-bold text-red-300">${evaluation.plannedOrder.sl} ({evaluation.plannedOrder.slPips}p)</span>
                  </div>
                  <div className="rounded bg-black/60 p-2 border border-zinc-800/80">
                    <span className="text-[10px] text-emerald-400 block">Take Profit</span>
                    <span className="font-bold text-emerald-300">${evaluation.plannedOrder.tp} ({evaluation.plannedOrder.tpPips}p)</span>
                  </div>
                  <div className="rounded bg-black/60 p-2 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 block">Status / Trigger</span>
                    <span className="font-semibold text-amber-300 truncate block">{evaluation.plannedOrder.status || evaluation.entryTrigger || "ARMED"}</span>
                  </div>
                </div>
                {evaluation.plannedOrder.rationale && (
                  <p className="mt-2 text-xs text-zinc-400 font-sans italic">
                    💡 Rationale Dewan: {evaluation.plannedOrder.rationale}
                  </p>
                )}
              </div>
            )}

            {/* AI Technical Analysis & Execution Plan Card */}
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
                    {/* Multi-Timeframe Alignment Matrix */}
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

                    {/* Bounded Entry, SL, and TP Level Metrics */}
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

                    {/* No-Trade Reasons when WAIT */}
                    {evaluation.signal === "WAIT" && (
                      <div className="rounded-lg border border-amber-800/80 bg-amber-950/20 p-3.5 space-y-2">
                        <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-semibold pb-1.5 border-b border-amber-900/40">
                          <AlertCircle className="h-4 w-4" />
                          <span>Status: MENAHAN DIRI (WAIT) — Edge Belum Terpenuhi</span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                          AI dewan memilih <strong className="text-amber-300">TIDAK MEMAKSAKAN ENTRY</strong> karena kondisi saat ini belum memiliki probabilitas edge yang memadai.
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

                    {/* Calculations */}
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

                    {/* Kesimpulan Akhir */}
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

                    {/* Tesis Konsensus */}
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

                    {/* Invalidation & Recommendation */}
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
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-2">
                    <Users className="mx-auto h-8 w-8 text-zinc-600" />
                    <p className="text-xs text-zinc-300 font-medium">Belum Ada Deliberasi Aktif</p>
                    <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                      Klik tombol DELIBERATE di pojok kanan atas untuk menjalankan analisis dewan AI.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 20-Agent Specialist Consensus Breakdown */}
            <Card className="border-zinc-800 bg-zinc-950 p-4 shadow-none space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-850">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-400" />
                  <span className="font-mono font-bold text-sm tracking-wide text-white">
                    20-AGENT SPECIALIST CONSENSUS BREAKDOWN &amp; DISCIPLINE
                  </span>
                </div>
                <Badge variant="outline" className="text-xs font-mono border-zinc-800 text-zinc-400">
                  {evaluation?.activeAgentCount ?? (evaluation?.agentOpinions?.length || 20)} CONTRIBUTORS
                </Badge>
              </div>

              {/* Agent Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                {(evaluation?.agentOpinions || []).map((agent) => {
                  const isExpanded = expandedAgentId === agent.agentId;
                  const isChief = agent.agentId === "slot_1";
                  const isNotContributed = agent.status === "not_contributed";

                  return (
                    <div
                      key={agent.agentId}
                      onClick={() => setExpandedAgentId(isExpanded ? null : agent.agentId)}
                      className={`cursor-pointer rounded-lg border p-3 text-xs transition-all select-none ${
                        isNotContributed
                          ? "border-zinc-900 bg-black/40 opacity-60 hover:opacity-100"
                          : isChief
                          ? isExpanded
                            ? "border-emerald-700 bg-emerald-950/25 ring-1 ring-emerald-600/40"
                            : "border-emerald-900/60 bg-emerald-950/10 hover:border-emerald-700"
                          : isExpanded
                          ? "border-zinc-600 bg-zinc-900 ring-1 ring-zinc-500/30"
                          : "border-zinc-800 bg-black hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-xs font-semibold text-zinc-200 truncate">
                          {agent.agentName}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            agent.bias === "BULLISH"
                              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/50"
                              : agent.bias === "BEARISH"
                              ? "bg-red-950/60 text-red-400 border border-red-900/50"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {agent.bias}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-zinc-400 line-clamp-2">
                        {isNotContributed ? "Offline" : agent.keyObservation || agent.detailedAnalysis}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Selected Agent Drawer / Detailed View */}
              {expandedAgentId && (() => {
                const selectedAgent = (evaluation?.agentOpinions || []).find((a) => a.agentId === expandedAgentId);
                if (!selectedAgent) return null;

                return (
                  <div className="rounded-xl border border-zinc-800 bg-black p-4 space-y-3 mt-4">
                    <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-zinc-100">{selectedAgent.agentName}</span>
                        <Badge variant="outline" className="text-xs font-mono text-zinc-400">{selectedAgent.role}</Badge>
                      </div>
                      <Badge className={`font-mono text-xs ${selectedAgent.bias === "BULLISH" ? "bg-emerald-950 text-emerald-400" : selectedAgent.bias === "BEARISH" ? "bg-red-950 text-red-400" : "bg-zinc-800 text-zinc-300"}`}>
                        {selectedAgent.bias} &bull; Confidence {selectedAgent.confidence}%
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-zinc-300">
                      {selectedAgent.detailedAnalysis || selectedAgent.keyObservation}
                    </p>
                    {selectedAgent.evidence && selectedAgent.evidence.length > 0 && (
                      <div className="pt-2 border-t border-zinc-850">
                        <span className="text-xs font-mono text-zinc-500 uppercase">Bukti &amp; Dasar Pertimbangan:</span>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedAgent.evidence.map((ev, i) => (
                            <div key={i} className="flex items-start gap-2 rounded bg-zinc-950 border border-zinc-850 p-2 text-xs text-zinc-300">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{ev}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </Card>
          </div>
        )}

        {/* 5. TRADE JOURNAL & RULES VIEW (Discipline Checklist + Persistent Log) */}
        {workspaceView === "journal" && (
          <div className="space-y-4">
            {/* Top Journal Overview Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="p-3 bg-zinc-950 border-zinc-800 shadow-none">
                <div className="text-[11px] text-zinc-500">Total Analisis Tercatat</div>
                <div className="mt-1 font-mono text-lg font-bold text-zinc-100">{evalLogs.length}</div>
              </Card>
              <Card className="p-3 bg-zinc-950 border-zinc-800 shadow-none">
                <div className="text-[11px] text-zinc-500">Winrate Historis</div>
                <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
                  {(() => {
                    const decided = evalLogs.filter((l) => l.outcome === "WIN" || l.outcome === "LOSE");
                    const wins = evalLogs.filter((l) => l.outcome === "WIN").length;
                    return decided.length > 0 ? `${Math.round((wins / decided.length) * 100)}%` : "N/A";
                  })()}
                </div>
              </Card>
              <Card className="p-3 bg-zinc-950 border-zinc-800 shadow-none">
                <div className="text-[11px] text-zinc-500">Menang / Kalah</div>
                <div className="mt-1 font-mono text-lg font-bold text-zinc-200">
                  {evalLogs.filter((l) => l.outcome === "WIN").length}W / {evalLogs.filter((l) => l.outcome === "LOSE").length}L
                </div>
              </Card>
              <Card className="p-3 bg-zinc-950 border-zinc-800 shadow-none">
                <div className="text-[11px] text-zinc-500">Setup Aktif Berjalan</div>
                <div className="mt-1 font-mono text-lg font-bold text-amber-400">
                  {evalLogs.filter((l) => l.outcome === "ACTIVE").length}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Discipline Checklist & Strategy (4 cols) */}
              <div className="lg:col-span-4 space-y-4">
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
                      Pilih Strategi
                    </Button>
                  </CardHeader>

                  {!selectedSkill ? (
                    <div className="py-6 text-center">
                      <p className="text-xs text-zinc-500">Belum ada strategi aktif terpilih.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSkillModalOpen(true)}
                        className="mt-3 text-xs border-zinc-800 bg-black hover:bg-zinc-900 text-zinc-300"
                      >
                        Buka Library Strategi
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
                    </div>
                  )}
                </Card>
              </div>

              {/* Right Column: Historical Analysis Log (8 cols) */}
              <div className="lg:col-span-8">
                <Card className="border-zinc-800 bg-zinc-950 p-4 shadow-none">
                  <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-zinc-800">
                    <CardTitle className="text-xs font-semibold text-zinc-200">
                      Persistent Analysis History Log ({evalLogs.length})
                    </CardTitle>
                    {evalLogs.length > 0 && (
                      <button
                        type="button"
                        onClick={clearLogs}
                        className="text-[10px] font-mono text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        Clear History
                      </button>
                    )}
                  </CardHeader>

                  <CardContent className="p-0 pt-3">
                    {evalLogs.length === 0 ? (
                      <div className="py-12 text-center text-xs text-zinc-500">
                        Belum ada riwayat analisis. Setiap evaluasi dewan akan otomatis diarsipkan di sini dengan pelacakan real-time WIN / LOSE / ACTIVE.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                        {evalLogs.map((log) => {
                          const isCurrent = evaluation?.id === log.id;
                          const dateStr = log.timestamp
                            ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                            : "Recent";

                          const outcomeStatus: EvaluationOutcome =
                            log.outcome || (log.signal === "WAIT" ? "WAIT" : "ACTIVE");
                          const awaitingEntry =
                            outcomeStatus === "ACTIVE" &&
                            log.signal !== "WAIT" &&
                            log.entryFilled !== true;

                          return (
                            <div
                              key={log.id}
                              onClick={() => {
                                selectHistoricalLog(log);
                                switchWorkspaceView("agents");
                              }}
                              className={`group cursor-pointer rounded-lg border p-3 text-xs transition-colors ${
                                isCurrent
                                  ? "border-zinc-700 bg-zinc-900"
                                  : "border-zinc-800/80 bg-black hover:border-zinc-700 hover:bg-zinc-950"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
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

                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold border tracking-wider ${
                                      outcomeStatus === "WIN"
                                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                                        : outcomeStatus === "LOSE"
                                        ? "bg-red-500/20 text-red-300 border-red-500/50"
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

                              <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-zinc-400">
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
        )}
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
