"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Key, ArrowLeft, CheckCircle2, Eye, EyeOff, Plus, Trash2, Cpu, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface KeySlot {
  id: string;
  label: string;
  provider: "gemini" | "groq" | "openai" | "deepseek" | "openrouter";
  model: string;
  apiKey: string;
}

const DEFAULT_SLOTS: KeySlot[] = [
  { id: "slot_1", label: "Agent 1 (Chief Synthesizer)", provider: "gemini", model: "gemini-2.5-flash", apiKey: "" },
  { id: "slot_2", label: "Agent 2 (Market Structure)", provider: "gemini", model: "gemini-2.5-flash", apiKey: "" },
  { id: "slot_3", label: "Agent 3 (Liquidity Hunter)", provider: "openai", model: "gpt-4o-mini", apiKey: "" },
  { id: "slot_4", label: "Agent 4 (Momentum & Trend)", provider: "groq", model: "llama-3.3-70b-versatile", apiKey: "" },
  { id: "slot_5", label: "Agent 5 (Volatility & Risk)", provider: "gemini", model: "gemini-2.5-pro", apiKey: "" },
  { id: "slot_6", label: "Agent 6 (Order Flow Scout)", provider: "groq", model: "llama3-8b-8192", apiKey: "" },
  { id: "slot_7", label: "Agent 7 (Scalp Microstructure)", provider: "openai", model: "gpt-4o-mini", apiKey: "" },
  { id: "slot_8", label: "Agent 8 (Multi-TF Confirmation)", provider: "deepseek", model: "deepseek-chat", apiKey: "" },
  { id: "slot_9", label: "Agent 9 (Volume Profile)", provider: "openrouter", model: "auto", apiKey: "" },
  { id: "slot_10", label: "Agent 10 (Dynamic Backup)", provider: "gemini", model: "gemini-2.0-flash", apiKey: "" },
];

