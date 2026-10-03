"use client";

import React, { useState } from "react";
import { TradingViewChart } from "@/components/chart/TradingViewChart";
import { useMarketStream } from "@/hooks/useMarketStream";
import { ShieldCheck, Activity, Award, BookOpen, Key } from "lucide-react";

export default function DashboardPage() {
  const wsUrl = process.env.NEXT_PUBLIC_ENGINE_WS_URL || "ws://localhost:8080/ws/live";
  const { currentCandle, isConnected } = useMarketStream(wsUrl);

  const [rules, setRules] = useState([
    { id: "1", text: "HTF Trend Alignment (1H/4H Bullish or Bearish)", checked: true },
    { id: "2", text: "Liquidity Sweep on Key High/Low or Asian Range", checked: false },
    { id: "3", text: "Change of Character (CHoCH) on 5m M15", checked: false },
    { id: "4", text: "Entry Mitigation on Orderblock / FVG Zone", checked: false },
    { id: "5", text: "Risk-to-Reward Ratio Minimum 1:2.5", checked: true },
    { id: "6", text: "No High Impact News (CPI/NFP/FOMC) in 30 mins", checked: true },
  ]);

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r))
    );
  };

  const allRulesPassed = rules.every((r) => r.checked);

  return (
    <main className="min-h-screen bg-[#090A0F] text-slate-200">
      {/* Top Navbar */}
      <header className="border-b border-border/80 bg-[#0D0F17]/90 px-6 py-3.5 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black">
              911
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">
                NEEDPIPS<span className="text-amber-400">FORPORSCHE</span>
              </h1>
              <p className="text-[10px] text-slate-400 tracking-wider">
                XAU/USD INTELLIGENCE & DISCIPLINE HUB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-border bg-[#141724] px-3 py-1">
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                }`}
              />
              <span className="text-xs font-medium text-slate-300">
                {isConnected ? "HFM FEED ACTIVE" : "DISCONNECTED"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto max-w-7xl p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Live Chart (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            <TradingViewChart currentCandle={currentCandle} />

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="text-xs text-slate-400">TARGET PAIR</div>
                <div className="text-lg font-bold text-white mt-1">XAU/USD (Gold)</div>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="text-xs text-slate-400">ACTIVE STRATEGY</div>
                <div className="text-lg font-bold text-amber-400 mt-1">SMC Liquidity Sweep</div>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="text-xs text-slate-400">TARGET RR MIN</div>
                <div className="text-lg font-bold text-emerald-400 mt-1">1 : 2.5</div>
              </div>
            </div>
          </div>

          {/* Right Column: Trading Discipline & Skill Checklist (1 Col) */}
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-amber-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Execution Checklist
                  </h2>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    allRulesPassed
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}
                >
                  {allRulesPassed ? "SETUP CONFIRMED" : "CONDITIONS PENDING"}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {rules.map((rule) => (
                  <label
                    key={rule.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/40 bg-[#0E1018] p-3 transition hover:border-amber-500/40"
                  >
                    <input
                      type="checkbox"
                      checked={rule.checked}
                      onChange={() => toggleRule(rule.id)}
                      className="mt-0.5 h-4 w-4 rounded border-border bg-background text-amber-500 focus:ring-amber-400 focus:ring-offset-0"
                    />
                    <span className="text-xs font-medium text-slate-300 leading-relaxed">
                      {rule.text}
                    </span>
                  </label>
                ))}
              </div>

              <button
                disabled={!allRulesPassed}
                className={`mt-6 w-full rounded-lg py-3 text-xs font-bold uppercase tracking-wider transition ${
                  allRulesPassed
                    ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                    : "bg-border text-slate-500 cursor-not-allowed"
                }`}
              >
                {allRulesPassed ? "Log Validated Trade Entry" : "Check All Rules to Enable"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
