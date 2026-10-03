"use client";

import React, { useState, useEffect } from "react";
import { X, AlertTriangle, Zap } from "lucide-react";

interface TradeExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  direction: "BUY" | "SELL";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  symbol: string;
  onConfirm: (volume: number, sl: number, tp: number) => Promise<void>;
  isExecuting?: boolean;
}

export const TradeExecutionModal: React.FC<TradeExecutionModalProps> = ({
  isOpen,
  onClose,
  direction,
  entryPrice,
  stopLoss,
  takeProfit,
  symbol,
  onConfirm,
  isExecuting = false,
}) => {
  const [volume, setVolume] = useState(0.1);
  const [sl, setSl] = useState(stopLoss);
  const [tp, setTp] = useState(takeProfit);

  useEffect(() => {
    if (isOpen) {
      setSl(stopLoss);
      setTp(takeProfit);
      setVolume(0.1);
    }
  }, [isOpen, stopLoss, takeProfit]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirm(volume, sl, tp);
  };

  const calculateRR = () => {
    if (direction === "BUY") {
      if (entryPrice - sl <= 0) return 0;
      return Math.abs((tp - entryPrice) / (entryPrice - sl));
    } else {
      if (sl - entryPrice <= 0) return 0;
      return Math.abs((entryPrice - tp) / (sl - entryPrice));
    }
  };

  const riskReward = calculateRR();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Confirm Trade Execution
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 transition hover:bg-white/5" disabled={isExecuting}>
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
              <div className="text-xs text-amber-300">
                This will send a live order to your HFM MT5 account. Please verify all parameters before confirming.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-[#0E1018] p-3">
              <div className="text-[10px] uppercase text-slate-400">Action</div>
              <div className={`mt-1 text-lg font-bold ${direction === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                {direction} {symbol}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-[#0E1018] p-3">
              <div className="text-[10px] uppercase text-slate-400">Entry Price</div>
              <div className="mt-1 font-mono text-lg font-bold text-white">{entryPrice.toFixed(2)}</div>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-slate-400">Lot Size (Volume)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value) || 0.01)}
              disabled={isExecuting}
              className="mt-1 w-full rounded-lg border border-border bg-[#0E1018] px-3 py-2 text-lg font-mono text-white focus:border-amber-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-400">Stop Loss (SL)</label>
              <input
                type="number"
                step="0.01"
                value={sl}
                onChange={(e) => setSl(parseFloat(e.target.value))}
                disabled={isExecuting}
                className="mt-1 w-full rounded-lg border border-border bg-[#0E1018] px-3 py-2 font-mono text-sm text-white focus:border-red-500 focus:outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-400">Take Profit (TP)</label>
              <input
                type="number"
                step="0.01"
                value={tp}
                onChange={(e) => setTp(parseFloat(e.target.value))}
                disabled={isExecuting}
                className="mt-1 w-full rounded-lg border border-border bg-[#0E1018] px-3 py-2 font-mono text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-[#0E1018] px-3 py-2">
            <span className="text-xs uppercase text-slate-400">Risk/Reward (Approx.)</span>
            <span className="text-sm font-bold text-amber-400">≥ {riskReward.toFixed(2)} : 1</span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isExecuting}
              className="flex-1 rounded-lg border border-border py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isExecuting || volume <= 0}
              className="flex-1 rounded-lg bg-emerald-500 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-600"
            >
              {isExecuting ? "Sending..." : "Confirm & Send Order"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
