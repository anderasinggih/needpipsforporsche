"use client";

import React, { useState, useEffect, useCallback } from "react";
import { TradingViewChart, Position } from "@/components/chart/TradingViewChart";
import { useMarketStream } from "@/hooks/useMarketStream";
import { SkillChecklistModal, TradingSkill } from "@/components/skills/SkillChecklistModal";
import { TradeJournalForm, JournalEntry } from "@/components/journal/TradeJournalForm";
import { JournalHistoryTable } from "@/components/journal/JournalHistoryTable";
import {
  ShieldCheck,
  Key,
  Sparkles,
  BookOpen,
  Plus,
  Loader2,
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
  }, []);

  const fetchJournal = useCallback(async () => {
    try {
      const res = await fetch("/api/journal");
      const data = await res.json();
      setJournalEntries(data.entries || []);
    } catch (err) {
      console.error("Failed to fetch journal:", err);
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
    showToast(`Skill loaded: ${skill.title}`);
  };

  const handleEvaluate = async () => {
    if (!currentCandle || !selectedSkill) return;
    try {
      setIsEvaluating(true);
      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "XAUUSD",
          price: currentCandle.close,
          direction: "BUY",
          checklistMet: allRequiredMet,
          indicatorsSummary: `Live 1m candle O:${currentCandle.open.toFixed(2)} H:${currentCandle.high.toFixed(2)} L:${currentCandle.low.toFixed(2)} C:${currentCandle.close.toFixed(2)}`,
          rules: rules.map((r) => ({ ...r, checked: !!checkedRules[r.id] })),
        }),
      });
      const data = await res.json();
      setEvaluation(data.evaluation);
    } catch (err) {
      console.error("Evaluation failed:", err);
      showToast("AI evaluation failed");
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
        aiValidationSummary: evaluation
          ? JSON.stringify(evaluation)
          : null,
      }),
    });
    if (!res.ok) {
      throw new Error("Failed to save trade journal entry");
    }
    await fetchJournal();
    showToast("Trade journal entry saved");
  };

  return (
    <main className="min-h-screen bg-[#090A0F] text-slate-200">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-[#0D0F17]/90 px-6 py-3.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-lg font-black text-amber-400">
              911
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide text-white">
                NEEDPIPS<span className="text-amber-400">FORPORSCHE</span>
              </h1>
              <p className="text-[10px] tracking-wider text-slate-400">
                XAU/USD INTELLIGENCE &amp; DISCIPLINE HUB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-border bg-[#141724] px-3 py-1">
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "animate-pulse bg-emerald-500" : "bg-red-500"
                }`}
              />
              <span className="text-xs font-medium text-slate-300">
                {isConnected ? "HFM FEED ACTIVE" : "RECONNECTING"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <TradingViewChart currentCandle={currentCandle} positions={positions} />

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="text-xs text-slate-400">TARGET PAIR</div>
                <div className="mt-1 text-lg font-bold text-white">XAU/USD (Gold)</div>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="text-xs text-slate-400">ACTIVE STRATEGY</div>
                <div className="mt-1 truncate text-lg font-bold text-amber-400">
                  {selectedSkill ? selectedSkill.title : "No Skill Selected"}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="text-xs text-slate-400">TARGET RR MIN</div>
                <div className="mt-1 text-lg font-bold text-emerald-400">
                  1 : {selectedSkill?.risk_reward_min ?? 2.5}
                </div>
              </div>
            </div>

            {evaluation && (
              <div className="rounded-xl border border-amber-500/30 bg-surface p-5 shadow-xl">
                <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    AI Setup Evaluation
                  </h2>
                  <span className="ml-auto rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-400">
                    {evaluation.rating} · {evaluation.confidence}%
                  </span>
                </div>
                <div className="mt-4 space-y-3 text-xs leading-relaxed">
                  <div>
                    <span className="font-bold uppercase text-slate-400">Thesis:</span>{" "}
                    <span className="text-slate-200">{evaluation.thesis}</span>
                  </div>
                  <div>
                    <span className="font-bold uppercase text-slate-400">Invalidation:</span>{" "}
                    <span className="text-red-400">{evaluation.riskInvalidation}</span>
                  </div>
                  <div>
                    <span className="font-bold uppercase text-slate-400">Recommendation:</span>{" "}
                    <span className="text-emerald-400">{evaluation.recommendation}</span>
                  </div>
                  <div className="border-t border-border/40 pt-2 text-[11px] text-slate-500">
                    {evaluation.notes}
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Trade Journal History
                </h2>
              </div>
              <JournalHistoryTable entries={journalEntries} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-amber-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    Execution Checklist
                  </h2>
                </div>
                <button
                  onClick={() => setIsSkillModalOpen(true)}
                  className="flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase text-amber-400 transition hover:bg-amber-500/20"
                >
                  <Key className="h-3 w-3" />
                  Skill
                </button>
              </div>

              {!selectedSkill ? (
                <button
                  onClick={() => setIsSkillModalOpen(true)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-6 text-xs uppercase tracking-wider text-slate-400 transition hover:border-amber-500/40 hover:text-amber-400"
                >
                  <Plus className="h-4 w-4" />
                  Load Trading Skill
                </button>
              ) : (
                <>
                  <div className="mt-4 space-y-3">
                    {rules.map((rule) => (
                      <label
                        key={rule.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/40 bg-[#0E1018] p-3 transition hover:border-amber-500/40"
                      >
                        <input
                          type="checkbox"
                          checked={!!checkedRules[rule.id]}
                          onChange={() => toggleRule(rule.id)}
                          className="mt-0.5 h-4 w-4 rounded border-border bg-background text-amber-500 focus:ring-amber-400 focus:ring-offset-0"
                        />
                        <span className="text-xs font-medium leading-relaxed text-slate-300">
                          {rule.text}
                          {rule.required && (
                            <span className="ml-2 text-[9px] font-bold uppercase text-red-400">
                              Required
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={handleEvaluate}
                    disabled={!allRequiredMet || isEvaluating}
                    className={`mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-xs font-bold uppercase tracking-wider transition ${
                      allRequiredMet
                        ? "bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/20"
                        : "cursor-not-allowed bg-border text-slate-500"
                    }`}
                  >
                    {isEvaluating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Evaluating...
                      </>
                    ) : (
                      "Validate Setup with AI"
                    )}
                  </button>

                  {!allRequiredMet && (
                    <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-red-400">
                      Check all required rules to unlock
                    </p>
                  )}
                </>
              )}
            </div>

            {selectedSkill && allRequiredMet && (
              <TradeJournalForm
                skillId={selectedSkill.id}
                rulesCompliance={rules.map((r) => ({
                  id: r.id,
                  text: r.text,
                  checked: !!checkedRules[r.id],
                }))}
                onSubmit={handleJournalSubmit}
              />
            )}
          </div>
        </div>
      </div>

      <SkillChecklistModal
        isOpen={isSkillModalOpen}
        onClose={() => setIsSkillModalOpen(false)}
        onSkillSelect={handleSkillSelect}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-amber-500/30 bg-[#12141C] px-4 py-2.5 text-xs font-medium text-amber-400 shadow-2xl">
          {toast}
        </div>
      )}
    </main>
  );
}
