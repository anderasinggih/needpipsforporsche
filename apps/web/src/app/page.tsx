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
  Flame,
  Radio,
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
          symbol: activeSymbol,
          price: currentCandle.close,
          direction: "BUY",
          checklistMet: allRequiredMet,
          indicatorsSummary: `${activeSymbol} 1m bar Open: ${currentCandle.open.toFixed(2)}, High: ${currentCandle.high.toFixed(2)}, Low: ${currentCandle.low.toFixed(2)}, Close: ${currentCandle.close.toFixed(2)}`,
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

  const currentPriceFormatted = currentCandle ? currentCandle.close.toFixed(2) : "---.--";

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 font-sans antialiased selection:bg-zinc-700 selection:text-white">
      {/* Top Application Bar with Pure Shadcn Design */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#0E1117]/95 px-5 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-mono font-semibold tracking-tight text-white text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/20 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                P
              </span>
              NEEDPIPS<span className="text-zinc-500 font-normal">/</span>FORPORSCHE
            </div>
            <div className="hidden sm:flex items-center gap-2 border-l border-zinc-800 pl-4 text-xs text-zinc-400 font-mono">
              <Badge variant="outline" className="text-zinc-200 bg-zinc-900/60 font-mono">
                {activeSymbol}
              </Badge>
              <span className="text-zinc-600">·</span>
              <span className="font-semibold text-amber-400 font-mono">${currentPriceFormatted}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant={isConnected ? "success" : "secondary"}
              className="flex items-center gap-1.5 py-1 px-2.5 text-[11px]"
            >
              <Radio className={`h-3 w-3 ${isConnected ? "animate-pulse text-emerald-400" : "text-zinc-500"}`} />
              <span>{isConnected ? "MASSIVE CLOUD FEED ACTIVE" : "OFFLINE / CONNECTING"}</span>
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center gap-1.5 border-zinc-750 bg-zinc-900/80 hover:bg-zinc-800 hover:text-white"
            >
              <Settings className="h-3.5 w-3.5 text-zinc-400" />
              <span>Settings &amp; Keys</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <div className="mx-auto max-w-7xl px-5 py-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Main Chart Section (8 cols) */}
          <div className="space-y-4 lg:col-span-8">
            <Card className="border-zinc-800 bg-[#0D0F17] p-1.5 shadow-2xl overflow-hidden">
              <TradingViewChart currentCandle={currentCandle} positions={positions} symbol={activeSymbol} />
            </Card>

            {/* Metric Row */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 bg-zinc-900/40 border-zinc-800">
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Feed Source</div>
                <div className="mt-1 font-mono text-sm font-semibold text-zinc-200">Massive.com Cloud WS</div>
              </Card>
              <Card className="p-3 bg-zinc-900/40 border-zinc-800">
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Strategi Terpilih</div>
                <div className="mt-1 truncate text-sm font-medium text-zinc-200">
                  {selectedSkill ? selectedSkill.title : "Pilih Skill..."}
                </div>
              </Card>
              <Card className="p-3 bg-zinc-900/40 border-zinc-800">
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Min. Risk:Reward</div>
                <div className="mt-1 font-mono text-sm font-semibold text-zinc-300">
                  1 : {selectedSkill?.risk_reward_min ?? 2.5}
                </div>
              </Card>
            </div>

            {/* AI Technical Context Card */}
            {evaluation && (
              <Card className="border-zinc-700 bg-zinc-900/60 p-4">
                <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-zinc-800">
                  <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    <Activity className="h-4 w-4 text-zinc-400" />
                    Analisis Rasionalitas Setup
                  </CardTitle>
                  <Badge variant="live">
                    {evaluation.rating} · Conf {evaluation.confidence}%
                  </Badge>
                </CardHeader>
                <CardContent className="p-0 pt-3 space-y-2 text-xs leading-relaxed">
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
                </CardContent>
              </Card>
            )}

            {/* Trade Journal Table Card */}
            <Card className="border-zinc-800 bg-[#12151D] p-4">
              <CardHeader className="p-0 pb-3 flex flex-row items-center gap-2">
                <BookOpen className="h-4 w-4 text-zinc-400" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Riwayat Trade Journal
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <JournalHistoryTable entries={journalEntries} />
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar: Rules & Discipline Execution Checklist (4 cols) */}
          <div className="space-y-4 lg:col-span-4">
            <Card className="border-zinc-800 bg-[#12151D] p-4">
              <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-zinc-400" />
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                    Discipline Checklist
                  </CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSkillModalOpen(true)}
                  className="h-7 text-[11px] px-2.5 bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
                >
                  Pilih Skill
                </Button>
              </CardHeader>

              {!selectedSkill ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-zinc-500">Belum ada strategi trading yang dimuat.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSkillModalOpen(true)}
                    className="mt-3 text-xs border-dashed border-zinc-700"
                  >
                    Muat Skill Trading
                  </Button>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="rounded bg-zinc-900/60 p-2.5 border border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-200 text-xs">{selectedSkill.title}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {selectedSkill.timeframes?.join(", ") || "M1 / M5"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400 leading-normal">
                      {selectedSkill.description}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                      Rules Checklist ({Object.values(checkedRules).filter(Boolean).length}/{rules.length})
                    </div>
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        onClick={() => toggleRule(rule.id)}
                        className={`flex cursor-pointer items-start gap-2.5 rounded border p-2 text-xs transition ${
                          checkedRules[rule.id]
                            ? "border-emerald-800/60 bg-emerald-950/20 text-emerald-300"
                            : "border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            checkedRules[rule.id]
                              ? "border-emerald-500 bg-emerald-600 text-white"
                              : "border-zinc-700 bg-zinc-800"
                          }`}
                        >
                          {checkedRules[rule.id] && <CheckCircle2 className="h-3 w-3" />}
                        </div>
                        <div className="leading-tight">
                          <span>{rule.text}</span>
                          {rule.required && (
                            <span className="ml-1 text-[10px] text-amber-500 font-mono">(wajib)</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Evaluation Button */}
                  <div className="pt-2">
                    <Button
                      onClick={handleEvaluate}
                      disabled={!allRequiredMet || isEvaluating}
                      variant={allRequiredMet ? "porsche" : "secondary"}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      {isEvaluating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Menganalisis Setup AI...</span>
                        </>
                      ) : (
                        <>
                          <Flame className="h-3.5 w-3.5" />
                          <span>Evaluasi Rasionalitas Setup</span>
                        </>
                      )}
                    </Button>
                    {!allRequiredMet && (
                      <p className="mt-1.5 text-center text-[11px] text-zinc-500">
                        Lengkapi semua checklist wajib untuk membuka validasi AI
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {/* Manual Journal Entry Form */}
            {selectedSkill && (
              <Card className="border-zinc-800 bg-[#12151D] p-4">
                <CardHeader className="p-0 pb-3 flex flex-row items-center gap-2 border-b border-zinc-800">
                  <Plus className="h-4 w-4 text-zinc-400" />
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Catat Jurnal Manual
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
        <div className="fixed bottom-5 right-5 z-50 rounded border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs text-zinc-200 shadow-lg font-mono">
          {toast}
        </div>
      )}
    </div>
  );
}
