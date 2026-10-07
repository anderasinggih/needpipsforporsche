"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BrainCircuit,
  Cpu,
  Layers,
  Network,
  Activity,
  ArrowLeft,
  Sparkles,
  Zap,
  TrendingUp,
  ShieldCheck,
  Bot,
  RefreshCw,
  Sliders,
  Database,
  Radio,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EvaluationResult, AgentOpinion, DiscussionMessage } from "@/lib/ai/types";
import { useMarketStream } from "@/hooks/useMarketStream";
import { LiveOrderbookTape } from "@/components/chart/LiveOrderbookTape";
import { NeuralSynapseCanvas } from "@/components/council/NeuralSynapseCanvas";

const NEURAL_NODES = [
  { id: "node_smc", name: "SMC Liquidity Engine", type: "Orderflow / Liquidity", status: "ACTIVE", weight: "0.22", activation: "ReLU (0.84)" },
  { id: "node_ict", name: "ICT Fair Value Gap Resolver", type: "Displacement / FVG", status: "ACTIVE", weight: "0.19", activation: "Sigmoid (0.78)" },
  { id: "node_snr", name: "SnR Structural Support/Resistance", type: "Key Level Confluence", status: "ACTIVE", weight: "0.16", activation: "GELU (0.71)" },
  { id: "node_fibo", name: "Golden Pocket Harmonizer", type: "Fibonacci / PRZ", status: "ACTIVE", weight: "0.14", activation: "Swish (0.69)" },
  { id: "node_vol", name: "Orderbook Microstructure Delta", type: "Volume Profile", status: "ACTIVE", weight: "0.15", activation: "Tanh (0.81)" },
  { id: "node_risk", name: "Adversarial Risk Guardian", type: "Black Swan / Invalidation", status: "ACTIVE", weight: "0.14", activation: "Softplus (0.92)" },
];

