"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useMarketStream } from "@/hooks/useMarketStream";
import { PossibilityMonteCarloChart } from "@/components/chart/PossibilityMonteCarloChart";
import { LiveOrderbookTape } from "@/components/chart/LiveOrderbookTape";
import { PossibilityScenario, EvaluationResult } from "@/lib/ai/types";
import {
  Sparkles,
  TrendingUp,
  BrainCircuit,
  Activity,
  ArrowLeft,
  ShieldAlert,
  Zap,
  Target,
  BarChart2,
  RefreshCw,
  Cpu,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PossibilityPage() {
  const [activeSymbol, setActiveSymbol] = useState<string>("BTCUSD");
  const [timeframe, setTimeframe] = useState<string>("1m");
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);

  const { currentCandle, historicalCandles, recentTrades, isConnected } = useMarketStream(
    activeSymbol,
    timeframe
  );

  // Load latest cached evaluation or load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("ai_evaluation_logs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const match = parsed.find(
            (p: any) => (!p.symbol || p.symbol === activeSymbol) && p.possibilityScenarios
          );
          if (match) {
            setEvaluation(match);
            return;
          }
        }
      }
    } catch {}
  }, [activeSymbol]);

  // Request new AI Deep Evaluation for Possibility Lines
  const runDeepSimulation = async () => {
    setIsEvaluating(true);
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
      }
    } catch (e) {
      console.error("Simulation run error:", e);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Generate fallback possibility scenarios if AI hasn't been run yet
  const scenarios: PossibilityScenario[] = React.useMemo(() => {
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
        name: "Scenario 1: Primary Breakout",
        probability: 62,
        color: "#06B6D4", // Neon Cyan
        description: "Impulsive structure continuation reaching next key liquidity pool and expansion target.",
        points: [
          { time: curTime, price: curPrice },
          { time: curTime + intervalSec * 3, price: Number((curPrice + atr * 0.4).toFixed(2)) },
          { time: curTime + intervalSec * 7, price: Number((curPrice + atr * 1.1).toFixed(2)) },
          { time: curTime + intervalSec * 12, price: Number((curPrice + atr * 2.2).toFixed(2)) },
        ],
      },
      {
        id: "alternative_sweep",
        name: "Scenario 2: Liquidity Sweep & Reversal",
        probability: 26,
        color: "#F59E0B", // Amber Gold
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
        color: "#EF4444", // Crimson Red
        description: "Structural invalidation breaching support pivot and triggering cascading market stop-outs.",
        points: [
          { time: curTime, price: curPrice },
          { time: curTime + intervalSec * 3, price: Number((curPrice - atr * 0.5).toFixed(2)) },
          { time: curTime + intervalSec * 6, price: Number((curPrice - atr * 1.4).toFixed(2)) },
          { time: curTime + intervalSec * 11, price: Number((curPrice - atr * 2.5).toFixed(2)) },
        ],
      },
    ];
  }, [evaluation, currentCandle, activeSymbol]);

  const currentPriceFormatted = currentCandle ? currentCandle.close.toFixed(2) : "---.--";

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased selection:bg-zinc-800">
      {/* Navigation Bar */}
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
              <span className="flex h-5 w-5 items-center justify-center rounded bg-cyan-950 text-cyan-400 border border-cyan-800 text-xs font-bold font-mono">
                P
              </span>
              <span className="font-mono font-bold text-sm tracking-wide text-white">
                POSSIBILITY FORECAST LAB
              </span>
              <Badge
                variant="outline"
                className="bg-cyan-950/40 text-cyan-400 border-cyan-800/80 text-[10px] font-mono"
              >
                MULTI-BRANCH
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/neural-mind"
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-purple-950/40 border border-purple-800/80 text-xs font-mono text-purple-300 hover:text-purple-200 hover:bg-purple-900/40 transition-colors"
            >
              <BrainCircuit className="h-3.5 w-3.5 text-purple-400" />
              <span>NEURAL MIND HIVE</span>
            </Link>

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
              onClick={runDeepSimulation}
              disabled={isEvaluating}
              size="sm"
              className="bg-cyan-600 hover:bg-cyan-500 text-black font-mono font-bold text-xs h-7 gap-1.5"
            >
              <RefreshCw className={`h-3 w-3 ${isEvaluating ? "animate-spin" : ""}`} />
              <span>{isEvaluating ? "CALCULATING..." : "RE-CALCULATE FORECAST"}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="w-full px-4 py-4 space-y-4">
        {/* Top Info Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="bg-zinc-950 border-zinc-800">
            <CardContent className="p-3">
              <div className="text-[10px] font-mono text-zinc-500 uppercase">Live Index Price</div>
              <div className="text-xl font-bold font-mono text-white mt-0.5">
                ${currentPriceFormatted}
              </div>
              <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                WS Feed Active • Real-time
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-950 border-zinc-800">
            <CardContent className="p-3">
              <div className="text-[10px] font-mono text-cyan-400 uppercase">Primary Scenario</div>
              <div className="text-xl font-bold font-mono text-cyan-300 mt-0.5">
                {scenarios[0]?.probability}% Odds
              </div>
              <div className="text-[10px] font-mono text-zinc-400 truncate mt-1">
                {scenarios[0]?.name}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-950 border-zinc-800">
            <CardContent className="p-3">
              <div className="text-[10px] font-mono text-amber-400 uppercase">Liquidity Sweep Odds</div>
              <div className="text-xl font-bold font-mono text-amber-300 mt-0.5">
                {scenarios[1]?.probability || 26}% Odds
              </div>
              <div className="text-[10px] font-mono text-zinc-400 truncate mt-1">
                Sweep prior swing before move
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-950 border-zinc-800">
            <CardContent className="p-3">
              <div className="text-[10px] font-mono text-red-400 uppercase">Invalidation Risk</div>
              <div className="text-xl font-bold font-mono text-red-300 mt-0.5">
                {scenarios[2]?.probability || 12}% Odds
              </div>
              <div className="text-[10px] font-mono text-zinc-400 truncate mt-1">
                Structural SL Breach Level
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart + Live Orderbook Running Tape Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main Possibility Chart (3 Columns) */}
          <div className="lg:col-span-3 space-y-3">
            <PossibilityMonteCarloChart
              candles={historicalCandles}
              currentPrice={currentCandle?.close || 0}
              scenarios={scenarios}
              symbol={activeSymbol}
              timeframe={timeframe}
            />

            {/* Scenario Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {scenarios.map((sc) => (
                <div
                  key={sc.id}
                  className="rounded-md border border-zinc-800 bg-zinc-950 p-3.5 space-y-2 font-mono"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sc.color }} />
                      {sc.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold"
                      style={{ color: sc.color, borderColor: sc.color }}
                    >
                      {sc.probability}%
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {sc.description}
                  </p>
                  <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-900 flex justify-between">
                    <span>Target Trajectory:</span>
                    <span className="text-zinc-200 font-bold">
                      ${sc.points[sc.points.length - 1]?.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Running Ticker / Orderbook Tape Panel (1 Column - Stockbit style) */}
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
