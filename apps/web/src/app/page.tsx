"use client";

import React, { useState, useEffect, useCallback } from "react";
import { TradingViewChart, Position } from "@/components/chart/TradingViewChart";
import { useMarketStream } from "@/hooks/useMarketStream";
import { SkillChecklistModal, TradingSkill } from "@/components/skills/SkillChecklistModal";
import { TradeJournalForm, JournalEntry } from "@/components/journal/TradeJournalForm";
import { JournalHistoryTable } from "@/components/journal/JournalHistoryTable";
import { TradeExecutionModal } from "@/components/trade/TradeExecutionModal";
import { SettingsModal } from "@/components/settings/SettingsModal";
import {
  ShieldCheck,
  Key,
  Sparkles,
  BookOpen,
  Plus,
  Loader2,
  TrendingUp,
  Activity,
  CheckCircle2,
  Layers,
  Send,
  Zap,
  Settings,
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

  // Trade Execution Modal State
  const [isExecModalOpen, setIsExecModalOpen] = useState(false);
  const [execDirection, setExecDirection] = useState<"BUY" | "SELL">("BUY");
  const [isExecuting, setIsExecuting] = useState(false);

  const rules = selectedSkill?.rules_checklist ?? [];
  const allRequiredMet = rules
    .filter((r) => r.required)
    .every((r) => checkedRules[r.id]);

  useEffect(() => {
    fetchJournal();
    if (typeof window !== "undefined") {
      const sym = localStorage.getItem("hfm_symbol");
      if (sym) setActiveSymbol(sym);
    }
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
    showToast(`Skill aktif: ${skill.title}`);
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
          symbol: "XAUUSD",
          price: currentCandle.close,
          direction: "BUY",
          checklistMet: allRequiredMet,
          indicatorsSummary: `XAU/USD 1m bar Open: ${currentCandle.open.toFixed(2)}, High: ${currentCandle.high.toFixed(2)}, Low: ${currentCandle.low.toFixed(2)}, Close: ${currentCandle.close.toFixed(2)}`,
          rules: rules.map((r) => ({ ...r, checked: !!checkedRules[r.id] })),
        }),
      });
      const data = await res.json();
      setEvaluation(data.evaluation);
    } catch (err) {
      console.error("Evaluation failed:", err);
      showToast("Evaluasi AI gagal");
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
      throw new Error("Gagal menyimpan jurnal");
    }
    await fetchJournal();
    showToast("Trade berhasil dicatat ke jurnal");
  };

  const handleExecuteTrade = async (volume: number, sl: number, tp: number) => {
    try {
      setIsExecuting(true);
      const res = await fetch("/api/trade/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "XAUUSD",
          action: execDirection,
          volume,
          sl,
          tp,
          magic: 911911,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const ticket = data.result?.order || data.result?.ticket || "N/A";
        showToast(`Order ${execDirection} ${volume} XAUUSD Berhasil! Ticket #${ticket}`);
        setIsExecModalOpen(false);
        try {
          await fetch("/api/journal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              symbol: "XAUUSD",
              direction: execDirection,
              entryPrice: currentCandle?.close ?? 2650.0,
              stopLoss: sl,
              takeProfit: tp,
              lotSize: volume,
              status: "OPEN",
              skillId: selectedSkill?.id,
              rulesCompliance: rules.map((r) => ({ id: r.id, text: r.text, checked: !!checkedRules[r.id] })),
              aiValidationSummary: evaluation ? JSON.stringify(evaluation) : null,
              notes: `Order otomatis dari live trade execution (Ticket: ${ticket})`,
            }),
          });
          await fetchJournal();
        } catch (e) {
          console.error("Auto-journal failed:", e);
        }
      } else {
        showToast(`Eksekusi gagal: ${data.error || "Cek terminal MT5"}`);
      }
    } catch (err) {
      showToast("Gagal mengirim order ke MT5 bridge");
    } finally {
      setIsExecuting(false);
    }
  };

  const currentPriceFormatted = currentCandle ? currentCandle.close.toFixed(2) : "---.--";

  return (
    <div className="min-h-screen bg-[#0E1117] text-zinc-100 font-sans antialiased selection:bg-zinc-700 selection:text-white">
      {/* Top Application Bar - Clean & Utilitarian */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#0E1117]/95 px-5 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-mono font-semibold tracking-tight text-white text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 text-[10px] font-bold text-zinc-300 border border-zinc-700">
                P
              </span>
              NEEDPIPS<span className="text-zinc-500 font-normal">/</span>FORPORSCHE
            </div>
            <div className="hidden sm:flex items-center gap-2 border-l border-zinc-800 pl-4 text-xs text-zinc-400 font-mono">
              <span className="font-bold text-zinc-300">{activeSymbol}</span>
              <span className="text-zinc-600">·</span>
              <span className="font-semibold text-zinc-200">${currentPriceFormatted}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs font-mono">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isConnected ? "bg-emerald-500" : "bg-zinc-500"
                }`}
              />
              <span className="text-zinc-400 text-[11px]">
                {isConnected ? "HFM BRIDGE ACTIVE" : "OFFLINE / MOCK"}
              </span>
            </div>

            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-850 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
              title="Pengaturan Akun & API Keys"
            >
              <Settings className="h-3.5 w-3.5 text-zinc-400" />
              <span>Settings &amp; Keys</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="mx-auto max-w-7xl px-5 py-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Main Chart Section (8 cols) */}
          <div className="space-y-4 lg:col-span-8">
            <div className="rounded border border-zinc-800 bg-[#12151D] p-1 shadow-sm">
              <TradingViewChart currentCandle={currentCandle} positions={positions} symbol={activeSymbol} />
            </div>

            {/* Metric Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Instrumen</div>
                <div className="mt-1 font-mono text-sm font-semibold text-zinc-200">{activeSymbol}</div>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Strategi Terpilih</div>
                <div className="mt-1 truncate text-sm font-medium text-zinc-200">
                  {selectedSkill ? selectedSkill.title : "Pilih Skill..."}
                </div>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Min. Risk:Reward</div>
                <div className="mt-1 font-mono text-sm font-semibold text-zinc-300">
                  1 : {selectedSkill?.risk_reward_min ?? 2.5}
                </div>
              </div>
            </div>

            {/* AI Technical Context Card */}
            {evaluation && (
              <div className="rounded border border-zinc-700 bg-zinc-900/60 p-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    <Activity className="h-4 w-4 text-zinc-400" />
                    Analisis Rasionalitas Setup
                  </div>
                  <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-300 border border-zinc-700">
                    {evaluation.rating} · Conf {evaluation.confidence}%
                  </span>
                </div>
                <div className="mt-3 space-y-2 text-xs leading-relaxed">
                  <div>
                    <span className="font-semibold text-zinc-400">Thesis:</span>{" "}
                    <span className="text-zinc-200">{evaluation.thesis}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-400">Invalidasi:</span>{" "}
                    <span className="font-mono text-zinc-300">{evaluation.riskInvalidation}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-400">Rekomendasi:</span>{" "}
                    <span className="text-zinc-200">{evaluation.recommendation}</span>
                  </div>

                  {/* Clean Execution Trigger Buttons */}
                  <div className="mt-4 flex items-center gap-2 pt-2 border-t border-zinc-800/80">
                    <button
                      onClick={() => { setExecDirection("BUY"); setIsExecModalOpen(true); }}
                      className="flex items-center gap-1.5 rounded bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 active:scale-[0.98]"
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                      Eksekusi Buy HFM
                    </button>
                    <button
                      onClick={() => { setExecDirection("SELL"); setIsExecModalOpen(true); }}
                      className="flex items-center gap-1.5 rounded bg-rose-600 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500 active:scale-[0.98]"
                    >
                      <TrendingUp className="h-3.5 w-3.5 rotate-180" />
                      Eksekusi Sell HFM
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Trade Journal Table */}
            <div className="rounded border border-zinc-800 bg-[#12151D] p-4">
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-zinc-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Riwayat Trade Journal
                </h3>
              </div>
              <JournalHistoryTable entries={journalEntries} />
            </div>
          </div>

          {/* Right Sidebar: Rules & Discipline Execution Checklist (4 cols) */}
          <div className="space-y-4 lg:col-span-4">
            <div className="rounded border border-zinc-800 bg-[#12151D] p-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-zinc-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                    Discipline Checklist
                  </h3>
                </div>
                <button
                  onClick={() => setIsSkillModalOpen(true)}
                  className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-zinc-700"
                >
                  Pilih Skill
                </button>
              </div>

              {!selectedSkill ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-zinc-500">Belum ada strategi trading yang dimuat.</p>
                  <button
                    onClick={() => setIsSkillModalOpen(true)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Pilih Template Skill
                  </button>
                </div>
              ) : (
                <div className="mt-3">
                  <div className="mb-3 flex items-center justify-between text-xs text-zinc-400">
                    <span className="truncate font-medium text-zinc-200">{selectedSkill.title}</span>
                    <span className="font-mono text-[11px]">
                      {Object.values(checkedRules).filter(Boolean).length}/{rules.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {rules.map((rule) => (
                      <label
                        key={rule.id}
                        className="flex cursor-pointer items-start gap-2.5 rounded border border-zinc-800/80 bg-zinc-900/40 p-2.5 text-xs transition hover:border-zinc-700"
                      >
                        <input
                          type="checkbox"
                          checked={!!checkedRules[rule.id]}
                          onChange={() => toggleRule(rule.id)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800 text-zinc-200 focus:ring-0"
                        />
                        <span className="text-zinc-300 leading-snug">
                          {rule.text}
                          {rule.required && (
                            <span className="ml-1.5 font-mono text-[10px] text-zinc-500 uppercase">
                              (Wajib)
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={handleEvaluate}
                    disabled={!allRequiredMet || isEvaluating}
                    className={`mt-4 flex w-full items-center justify-center gap-1.5 rounded py-2 text-xs font-medium transition ${
                      allRequiredMet
                        ? "bg-zinc-200 text-zinc-900 hover:bg-white active:scale-[0.99]"
                        : "cursor-not-allowed bg-zinc-800/60 text-zinc-600"
                    }`}
                  >
                    {isEvaluating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Menganalisis...
                      </>
                    ) : (
                      "Evaluasi Confluence Setup"
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Quick Journal Form when Rules Met */}
            {selectedSkill && allRequiredMet && (
              <div className="rounded border border-zinc-800 bg-[#12151D] p-4">
                <TradeJournalForm
                  skillId={selectedSkill.id}
                  rulesCompliance={rules.map((r) => ({
                    id: r.id,
                    text: r.text,
                    checked: !!checkedRules[r.id],
                  }))}
                  onSubmit={handleJournalSubmit}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <SkillChecklistModal
        isOpen={isSkillModalOpen}
        onClose={() => setIsSkillModalOpen(false)}
        onSkillSelect={handleSkillSelect}
      />

      <TradeExecutionModal
        isOpen={isExecModalOpen}
        onClose={() => setIsExecModalOpen(false)}
        onConfirm={handleExecuteTrade}
        symbol={activeSymbol}
        direction={execDirection}
        entryPrice={currentCandle?.close ?? 2650.0}
        stopLoss={execDirection === "BUY" ? (currentCandle?.close ?? 2650) - 5 : (currentCandle?.close ?? 2650) + 5}
        takeProfit={execDirection === "BUY" ? (currentCandle?.close ?? 2650) + 12.5 : (currentCandle?.close ?? 2650) - 12.5}
        isExecuting={isExecuting}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => {
          setIsSettingsModalOpen(false);
          const sym = localStorage.getItem("hfm_symbol");
          if (sym) setActiveSymbol(sym);
        }}
        onSaved={(msg) => {
          showToast(msg);
          const sym = localStorage.getItem("hfm_symbol");
          if (sym) setActiveSymbol(sym);
        }}
      />

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs text-zinc-200 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
