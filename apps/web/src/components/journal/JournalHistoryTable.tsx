"use client";

import React from "react";

interface JournalRow {
  id: string;
  symbol: string;
  direction: string;
  entry_price: number;
  exit_price?: number;
  stop_loss: number;
  take_profit: number;
  lot_size: number;
  pnl?: number;
  status: string;
  created_at: string;
  notes?: string;
}

interface JournalHistoryTableProps {
  entries: JournalRow[];
}

export const JournalHistoryTable: React.FC<JournalHistoryTableProps> = ({ entries }) => {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/60 bg-[#0E1018]">
            <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-400">Date</th>
            <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-400">Symbol</th>
            <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-400">Dir</th>
            <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-400">Entry</th>
            <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-400">Exit</th>
            <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-400">PnL</th>
            <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-400">Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                No trade journal entries yet
              </td>
            </tr>
          ) : (
            entries.map((entry) => (
              <tr key={entry.id} className="border-b border-border/30 last:border-0 hover:bg-white/5">
                <td className="px-4 py-2 text-xs text-slate-300">
                  {new Date(entry.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-xs font-semibold text-white">{entry.symbol}</td>
                <td className={`px-4 py-2 text-xs font-bold ${entry.direction === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {entry.direction}
                </td>
                <td className="px-4 py-2 text-xs font-mono text-slate-300">{entry.entry_price.toFixed(2)}</td>
                <td className="px-4 py-2 text-xs font-mono text-slate-300">{entry.exit_price?.toFixed(2) || '-'}</td>
                <td className={`px-4 py-2 text-xs font-bold ${entry.pnl && entry.pnl > 0 ? 'text-emerald-400' : entry.pnl && entry.pnl < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {entry.pnl !== null && entry.pnl !== undefined ? entry.pnl.toFixed(2) : '-'}
                </td>
                <td className="px-4 py-2 text-xs uppercase">{entry.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