export default function OwnerKeyPage() {
  const [slots, setSlots] = useState<KeySlot[]>(DEFAULT_SLOTS);
  const [isSaved, setIsSaved] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ai_council_keys_10");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSlots(parsed);
            return;
          }
        } catch (e) {
          console.warn("Error parsing saved keys", e);
        }
      }

      // Backward compatibility with individual keys
      const g = localStorage.getItem("gemini_api_key") || "";
      const gr = localStorage.getItem("groq_api_key") || "";
      const o = localStorage.getItem("openai_api_key") || "";
      const d = localStorage.getItem("deepseek_api_key") || "";
      const or = localStorage.getItem("openrouter_api_key") || "";

      setSlots((prev) =>
        prev.map((s, idx) => {
          if (idx === 0 || idx === 1) return { ...s, apiKey: g };
          if (idx === 2) return { ...s, apiKey: o };
          if (idx === 3) return { ...s, apiKey: gr };
          if (idx === 7) return { ...s, apiKey: d };
          if (idx === 8) return { ...s, apiKey: or };
          return s;
        })
      );
    }
  }, []);

  const updateSlot = (id: string, field: keyof KeySlot, value: string) => {
    setSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, [field]: value } : slot))
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      localStorage.setItem("ai_council_keys_10", JSON.stringify(slots));

      // Also set primary keys for backward compatibility
      const geminiSlot = slots.find((s) => s.provider === "gemini" && s.apiKey.trim());
      if (geminiSlot) localStorage.setItem("gemini_api_key", geminiSlot.apiKey.trim());

      const groqSlot = slots.find((s) => s.provider === "groq" && s.apiKey.trim());
      if (groqSlot) localStorage.setItem("groq_api_key", groqSlot.apiKey.trim());

      const openaiSlot = slots.find((s) => s.provider === "openai" && s.apiKey.trim());
      if (openaiSlot) localStorage.setItem("openai_api_key", openaiSlot.apiKey.trim());

      const deepseekSlot = slots.find((s) => s.provider === "deepseek" && s.apiKey.trim());
      if (deepseekSlot) localStorage.setItem("deepseek_api_key", deepseekSlot.apiKey.trim());

      const openrouterSlot = slots.find((s) => s.provider === "openrouter" && s.apiKey.trim());
      if (openrouterSlot) localStorage.setItem("openrouter_api_key", openrouterSlot.apiKey.trim());
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const activeCount = slots.filter((s) => s.apiKey.trim().length > 0).length;

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-zinc-800">
      <header className="border-b border-zinc-800 bg-black/90 px-6 py-3.5 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Terminal</span>
            </Link>
            <div className="h-4 w-[1px] bg-zinc-800" />
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-zinc-400" />
              <span className="text-xs font-mono font-semibold tracking-wider uppercase text-zinc-200">
                10-Agent Multi-Key Scalping Council
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-[10px] font-mono border-zinc-800 text-emerald-400">
              {activeCount} / {slots.length} Keys Configured
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono border-zinc-800 text-zinc-400">
              Route: /owner/key
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <Card className="border-zinc-800 bg-zinc-950 p-4 shadow-none">
          <div className="flex items-start gap-3">
            <Cpu className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold uppercase font-mono tracking-wider text-zinc-200">
                10 Dedicated Multi-AI Slots with Dynamic Failure Resilience
              </div>
              <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                Anda bebas mengisi hingga 10 API Key (misal 3 Gemini, 2 Groq, 2 OpenAI, DeepSeek, dll.).
                Jika salah satu API Key mati/habis limit, sistem akan mencatat statusnya sebagai{" "}
                <span className="text-amber-400 font-mono font-bold">Not Contributed (Offline)</span> di collapse bar dashboard,
                sementara sisa otak AI yang aktif dan AI penyimpul (Synthesizer) akan tetap mengkalkulasi scalping 30–50 pips secara presisi.
              </p>
            </div>
          </div>
        </Card>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-semibold uppercase font-mono tracking-wider text-zinc-300">
              Konfigurasi 10 Slot Kunci Agen AI
            </span>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setShowKeys(!showKeys)}
              className="h-8 border-zinc-800 bg-black hover:bg-zinc-900 text-xs text-zinc-300 gap-1.5"
            >
              {showKeys ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span>{showKeys ? "Hide Keys" : "Reveal Keys"}</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {slots.map((slot, index) => {
              const isConfigured = slot.apiKey.trim().length > 0;
              return (
                <Card
                  key={slot.id}
                  className={`border p-3.5 shadow-none transition-all ${
                    isConfigured ? "border-zinc-700/80 bg-zinc-950" : "border-zinc-900 bg-black/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-bold text-zinc-300">
                        {index + 1}
                      </span>
                      <Input
                        value={slot.label}
                        onChange={(e) => updateSlot(slot.id, "label", e.target.value)}
                        className="h-6 text-[11px] font-semibold bg-transparent border-0 p-0 text-zinc-200 focus-visible:ring-0 w-48"
                      />
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-mono ${
                        isConfigured
                          ? "border-emerald-900/60 text-emerald-400 bg-emerald-950/30"
                          : "border-zinc-800 text-zinc-500"
                      }`}
                    >
                      {isConfigured ? "ACTIVE KEY" : "EMPTY"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <Label className="text-[10px] text-zinc-500 font-mono">PROVIDER</Label>
                      <select
                        value={slot.provider}
                        onChange={(e) => updateSlot(slot.id, "provider", e.target.value as any)}
                        className="mt-1 w-full rounded border border-zinc-800 bg-black px-2 py-1 text-[11px] font-mono text-zinc-200 focus:outline-none"
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="groq">Groq Llama</option>
                        <option value="openai">OpenAI GPT</option>
                        <option value="deepseek">DeepSeek</option>
                        <option value="openrouter">OpenRouter</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-zinc-500 font-mono">MODEL</Label>
                      <Input
                        value={slot.model}
                        onChange={(e) => updateSlot(slot.id, "model", e.target.value)}
                        placeholder="e.g. gemini-2.5-flash"
                        className="mt-1 h-7 text-[11px] font-mono bg-black border-zinc-800"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px] text-zinc-500 font-mono">API KEY</Label>
                    <Input
                      type={showKeys ? "text" : "password"}
                      value={slot.apiKey}
                      onChange={(e) => updateSlot(slot.id, "apiKey", e.target.value)}
                      placeholder={
                        slot.provider === "gemini"
                          ? "AIzaSy..."
                          : slot.provider === "groq"
                          ? "gsk_..."
                          : slot.provider === "openai"
                          ? "sk-..."
                          : "API Key string..."
                      }
                      className="mt-1 font-mono text-[11px] h-8 bg-black border-zinc-800"
                    />
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <div>
              {isSaved && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                  <CheckCircle2 className="h-4 w-4" />
                  10-Agent council configuration successfully saved
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button
                  type="button"
                  variant="outline"
                  className="border-zinc-800 bg-black hover:bg-zinc-900 text-xs"
                >
                  Return to Chart
                </Button>
              </Link>
              <Button
                type="submit"
                className="bg-zinc-100 text-black hover:bg-white font-medium text-xs shadow-none border-0 px-6"
              >
                Save All 10 Key Slots
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
