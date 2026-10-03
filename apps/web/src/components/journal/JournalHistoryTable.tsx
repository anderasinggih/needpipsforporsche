"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";

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
    <div className="overflow-x-auto rounded-md border border-zinc-800 bg-[#0C0E14]">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-zinc-800 bg-zinc-900/60 text-[10px] uppercase tracking-wider text-zinc-400">
          <tr>
            <th className="px-3.5 py-2.5">Waktu</th>
            <th className="px-3.5 py-2.5">Simbol</th>
            <th className="px-3.5 py-2.5">Posisi</th>
            <th className="px-3.5 py-2.5">Entry</th>
            <th className="px-3.5 py-2.5">Exit</th>
            <th className="px-3.5 py-2.5">P&amp;L</th>
            <th className="px-3.5 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
          {entries.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center font-sans text-xs text-zinc-500">
                Belum ada catatan jurnal trading
              </td>
            </tr>
          ) : (
            entries.map((entry) => (
              <tr key={entry.id} className="transition-colors hover:bg-zinc-850/40">
                <td className="px-3.5 py-2 font-sans text-[11px] text-zinc-400">
                  {new Date(entry.created_at).toLocaleDateString("id-ID", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-3.5 py-2 font-bold text-zinc-100">{entry.symbol}</td>
                <td className="px-3.5 py-2 font-bold">
                  {entry.direction === "BUY" ? (
                    <span className="text-emerald-400">BUY</span>
                  ) : (
                    <span className="text-red-400">SELL</span>
                  )}
                </td>
                <td className="px-3.5 py-2 text-zinc-300">{Number(entry.entry_price).toFixed(2)}</td>
                <td className="px-3.5 py-2 text-zinc-400">
                  {entry.exit_price ? Number(entry.exit_price).toFixed(2) : "-"}
                </td>
                <td className="px-3.5 py-2 font-bold">
                  {entry.pnl !== null && entry.pnl !== undefined ? (
                    entry.pnl > 0 ? (
                      <span className="text-emerald-400">+{Number(entry.pnl).toFixed(2)}</span>
                    ) : (
                      <span className="text-red-400">{Number(entry.pnl).toFixed(2)}</span>
                    )
                  ) : (
                    <span className="text-zinc-500">-</span>
                  )}
                </td>
                <td className="px-3.5 py-2 font-sans">
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {entry.status}
                  </Badge>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
