"use client";

import React, { useState, useEffect, useCallback } from "react";
import { TradingViewChart } from "@/components/chart/TradingViewChart";
import { useMarketStream } from "@/hooks/useMarketStream";
import { SkillChecklistModal, TradingSkill } from "@/components/skills/SkillChecklistModal";
import { TradeJournalForm, JournalEntry } from "@/components/journal/TradeJournalForm";
import { JournalHistoryTable } from "@/components/journal/JournalHistoryTable";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  BookOpen,
  Plus,
  Loader2,
  TrendingUp,
  Activity,
  CheckCircle2,
  Settings,
  Radio,
  Sparkles,
} from "lucide-react";

interface JournalRow {
  id: string;
  symbol: string;
  direction: string;
  entry_price: number;
  exit_price?: number;
  stop_loss: number;
  take_profit: number;
  lot_size: number;
  pnl?: number;
  status: string;
  created_at: string;
  notes?: string;
}

interface EvaluationResult {
  rating: string;
  confidence: number;
  thesis: string;
  riskInvalidation: string;
  recommendation: string;
  notes: string;
}

export default function DashboardPage() {
  const wsUrl = process.env.NEXT_PUBLIC_ENGINE_WS_URL || "ws://localhost:8080/ws/live";
  const { currentCandle, positions, isConnected } = useMarketStream(wsUrl);

  const [selectedSkill, setSelectedSkill] = useState<TradingSkill | null>(null);
  const [checkedRules, setCheckedRules] = useState<Record<string, boolean>>({});
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSymbol, setActiveSymbol] = useState<string>("XAUUSD");
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const rules = selectedSkill?.rules_checklist ?? [];
  const allRequiredMet = rules
    .filter((r) => r.required)
    .every((r) => checkedRules[r.id]);

  useEffect(() => {
    fetchJournal();
    if (typeof window !== "undefined") {
      const sym = localStorage.getItem("hfm_symbol") || localStorage.getItem("active_symbol");
      if (sym) setActiveSymbol(sym);
    }
  }, []);

  const fetchJournal = useCallback(async () => {
    try {
      const res = await fetch("/api/journal");
      const data = await res.json();
      setJournalEntries(data.entries || []);
    } catch (err) {
      console.error("Failed to fetch journal entries:", err);
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

  const handleJournalSubmit = async (entry: JournalEntry) => {
    const res = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: entry.symbol,
        direction: entry.direction,
        entryPrice: entry.entryPrice,
        stopLoss: entry.stopLoss,
        takeProfit: entry.takeProfit,
        lotSize: entry.lotSize,
        notes: entry.notes,
        skillId: selectedSkill?.id,
        rulesCompliance: rules.map((r) => ({
          id: r.id,
          text: r.text,
          checked: !!checkedRules[r.id],
        })),
        aiValidationSummary: evaluation ? JSON.stringify(evaluation) : null,
      }),
    });
    if (!res.ok) {
      throw new Error("Failed to record trade entry");
    }
    await fetchJournal();
    showToast("Trade successfully logged to journal");
  };

  const currentPriceFormatted = currentCandle ? currentCandle.close.toFixed(2) : "---.--";

  return (
    <div className="min-h-screen bg-black text-neutral-100 font-sans antialiased selection:bg-[#00FF66]/20 selection:text-[#00FF66]">
      {/* Top Application Bar with Pure Shadcn Design & Electric Green Accents */}
      <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-black/95 px-5 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-mono font-semibold tracking-tight text-white text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-[#00FF66]/10 text-[10px] font-bold text-[#00FF66] border border-[#00FF66]/30 shadow-[0_0_8px_rgba(0,255,102,0.2)]">
                P
              </span>
              NEEDPIPS<span className="text-neutral-600 font-normal">/</span>FORPORSCHE
            </div>
            <div className="hidden sm:flex items-center gap-2 border-l border-neutral-800 pl-4 text-xs font-mono">
              <Badge variant="outline" className="border-neutral-800 bg-neutral-950 font-mono text-neutral-200">
                {activeSymbol}
              </Badge>
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
              <span>{isConnected ? "LIVE STREAM CONNECTED" : "OFFLINE / RECONNECTING"}</span>
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

      {/* Main Workspace Grid */}
      <div className="mx-auto max-w-7xl px-5 py-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Main Chart Section (8 cols) */}
          <div className="space-y-4 lg:col-span-8">
            <Card className="border-neutral-800 bg-black p-1 shadow-2xl overflow-hidden">
              <TradingViewChart currentCandle={currentCandle} positions={positions} symbol={activeSymbol} />
            </Card>

            {/* Metrics Overview Row */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 bg-[#0A0A0A] border-neutral-800">
                <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-neutral-500">
                  Data Stream Feed
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-neutral-200">
                  Binance / Massive WS
                </div>
              </Card>
              <Card className="p-3 bg-[#0A0A0A] border-neutral-800">
                <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-neutral-500">
                  Active Framework
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

            {/* AI Technical Evaluation Card */}
            {evaluation && (
              <Card className="border-neutral-800 bg-[#0A0A0A] p-4">
                <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-neutral-800">
                  <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    <Activity className="h-4 w-4 text-[#00FF66]" />
                    AI Quantitative Setup Evaluation
                  </CardTitle>
                  <Badge variant="electric">
                    {evaluation.rating} · Confidence {evaluation.confidence}%
                  </Badge>
                </CardHeader>
                <CardContent className="p-0 pt-3 space-y-2 text-xs leading-relaxed">
                  <div>
                    <span className="font-semibold text-neutral-400 font-mono text-[11px] uppercase">Thesis:</span>{" "}
                    <span className="text-neutral-200">{evaluation.thesis}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-neutral-400 font-mono text-[11px] uppercase">Invalidation:</span>{" "}
                    <span className="font-mono text-neutral-300">{evaluation.riskInvalidation}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-neutral-400 font-mono text-[11px] uppercase">Recommendation:</span>{" "}
                    <span className="text-neutral-200">{evaluation.recommendation}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Trade Journal Table Card */}
            <Card className="border-neutral-800 bg-[#0A0A0A] p-4">
              <CardHeader className="p-0 pb-3 flex flex-row items-center gap-2">
                <BookOpen className="h-4 w-4 text-neutral-400" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  Trade Performance Journal
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <JournalHistoryTable entries={journalEntries} />
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar: Rules & Discipline Execution Checklist (4 cols) */}
          <div className="space-y-4 lg:col-span-4">
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
                    Load Quantitative Skill
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
                          <span>Evaluate Setup Rationality</span>
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

            {/* Manual Journal Entry Card */}
            {selectedSkill && (
              <Card className="border-neutral-800 bg-[#0A0A0A] p-4">
                <CardHeader className="p-0 pb-3 flex flex-row items-center gap-2 border-b border-neutral-800">
                  <Plus className="h-4 w-4 text-neutral-400" />
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Record Trade to Journal
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 pt-3">
                  <TradeJournalForm
                    skillId={selectedSkill.id}
                    rulesCompliance={rules.map((r) => ({
                      id: r.id,
                      text: r.text,
                      checked: !!checkedRules[r.id],
                    }))}
                    onSubmit={handleJournalSubmit}
                  />
                </CardContent>
              </Card>
            )}
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
