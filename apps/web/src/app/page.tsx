"use client";

import React, { useState, useEffect } from "react";
import { TradingViewChart } from "@/components/chart/TradingViewChart";
import { useMarketStream } from "@/hooks/useMarketStream";
import { SkillChecklistModal, TradingSkill } from "@/components/skills/SkillChecklistModal";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Loader2,
  Activity,
  CheckCircle2,
  Settings,
  Radio,
  Sparkles,
} from "lucide-react";

interface EvaluationResult {
  rating: string;
  confidence: number;
  thesis: string;
  riskInvalidation: string;
  recommendation: string;
  notes: string;
}

export default function DashboardPage() {
  const [activeSymbol, setActiveSymbol] = useState<string>("BTCUSD");
  const { currentCandle, historicalCandles, positions, isConnected } = useMarketStream(activeSymbol);
  const [selectedSkill, setSelectedSkill] = useState<TradingSkill | null>(null);
  const [checkedRules, setCheckedRules] = useState<Record<string, boolean>>({});
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const rules = selectedSkill?.rules_checklist ?? [];
  const allRequiredMet = rules
    .filter((r) => r.required)
    .every((r) => checkedRules[r.id]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sym = localStorage.getItem("active_symbol");
      if (sym === "XAUUSD" || sym === "BTCUSD") {
        setActiveSymbol(sym);
      }
    }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const toggleRule = (id: string) => {
    setCheckedRules((prev) => ({ ...prev, [id]: !prev[id] }));
    setEvaluation(null);
  };

  const handleSkillSelect = (skill: TradingSkill) => {
    setSelectedSkill(skill);
    setCheckedRules({});
    setEvaluation(null);
    setIsSkillModalOpen(false);
    showToast(`Active Strategy: ${skill.title}`);
  };

  const handleEvaluate = async () => {
    if (!currentCandle || !selectedSkill) return;
    try {
      setIsEvaluating(true);
      const geminiKey = localStorage.getItem("gemini_api_key") || "";
      const aiModel = localStorage.getItem("ai_model") || "gemini-2.5-flash";
      const groqKey = localStorage.getItem("groq_api_key") || "";

      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-key": geminiKey,
          "x-ai-model": aiModel,
          "x-groq-key": groqKey,
        },
        body: JSON.stringify({
          symbol: activeSymbol,
          price: currentCandle.close,
          direction: "BUY",
          checklistMet: allRequiredMet,
          indicatorsSummary: `${activeSymbol} 1m bar: Open ${currentCandle.open.toFixed(2)}, High ${currentCandle.high.toFixed(2)}, Low ${currentCandle.low.toFixed(2)}, Close ${currentCandle.close.toFixed(2)}`,
          rules: rules.map((r) => ({ ...r, checked: !!checkedRules[r.id] })),
        }),
      });
      const data = await res.json();
      setEvaluation(data.evaluation);
    } catch (err) {
      console.error("Evaluation failed:", err);
      showToast("AI Evaluation request failed");
    } finally {
      setIsEvaluating(false);
    }
  };

  const currentPriceFormatted = currentCandle ? currentCandle.close.toFixed(2) : "---.--";

  return (
    <div className="min-h-screen bg-black text-neutral-100 font-sans antialiased selection:bg-[#00FF66]/20 selection:text-[#00FF66]">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-black/95 px-6 py-2.5 backdrop-blur">
        <div className="mx-auto flex w-full items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-mono font-semibold tracking-tight text-white text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-[#00FF66]/10 text-[10px] font-bold text-[#00FF66] border border-[#00FF66]/30 shadow-[0_0_8px_rgba(0,255,102,0.2)]">
                P
              </span>
              NEEDPIPS<span className="text-neutral-600 font-normal">/</span>FORPORSCHE
            </div>
            <div className="hidden sm:flex items-center gap-2 border-l border-neutral-800 pl-4 text-xs font-mono">
              {/* Pair Switcher in Top Bar */}
              <div className="flex items-center rounded-md bg-neutral-900/90 p-0.5 border border-neutral-800">
                <button
                  onClick={() => {
                    setActiveSymbol("BTCUSD");
                    if (typeof window !== "undefined") localStorage.setItem("active_symbol", "BTCUSD");
                  }}
                  className={`px-2.5 py-0.5 text-[11px] font-mono font-bold rounded transition-all ${
                    activeSymbol === "BTCUSD"
                      ? "bg-[#00FF66] text-black shadow-[0_0_8px_rgba(0,255,102,0.4)]"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  BTCUSD
                </button>
                <button
                  onClick={() => {
                    setActiveSymbol("XAUUSD");
                    if (typeof window !== "undefined") localStorage.setItem("active_symbol", "XAUUSD");
                  }}
                  className={`px-2.5 py-0.5 text-[11px] font-mono font-bold rounded transition-all ${
                    activeSymbol === "XAUUSD"
                      ? "bg-[#00FF66] text-black shadow-[0_0_8px_rgba(0,255,102,0.4)]"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  XAUUSD
                </button>
              </div>
              <span className="text-neutral-700">·</span>
              <span className="font-semibold text-[#00FF66] font-mono tracking-wide text-xs">
                ${currentPriceFormatted}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant={isConnected ? "live" : "secondary"}
              className="flex items-center gap-1.5 py-1 px-2.5 text-[10px] font-mono"
            >
              <Radio className={`h-3 w-3 ${isConnected ? "text-[#00FF66]" : "text-neutral-500"}`} />
              <span>{isConnected ? "BINANCE LIVE STREAM ACTIVE" : "CONNECTING..."}</span>
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center gap-1.5 border-neutral-800 bg-black hover:border-neutral-700 hover:text-white text-xs h-8"
            >
              <Settings className="h-3.5 w-3.5 text-neutral-400" />
              <span>Settings</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Full-Width Workspace Layout */}
      <div className="w-full px-5 py-4 space-y-4">
        {/* Full-Width Chart Section */}
        <Card className="border-neutral-800 bg-black p-1 shadow-2xl overflow-hidden">
          <TradingViewChart
            currentCandle={currentCandle}
            historicalCandles={historicalCandles}
            positions={positions}
            symbol={activeSymbol}
            onSymbolChange={(sym) => {
              setActiveSymbol(sym);
              if (typeof window !== "undefined") localStorage.setItem("active_symbol", sym);
            }}
          />
        </Card>

        {/* Bottom Split Grid: Metrics, AI Evaluator & Discipline Sidebar */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left/Main Column: Stream Info, AI Evaluation & Journal (7 cols) */}
          <div className="space-y-4 lg:col-span-7">
            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 bg-[#0A0A0A] border-neutral-800">
                <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-neutral-500">
                  Data Stream Feed
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-neutral-200">
                  Binance Spot 1m Kline
                </div>
              </Card>
              <Card className="p-3 bg-[#0A0A0A] border-neutral-800">
                <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-neutral-500">
                  Active Strategy
                </div>
                <div className="mt-1 truncate text-xs font-medium text-neutral-200">
                  {selectedSkill ? selectedSkill.title : "Select Strategy..."}
                </div>
              </Card>
              <Card className="p-3 bg-[#0A0A0A] border-neutral-800">
                <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-neutral-500">
                  Min. Target Ratio
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-[#00FF66]">
                  1 : {selectedSkill?.risk_reward_min ?? 2.5}
                </div>
              </Card>
            </div>

            {/* AI Technical Evaluation & Quantitative Reasoner Card */}
            <Card className="border-neutral-800 bg-[#0A0A0A] p-4 shadow-xl">
              <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-neutral-800">
                <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-200">
                  <Activity className="h-4 w-4 text-[#00FF66]" />
                  AI Quantitative Analysis &amp; Reasoning Panel
                </CardTitle>
                {evaluation && (
                  <Badge variant="electric">
                    {evaluation.rating} · Confidence {evaluation.confidence}%
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="p-0 pt-3">
                {evaluation ? (
                  <div className="space-y-3 text-xs leading-relaxed">
                    <div className="rounded border border-neutral-800/80 bg-black/60 p-3">
                      <div className="font-semibold text-neutral-400 font-mono text-[10px] uppercase tracking-wider">Market Setup Thesis</div>
                      <p className="mt-1 text-neutral-200">{evaluation.thesis}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded border border-neutral-800/80 bg-black/60 p-3">
                        <div className="font-semibold text-red-400 font-mono text-[10px] uppercase tracking-wider">Invalidation Level</div>
                        <p className="mt-1 font-mono text-neutral-200">{evaluation.riskInvalidation}</p>
                      </div>
                      <div className="rounded border border-neutral-800/80 bg-black/60 p-3">
                        <div className="font-semibold text-[#00FF66] font-mono text-[10px] uppercase tracking-wider">Execution Bias</div>
                        <p className="mt-1 text-neutral-200">{evaluation.recommendation}</p>
                      </div>
                    </div>

                    {evaluation.notes && (
                      <div className="rounded border border-neutral-800/80 bg-black/60 p-3">
                        <div className="font-semibold text-neutral-400 font-mono text-[10px] uppercase tracking-wider">Quantitative Notes</div>
                        <p className="mt-1 text-neutral-300 font-mono text-[11px]">{evaluation.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Sparkles className="mx-auto h-8 w-8 text-[#00FF66]/40" />
                    <p className="mt-2 text-xs text-neutral-400 font-medium">AI Quantitative Analysis Idle</p>
                    <p className="mt-1 text-[11px] text-neutral-500 max-w-sm mx-auto">
                      Select an institutional strategy and verify required checklist conditions on the right to trigger AI reasoning.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Discipline Checklist & Strategy Framework (5 cols) */}
          <div className="space-y-4 lg:col-span-5">
            <Card className="border-neutral-800 bg-[#0A0A0A] p-4">
              <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#00FF66]" />
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
                    Discipline Checklist
                  </CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSkillModalOpen(true)}
                  className="h-7 text-[11px] px-2.5 bg-black border-neutral-800 hover:border-neutral-700"
                >
                  Strategies
                </Button>
              </CardHeader>

              {!selectedSkill ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-neutral-500">No trading strategy loaded yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSkillModalOpen(true)}
                    className="mt-3 text-xs border-neutral-800 bg-black hover:border-neutral-700"
                  >
                    Select Quantitative Strategy
                  </Button>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="rounded border border-neutral-800 bg-black p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-200 text-xs">{selectedSkill.title}</span>
                      <Badge variant="outline" className="text-[10px] font-mono border-neutral-800">
                        {selectedSkill.timeframes?.join(", ") || "M1 / M5"}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-[11px] text-neutral-400 leading-normal">
                      {selectedSkill.description}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono font-medium text-neutral-400 uppercase tracking-wider">
                      Execution Rules ({Object.values(checkedRules).filter(Boolean).length}/{rules.length})
                    </div>
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        onClick={() => toggleRule(rule.id)}
                        className={`flex cursor-pointer items-start gap-2.5 rounded border p-2.5 text-xs transition ${
                          checkedRules[rule.id]
                            ? "border-[#00FF66]/40 bg-[#00FF66]/5 text-neutral-100"
                            : "border-neutral-800/80 bg-black text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            checkedRules[rule.id]
                              ? "border-[#00FF66] bg-[#00FF66] text-black"
                              : "border-neutral-700 bg-neutral-900"
                          }`}
                        >
                          {checkedRules[rule.id] && <CheckCircle2 className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>
                        <div className="leading-tight">
                          <span>{rule.text}</span>
                          {rule.required && (
                            <span className="ml-1 text-[10px] text-[#00FF66] font-mono font-semibold">[REQUIRED]</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Evaluation Trigger */}
                  <div className="pt-2">
                    <Button
                      onClick={handleEvaluate}
                      disabled={!allRequiredMet || isEvaluating}
                      variant="electric"
                      className="w-full flex items-center justify-center gap-2"
                    >
                      {isEvaluating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Evaluating Setup with AI...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Evaluate Setup with AI</span>
                        </>
                      )}
                    </Button>
                    {!allRequiredMet && (
                      <p className="mt-1.5 text-center text-[10px] font-mono text-neutral-500">
                        Complete all mandatory rules to unlock AI evaluation
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <SkillChecklistModal
        isOpen={isSkillModalOpen}
        onClose={() => setIsSkillModalOpen(false)}
        onSkillSelect={handleSkillSelect}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => {
          setIsSettingsModalOpen(false);
          const sym = localStorage.getItem("hfm_symbol") || localStorage.getItem("active_symbol");
          if (sym) setActiveSymbol(sym);
        }}
        onSaved={(msg) => {
          showToast(msg);
          const sym = localStorage.getItem("hfm_symbol") || localStorage.getItem("active_symbol");
          if (sym) setActiveSymbol(sym);
        }}
      />

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-xs text-neutral-200 shadow-xl font-mono border-l-2 border-l-[#00FF66]">
          {toast}
        </div>
      )}
    </div>
  );
}
