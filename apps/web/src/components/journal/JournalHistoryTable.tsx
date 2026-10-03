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
    <div className="overflow-x-auto rounded-md border border-neutral-800 bg-black">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-neutral-800 bg-neutral-950 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
          <tr>
            <th className="px-3.5 py-2.5">Timestamp</th>
            <th className="px-3.5 py-2.5">Symbol</th>
            <th className="px-3.5 py-2.5">Side</th>
            <th className="px-3.5 py-2.5">Entry</th>
            <th className="px-3.5 py-2.5">Exit</th>
            <th className="px-3.5 py-2.5">P&amp;L ($)</th>
            <th className="px-3.5 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900 font-mono text-neutral-300">
          {entries.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center font-sans text-xs text-neutral-500">
                No recorded journal trades in history
              </td>
            </tr>
          ) : (
            entries.map((entry) => (
              <tr key={entry.id} className="transition-colors hover:bg-neutral-950">
                <td className="px-3.5 py-2 font-mono text-[11px] text-neutral-500">
                  {new Date(entry.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-3.5 py-2 font-bold text-neutral-100">{entry.symbol}</td>
                <td className="px-3.5 py-2 font-bold">
                  {entry.direction === "BUY" ? (
                    <span className="text-[#00FF66]">BUY</span>
                  ) : (
                    <span className="text-red-400">SELL</span>
                  )}
                </td>
                <td className="px-3.5 py-2 text-neutral-300">{Number(entry.entry_price).toFixed(2)}</td>
                <td className="px-3.5 py-2 text-neutral-500">
                  {entry.exit_price ? Number(entry.exit_price).toFixed(2) : "—"}
                </td>
                <td className="px-3.5 py-2 font-bold">
                  {entry.pnl !== null && entry.pnl !== undefined ? (
                    entry.pnl > 0 ? (
                      <span className="text-[#00FF66]">+{Number(entry.pnl).toFixed(2)}</span>
                    ) : (
                      <span className="text-red-400">{Number(entry.pnl).toFixed(2)}</span>
                    )
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                </td>
                <td className="px-3.5 py-2">
                  <Badge
                    variant={entry.status === "CLOSED" ? "outline" : "electric"}
                    className="text-[9px] uppercase font-mono"
                  >
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
