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
import { SkillChecklistModal, TradingSkill } from "@/components/skills/SkillChecklistModal";
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
} from "lucide-react";

export interface AgentOpinion {
  agentId: string;
  agentName: string;
  role: string;
  modelUsed: string;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
  keyObservation: string;
  detailedAnalysis?: string;
  evidence?: string[];
  suggestedLevel?: { entry: number; sl: number; tp: number };
  status: "active" | "offline";
}

export interface EvaluationResult {
  id?: string;
  timestamp?: number;
  symbol?: string;
  timeframe?: string;
  signal?: "BUY" | "SELL" | "WAIT";
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  riskRewardRatio?: string;
  confidence: number;
  thesis: string;
  detailedVerdict?: string;
  riskInvalidation: string;
  slReason?: string;
  tpReason?: string;
  calculations?: string;
  chartMapping?: AIMapping;
  positionBox?: PositionBox;
  predictiveTrajectory?: Array<{ time: number; price: number }>;
  recommendation: string;
  notes: string;
  agentOpinions?: AgentOpinion[];
}

export default function DashboardPage() {
  const [activeSymbol, setActiveSymbol] = useState<string>("BTCUSD");
  const [timeframe, setTimeframe] = useState<string>("1m");
  const [isClientLoaded, setIsClientLoaded] = useState(false);

  const { currentCandle, historicalCandles, positions, isConnected, lastTickTimestamp } =
    useMarketStream(activeSymbol, timeframe);

  const [selectedSkill, setSelectedSkill] = useState<TradingSkill | null>(null);
  const [checkedRules, setCheckedRules] = useState<Record<string, boolean>>({});
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);

  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Expanded collapse states for agents
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>("agent_arbiter");
  const [isCouncilStripOpen, setIsCouncilStripOpen] = useState(true);

  // Persistent AI Evaluation History Log
  const [evalLogs, setEvalLogs] = useState<EvaluationResult[]>([]);

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

      try {
        const savedLogs = localStorage.getItem("ai_evaluation_logs");
        if (savedLogs) {
          setEvalLogs(JSON.parse(savedLogs));
        }
      } catch (e) {
        console.warn("Failed to load evaluation logs", e);
      }
    }
  }, []);

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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const toggleRule = (id: string) => {
    setCheckedRules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSkillSelect = (skill: TradingSkill) => {
    setSelectedSkill(skill);
    setCheckedRules({});
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
      const geminiKey = localStorage.getItem("gemini_api_key") || "";
      const groqKey = localStorage.getItem("groq_api_key") || "";
      const openaiKey = localStorage.getItem("openai_api_key") || "";
      const deepseekKey = localStorage.getItem("deepseek_api_key") || "";
      const openrouterKey = localStorage.getItem("openrouter_api_key") || "";
      const aiModel = localStorage.getItem("ai_model") || "gemini-2.5-flash";

      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-key": geminiKey,
          "x-groq-key": groqKey,
          "x-openai-key": openaiKey,
          "x-deepseek-key": deepseekKey,
          "x-openrouter-key": openrouterKey,
          "x-ai-model": aiModel,
        },
        body: JSON.stringify({
          symbol: activeSymbol,
          price: currentCandle.close,
          timeframe,
          checklistMet: allRequiredMet,
          indicatorsSummary: `${activeSymbol} ${timeframe.toUpperCase()} @ ${currentCandle.close.toFixed(2)}`,
          candles: historicalCandles.slice(-25),
        }),
      });

      const data = await res.json();
      if (data.evaluation) {
        const newRecord: EvaluationResult = {
          ...data.evaluation,
          id: `eval_${Date.now()}`,
          timestamp: Date.now(),
          symbol: activeSymbol,
          timeframe: timeframe,
        };
        setEvaluation(newRecord);
        setExpandedAgentId("agent_arbiter");

        const updatedLogs = [newRecord, ...evalLogs.slice(0, 49)];
        setEvalLogs(updatedLogs);
        if (typeof window !== "undefined") {
          localStorage.setItem("ai_evaluation_logs", JSON.stringify(updatedLogs));
        }

        showToast(`5-Agent Council consensus successfully reached!`);
      }
    } catch (err) {
      console.error("Evaluation failed:", err);
      showToast("Council deliberation error");
    } finally {
      setIsEvaluating(false);
    }
  };

  const selectHistoricalLog = (item: EvaluationResult) => {
    setEvaluation(item);
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
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/90 px-6 py-2.5 backdrop-blur">
        <div className="mx-auto flex w-full items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-mono font-semibold tracking-tight text-white text-sm">
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
                  XAUUSD
                </button>
              </div>
              <span className="text-zinc-700">·</span>
              <span className="font-semibold text-zinc-200 font-mono tracking-wide text-xs">
                ${currentPriceFormatted}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="flex items-center gap-1.5 py-1 px-2.5 text-[10px] font-mono border-zinc-800 bg-zinc-950 text-zinc-400"
            >
              <Radio className={`h-3 w-3 ${isConnected ? "text-emerald-400" : "text-zinc-500"}`} />
              <span>{isConnected ? "LIVE FEED ACTIVE" : "CONNECTING..."}</span>
            </Badge>

            <Link href="/owner/key">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs h-8"
              >
                <Key className="h-3.5 w-3.5 text-zinc-400" />
                <span>5-Agent Keys (/owner/key)</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Full-Width Terminal Content */}
      <div className="w-full px-5 py-4 space-y-4">
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
            aiMapping={evaluation?.chartMapping || null}
            aiSignal={
              evaluation?.signal
                ? {
                    signal: evaluation.signal,
                    entryPrice: evaluation.entryPrice,
                    stopLoss: evaluation.stopLoss,
                    takeProfit: evaluation.takeProfit,
                    positionBox: evaluation.positionBox,
                    predictiveTrajectory: evaluation.predictiveTrajectory,
                    note: evaluation.calculations,
                  }
                : null
            }
          />
        </Card>

        {/* 5-Agent Council Discussion Strip with Individual Collapse Bars */}
        {evaluation?.agentOpinions && evaluation.agentOpinions.length > 0 && (
          <Card className="border-zinc-800 bg-zinc-950 p-3.5 shadow-none">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold font-mono tracking-wider uppercase text-zinc-200">
                  5-Agent Quantitative Council Debating &amp; Deliberation
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">(Klik tiap agent untuk expand detail)</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-[10px] font-mono border-zinc-800 text-zinc-400">
                  Consensus {evaluation.signal} ({evaluation.confidence}%)
                </Badge>
                <button
                  type="button"
                  onClick={() => setIsCouncilStripOpen(!isCouncilStripOpen)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs font-mono flex items-center gap-1"
                >
                  {isCouncilStripOpen ? "Minimize" : "Expand All"}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isCouncilStripOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>

            {isCouncilStripOpen && (
              <div className="space-y-2.5">
                {/* 5-Agent Grid */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                  {evaluation.agentOpinions.map((agent) => {
                    const isExpanded = expandedAgentId === agent.agentId;
                    const isArbiter = agent.agentId === "agent_arbiter";

                    return (
                      <div
                        key={agent.agentId}
                        onClick={() => toggleAgentCollapse(agent.agentId)}
                        className={`cursor-pointer rounded border p-2.5 text-xs transition-all select-none ${
                          isArbiter
                            ? isExpanded
                              ? "border-emerald-700 bg-emerald-950/25 ring-1 ring-emerald-600/40"
                              : "border-emerald-900/60 bg-emerald-950/10 hover:border-emerald-700"
                            : isExpanded
                            ? "border-zinc-600 bg-zinc-900 ring-1 ring-zinc-500/30"
                            : "border-zinc-800/90 bg-black hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-semibold text-zinc-200 truncate pr-1">
                            {agent.agentName}
                          </span>
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
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

                        <div className="text-[10px] font-mono text-zinc-500 mt-1 flex items-center justify-between">
                          <span className="truncate">{agent.role.split(" ")[0]}</span>
                          <span className="text-[9px]">{agent.modelUsed}</span>
                        </div>

                        <p className="mt-1.5 text-[11px] text-zinc-300 leading-snug line-clamp-2">
                          {agent.keyObservation}
                        </p>

                        <div className="mt-2 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                          <span>{isExpanded ? "Collapse" : "Lihat Detail"}</span>
                          <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180 text-emerald-400" : ""}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Expanded Detail Drawer for Selected Agent */}
                {expandedAgentId && (() => {
                  const selectedAgent = evaluation.agentOpinions?.find((a) => a.agentId === expandedAgentId);
                  if (!selectedAgent) return null;
                  const isArbiter = selectedAgent.agentId === "agent_arbiter";

                  return (
                    <div className={`rounded-lg border p-3.5 transition-all text-xs font-sans ${
                      isArbiter
                        ? "border-emerald-800/80 bg-black/90"
                        : "border-zinc-800 bg-black/90"
                    }`}>
                      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800/80 pb-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <Bot className={`h-4 w-4 ${isArbiter ? "text-emerald-400" : "text-zinc-400"}`} />
                          <span className="font-semibold text-zinc-100 font-mono text-xs">
                            {selectedAgent.agentName}
                          </span>
                          <span className="text-zinc-500 font-mono text-[11px]">&bull; {selectedAgent.role}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono border-zinc-800 text-zinc-400">
                            Engine: {selectedAgent.modelUsed}
                          </Badge>
                          <Badge className={`text-[10px] font-mono font-bold ${
                            selectedAgent.bias === "BULLISH"
                              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800"
                              : selectedAgent.bias === "BEARISH"
                              ? "bg-red-950/60 text-red-400 border border-red-800"
                              : "bg-zinc-900 text-zinc-300"
                          }`}>
                            Bias: {selectedAgent.bias} ({selectedAgent.confidence}%)
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
                            Analisis Mendalam &amp; Observasi Pasar:
                          </div>
                          <p className="text-zinc-200 text-xs leading-relaxed">
                            {selectedAgent.detailedAnalysis || selectedAgent.keyObservation}
                          </p>
                        </div>

                        {selectedAgent.evidence && selectedAgent.evidence.length > 0 && (
                          <div className="pt-2 border-t border-zinc-900">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                              Bukti &amp; Dasar Pertimbangan:
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              {selectedAgent.evidence.map((ev, i) => (
                                <div key={i} className="flex items-start gap-2 rounded bg-zinc-950 border border-zinc-900 p-2 text-[11px] text-zinc-300">
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
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
          </Card>
        )}

        {/* Analytical Workspace Layout */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left Column: AI Technical Breakdown & Analysis (7 cols) */}
          <div className="space-y-4 lg:col-span-7">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 bg-zinc-950 border-zinc-800 shadow-none">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Market Source
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-zinc-200">
                  Real-time {activeSymbol} ({timeframe.toUpperCase()})
                </div>
              </Card>
              <Card className="p-3 bg-zinc-950 border-zinc-800 shadow-none">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Execution Model
                </div>
                <div className="mt-1 truncate text-xs font-medium text-zinc-200">
                  {selectedSkill ? selectedSkill.title : "Discipline Framework"}
                </div>
              </Card>
              <Card className="p-3 bg-zinc-950 border-zinc-800 shadow-none">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Risk / Reward Target
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-zinc-200">
                  1 : {selectedSkill?.risk_reward_min ?? 2.5}
                </div>
              </Card>
            </div>

            {/* AI Technical Analysis & Evaluation Card */}
            <Card className="border-zinc-800 bg-zinc-950 p-4 shadow-none">
              <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-zinc-800">
                <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  <Compass className="h-4 w-4 text-zinc-400" />
                  Synthesized Council Decision &amp; Execution Plan
                </CardTitle>
                {evaluation?.signal && (
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs font-semibold ${
                      evaluation.signal === "BUY"
                        ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60"
                        : evaluation.signal === "SELL"
                        ? "bg-red-950/40 text-red-400 border-red-900/60"
                        : "bg-zinc-900 text-zinc-300 border-zinc-800"
                    }`}
                  >
                    SIGNAL: {evaluation.signal} · Confidence {evaluation.confidence}%
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="p-0 pt-3">
                {evaluation ? (
                  <div className="space-y-3 text-xs leading-relaxed">
                    {/* Bounded Entry, SL, and TP Level Metrics */}
                    {evaluation.entryPrice && (
                      <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-black border border-zinc-800 font-mono">
                        <div className="text-center border-r border-zinc-800 pr-2">
                          <span className="text-[10px] text-zinc-500 uppercase">Suggested Entry</span>
                          <div className="text-sm font-semibold text-zinc-100 mt-0.5">
                            ${evaluation.entryPrice.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-center border-r border-zinc-800 pr-2">
                          <span className="text-[10px] text-red-400 uppercase">Stop Loss (SL)</span>
                          <div className="text-sm font-semibold text-red-400 mt-0.5">
                            ${evaluation.stopLoss?.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] text-emerald-400 uppercase">Take Profit (TP)</span>
                          <div className="text-sm font-semibold text-emerald-400 mt-0.5">
                            ${evaluation.takeProfit?.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Mathematical Calculations & Volatility Metrics */}
                    {evaluation.calculations && (
                      <div className="rounded border border-zinc-800 bg-black p-3">
                        <div className="font-semibold text-zinc-400 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                          <Calculator className="h-3 w-3 text-zinc-400" />
                          Quantitative Calculations &amp; Volatility Metrics
                        </div>
                        <p className="mt-1 font-mono text-zinc-300 text-[11px] leading-relaxed">
                          {evaluation.calculations}
                        </p>
                      </div>
                    )}

                    {/* KESIMPULAN MENDALAM DARI AI PENYIMPUL */}
                    {evaluation.detailedVerdict && (
                      <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/10 p-3.5">
                        <div className="font-semibold text-emerald-400 font-mono text-[11px] uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-emerald-900/40">
                          <Scale className="h-3.5 w-3.5 text-emerald-400" />
                          Kesimpulan Akhir &amp; Putusan AI Penyimpul (Supreme Arbiter)
                        </div>
                        <p className="mt-2 text-zinc-200 text-xs leading-relaxed font-sans">
                          {evaluation.detailedVerdict}
                        </p>
                      </div>
                    )}

                    {/* Detailed Indonesian Market Thesis Synthesized by Council */}
                    <div className="rounded border border-zinc-800 bg-black p-3">
                      <div className="font-semibold text-zinc-400 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="h-3 w-3 text-zinc-400" />
                        Tesis Konsensus Dewan AI ({activeSymbol} · {timeframe.toUpperCase()})
                      </div>
                      <p className="mt-1 text-zinc-200 leading-relaxed">{evaluation.thesis}</p>
                    </div>

                    {/* SL & TP Detailed Justification Reasons */}
                    {(evaluation.slReason || evaluation.tpReason) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {evaluation.slReason && (
                          <div className="rounded border border-zinc-800 bg-black p-3">
                            <div className="font-semibold text-red-400 font-mono text-[10px] uppercase tracking-wider">
                              Alasan Penempatan Stop Loss
                            </div>
                            <p className="mt-1 text-zinc-300 text-[11px] leading-relaxed">
                              {evaluation.slReason}
                            </p>
                          </div>
                        )}
                        {evaluation.tpReason && (
                          <div className="rounded border border-zinc-800 bg-black p-3">
                            <div className="font-semibold text-emerald-400 font-mono text-[10px] uppercase tracking-wider">
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
                        <div className="font-semibold text-zinc-400 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                          <Crosshair className="h-3 w-3 text-zinc-400" />
                          Level Pembatalan Skenario (Invalidation)
                        </div>
                        <p className="mt-1 font-mono text-zinc-300 text-[11px]">
                          {evaluation.riskInvalidation}
                        </p>
                      </div>
                      <div className="rounded border border-zinc-800 bg-black p-3">
                        <div className="font-semibold text-zinc-400 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                          <Target className="h-3 w-3 text-zinc-400" />
                          Instruksi Eksekusi Dewan
                        </div>
                        <p className="mt-1 text-zinc-200 text-[11px]">
                          {evaluation.recommendation}
                        </p>
                      </div>
                    </div>

                    {/* Chart Mapping Coordinates Notice */}
                    {evaluation.chartMapping && (
                      <div className="rounded border border-zinc-800 bg-zinc-900/40 p-2.5 text-[11px] font-mono text-zinc-300 flex items-center justify-between">
                        <span className="text-zinc-400">Position Box &amp; Support/Resistance Overlaid on Chart</span>
                        <span>
                          Support: <strong className="text-zinc-200">${evaluation.chartMapping.supportLevel}</strong> · Resistance: <strong className="text-zinc-200">${evaluation.chartMapping.resistanceLevel}</strong>
                        </span>
                      </div>
                    )}

                    {evaluation.notes && (
                      <div className="rounded border border-zinc-800 bg-black p-3">
                        <div className="font-semibold text-zinc-500 font-mono text-[10px] uppercase tracking-wider">
                          Catatan Risiko &amp; Psikologi
                        </div>
                        <p className="mt-1 text-zinc-300 font-mono text-[11px]">{evaluation.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <BrainCircuit className="mx-auto h-8 w-8 text-zinc-600" />
                    <p className="mt-2 text-xs text-zinc-300 font-medium">Ready for 5-Agent Council Deliberation</p>
                    <p className="mt-1 text-[11px] text-zinc-500 max-w-sm mx-auto">
                      5 distinct AI minds debate market structure, order flows, indicators, and volatility in parallel, then synthesize a single execution setup.
                    </p>
                    <Button
                      onClick={handleEvaluate}
                      disabled={isEvaluating}
                      className="mt-4 bg-zinc-100 text-black hover:bg-white font-medium text-xs border-0 shadow-none px-5"
                    >
                      {isEvaluating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          5 Minds Deliberating &amp; Synthesizing...
                        </>
                      ) : (
                        <>
                          <Compass className="h-3.5 w-3.5 mr-1.5" />
                          Start 5-Agent Deliberation &amp; Mapping
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
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-zinc-400" />
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                    Discipline Checklist &amp; Strategy
                  </CardTitle>
                </div>
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
                    <div className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">
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
                            <span className="ml-1 text-[10px] text-zinc-400 font-mono font-semibold">[REQUIRED]</span>
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
                          <span>Deliberating 5 Minds...</span>
                        </>
                      ) : (
                        <>
                          <Compass className="h-3.5 w-3.5" />
                          <span>Run 5-Agent Deliberation &amp; Mapping</span>
                        </>
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
                  <History className="h-4 w-4 text-zinc-400" />
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                    Analysis History Log ({evalLogs.length})
                  </CardTitle>
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
                    No generated analyses logged yet. Each evaluation will automatically be archived here.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {evalLogs.map((log) => {
                      const isCurrent = evaluation?.id === log.id;
                      const dateStr = log.timestamp
                        ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : "Recent";

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
                              <span className="font-mono text-xs font-semibold text-zinc-200">
                                {log.symbol || activeSymbol} · {(log.timeframe || timeframe).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                              <Clock className="h-3 w-3" />
                              <span>{dateStr}</span>
                            </div>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                            <div>
                              Entry: <span className="text-zinc-200">${log.entryPrice?.toFixed(2)}</span> · SL: <span className="text-red-400">${log.stopLoss?.toFixed(2)}</span> · TP: <span className="text-emerald-400">${log.takeProfit?.toFixed(2)}</span>
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
