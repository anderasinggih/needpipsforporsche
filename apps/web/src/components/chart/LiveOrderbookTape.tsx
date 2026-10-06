"use client";

import React, { useMemo } from "react";
import { LiveTradeTick } from "@/hooks/useMarketStream";
import { Activity, ArrowDownRight, ArrowUpRight } from "lucide-react";

interface LiveOrderbookTapeProps {
  trades: LiveTradeTick[];
  symbol: string;
  currentPrice?: number;
}

export const LiveOrderbookTape: React.FC<LiveOrderbookTapeProps> = ({
  trades,
  symbol,
  currentPrice,
}) => {
  // Aggregate recent buy vs sell volume ratio
  const { buyVol, sellVol, buyPct } = useMemo(() => {
    let b = 0;
    let s = 0;
    const windowTrades = trades.slice(0, 30);
    for (const t of windowTrades) {
      if (t.side === "BUY") b += t.qty;
      else s += t.qty;
    }
    const total = b + s;
    const pct = total > 0 ? Math.round((b / total) * 100) : 50;
    return { buyVol: b, sellVol: s, buyPct: pct };
  }, [trades]);

  const priceDecimals = symbol.toUpperCase().includes("BTC") ? 2 : 2;

  return (
    <div className="flex flex-col h-full bg-black border border-zinc-800 rounded-md overflow-hidden font-mono select-none">
      {/* Tape Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/80 bg-zinc-950/80">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
          <span className="text-xs font-bold tracking-wider text-zinc-200">
            TAPE / RUNNING TRADES
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
            LIVE WS
          </span>
        </div>
        <div className="text-[11px] text-zinc-400">
          {currentPrice ? (
            <span className="text-zinc-100 font-semibold">
              ${currentPrice.toFixed(priceDecimals)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Buy vs Sell Pressure Bar (Stockbit / Bloomberg terminal style) */}
      <div className="px-3 py-1.5 border-b border-zinc-900 bg-zinc-950/40 text-[10px]">
        <div className="flex items-center justify-between text-zinc-400 mb-1">
          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
            <ArrowUpRight className="h-3 w-3" /> BUY {buyPct}%
          </span>
          <span className="text-zinc-500 font-mono text-[9px]">ORDERFLOW PRESSURE</span>
          <span className="text-red-400 flex items-center gap-1 font-semibold">
            SELL {100 - buyPct}% <ArrowDownRight className="h-3 w-3" />
          </span>
        </div>
        <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${buyPct}%` }}
          />
          <div
            className="h-full bg-red-500 transition-all duration-300"
            style={{ width: `${100 - buyPct}%` }}
          />
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 px-3 py-1 text-[10px] font-semibold text-zinc-500 border-b border-zinc-900 bg-zinc-950/90 tracking-wider">
        <span>TIME</span>
        <span className="text-right">PRICE ($)</span>
        <span className="text-right">LOT / QTY</span>
      </div>

      {/* Stream List (Running Ticker like Stockbit/Indo Premier/Binance) */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/40 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-zinc-600 text-xs gap-1">
            <div className="h-2 w-2 rounded-full bg-zinc-600 animate-ping" />
            <span>Waiting for live market ticks...</span>
          </div>
        ) : (
          trades.slice(0, 30).map((trade, idx) => {
            const isBuy = trade.side === "BUY";
            const date = new Date(trade.time);
            const timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;

            return (
              <div
                key={trade.id || `${trade.time}-${idx}`}
                className={`grid grid-cols-3 px-3 py-1 text-[11px] items-center transition-colors duration-150 ${
                  idx === 0
                    ? isBuy
                      ? "bg-emerald-950/40"
                      : "bg-red-950/40"
                    : "hover:bg-zinc-900/30"
                }`}
              >
                {/* Timestamp */}
                <span className="text-zinc-500 text-[10px] font-mono">
                  {timeStr}
                </span>

                {/* Price (Green for Buy, Red for Sell) */}
                <span
                  className={`text-right font-bold tracking-tight ${
                    isBuy ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {trade.price.toFixed(priceDecimals)}
                </span>

                {/* Lot / Volume */}
                <span
                  className={`text-right font-mono ${
                    trade.qty > 0.5
                      ? isBuy
                        ? "text-emerald-300 font-bold"
                        : "text-red-300 font-bold"
                      : "text-zinc-400"
                  }`}
                >
                  {trade.qty >= 1000
                    ? (trade.qty / 1000).toFixed(1) + "k"
                    : trade.qty.toFixed(4)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Status */}
      <div className="px-3 py-1 text-[9px] bg-zinc-950 border-t border-zinc-900 text-zinc-500 flex justify-between items-center">
        <span>TICK SPEED: ULTRA FAST</span>
        <span className="text-emerald-400 font-semibold flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
          STREAMING
        </span>
      </div>
    </div>
  );
};
