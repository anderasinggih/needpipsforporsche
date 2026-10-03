"use client";

import React, { useState } from "react";

export interface JournalEntry {
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  lotSize: number;
  notes?: string;
  skillId?: string;
  rulesCompliance?: any;
}

interface TradeJournalFormProps {
  onSubmit: (entry: JournalEntry) => Promise<void>;
  skillId?: string;
  rulesCompliance?: any;
}

export const TradeJournalForm: React.FC<TradeJournalFormProps> = ({
  onSubmit,
  skillId,
  rulesCompliance,
}) => {
  const [formData, setFormData] = useState<JournalEntry>({
    symbol: 'XAUUSD',
    direction: 'BUY',
    entryPrice: 2650.5,
    stopLoss: 2645.0,
    takeProfit: 2665.0,
    lotSize: 0.1,
    notes: '',
    skillId,
    rulesCompliance,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await onSubmit(formData);
      setFormData({ ...formData, notes: '' });
    } catch (error) {
      console.error('Failed to submit journal:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-white">Trade Journal Entry</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400">Symbol</label>
          <input
            type="text"
            value={formData.symbol}
            onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-[#0E1018] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Direction</label>
          <select
            value={formData.direction}
            onChange={(e) => setFormData({ ...formData, direction: e.target.value as 'BUY' | 'SELL' })}
            className="mt-1 w-full rounded-lg border border-border bg-[#0E1018] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="text-xs text-slate-400">Entry</label>
          <input
            type="number"
            step="0.01"
            value={formData.entryPrice}
            onChange={(e) => setFormData({ ...formData, entryPrice: parseFloat(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-border bg-[#0E1018] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">SL</label>
          <input
            type="number"
            step="0.01"
            value={formData.stopLoss}
            onChange={(e) => setFormData({ ...formData, stopLoss: parseFloat(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-border bg-[#0E1018] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">TP</label>
          <input
            type="number"
            step="0.01"
            value={formData.takeProfit}
            onChange={(e) => setFormData({ ...formData, takeProfit: parseFloat(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-border bg-[#0E1018] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Lot</label>
          <input
            type="number"
            step="0.01"
            value={formData.lotSize}
            onChange={(e) => setFormData({ ...formData, lotSize: parseFloat(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-border bg-[#0E1018] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="mt-1 w-full rounded-lg border border-border bg-[#0E1018] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          rows={2}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-emerald-500 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-600"
      >
        {submitting ? "Saving..." : "Save Trade Entry"}
      </button>
    </form>
  );
};
