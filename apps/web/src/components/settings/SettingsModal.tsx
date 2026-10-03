"use client";

import React, { useState, useEffect } from "react";
import { X, Key, Shield, Check, Server, Bot } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [tab, setTab] = useState<"hfm" | "ai">("hfm");

  // HFM Account Form State
  const [hfmAccount, setHfmAccount] = useState("223052814");
  const [hfmPassword, setHfmPassword] = useState("Lalalalisa123!#");
  const [hfmServer, setHfmServer] = useState("HFMarketsGlobal-Live18");
  const [hfmSymbol, setHfmSymbol] = useState("XAUUSD");

  // AI Keys & Model Form State
  const [geminiKey, setGeminiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [groqKey, setGroqKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load existing settings from localStorage if available
    const savedHfmAcc = localStorage.getItem("hfm_account");
    if (savedHfmAcc) setHfmAccount(savedHfmAcc);
    const savedHfmServ = localStorage.getItem("hfm_server");
    if (savedHfmServ) setHfmServer(savedHfmServ);
    const savedGemini = localStorage.getItem("gemini_api_key");
    if (savedGemini) setGeminiKey(savedGemini);
    const savedModel = localStorage.getItem("ai_model");
    if (savedModel) setSelectedModel(savedModel);
  }, []);

  if (!isOpen) return null;

  const handleSaveHfm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      localStorage.setItem("hfm_account", hfmAccount);
      localStorage.setItem("hfm_server", hfmServer);
      localStorage.setItem("hfm_symbol", hfmSymbol);

      // Save to encrypted vault API
      await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "hfm",
          keyIdentifier: `HFM_${hfmAccount}_${hfmServer}`,
          apiKey: JSON.stringify({ account: hfmAccount, password: hfmPassword, server: hfmServer, symbol: hfmSymbol }),
        }),
      });

      onSaved("Konfigurasi akun HFM tersimpan di Vault & Storage");
      onClose();
    } catch (err) {
      onSaved("Pengaturan akun HFM disimpan lokal");
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAi = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      localStorage.setItem("gemini_api_key", geminiKey);
      localStorage.setItem("ai_model", selectedModel);

      if (geminiKey) {
        await fetch("/api/vault", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "gemini", keyIdentifier: "GEMINI_API_KEY", apiKey: geminiKey }),
        });
      }
      if (groqKey) {
        await fetch("/api/vault", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "groq", keyIdentifier: "GROQ_API_KEY", apiKey: groqKey }),
        });
      }
      if (openaiKey) {
        await fetch("/api/vault", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "openai", keyIdentifier: "OPENAI_API_KEY", apiKey: openaiKey }),
        });
      }
      onSaved("Pengaturan AI Model & API Keys berhasil disimpan");
      onClose();
    } catch (err) {
      onSaved("Pengaturan AI disimpan lokal");
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-[#12151D] shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
              Pengaturan Akun &amp; API Keys
            </h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Header */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/40 text-xs font-medium">
          <button
            onClick={() => setTab("hfm")}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition border-b-2 ${
              tab === "hfm"
                ? "border-zinc-300 text-white bg-zinc-800/40 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            Akun Broker HFM
          </button>
          <button
            onClick={() => setTab("ai")}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition border-b-2 ${
              tab === "ai"
                ? "border-zinc-300 text-white bg-zinc-800/40 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            AI Evaluator Keys
          </button>
        </div>

        {/* Form Content */}
        <div className="p-5">
          {tab === "hfm" ? (
            <form onSubmit={handleSaveHfm} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                  Nomor Akun MT5 HFM
                </label>
                <input
                  type="text"
                  value={hfmAccount}
                  onChange={(e) => setHfmAccount(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-zinc-100 focus:border-zinc-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                  Password Akun / Investor Pass
                </label>
                <input
                  type="password"
                  value={hfmPassword}
                  onChange={(e) => setHfmPassword(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-zinc-100 focus:border-zinc-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                  Server HFM
                </label>
                <input
                  type="text"
                  value={hfmServer}
                  onChange={(e) => setHfmServer(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-zinc-100 focus:border-zinc-600 focus:outline-none"
                  placeholder="HFMarketsGlobal-Live18"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                  Simbol Emas
                </label>
                <input
                  type="text"
                  value={hfmSymbol}
                  onChange={(e) => setHfmSymbol(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-zinc-100 focus:border-zinc-600 focus:outline-none"
                  placeholder="XAUUSD"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full rounded bg-zinc-200 py-2 font-medium text-zinc-900 hover:bg-white active:scale-[0.99] transition"
                >
                  {isSaving ? "Menyimpan..." : "Simpan Pengaturan HFM"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSaveAi} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                  Google Gemini API Key (Rekomendasi)
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-zinc-100 focus:border-zinc-600 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-zinc-500">Dapatkan gratis di aistudio.google.com</p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                  Pilih Model AI Evaluator
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-zinc-600 focus:outline-none"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Super Cepat &amp; Presisi)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep SMC Reasoning)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  <option value="llama3-8b-8192">Groq Llama-3 8B (Ultra Low Latency)</option>
                  <option value="gpt-4o-mini">OpenAI GPT-4o Mini</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                  Groq API Key (Alternatif Gratis)
                </label>
                <input
                  type="password"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-zinc-100 focus:border-zinc-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
                  OpenAI API Key (Opsional)
                </label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-zinc-100 focus:border-zinc-600 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full rounded bg-zinc-200 py-2 font-medium text-zinc-900 hover:bg-white active:scale-[0.99] transition"
                >
                  {isSaving ? "Menyimpan..." : "Simpan Pengaturan AI"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
