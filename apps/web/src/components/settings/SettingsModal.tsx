"use client";

import React, { useState, useEffect } from "react";
import { Bot, Key, Radio, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [geminiKey, setGeminiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [groqKey, setGroqKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [activeSymbol, setActiveSymbol] = useState("XAUUSD");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedGemini = localStorage.getItem("gemini_api_key");
    if (savedGemini) setGeminiKey(savedGemini);
    const savedModel = localStorage.getItem("ai_model");
    if (savedModel) setSelectedModel(savedModel);
    const savedGroq = localStorage.getItem("groq_api_key");
    if (savedGroq) setGroqKey(savedGroq);
    const savedOpenai = localStorage.getItem("openai_api_key");
    if (savedOpenai) setOpenaiKey(savedOpenai);
    const savedSym = localStorage.getItem("hfm_symbol") || localStorage.getItem("active_symbol");
    if (savedSym) setActiveSymbol(savedSym);
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      localStorage.setItem("gemini_api_key", geminiKey);
      localStorage.setItem("ai_model", selectedModel);
      localStorage.setItem("groq_api_key", groqKey);
      localStorage.setItem("openai_api_key", openaiKey);
      localStorage.setItem("active_symbol", activeSymbol);
      localStorage.setItem("hfm_symbol", activeSymbol);

      if (geminiKey) {
        await fetch("/api/vault", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "gemini",
            keyIdentifier: "GEMINI_API_KEY",
            apiKey: geminiKey,
          }),
        }).catch(() => {});
      }
      if (groqKey) {
        await fetch("/api/vault", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "groq",
            keyIdentifier: "GROQ_API_KEY",
            apiKey: groqKey,
          }),
        }).catch(() => {});
      }

      onSaved("Konfigurasi AI Engine & Model tersimpan!");
      onClose();
    } catch {
      onSaved("Pengaturan disimpan lokal");
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-zinc-800 bg-[#11131B]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold tracking-wide text-zinc-100">
                AI Trading Model &amp; Feed Engine
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Konfigurasi evaluasi AI realtime &amp; symbol feed pasar
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="active-symbol">Trading Symbol / Pair</Label>
            <Input
              id="active-symbol"
              type="text"
              value={activeSymbol}
              onChange={(e) => setActiveSymbol(e.target.value.toUpperCase())}
              placeholder="XAUUSD"
              className="font-mono text-zinc-100 uppercase"
              required
            />
            <p className="text-[10px] text-zinc-500">
              Contoh: XAUUSD (Gold 24/7), BTCUSDT, EURUSD
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-model">Pilih Model AI Evaluator</Label>
            <select
              id="ai-model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="flex h-9 w-full rounded-md border border-zinc-800 bg-[#0C0E14] px-3 py-1.5 text-xs text-zinc-100 shadow-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <optgroup label="Google Gemini (Rekomendasi)">
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Paling Stabil &amp; Cepat)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Reasoning)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              </optgroup>
              <optgroup label="Alternatif High-Speed">
                <option value="llama3-8b-8192">Groq Llama-3 8B (Sub-second)</option>
                <option value="gpt-4o-mini">OpenAI GPT-4o Mini</option>
              </optgroup>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="gemini-key">Google Gemini API Key</Label>
              <span className="text-[10px] text-amber-400 font-mono">Gratis di aistudio.google.com</span>
            </div>
            <Input
              id="gemini-key"
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="groq-key">Groq API Key (Opsional)</Label>
            <Input
              id="groq-key"
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="gsk_..."
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="openai-key">OpenAI API Key (Opsional)</Label>
            <Input
              id="openai-key"
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className="font-mono"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              variant="porsche"
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isSaving ? "Menyimpan..." : "Simpan Pengaturan"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