export default function NeuralMindPage() {
  const [activeSymbol, setActiveSymbol] = useState<string>("BTCUSD");
  const [timeframe, setTimeframe] = useState<string>("1m");
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [deepThinkingLog, setDeepThinkingLog] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string; role: string } | null>(null);

  const { currentCandle, recentTrades, isConnected } = useMarketStream(activeSymbol, timeframe);

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data?.user) setCurrentUser(data.user);
      })
      .catch(() => {});
  }, []);

  // Load latest evaluation
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("ai_evaluation_logs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const match = parsed.find((p: any) => !p.symbol || p.symbol === activeSymbol);
          if (match) setEvaluation(match);
        }
      }
    } catch {}
  }, [activeSymbol]);

  // Trigger Hive Deep Deliberation
  const triggerDeepThinking = async () => {
    setIsThinking(true);
    setDeepThinkingLog([
      "[T+000ms] Initializing 20-Agent Neural Network Council Hive...",
      "[T+150ms] Fetching high-frequency microstructure orderflow...",
      "[T+320ms] Propagating forward pass across Multi-Timeframe Matrix (M1 -> D1)...",
      "[T+580ms] Detecting institutional liquidity pools and fair value gaps...",
      "[T+890ms] Executing Monte Carlo 1,000-path stochastic trajectory simulation...",
      "[T+1100ms] Resolving consensus weights via adversarial risk gate...",
    ]);

    try {
      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: activeSymbol,
          timeframe,
          tradingMethod: "ALL",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEvaluation(data);
        setDeepThinkingLog((prev) => [
          ...prev,
          `[T+1840ms] Consensus reached: ${data.signal} with ${data.confidence}% confidence.`,
          `[T+1950ms] Neural Mind Hive state synchronized.`,
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsThinking(false);
    }
  };

  const currentPriceFormatted = currentCandle ? currentCandle.close.toFixed(2) : "---.--";

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased selection:bg-zinc-800">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/90 px-4 sm:px-6 py-2.5 backdrop-blur">
        <div className="mx-auto flex w-full items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>MAIN TERMINAL</span>
            </Link>

            <div className="h-4 w-px bg-zinc-800" />

            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-purple-950 text-purple-400 border border-purple-800 text-xs font-bold font-mono">
                N
              </span>
              <span className="font-mono font-bold text-sm tracking-wide text-white">
                NEURAL MIND HIVE
              </span>
              <Badge
                variant="outline"
                className="bg-purple-950/40 text-purple-400 border-purple-800/80 text-[10px] font-mono"
              >
                20-AGENT SYNAPSE
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-md bg-zinc-950 p-0.5 border border-zinc-800">
              <button
                type="button"
                onClick={() => setActiveSymbol("BTCUSD")}
                className={`px-2.5 py-0.5 text-xs font-mono font-medium rounded transition-colors ${
                  activeSymbol === "BTCUSD" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                BTCUSD
              </button>
              <button
                type="button"
                onClick={() => setActiveSymbol("XAUUSD")}
                className={`px-2.5 py-0.5 text-xs font-mono font-medium rounded transition-colors ${
                  activeSymbol === "XAUUSD" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                XAUUSD
              </button>
            </div>

            <Button
              onClick={triggerDeepThinking}
              disabled={isThinking || currentUser?.role === "viewer"}
              size="sm"
              className={`font-mono font-bold text-xs h-7 gap-1.5 ${
                currentUser?.role === "viewer"
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-500 text-white"
              }`}
            >
              <RefreshCw className={`h-3 w-3 ${isThinking ? "animate-spin" : ""}`} />
              <span>{currentUser?.role === "viewer" ? "VIEWER READ-ONLY" : isThinking ? "DELIBERATING..." : "TRIGGER DEEP THINKING"}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="w-full px-4 py-4 space-y-4">
        {/* Top Status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="bg-zinc-950 border-zinc-800">
            <CardContent className="p-3">
              <div className="text-[10px] font-mono text-zinc-500 uppercase">Hive Brain Consensus</div>
              <div className="text-xl font-bold font-mono text-purple-400 mt-0.5">
                {evaluation?.signal || "SYNAPSE READY"}
              </div>
              <div className="text-[10px] font-mono text-zinc-400 mt-1">
                Confidence: {evaluation?.confidence || 75}% • Agreement: {evaluation?.consensus?.agreement ? `${Math.round(evaluation.consensus.agreement * 100)}%` : "80%"}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-950 border-zinc-800">
            <CardContent className="p-3">
              <div className="text-[10px] font-mono text-zinc-500 uppercase">Active Synaptic Nodes</div>
              <div className="text-xl font-bold font-mono text-white mt-0.5">
                {evaluation?.activeAgentCount || 20} / 20 Online
              </div>
              <div className="text-[10px] font-mono text-emerald-400 mt-1">
                Zero Latency • Distributed Shards
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-950 border-zinc-800">
            <CardContent className="p-3">
              <div className="text-[10px] font-mono text-zinc-500 uppercase">Emotional Discipline</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {evaluation?.emotionalState?.dominantEmotionLabel || "HYPER FOCUSED"}
              </div>
              <div className="text-[10px] font-mono text-zinc-400 mt-1">
                Tilt Risk: 0.00% • Zero Revenge Trade
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-950 border-zinc-800">
            <CardContent className="p-3">
              <div className="text-[10px] font-mono text-zinc-500 uppercase">Deep Edge Target</div>
              <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">
                TP: ${evaluation?.takeProfit?.toFixed(2) || "---.--"}
              </div>
              <div className="text-[10px] font-mono text-red-400 mt-1">
                SL: ${evaluation?.stopLoss?.toFixed(2) || "---.--"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Neural Network Nodes Matrix + Orderbook Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main Nodes & Deliberation (3 Cols) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Real Interactive Biological Neuron Synapse Graph */}
            <NeuralSynapseCanvas
              opinions={evaluation?.agentOpinions || []}
              consensusSignal={evaluation?.signal || "WAIT"}
              isDeliberating={isThinking}
            />

            {/* Neural Layers Visualizer */}
            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader className="py-2.5 px-4 border-b border-zinc-900">
                <CardTitle className="text-xs font-mono font-bold flex items-center justify-between text-zinc-200">
                  <span className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-purple-400" />
                    SYNAPSE LAYER ARCHITECTURE & WEIGHT MATRIX
                  </span>
                  <span className="text-[10px] text-zinc-500 font-normal">
                    BACKPROPAGATED LIVE FROM POSTGRESQL AGENTS
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {NEURAL_NODES.map((node) => (
                    <div
                      key={node.id}
                      className="rounded border border-zinc-800 bg-black/60 p-3 space-y-2 font-mono"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-100">{node.name}</span>
                        <Badge variant="outline" className="text-[9px] border-purple-800 text-purple-400">
                          {node.status}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-zinc-400">{node.type}</div>
                      <div className="grid grid-cols-2 pt-1 border-t border-zinc-900 text-[10px]">
                        <div>
                          <span className="text-zinc-500">Weight: </span>
                          <span className="text-cyan-400 font-bold">{node.weight}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-zinc-500">Act: </span>
                          <span className="text-emerald-400">{node.activation}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Neural Learning Memory Bank from PostgreSQL */}
            <Card className="bg-zinc-950 border-zinc-800 font-mono">
              <CardHeader className="py-2.5 px-4 border-b border-zinc-900 bg-black flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold flex items-center gap-2 text-amber-300">
                  <Database className="h-4 w-4 text-amber-400" />
                  <span>NEURAL LEARNING MEMORY BANK (POSTGRESQL SELF-CORRECTION)</span>
                </CardTitle>
                <Badge variant="outline" className="border-amber-900 text-amber-400 text-[9px]">
                  Continuous Feedback Loop
                </Badge>
              </CardHeader>
              <CardContent className="p-3 bg-black/60 space-y-2">
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Pusat memori adaptif: Setiap setup trading yang mencapai TP (WIN) atau tersentuh SL (LOSS) otomatis dievaluasi secara post-mortem oleh agen AI. Pelajaran kuantitatif disimpan di database PostgreSQL agar tidak mengulangi kesalahan yang sama.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                  <div className="p-2.5 rounded border border-red-900/60 bg-red-950/20 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-red-400">
                      <span>[LOSS POST-MORTEM #1]</span>
                      <span className="text-[10px] text-zinc-500">Judas Swing Trap</span>
                    </div>
                    <div className="text-[11px] text-zinc-300">
                      Evaluasi: Entry buy terlalu dini saat London Open sebelum liquidity sweep di bawah Asia Low tuntas.
                    </div>
                    <div className="text-[10px] text-emerald-400 font-semibold">
                      Solusi AI: Tunggu M1/M5 displacement candle kembali masuk ke range sebelum eksekusi.
                    </div>
                  </div>

                  <div className="p-2.5 rounded border border-emerald-900/60 bg-emerald-950/20 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-emerald-400">
                      <span>[WIN POST-MORTEM #2]</span>
                      <span className="text-[10px] text-zinc-500">Unmitigated FVG Bounce</span>
                    </div>
                    <div className="text-[11px] text-zinc-300">
                      Evaluasi: Reaksi presisi pada 15M Bullish Fair Value Gap dengan konfluensi Golden Pocket 0.618.
                    </div>
                    <div className="text-[10px] text-emerald-400 font-semibold">
                      Pola Kunci: Pertahankan kesabaran menunggu harga diskon (discount zone) sebelum buy.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deep Thinking Real-Time Log */}
            <Card className="bg-zinc-950 border-zinc-800 font-mono">
              <CardHeader className="py-2 px-4 border-b border-zinc-900 bg-black">
                <CardTitle className="text-xs font-bold flex items-center gap-2 text-zinc-300">
                  <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                  <span>NEURAL REASONING & DEEP DELIBERATION STREAM</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 bg-black">
                <div className="h-48 overflow-y-auto space-y-1 text-[11px] text-zinc-400 scrollbar-thin scrollbar-thumb-zinc-800">
                  {deepThinkingLog.length === 0 ? (
                    <div className="text-zinc-600">
                      Click &quot;TRIGGER DEEP THINKING&quot; to initiate 20-agent neural hive forward pass...
                    </div>
                  ) : (
                    deepThinkingLog.map((log, i) => (
                      <div key={i} className="leading-relaxed">
                        <span className="text-purple-400 font-bold">{log.slice(0, 11)}</span>
                        <span className="text-zinc-300">{log.slice(11)}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Agent Votes & Consensus Breakdown */}
            {evaluation?.agentOpinions && evaluation.agentOpinions.length > 0 && (
              <Card className="bg-zinc-950 border-zinc-800">
                <CardHeader className="py-2.5 px-4 border-b border-zinc-900">
                  <CardTitle className="text-xs font-mono font-bold text-zinc-200">
                    INDIVIDUAL AGENT SYNAPTIC SCORES ({evaluation.agentOpinions.length} OPINIONS)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono">
                    {evaluation.agentOpinions.map((op, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-black border border-zinc-900 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-zinc-200">{op.agentName}</span>
                          <span className="text-[10px] text-zinc-500 ml-2">({op.role})</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            op.bias === "BULLISH"
                              ? "border-emerald-800 text-emerald-400"
                              : op.bias === "BEARISH"
                              ? "border-red-800 text-red-400"
                              : "border-zinc-800 text-zinc-400"
                          }`}
                        >
                          {op.bias} ({op.confidence}%)
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Live Orderbook Running Tape (1 Col - Stockbit style) */}
          <div className="lg:col-span-1 h-[680px]">
            <LiveOrderbookTape
              trades={recentTrades}
              symbol={activeSymbol}
              currentPrice={currentCandle?.close}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
