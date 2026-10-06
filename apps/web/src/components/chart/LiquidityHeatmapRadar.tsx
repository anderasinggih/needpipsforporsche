"use client";

import React, { useMemo } from "react";
import { MarketDepthState } from "@/hooks/useMarketStream";
import { Layers, ShieldAlert, Zap, TrendingUp, TrendingDown, Crosshair } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LiquidityHeatmapRadarProps {
  depth: MarketDepthState | null;
  currentPrice?: number;
  symbol: string;
}

export const LiquidityHeatmapRadar: React.FC<LiquidityHeatmapRadarProps> = ({
  depth,
  currentPrice = 0,
  symbol,
}) => {
  const priceDecimals = symbol.toUpperCase().includes("BTC") ? 2 : 2;

  // Find highest liquidity cluster wall (Whale resting orders)
  const whaleWall = useMemo(() => {
    if (!depth) return null;
    let maxQty = 0;
    let wallPrice = 0;
    let wallSide: "BID" | "ASK" = "BID";

    for (const b of depth.bids) {
      if (b.qty > maxQty) {
        maxQty = b.qty;
        wallPrice = b.price;
        wallSide = "BID";
      }
    }
    for (const a of depth.asks) {
      if (a.qty > maxQty) {
        maxQty = a.qty;
        wallPrice = a.price;
        wallSide = "ASK";
      }
    }

    return { maxQty, wallPrice, wallSide };
  }, [depth]);

  const maxTotal = useMemo(() => {
    if (!depth) return 1;
    const bidTotal = depth.bids[depth.bids.length - 1]?.total || 1;
    const askTotal = depth.asks[depth.asks.length - 1]?.total || 1;
    return Math.max(bidTotal, askTotal, 1);
  }, [depth]);

  return (
    <div className="flex flex-col h-full bg-black border border-zinc-800 rounded-md overflow-hidden font-mono select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/80 bg-zinc-950">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-zinc-200">
            LIQUIDITY HEATMAP &amp; DEPTH RADAR
          </span>
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 border-cyan-800/80 text-cyan-400 bg-cyan-950/40"
          >
            ORDERBOOK L2
          </Badge>
        </div>

        {depth && (
          <div className="text-[10px] text-zinc-400 flex items-center gap-2">
            <span>Spread: <strong className="text-zinc-200">${depth.spread.toFixed(2)}</strong></span>
          </div>
        )}
      </div>

      {/* Whale Resting Liquidity Callout */}
      {whaleWall && whaleWall.maxQty > 0 && (
        <div className="px-3 py-1.5 bg-zinc-950/70 border-b border-zinc-900 flex items-center justify-between text-[10px]">
          <span className="text-zinc-400 flex items-center gap-1">
            <Crosshair className="h-3 w-3 text-amber-400 animate-pulse" />
            WHALE RESTING POOL:
          </span>
          <span
            className={`font-bold ${
              whaleWall.wallSide === "BID" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {whaleWall.wallSide === "BID" ? "BUY WALL" : "SELL WALL"} @ ${whaleWall.wallPrice.toFixed(priceDecimals)} ({whaleWall.maxQty.toFixed(2)} Lot)
          </span>
        </div>
      )}

      {/* Liquidity Imbalance Bar */}
      {depth && (
        <div className="px-3 py-1.5 border-b border-zinc-900 bg-zinc-950/40 text-[10px]">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-emerald-400 font-semibold">
              BIDS {depth.totalBidLiquidity.toFixed(1)}
            </span>
            <span className="text-zinc-500 font-mono text-[9px]">
              DEPTH IMBALANCE: {depth.imbalancePct > 0 ? `+${depth.imbalancePct}% BULLISH` : `${depth.imbalancePct}% BEARISH`}
            </span>
            <span className="text-red-400 font-semibold">
              ASKS {depth.totalAskLiquidity.toFixed(1)}
            </span>
          </div>
          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all duration-200"
              style={{
                width: `${Math.max(5, Math.min(95, 50 + depth.imbalancePct / 2))}%`,
              }}
            />
            <div
              className="h-full bg-red-500 transition-all duration-200"
              style={{
                width: `${Math.max(5, Math.min(95, 50 - depth.imbalancePct / 2))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Heatmap Depth Ladders (Asks Top -> Spread Center -> Bids Bottom) */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/40 p-2 space-y-2">
        {!depth ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-600 text-xs gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Connecting to L2 orderbook stream...</span>
          </div>
        ) : (
          <div className="space-y-1">
            {/* ASKS (Sell Resting Orders - Rendered in Reverse so lowest ask is closest to center) */}
            <div className="space-y-0.5">
              <div className="text-[9px] text-red-500 font-bold px-1 uppercase tracking-wider">
                Ask Liquidity Pool (Resistance Ceilings)
              </div>
              {depth.asks.slice(0, 8).reverse().map((ask, idx) => {
                const depthPct = Math.min(100, (ask.total / maxTotal) * 100);
                const isWhale = whaleWall?.wallSide === "ASK" && whaleWall?.wallPrice === ask.price;

                return (
                  <div
                    key={`ask-${idx}`}
                    className="relative flex items-center justify-between px-2 py-0.5 text-[11px] rounded overflow-hidden"
                  >
                    {/* Heatmap Bar (Coinglass style red gradient glow) */}
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-red-950/50 border-r-2 border-red-500 transition-all duration-150"
                      style={{ width: `${depthPct}%` }}
                    />

                    <span className="relative z-10 text-red-400 font-bold">
                      ${ask.price.toFixed(priceDecimals)}
                      {isWhale && <span className="ml-1 text-[9px] text-amber-400">★ WHALE</span>}
                    </span>
                    <span className="relative z-10 text-zinc-400 font-mono text-[10px]">
                      {ask.qty.toFixed(2)} ({ask.total.toFixed(1)})
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Current Price Midpoint Divider */}
            <div className="py-1 px-2 my-1 bg-zinc-900/80 border border-zinc-800 rounded flex items-center justify-between text-xs font-bold text-white">
              <span className="text-zinc-400 text-[10px]">MID PRICE</span>
              <span className="text-cyan-400 font-mono text-sm tracking-wide">
                ${currentPrice ? currentPrice.toFixed(priceDecimals) : "---.--"}
              </span>
              <span className="text-[9px] text-zinc-500 font-normal">
                {depth.spread ? `±$${depth.spread.toFixed(2)}` : ""}
              </span>
            </div>

            {/* BIDS (Buy Resting Orders) */}
            <div className="space-y-0.5">
              <div className="text-[9px] text-emerald-500 font-bold px-1 uppercase tracking-wider">
                Bid Liquidity Pool (Support Floors)
              </div>
              {depth.bids.slice(0, 8).map((bid, idx) => {
                const depthPct = Math.min(100, (bid.total / maxTotal) * 100);
                const isWhale = whaleWall?.wallSide === "BID" && whaleWall?.wallPrice === bid.price;

                return (
                  <div
                    key={`bid-${idx}`}
                    className="relative flex items-center justify-between px-2 py-0.5 text-[11px] rounded overflow-hidden"
                  >
                    {/* Heatmap Bar (Coinglass style emerald gradient glow) */}
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-emerald-950/50 border-r-2 border-emerald-500 transition-all duration-150"
                      style={{ width: `${depthPct}%` }}
                    />

                    <span className="relative z-10 text-emerald-400 font-bold">
                      ${bid.price.toFixed(priceDecimals)}
                      {isWhale && <span className="ml-1 text-[9px] text-amber-400">★ WHALE</span>}
                    </span>
                    <span className="relative z-10 text-zinc-400 font-mono text-[10px]">
                      {bid.qty.toFixed(2)} ({bid.total.toFixed(1)})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1 text-[9px] bg-zinc-950 border-t border-zinc-900 text-zinc-500 flex justify-between items-center">
        <span>RADAR RESOLUTION: 100MS L2</span>
        <span className="text-cyan-400 font-semibold flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
          HEATMAP ONLINE
        </span>
      </div>
    </div>
  );
};
