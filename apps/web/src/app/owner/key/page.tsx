"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Key, Shield, ArrowLeft, CheckCircle2, Eye, EyeOff, Cpu, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function OwnerKeyPage() {
  const [geminiKey, setGeminiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [isSaved, setIsSaved] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setGeminiKey(localStorage.getItem("gemini_api_key") || "");
      setGroqKey(localStorage.getItem("groq_api_key") || "");
      setOpenaiKey(localStorage.getItem("openai_api_key") || "");
      setDeepseekKey(localStorage.getItem("deepseek_api_key") || "");
      setOpenrouterKey(localStorage.getItem("openrouter_api_key") || "");
      setSelectedModel(localStorage.getItem("ai_model") || "gemini-2.5-flash");
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      localStorage.setItem("gemini_api_key", geminiKey.trim());
      localStorage.setItem("groq_api_key", groqKey.trim());
      localStorage.setItem("openai_api_key", openaiKey.trim());
      localStorage.setItem("deepseek_api_key", deepseekKey.trim());
      localStorage.setItem("openrouter_api_key", openrouterKey.trim());
      localStorage.setItem("ai_model", selectedModel);
    }

    // Sync vault
    if (geminiKey.trim()) {
      await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "gemini",
          keyIdentifier: "GEMINI_API_KEY",
          apiKey: geminiKey.trim(),
        }),
      }).catch(() => {});
    }

    if (groqKey.trim()) {
      await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "groq",
          keyIdentifier: "GROQ_API_KEY",
          apiKey: groqKey.trim(),
        }),
      }).catch(() => {});
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-zinc-800">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-black/90 px-6 py-3.5 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
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
                Multi-Agent Brain &amp; API Key Dashboard
              </span>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono border-zinc-800 text-zinc-400">
            Open Access Route (/owner/key)
          </Badge>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        {/* Architecture Notice */}
        <Card className="border-zinc-800 bg-zinc-950 p-4 shadow-none">
          <div className="flex items-start gap-3">
            <Network className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold uppercase font-mono tracking-wider text-zinc-200">
                5-Agent Quantitative Council Architecture
              </div>
              <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                When you initiate an evaluation, 5 specialized AI minds debate in parallel:
                (1) <strong>Market Structure / SMC Specialist</strong>,
                (2) <strong>Liquidity &amp; Order Book Hunter</strong>,
                (3) <strong>Trend Momentum &amp; Volume Analyst</strong>,
                (4) <strong>Volatility &amp; ATR Risk Manager</strong>, and
                (5) <strong>Chief Synthesizer (Supreme Council Arbiter)</strong>.
                If any single API key fails or reaches rate-limit, the remaining minds maintain consensus seamlessly.
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950 shadow-none">
          <CardHeader className="border-b border-zinc-800 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
                  Multi-Provider API Credentials
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400 mt-1">
                  Configure keys for Gemini, OpenAI, Groq, DeepSeek, and OpenRouter. You can fill one, several, or all.
                </CardDescription>
              </div>
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
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSave} className="space-y-6">
              {/* Primary Arbiter Model Choice */}
              <div className="space-y-2">
                <Label htmlFor="ai-model" className="text-xs text-zinc-300 font-medium">
                  Primary Arbiter Model (Supreme Synthesizer)
                </Label>
                <select
                  id="ai-model"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-600"
                >
                  <optgroup label="Google Gemini (Free &amp; Ultra-Fast)">
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Quantitative Reasoning)</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  </optgroup>
                  <optgroup label="Groq High-Throughput">
                    <option value="llama-3.3-70b-versatile">Groq Llama 3.3 70B Versatile</option>
                    <option value="llama3-8b-8192">Groq Llama 3 8B</option>
                  </optgroup>
                  <optgroup label="OpenAI">
                    <option value="gpt-4o-mini">OpenAI GPT-4o Mini</option>
                    <option value="gpt-4o">OpenAI GPT-4o</option>
                  </optgroup>
                </select>
              </div>

              {/* 1. Gemini Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="gemini-key" className="text-xs text-zinc-300 font-medium">
                      Google Gemini API Key
                    </Label>
                    <Badge variant="outline" className="text-[9px] font-mono border-zinc-800 text-emerald-400">
                      Agent 1 &amp; Synthesizer
                    </Badge>
                  </div>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-zinc-400 hover:text-white underline underline-offset-2"
                  >
                    Get free key &rarr;
                  </a>
                </div>
                <Input
                  id="gemini-key"
                  type={showKeys ? "text" : "password"}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="font-mono text-xs bg-black border-zinc-800 focus-visible:ring-zinc-600"
                />
              </div>

              {/* 2. OpenAI Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="openai-key" className="text-xs text-zinc-300 font-medium">
                      OpenAI API Key (Optional)
                    </Label>
                    <Badge variant="outline" className="text-[9px] font-mono border-zinc-800 text-blue-400">
                      Agent 2: Liquidity Hunter
                    </Badge>
                  </div>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-zinc-400 hover:text-white underline underline-offset-2"
                  >
                    OpenAI Platform &rarr;
                  </a>
                </div>
                <Input
                  id="openai-key"
                  type={showKeys ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="font-mono text-xs bg-black border-zinc-800 focus-visible:ring-zinc-600"
                />
              </div>

              {/* 3. Groq Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="groq-key" className="text-xs text-zinc-300 font-medium">
                      Groq API Key (Optional)
                    </Label>
                    <Badge variant="outline" className="text-[9px] font-mono border-zinc-800 text-amber-400">
                      Agent 3: Momentum Scout
                    </Badge>
                  </div>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-zinc-400 hover:text-white underline underline-offset-2"
                  >
                    Groq Console &rarr;
                  </a>
                </div>
                <Input
                  id="groq-key"
                  type={showKeys ? "text" : "password"}
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  className="font-mono text-xs bg-black border-zinc-800 focus-visible:ring-zinc-600"
                />
              </div>

              {/* 4. DeepSeek Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="deepseek-key" className="text-xs text-zinc-300 font-medium">
                      DeepSeek API Key (Optional)
                    </Label>
                    <Badge variant="outline" className="text-[9px] font-mono border-zinc-800 text-purple-400">
                      Agent 4: Volatility &amp; ATR Arbiter
                    </Badge>
                  </div>
                  <a
                    href="https://platform.deepseek.com/api_keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-zinc-400 hover:text-white underline underline-offset-2"
                  >
                    DeepSeek Platform &rarr;
                  </a>
                </div>
                <Input
                  id="deepseek-key"
                  type={showKeys ? "text" : "password"}
                  value={deepseekKey}
                  onChange={(e) => setDeepseekKey(e.target.value)}
                  placeholder="sk-..."
                  className="font-mono text-xs bg-black border-zinc-800 focus-visible:ring-zinc-600"
                />
              </div>

              {/* 5. OpenRouter Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="openrouter-key" className="text-xs text-zinc-300 font-medium">
                      OpenRouter API Key (Optional Fallback)
                    </Label>
                    <Badge variant="outline" className="text-[9px] font-mono border-zinc-800 text-cyan-400">
                      Multi-Model Gateway
                    </Badge>
                  </div>
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-zinc-400 hover:text-white underline underline-offset-2"
                  >
                    OpenRouter &rarr;
                  </a>
                </div>
                <Input
                  id="openrouter-key"
                  type={showKeys ? "text" : "password"}
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="font-mono text-xs bg-black border-zinc-800 focus-visible:ring-zinc-600"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                <div className="flex items-center gap-2">
                  {isSaved && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                      <CheckCircle2 className="h-4 w-4" />
                      All brain credentials saved successfully
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
                      Return
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    className="bg-zinc-100 text-black hover:bg-white font-medium text-xs shadow-none border-0 px-5"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
