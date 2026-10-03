"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";

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
      setFormData((prev) => ({ ...prev, notes: '' }));
    } catch (error) {
      console.error('Failed to submit journal:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <Label htmlFor="journal-symbol">Symbol</Label>
          <Input
            id="journal-symbol"
            type="text"
            value={formData.symbol}
            onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
            className="font-mono uppercase text-xs bg-black border-neutral-800"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="journal-dir">Direction</Label>
          <select
            id="journal-dir"
            value={formData.direction}
            onChange={(e) => setFormData({ ...formData, direction: e.target.value as 'BUY' | 'SELL' })}
            className="flex h-9 w-full rounded-md border border-neutral-800 bg-black px-3 py-1.5 text-xs text-neutral-100 shadow-sm focus:outline-none focus:ring-1 focus:ring-[#00FF66] font-mono font-bold"
          >
            <option value="BUY" className="text-[#00FF66]">BUY (Long)</option>
            <option value="SELL" className="text-red-400">SELL (Short)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label htmlFor="journal-entry">Entry Price</Label>
          <Input
            id="journal-entry"
            type="number"
            step="0.01"
            value={formData.entryPrice}
            onChange={(e) => setFormData({ ...formData, entryPrice: parseFloat(e.target.value) || 0 })}
            className="font-mono text-xs bg-black border-neutral-800"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="journal-sl">Stop Loss</Label>
          <Input
            id="journal-sl"
            type="number"
            step="0.01"
            value={formData.stopLoss}
            onChange={(e) => setFormData({ ...formData, stopLoss: parseFloat(e.target.value) || 0 })}
            className="font-mono text-xs bg-black border-neutral-800"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="journal-tp">Take Profit</Label>
          <Input
            id="journal-tp"
            type="number"
            step="0.01"
            value={formData.takeProfit}
            onChange={(e) => setFormData({ ...formData, takeProfit: parseFloat(e.target.value) || 0 })}
            className="font-mono text-xs bg-black border-neutral-800"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <Label htmlFor="journal-lot">Position Size (Lots)</Label>
          <Input
            id="journal-lot"
            type="number"
            step="0.01"
            value={formData.lotSize}
            onChange={(e) => setFormData({ ...formData, lotSize: parseFloat(e.target.value) || 0.01 })}
            className="font-mono text-xs bg-black border-neutral-800"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="journal-notes">Trade Rationale</Label>
          <Input
            id="journal-notes"
            type="text"
            placeholder="Key catalyst / trigger..."
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="text-xs bg-black border-neutral-800"
          />
        </div>
      </div>

      <div className="pt-1">
        <Button
          type="submit"
          disabled={submitting}
          variant="outline"
          className="w-full flex items-center justify-center gap-1.5 border-neutral-800 bg-neutral-950 hover:bg-neutral-900 hover:text-white text-xs h-9"
        >
          <Check className="h-3.5 w-3.5 text-[#00FF66]" />
          <span>{submitting ? "Logging Trade..." : "Record Trade to Journal"}</span>
        </Button>
      </div>
    </form>
  );
};
