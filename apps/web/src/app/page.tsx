"use client";

import React, { useState, useEffect } from "react";
import { TradingViewChart, AIMapping, AISignalOverlay } from "@/components/chart/TradingViewChart";
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
  Crosshair,
  Target,
  Compass,
} from "lucide-react";

interface EvaluationResult {
  signal?: "BUY" | "SELL" | "WAIT";
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  riskRewardRatio?: string;
  confidence: number;
  thesis: string;
  riskInvalidation: string;
  chartMapping?: AIMapping;
  recommendation: string;
  notes: string;
}

export default function DashboardPage() {
  const [activeSymbol, setActiveSymbol] = useState<string>("BTCUSD");
  const [timeframe, setTimeframe] = useState<string>("1m");
  const [isClientLoaded, setIsClientLoaded] = useState(false);

  const { currentCandle, historicalCandles, positions, isConnected, lastTickTimestamp } = useMarketStream(activeSymbol, timeframe);
  
  const [selectedSkill, setSelectedSkill] = useState<TradingSkill | null>(null);
  const [checkedRules, setCheckedRules] = useState<Record<string, boolean>>({});
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const rules = selectedSkill?.rules_checklist ?? [];
  const allRequiredMet = rules.length === 0 || rules
    .filter((r) => r.required)
    .every((r) => checkedRules[r.id]);

  useEffect(() => {
    setIsClientLoaded(true);
    if (typeof window !== "undefined") {
      const sym = localStorage.getItem("active_symbol");
      if (sym === "XAUUSD" || sym === "BTCUSD") {
        setActiveSymbol(sym);
      }
      const tf = localStorage.getItem("active_timeframe");
      if (tf) setTimeframe(tf);
    }
  }, []);

  const handleSymbolChange = (sym: string) => {
    setActiveSymbol(sym);
    setEvaluation(null);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_symbol", sym);
    }
    showToast(`Instrumen: ${sym}`);
  };

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
    setEvaluation(null);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_timeframe", tf);
    }
    showToast(`Timeframe: ${tf.toUpperCase()}`);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const toggleRule = (id: string) => {
    setCheckedRules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSkillSelect = (skill: TradingSkill) => {
    setSelectedSkill(skill);
    setCheckedRules({});
    setEvaluation(null);
    setIsSkillModalOpen(false);
    showToast(`Strategi: ${skill.title}`);
  };

  const handleEvaluate = async () => {
    if (!currentCandle) {
      showToast("Menunggu data harga pasar...");
      return;
    }
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
          timeframe,
          checklistMet: allRequiredMet,
          indicatorsSummary: `${activeSymbol} ${timeframe.toUpperCase()} @ ${currentCandle.close.toFixed(2)}`,
          candles: historicalCandles.slice(-25),
        }),
      });

      const data = await res.json();
      if (data.evaluation) {
        setEvaluation(data.evaluation);
        showToast(`AI Selesai Analisa & Mapping untuk ${activeSymbol}!`);
      }
    } catch (err) {
      console.error("Evaluation failed:", err);
      showToast("Gagal melakukan analisa AI");
    } finally {
      setIsEvaluating(false);
    }
  };

  const currentPriceFormatted = currentCandle ? currentCandle.close.toFixed(2) : "---.--";

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans antialiased selection:bg-[#1E40AF]/30 selection:text-white">
      {/* Top Application Bar - Shadcn Styled with MT5 Royal Blue Accents */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#060D1F]/90 px-6 py-2.5 backdrop-blur shadow-md">
        <div className="mx-auto flex w-full items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-mono font-semibold tracking-tight text-white text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-[#1E40AF] text-[10px] font-bold text-white border border-[#3B82F6]/50 shadow-[0_0_10px_rgba(30,64,175,0.5)]">
                M
              </span>
              NEEDPIPS<span className="text-slate-600 font-normal">/</span>FORPORSCHE
            </div>
            <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-4 text-xs font-mono">
              {/* Pair Switcher */}
              <div className="flex items-center rounded-md bg-slate-950 p-0.5 border border-slate-800">
                <button
                  onClick={() => handleSymbolChange("BTCUSD")}
                  className={`px-2.5 py-0.5 text-[11px] font-mono font-bold rounded transition-all ${
                    activeSymbol === "BTCUSD"
                      ? "bg-[#1E40AF] text-white shadow-[0_0_10px_rgba(30,64,175,0.6)] border border-[#3B82F6]/60"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  BTCUSD
                </button>
                <button
                  onClick={() => handleSymbolChange("XAUUSD")}
                  className={`px-2.5 py-0.5 text-[11px] font-mono font-bold rounded transition-all ${
                    activeSymbol === "XAUUSD"
                      ? "bg-[#1E40AF] text-white shadow-[0_0_10px_rgba(30,64,175,0.6)] border border-[#3B82F6]/60"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  XAUUSD
                </button>
              </div>
              <span className="text-slate-700">·</span>
              <span className="font-semibold text-[#60A5FA] font-mono tracking-wide text-xs">
                ${currentPriceFormatted}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="flex items-center gap-1.5 py-1 px-2.5 text-[10px] font-mono border-slate-800 bg-slate-950 text-slate-300"
            >
              <Radio className={`h-3 w-3 ${isConnected ? "text-[#3B82F6]" : "text-slate-500"}`} />
              <span>{isConnected ? "LIVE FEED" : "CONNECTING..."}</span>
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center gap-1.5 border-slate-800 bg-slate-950 hover:bg-slate-900 hover:border-slate-700 hover:text-white text-xs h-8 text-slate-300"
            >
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              <span>Settings</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Full-Width Workspace Layout */}
      <div className="w-full px-5 py-4 space-y-4">
        {/* Full-Width Chart Section */}
        <Card className="border-slate-800/80 bg-black p-1 shadow-2xl overflow-hidden">
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
                  }
                : null
            }
          />
        </Card>

        {/* Bottom Split Grid: Metrics, AI Evaluator & Discipline Sidebar */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left Column: Stream Info & AI Mapping / Reasoning Panel (7 cols) */}
          <div className="space-y-4 lg:col-span-7">
            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 bg-[#060D1F] border-slate-800">
                <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-slate-400">
                  Data Feed
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-slate-200">
                  Binance {timeframe.toUpperCase()}
                </div>
              </Card>
              <Card className="p-3 bg-[#060D1F] border-slate-800">
                <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-slate-400">
                  Strategi
                </div>
                <div className="mt-1 truncate text-xs font-medium text-slate-200">
                  {selectedSkill ? selectedSkill.title : "Pilih Strategi..."}
                </div>
              </Card>
              <Card className="p-3 bg-[#060D1F] border-slate-800">
                <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-slate-400">
                  Risk / Reward
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-[#60A5FA]">
                  1 : {selectedSkill?.risk_reward_min ?? 2.5}
                </div>
              </Card>
            </div>

            {/* AI Technical Evaluation, Mapping & Trade Signal Card */}
            <Card className="border-slate-800 bg-[#060D1F] p-4 shadow-xl">
              <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-slate-800">
                <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-200">
                  <Compass className="h-4 w-4 text-[#3B82F6]" />
                  AI Quant Mapping &amp; Sinyal Entry
                </CardTitle>
                {evaluation?.signal && (
                  <Badge className={`font-mono text-xs font-bold ${
                    evaluation.signal === "BUY"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : evaluation.signal === "SELL"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  }`}>
                    SINYAL: {evaluation.signal} · Konfidensi {evaluation.confidence}%
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="p-0 pt-3">
                {evaluation ? (
                  <div className="space-y-3 text-xs leading-relaxed">
                    {/* Kotak Saran Entry, SL, dan TP */}
                    {evaluation.entryPrice && (
                      <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-black/80 border border-slate-800">
                        <div className="text-center border-r border-slate-800/80 pr-2">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">Saran Entry</span>
                          <div className="text-sm font-mono font-bold text-white mt-0.5">
                            ${evaluation.entryPrice.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-center border-r border-slate-800/80 pr-2">
                          <span className="text-[10px] font-mono text-rose-400 uppercase">Stop Loss (SL)</span>
                          <div className="text-sm font-mono font-bold text-rose-400 mt-0.5">
                            ${evaluation.stopLoss?.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] font-mono text-emerald-400 uppercase">Take Profit (TP)</span>
                          <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                            ${evaluation.takeProfit?.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tesis & Analisa Pasar */}
                    <div className="rounded border border-slate-800/80 bg-black/60 p-3">
                      <div className="font-semibold text-slate-400 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="h-3 w-3 text-[#3B82F6]" />
                        Tesis Analisis Struktur Pasar ({activeSymbol} · {timeframe.toUpperCase()})
                      </div>
                      <p className="mt-1 text-slate-200 leading-relaxed">{evaluation.thesis}</p>
                    </div>

                    {/* Pembatalan Skenario & Rekomendasi Eksekusi */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded border border-slate-800/80 bg-black/60 p-3">
                        <div className="font-semibold text-rose-400 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                          <Crosshair className="h-3 w-3" />
                          Level Pembatalan (Invalidation)
                        </div>
                        <p className="mt-1 font-mono text-slate-300 text-[11px]">{evaluation.riskInvalidation}</p>
                      </div>
                      <div className="rounded border border-slate-800/80 bg-black/60 p-3">
                        <div className="font-semibold text-[#60A5FA] font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                          <Target className="h-3 w-3" />
                          Rekomendasi Tindakan
                        </div>
                        <p className="mt-1 text-slate-200 text-[11px]">{evaluation.recommendation}</p>
                      </div>
                    </div>

                    {/* Info Mapping Chart MT5 yang sudah terpasang */}
                    {evaluation.chartMapping && (
                      <div className="rounded border border-[#1E40AF]/40 bg-[#1E40AF]/10 p-2.5 text-[11px] font-mono text-slate-300 flex items-center justify-between">
                        <span className="text-[#60A5FA] font-semibold">📍 Garis Mapping Terpasang di Chart:</span>
                        <span>
                          Support: <strong className="text-[#60A5FA]">${evaluation.chartMapping.supportLevel}</strong> · Resistance: <strong className="text-amber-400">${evaluation.chartMapping.resistanceLevel}</strong>
                        </span>
                      </div>
                    )}

                    {evaluation.notes && (
                      <div className="rounded border border-slate-800/80 bg-black/60 p-3">
                        <div className="font-semibold text-slate-400 font-mono text-[10px] uppercase tracking-wider">Catatan Risiko &amp; Psikologi</div>
                        <p className="mt-1 text-slate-300 font-mono text-[11px]">{evaluation.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <Sparkles className="mx-auto h-8 w-8 text-[#3B82F6]/40" />
                    <p className="mt-2 text-xs text-slate-300 font-medium">AI Siap Melakukan Analisa</p>
                    <p className="mt-1 text-[11px] text-slate-500 max-w-sm mx-auto">
                      Klik tombol &quot;Analisa &amp; Pasang Mapping AI&quot; untuk memetakan garis tren, level likuiditas, dan sinyal entry otomatis di chart.
                    </p>
                    <Button
                      onClick={handleEvaluate}
                      disabled={isEvaluating}
                      className="mt-4 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-semibold text-xs transition border border-[#3B82F6]/50 shadow-[0_0_12px_rgba(30,64,175,0.4)]"
                    >
                      {isEvaluating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          Sedang Memetakan &amp; Menganalisa...
                        </>
                      ) : (
                        <>
                          <Compass className="h-3.5 w-3.5 mr-1.5" />
                          Mulai Analisa &amp; Mapping AI Sekarang
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Discipline Checklist & Strategy Framework (5 cols) */}
          <div className="space-y-4 lg:col-span-5">
            <Card className="border-slate-800 bg-[#060D1F] p-4">
              <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#3B82F6]" />
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                    Disiplin Trading &amp; Strategi
                  </CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSkillModalOpen(true)}
                  className="h-7 text-[11px] px-2.5 bg-slate-950 border-slate-800 hover:bg-slate-900 hover:border-slate-700 text-slate-300 hover:text-white"
                >
                  Pilih Strategi
                </Button>
              </CardHeader>

              {!selectedSkill ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-slate-500">Belum ada strategi trading yang dipilih.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSkillModalOpen(true)}
                    className="mt-3 text-xs border-slate-800 bg-slate-950 hover:bg-slate-900 hover:border-slate-700 text-slate-300"
                  >
                    Buka Library Strategi Kuantitatif
                  </Button>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="rounded border border-slate-800 bg-black p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 text-xs">{selectedSkill.title}</span>
                      <Badge variant="outline" className="text-[10px] font-mono border-slate-800 text-[#60A5FA]">
                        {selectedSkill.timeframes?.join(", ") || "M1 / M5"}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400 leading-normal">
                      {selectedSkill.description}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wider">
                      Aturan Konfirmasi ({Object.values(checkedRules).filter(Boolean).length}/{rules.length})
                    </div>
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        onClick={() => toggleRule(rule.id)}
                        className={`flex cursor-pointer items-start gap-2.5 rounded border p-2.5 text-xs transition ${
                          checkedRules[rule.id]
                            ? "border-[#1E40AF] bg-[#1E40AF]/15 text-slate-100"
                            : "border-slate-800/80 bg-black text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            checkedRules[rule.id]
                              ? "border-[#3B82F6] bg-[#1E40AF] text-white"
                              : "border-slate-700 bg-slate-900"
                          }`}
                        >
                          {checkedRules[rule.id] && <CheckCircle2 className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>
                        <div className="leading-tight">
                          <span>{rule.text}</span>
                          {rule.required && (
                            <span className="ml-1 text-[10px] text-[#60A5FA] font-mono font-semibold">[WAJIB]</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Evaluation Trigger */}
                  <div className="pt-2">
                    <Button
                      onClick={handleEvaluate}
                      disabled={isEvaluating}
                      className="w-full flex items-center justify-center gap-2 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-semibold text-xs transition border border-[#3B82F6]/50 shadow-[0_0_12px_rgba(30,64,175,0.4)]"
                    >
                      {isEvaluating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>AI Sedang Memetakan &amp; Menganalisa...</span>
                        </>
                      ) : (
                        <>
                          <Compass className="h-3.5 w-3.5" />
                          <span>Analisa &amp; Pasang Mapping AI</span>
                        </>
                      )}
                    </Button>
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
          const sym = localStorage.getItem("active_symbol");
          if (sym) setActiveSymbol(sym);
        }}
        onSaved={(msg) => {
          showToast(msg);
          const sym = localStorage.getItem("active_symbol");
          if (sym) setActiveSymbol(sym);
        }}
      />

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-200 shadow-xl font-mono border-l-2 border-l-[#3B82F6]">
          {toast}
        </div>
      )}
    </div>
  );
}
