"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[140px]">TIMESTAMP</TableHead>
          <TableHead className="w-[100px]">SYMBOL</TableHead>
          <TableHead className="w-[80px]">SIDE</TableHead>
          <TableHead className="text-right w-[100px]">ENTRY</TableHead>
          <TableHead className="text-right w-[100px]">EXIT</TableHead>
          <TableHead className="text-right w-[110px]">P&amp;L ($)</TableHead>
          <TableHead className="w-[90px]">STATUS</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="h-24 text-center font-sans text-xs text-zinc-500">
              No recorded journal trades in history
            </TableCell>
          </TableRow>
        ) : (
          entries.map((entry) => {
            const isBuy = entry.direction.toUpperCase() === "BUY";
            const pnlVal = entry.pnl !== null && entry.pnl !== undefined ? Number(entry.pnl) : null;

            return (
              <TableRow key={entry.id}>
                <TableCell className="text-zinc-500 text-[11px] whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell className="font-semibold text-zinc-100">
                  {entry.symbol}
                </TableCell>
                <TableCell>
                  <Badge variant={isBuy ? "default" : "destructive"}>
                    {entry.direction}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-zinc-300 tabular-nums">
                  {Number(entry.entry_price).toFixed(2)}
                </TableCell>
                <TableCell className="text-right text-zinc-500 tabular-nums">
                  {entry.exit_price ? Number(entry.exit_price).toFixed(2) : "—"}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {pnlVal !== null ? (
                    <span className={pnlVal >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {pnlVal >= 0 ? `+${pnlVal.toFixed(2)}` : pnlVal.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={entry.status === "CLOSED" ? "secondary" : "secondary"}
                    className="text-[9px] uppercase font-mono"
                  >
                    {entry.status}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
};
