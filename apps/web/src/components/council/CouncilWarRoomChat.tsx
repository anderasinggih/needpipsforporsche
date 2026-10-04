"use client";

import React, { useState, useEffect, useRef } from "react";
import { DiscussionMessage } from "@/lib/ai/types";
import { MessageSquare, Users, ShieldAlert, Sparkles, Send, CornerDownRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CouncilWarRoomChatProps {
  evaluationId?: string;
  discussion?: DiscussionMessage[];
  isEvaluating?: boolean;
  symbol: string;
  timeframe: string;
  price?: number;
  agentOpinions?: any[];
  signal?: string;
}

const ROUND_BADGES = {
  pitch: { label: "Opening Pitch", color: "border-blue-900/60 bg-blue-950/40 text-blue-400" },
  rebuttal: { label: "Debate & Rebuttal", color: "border-amber-900/60 bg-amber-950/40 text-amber-400" },
  ruling: { label: "Final Ruling", color: "border-emerald-900/60 bg-emerald-950/40 text-emerald-400" },
};

export const CouncilWarRoomChat: React.FC<CouncilWarRoomChatProps> = ({
  evaluationId,
  discussion = [],
  isEvaluating = false,
  symbol,
  timeframe,
  price = 0,
  agentOpinions = [],
  signal = "WAIT",
}) => {
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [typingIndex, setTypingIndex] = useState<number>(-1);
  const [userQuery, setUserQuery] = useState("");
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [userMessages, setUserMessages] = useState<Array<{ sender: string; text: string; time: number; targetAgent?: string }>>([]);
  const [activeTab, setActiveTab] = useState<"all" | "pitch" | "rebuttal" | "ruling">("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Stream discussion messages sequentially so the trader can read the AI debate unfold step by step
  useEffect(() => {
    setUserMessages([]);

    if (isEvaluating) {
      setMessages([]);
      setTypingIndex(-1);
      return;
    }

    if (!discussion || discussion.length === 0) {
      setMessages([]);
      setTypingIndex(-1);
      return;
    }

    // Progressive live stream: push messages one by one with realistic deliberation timing
    let currentIndex = 0;
    setMessages([]);
    setTypingIndex(0);

    const interval = setInterval(() => {
      if (currentIndex < discussion.length) {
        const nextMsg = discussion[currentIndex];
        setMessages((prev) => [...prev, nextMsg]);
        currentIndex++;
        setTypingIndex(currentIndex < discussion.length ? currentIndex : -1);
      } else {
        setTypingIndex(-1);
        clearInterval(interval);
      }
    }, 750);

    return () => {
      clearInterval(interval);
    };
  }, [discussion, evaluationId, isEvaluating]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingIndex, userMessages, isAskingAi]);

  const handleSendUserMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim() || isAskingAi) return;

    const query = userQuery.trim();
    setUserQuery("");

    // Add user message to chat stream
    setUserMessages((prev) => [
      ...prev,
      { sender: "Trader", text: query, time: Date.now() },
    ]);

    setIsAskingAi(true);

    try {
      let keySlots: any[] = [];
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("ai_council_keys_10");
        if (saved) {
          try {
            keySlots = JSON.parse(saved);
          } catch {
            keySlots = [];
          }
        }
      }

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userQuery: query,
          symbol,
          price,
          timeframe,
          keySlots,
          agentOpinions,
          signal,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setUserMessages((prev) => [
          ...prev,
          {
            sender: "System",
            text: `[Error: ${data.error || "Gagal menghubungi model AI"}]`,
            time: Date.now(),
          },
        ]);
        return;
      }

      setUserMessages((prev) => [
        ...prev,
        {
          sender: data.sender || "Council AI",
          text: data.text,
          time: data.timestamp || Date.now(),
          targetAgent: data.agentId,
        },
      ]);
    } catch (err: any) {
      setUserMessages((prev) => [
        ...prev,
        {
          sender: "System",
          text: `[Network Error: ${err?.message || "Tidak dapat terhubung"}]`,
          time: Date.now(),
        },
      ]);
    } finally {
      setIsAskingAi(false);
    }
  };

  const filteredMessages = messages.filter((m) => activeTab === "all" || m.round === activeTab);

  return (
    <div className="flex flex-col h-[520px] rounded-lg border border-zinc-800 bg-zinc-950/95 overflow-hidden text-xs font-sans shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-3.5 py-2.5 bg-black/60 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-950/70 border border-emerald-800/60 text-emerald-400">
            <MessageSquare className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-100 text-xs">Council War Room Debate</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">
              Diskusi & Sanggahan 10 Agen AI • {symbol} ({timeframe.toUpperCase()})
            </p>
          </div>
        </div>

        {/* Filter Round Tabs */}
        <div className="flex items-center gap-1 bg-black p-0.5 rounded-md border border-zinc-800 text-[10px]">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeTab === "all" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Semua ({messages.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pitch")}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeTab === "pitch" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Pitches
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rebuttal")}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeTab === "rebuttal" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Debat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ruling")}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeTab === "ruling" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Putusan
          </button>
        </div>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 font-sans">
        {messages.length === 0 && !isEvaluating ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 px-4">
            <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-2.5">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-zinc-300 font-medium text-xs">War Room Siap Berdiskusi</p>
            <p className="text-zinc-500 text-[11px] max-w-sm mt-1 leading-normal">
              Klik &quot;Deliberate 10 Minds&quot; untuk memulai musyawarah. Seluruh agen AI akan saling melempar argumen, mendebat setup, dan menguji kelayakan risiko secara transparan.
            </p>
          </div>
        ) : null}

        {/* Live Multi-Stage Deliberation Status while AI Council is deliberating */}
        {isEvaluating && (
          <div className="p-3.5 rounded-lg border border-emerald-900/40 bg-emerald-950/20 space-y-3 font-mono">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-emerald-400 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                Live Deliberation In Progress...
              </span>
              <span className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                10 AI Minds Engaged
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
              <div className="p-2 rounded bg-black/40 border border-zinc-800/80 flex items-center gap-2 text-zinc-300">
                <span className="text-emerald-400 font-bold">R1:</span>
                <span>Pitches & Technical Scans</span>
              </div>
              <div className="p-2 rounded bg-black/40 border border-zinc-800/80 flex items-center gap-2 text-zinc-300">
                <span className="text-amber-400 font-bold">R2:</span>
                <span>Cross-Debate & Rebuttal</span>
              </div>
              <div className="p-2 rounded bg-black/40 border border-zinc-800/80 flex items-center gap-2 text-zinc-300">
                <span className="text-cyan-400 font-bold">R3:</span>
                <span>Chief Risk Synthesis</span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 font-sans italic">
              Sedang mengambil pembacaan live dari seluruh slot AI... argumen dan perdebatan akan segera masuk ke stream di bawah ini.
            </p>
          </div>
        )}

        {filteredMessages.map((msg, idx) => {
          const isChief = msg.agentId === "slot_1" || msg.round === "ruling";
          const roundBadge = ROUND_BADGES[msg.round] || ROUND_BADGES.pitch;

          return (
            <div
              key={msg.id || idx}
              className={`flex flex-col gap-1.5 p-3 rounded-lg border transition-all ${
                isChief
                  ? "border-emerald-800/70 bg-emerald-950/20 shadow-[0_0_12px_rgba(16,185,129,0.06)]"
                  : msg.round === "rebuttal"
                  ? "border-amber-900/40 bg-black/60"
                  : "border-zinc-800/80 bg-zinc-900/30"
              }`}
            >
              {/* Agent Title & Meta */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm select-none">{msg.avatarIcon || "🤖"}</span>
                  <span className="font-semibold text-zinc-100 font-mono">{msg.agentName}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">• {msg.role}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border ${
                      msg.bias === "BULLISH"
                        ? "bg-emerald-950/60 text-emerald-400 border-emerald-900/50"
                        : msg.bias === "BEARISH"
                        ? "bg-red-950/60 text-red-400 border-red-900/50"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    }`}
                  >
                    {msg.bias}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${roundBadge.color}`}>
                    {roundBadge.label}
                  </span>
                </div>
              </div>

              {/* Reply To Tag if rebuttal */}
              {msg.replyToAgentName && (
                <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 pl-1 border-l-2 border-zinc-700">
                  <CornerDownRight className="h-3 w-3 text-zinc-400" />
                  <span>Sanggahan kepada: <strong className="text-zinc-300">@{msg.replyToAgentName}</strong></span>
                </div>
              )}

              {/* Chat Content Text */}
              <p className="text-[11.5px] leading-relaxed text-zinc-200 mt-0.5">
                {msg.message}
              </p>
            </div>
          );
        })}

        {/* User Interactive Messages */}
        {userMessages.map((um, uidx) => {
          const isUser = um.sender === "Trader";
          return (
            <div
              key={`user_${uidx}`}
              className={`flex flex-col gap-1 p-2.5 rounded-lg border text-[11px] ${
                isUser
                  ? "border-blue-800/60 bg-blue-950/30 ml-6 text-blue-100"
                  : "border-zinc-700 bg-zinc-900/90 mr-6 text-zinc-200"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span className="font-semibold text-zinc-200">{isUser ? "👤 Kamu (Trader)" : `🤖 ${um.sender}`}</span>
                <span>{new Date(um.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <p className="leading-normal">{um.text}</p>
            </div>
          );
        })}

        {/* Live Typing Indicator for Debate Stream */}
        {typingIndex >= 0 && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-zinc-900/40 border border-zinc-800/60 text-zinc-400 text-[10px] font-mono">
            <span className="flex gap-1 items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]"></span>
            </span>
            <span>Dewan AI sedang menanggapi & memperdebatkan argumen...</span>
          </div>
        )}

        {/* Real Live LLM Thinking Indicator when user asks question */}
        {isAskingAi && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 text-[10px] font-mono animate-pulse">
            <span className="flex gap-1 items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]"></span>
            </span>
            <span>Menghubungi otak model AI... sedang merumuskan jawaban kuantitatif live</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* User Chat Input / Q&A Bar */}
      <form onSubmit={handleSendUserMessage} className="border-t border-zinc-800 bg-black/80 p-2.5 flex items-center gap-2">
        <input
          type="text"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          disabled={isAskingAi}
          placeholder="Tanyakan / debatkan langsung ke dewan AI (misal: '@Agent 5 kenapa SL gak dilebarin?')..."
          className="flex-1 rounded-md bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-600 font-sans disabled:opacity-50"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!userQuery.trim() || isAskingAi}
          className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
        >
          <Send className="h-3 w-3 mr-1" />
          {isAskingAi ? "Menjawab..." : "Kirim"}
        </Button>
      </form>
    </div>
  );
};
