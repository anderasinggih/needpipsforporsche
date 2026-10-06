"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Key, ArrowLeft, CheckCircle2, Eye, EyeOff, Plus, Trash2, Cpu, ShieldCheck, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface KeySlot {
  id: string;
  label: string;
  roleTitle?: string;
  provider: "gemini" | "groq" | "openai" | "deepseek" | "openrouter";
  model: string;
  apiKey: string;
  enabled: boolean;
}

interface ModelOption {
  value: string;
  label: string;
  recommended?: boolean;
}

const PROVIDER_MODELS: Record<string, ModelOption[]> = {
  gemini: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Flagship Scalp - Cepat & Akurat)", recommended: true },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Deep Technical Reasoner / Reasoning)" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite (Super Low Latency)" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (General Fast)" },
    { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash-Lite (Ultra Fast)" },
    { value: "gemini-3.8-flash", label: "Gemini 3.8 Flash (Frontier Series)" },
    { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (High Throughput)" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Legacy High Capacity)" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Legacy Reasoner)" },
    { value: "custom", label: "Custom Model..." },
  ],
  groq: [
    { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile (Flagship Ultra Fast)", recommended: true },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant (Sub-second Latency)" },
    { value: "llama3-70b-8192", label: "Llama 3 70B (8k Context)" },
    { value: "llama3-8b-8192", label: "Llama 3 8B (Fast)" },
    { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B (MoE)" },
    { value: "custom", label: "Custom Model..." },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o Mini (Optimal Scalp & Microstructure)", recommended: true },
    { value: "gpt-4o", label: "GPT-4o (Full Omni Reasoner)" },
    { value: "o3-mini", label: "o3-mini (High-End Reasoning)" },
    { value: "o1-mini", label: "o1-mini (Specialized Logic)" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "custom", label: "Custom Model..." },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek Chat (V3 / V3.1 General)", recommended: true },
    { value: "deepseek-reasoner", label: "DeepSeek Reasoner (R1 Chain-of-Thought)" },
    { value: "deepseek-flash", label: "DeepSeek Flash (High Speed)" },
    { value: "custom", label: "Custom Model..." },
  ],
  openrouter: [
    { value: "deepseek/deepseek-chat", label: "DeepSeek V3 (via OpenRouter)", recommended: true },
    { value: "deepseek/deepseek-r1", label: "DeepSeek R1 (via OpenRouter)" },
    { value: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash (Free Tier)" },
    { value: "meta-llama/llama-3.3-70b-instruct", label: "Meta Llama 3.3 70B Instruct" },
    { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
    { value: "auto", label: "Auto (Best Available)" },
    { value: "custom", label: "Custom Model..." },
  ],
};

const DEFAULT_SLOTS: KeySlot[] = [
  { id: "slot_1", label: "Agent 1", roleTitle: "Chief Synthesizer & Scalping Consensus Arbiter", provider: "gemini", model: "gemini-2.5-flash", apiKey: "", enabled: true },
  { id: "slot_2", label: "Agent 2", roleTitle: "Market Structure & Smart Money Specialist", provider: "gemini", model: "gemini-2.5-flash", apiKey: "", enabled: true },
  { id: "slot_3", label: "Agent 3", roleTitle: "Liquidity Hunter & Fair Value Gap Scout", provider: "openai", model: "gpt-4o-mini", apiKey: "", enabled: true },
  { id: "slot_4", label: "Agent 4", roleTitle: "Multi-Timeframe Trend & Momentum Analyst", provider: "groq", model: "llama-3.3-70b-versatile", apiKey: "", enabled: true },
  { id: "slot_5", label: "Agent 5", roleTitle: "Dynamic ATR Volatility & Drawdown Architect", provider: "gemini", model: "gemini-2.5-pro", apiKey: "", enabled: true },
  { id: "slot_6", label: "Agent 6", roleTitle: "Harmonic Pattern & XABCD Geometry Specialist", provider: "groq", model: "llama-3.1-8b-instant", apiKey: "", enabled: true },
  { id: "slot_7", label: "Agent 7", roleTitle: "Fibonacci Retracement & Golden Pocket Analyst", provider: "openai", model: "gpt-4o-mini", apiKey: "", enabled: true },
  { id: "slot_8", label: "Agent 8", roleTitle: "Multi-Timeframe Confirmation Matrix Auditor", provider: "deepseek", model: "deepseek-chat", apiKey: "", enabled: true },
  { id: "slot_9", label: "Agent 9", roleTitle: "Volume Profile & Volume-Weighted Average Scout", provider: "openrouter", model: "deepseek/deepseek-chat", apiKey: "", enabled: true },
  { id: "slot_10", label: "Agent 10", roleTitle: "Quantitative Invalidation Auditor", provider: "gemini", model: "gemini-2.5-flash", apiKey: "", enabled: true },
  { id: "slot_11", label: "Agent 11", roleTitle: "Judas Swing & Session Liquidity Scout", provider: "gemini", model: "gemini-2.5-flash", apiKey: "", enabled: true },
  { id: "slot_12", label: "Agent 12", roleTitle: "Mean-Reversion & Bollinger Z-Score Specialist", provider: "groq", model: "llama-3.3-70b-versatile", apiKey: "", enabled: true },
  { id: "slot_13", label: "Agent 13", roleTitle: "Momentum RSI Divergence & Oscillator Scout", provider: "openai", model: "gpt-4o-mini", apiKey: "", enabled: true },
  { id: "slot_14", label: "Agent 14", roleTitle: "Support & Resistance Dynamic Pivot Master", provider: "deepseek", model: "deepseek-chat", apiKey: "", enabled: true },
  { id: "slot_15", label: "Agent 15", roleTitle: "Session Timing & Macro Killzone Analyst", provider: "gemini", model: "gemini-2.5-flash-lite", apiKey: "", enabled: true },
  { id: "slot_16", label: "Agent 16", roleTitle: "Take Risk Aggressive Momentum Front-Runner", provider: "groq", model: "llama-3.3-70b-versatile", apiKey: "", enabled: true },
  { id: "slot_17", label: "Agent 17", roleTitle: "Capital Preservation & Drawdown Sentinel", provider: "gemini", model: "gemini-2.5-pro", apiKey: "", enabled: true },
  { id: "slot_18", label: "Agent 18", roleTitle: "Slippage & Spread Friction Defense", provider: "openai", model: "gpt-4o-mini", apiKey: "", enabled: true },
  { id: "slot_19", label: "Agent 19", roleTitle: "Contrarian Devil's Advocate & Risk Challenger", provider: "deepseek", model: "deepseek-chat", apiKey: "", enabled: true },
  { id: "slot_20", label: "Agent 20", roleTitle: "Sub-Second Micro-Scalp Execution Trigger", provider: "gemini", model: "gemini-2.5-flash", apiKey: "", enabled: true },
];

export default function OwnerKeyPage() {
  const [slots, setSlots] = useState<KeySlot[]>(DEFAULT_SLOTS);
  const [youtubeLinks, setYoutubeLinks] = useState<string>("");
  const [isSaved, setIsSaved] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [testingStatus, setTestingStatus] = useState<Record<string, { loading: boolean; ok?: boolean; msg?: string }>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedMusic = localStorage.getItem("bg_music_youtube_links") || "";
      setYoutubeLinks(savedMusic);

      const saved = localStorage.getItem("ai_council_keys_10");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Merge with 20 DEFAULT_SLOTS so new slots 11-20 are available while preserving saved keys
            const merged = DEFAULT_SLOTS.map((defSlot) => {
              const found = parsed.find((p: any) => p.id === defSlot.id);
              if (found) {
                return {
                  ...defSlot,
                  ...found,
                  enabled: found.enabled !== undefined ? Boolean(found.enabled) : true,
                };
              }
              return defSlot;
            });
            setSlots(merged);
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

      // Load authoritative encrypted keys from PostgreSQL database (Server-wide across all browsers/devices)
      fetch("/api/vault?type=slots")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.slots) && data.slots.length > 0) {
            setSlots((prev) =>
              DEFAULT_SLOTS.map((defSlot) => {
                const serverSlot = data.slots.find((s: any) => s.id === defSlot.id);
                const localSlot = prev.find((s) => s.id === defSlot.id);
                if (serverSlot && serverSlot.apiKey) {
                  return {
                    ...defSlot,
                    ...serverSlot,
                    enabled: serverSlot.enabled !== undefined ? Boolean(serverSlot.enabled) : true,
                  };
                }
                if (localSlot && localSlot.apiKey) {
                  return localSlot;
                }
                return serverSlot ? { ...defSlot, ...serverSlot } : defSlot;
              })
            );
          }
        })
        .catch((err) => console.warn("Failed to fetch keys from PostgreSQL vault:", err));
    }
  }, []);

  const updateSlot = (id: string, field: keyof KeySlot, value: string) => {
    setSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, [field]: value } : slot))
    );
  };

  const handleTestKey = async (slot: KeySlot) => {
    if (!slot.apiKey || !slot.apiKey.trim()) {
      setTestingStatus((prev) => ({
        ...prev,
        [slot.id]: { loading: false, ok: false, msg: "Isi API key dulu" },
      }));
      return;
    }

    setTestingStatus((prev) => ({
      ...prev,
      [slot.id]: { loading: true },
    }));

    try {
      const res = await fetch("/api/ai/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: slot.provider,
          model: slot.model,
          apiKey: slot.apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setTestingStatus((prev) => ({
          ...prev,
          [slot.id]: { loading: false, ok: true, msg: data.message || "Key aktif & terhubung!" },
        }));
      } else {
        setTestingStatus((prev) => ({
          ...prev,
          [slot.id]: { loading: false, ok: false, msg: data.error || "Gagal terhubung" },
        }));
      }
    } catch (e: any) {
      setTestingStatus((prev) => ({
        ...prev,
        [slot.id]: { loading: false, ok: false, msg: e.message || "Network error" },
      }));
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      localStorage.setItem("ai_council_keys_10", JSON.stringify(slots));
      localStorage.setItem("bg_music_youtube_links", youtubeLinks.trim());

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

      // 2. Persist to PostgreSQL Database Server (Encrypted AES-256-GCM across all browsers)
      fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      }).catch((dbErr) => console.warn("Failed to save keys to PostgreSQL database:", dbErr));
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
                20-Agent Multi-Key Scalping Council
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-[10px] font-mono border-zinc-800 text-emerald-400">
              {slots.filter((s) => s.enabled && s.apiKey.trim().length > 0).length} / {slots.length} Active Agents
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
                Tersedia tombol <span className="text-zinc-200 font-semibold">Test Key</span> untuk langsung memverifikasi apakah kunci dan kuota model Anda valid sebelum digunakan scalping secara live.
              </p>
            </div>
          </div>
        </Card>

        {/* YouTube Background Music Playlist Configuration Card */}
        <Card className="border-zinc-800 bg-zinc-950 p-4 shadow-none">
          <div className="flex items-start gap-3">
            <Music className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase font-mono tracking-wider text-zinc-200">
                  Background Music Audio Player (YouTube Embed)
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-zinc-800 text-cyan-400">
                  Auto-Loop &bull; Multi-Link
                </Badge>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Masukkan URL atau Video ID YouTube untuk musik background saat trading.
                Mendukung banyak lagu sekaligus (pisahkan dengan tanda koma <span className="text-zinc-200 font-mono">,</span>). Pemutar lagu akan otomatis memutar dan mengulang (loop) secara berurutan.
              </p>
              <div>
                <Label htmlFor="yt-music" className="text-[11px] font-mono text-zinc-400">
                  YouTube Video URLs / Video IDs (Pisahkan dengan koma):
                </Label>
                <textarea
                  id="yt-music"
                  rows={2}
                  value={youtubeLinks}
                  onChange={(e) => setYoutubeLinks(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=jfKfPfyJRdk, https://youtu.be/5qap5aO4i9A"
                  className="mt-1.5 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                />
              </div>
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
              const testState = testingStatus[slot.id];

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
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={slot.label}
                            onChange={(e) => updateSlot(slot.id, "label", e.target.value)}
                            className="h-6 text-[11px] font-semibold bg-transparent border-0 p-0 text-zinc-200 focus-visible:ring-0 w-36 sm:w-44"
                          />
                        </div>
                        {slot.roleTitle && (
                          <div className="text-[10px] font-mono text-emerald-400/90 truncate max-w-[200px] sm:max-w-xs">
                            {slot.roleTitle}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Interactive ON / OFF Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          setSlots((prev) =>
                            prev.map((s) => (s.id === slot.id ? { ...s, enabled: !s.enabled } : s))
                          );
                        }}
                        className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded transition-colors border ${
                          slot.enabled
                            ? "bg-emerald-950/80 text-emerald-400 border-emerald-800 hover:bg-emerald-900/60"
                            : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:bg-zinc-800/80"
                        }`}
                      >
                        {slot.enabled ? "ON" : "OFF"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTestKey(slot)}
                        disabled={testState?.loading || !slot.enabled}
                        className="px-2 py-0.5 text-[10px] font-mono font-medium rounded border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
                      >
                        {testState?.loading ? "Testing..." : "Test"}
                      </button>
                      <Badge
                        variant="outline"
                        className={`text-[9px] font-mono ${
                          !slot.enabled
                            ? "border-zinc-800 text-zinc-600 bg-zinc-950"
                            : isConfigured
                            ? "border-emerald-900/60 text-emerald-400 bg-emerald-950/30"
                            : "border-zinc-800 text-zinc-500"
                        }`}
                      >
                        {!slot.enabled ? "MUTED" : isConfigured ? "ACTIVE" : "EMPTY"}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <Label className="text-[10px] text-zinc-500 font-mono">PROVIDER</Label>
                      <select
                        value={slot.provider}
                        onChange={(e) => {
                          const newProvider = e.target.value as any;
                          const defaultModel = PROVIDER_MODELS[newProvider]?.[0]?.value || "";
                          updateSlot(slot.id, "provider", newProvider);
                          updateSlot(slot.id, "model", defaultModel);
                        }}
                        className="mt-1 w-full rounded border border-zinc-800 bg-black px-2 py-1 text-[11px] font-mono text-zinc-200 focus:outline-none"
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="groq">Groq (Llama / Mistral)</option>
                        <option value="openai">OpenAI GPT</option>
                        <option value="deepseek">DeepSeek</option>
                        <option value="openrouter">OpenRouter (Multi-Model)</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-zinc-500 font-mono">MODEL PRESET</Label>
                      {(() => {
                        const models = PROVIDER_MODELS[slot.provider] || [];
                        const isPreset = models.some((m) => m.value === slot.model && m.value !== "custom");
                        const selectedSelectValue = isPreset ? slot.model : "custom";

                        return (
                          <div className="space-y-1">
                            <select
                              value={selectedSelectValue}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val !== "custom") {
                                  updateSlot(slot.id, "model", val);
                                }
                              }}
                              className="mt-1 w-full rounded border border-zinc-800 bg-black px-2 py-1 text-[11px] font-mono text-zinc-200 focus:outline-none"
                            >
                              {models.map((m) => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>

                            {selectedSelectValue === "custom" && (
                              <Input
                                value={slot.model}
                                onChange={(e) => updateSlot(slot.id, "model", e.target.value)}
                                placeholder="Tulis nama model manual..."
                                className="h-6 text-[10px] font-mono bg-zinc-950 border-zinc-800"
                              />
                            )}
                          </div>
                        );
                      })()}
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

                  {testState && (
                    <div className="mt-2 pt-1.5 border-t border-zinc-900 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-zinc-500">Hasil Tes:</span>
                      <span
                        className={`truncate max-w-[260px] font-medium ${
                          testState.loading
                            ? "text-blue-400"
                            : testState.ok
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {testState.loading ? "Sedang menghubungi server AI..." : testState.msg}
                      </span>
                    </div>
                  )}
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
