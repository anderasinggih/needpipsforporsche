"use client";

import React, { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, LineStyle, ColorType } from "lightweight-charts";

export interface CandleData {
  time: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_closed?: boolean;
}

export interface Position {
  ticket: number;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  open_price: number;
  current_price: number;
  sl: number;
  tp: number;
  profit: number;
  time: number;
}

interface TradingViewChartProps {
  currentCandle: CandleData | null;
  positions?: Position[];
  historicalCandles?: CandleData[];
  symbol?: string;
  onSymbolChange?: (symbol: string) => void;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  currentCandle,
  positions = [],
  historicalCandles = [],
  symbol = "BTCUSD",
  onSymbolChange,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesMap = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#737373",
      },
      grid: {
        vertLines: { color: "#141414" },
        horzLines: { color: "#141414" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: "#262626",
        autoScale: true,
      },
      timeScale: {
        borderColor: "#262626",
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 640,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#00FF66",
      downColor: "#FF3366",
      borderVisible: false,
      wickUpColor: "#00FF66",
      wickDownColor: "#FF3366",
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      lineSeriesMap.current.clear();
    };
  }, []);

  const isDataSetRef = useRef(false);

  // Reset viewport state when symbol changes
  useEffect(() => {
    isDataSetRef.current = false;
  }, [symbol]);

  // Update whole series when historicalCandles arrive (only fitContent once per symbol)
  useEffect(() => {
    if (candleSeriesRef.current && historicalCandles.length > 0) {
      // Ensure sorted ascending and deduplicated by time
      const sorted = [...historicalCandles].sort((a, b) => a.time - b.time);
      const unique = sorted.filter((item, index, self) => 
        index === 0 || item.time > self[index - 1].time
      );
      candleSeriesRef.current.setData(unique as any);
      
      if (chartRef.current && !isDataSetRef.current) {
        chartRef.current.timeScale().fitContent();
        isDataSetRef.current = true;
      }
    }
  }, [historicalCandles, symbol]);

  // Real-time tick update
  useEffect(() => {
    if (candleSeriesRef.current && currentCandle) {
      try {
        const candleTime = Number(currentCandle.time);
        candleSeriesRef.current.update({
          time: candleTime as any,
          open: Number(currentCandle.open),
          high: Number(currentCandle.high),
          low: Number(currentCandle.low),
          close: Number(currentCandle.close),
        });
      } catch (err) {
        console.warn("Candle update error:", err);
      }
    }
  }, [currentCandle]);

  // Position SL/TP markers
  useEffect(() => {
    if (!chartRef.current) return;

    const lineMap = lineSeriesMap.current;
    const activeLineIds = new Set<string>();

    positions.forEach((pos) => {
      const entryId = `pos_${pos.ticket}_entry`;
      activeLineIds.add(entryId);
      if (!lineMap.has(entryId)) {
        const line = chartRef.current!.addLineSeries({
          color: pos.type === "BUY" ? "#00FF66" : "#FF3366",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          title: `${pos.type} Entry @ ${pos.open_price.toFixed(2)}`,
        });
        line.setData([{ time: pos.time as any, value: pos.open_price }]);
        lineMap.set(entryId, line);
      }

      const slId = `pos_${pos.ticket}_sl`;
      if (pos.sl > 0) {
        activeLineIds.add(slId);
        if (!lineMap.has(slId)) {
          const line = chartRef.current!.addLineSeries({
            color: "#FF3366",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            title: `SL @ ${pos.sl.toFixed(2)}`,
          });
          line.setData([{ time: pos.time as any, value: pos.sl }]);
          lineMap.set(slId, line);
        }
      }

      const tpId = `pos_${pos.ticket}_tp`;
      if (pos.tp > 0) {
        activeLineIds.add(tpId);
        if (!lineMap.has(tpId)) {
          const line = chartRef.current!.addLineSeries({
            color: "#00FF66",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            title: `TP @ ${pos.tp.toFixed(2)}`,
          });
          line.setData([{ time: pos.time as any, value: pos.tp }]);
          lineMap.set(tpId, line);
        }
      }
    });

    lineMap.forEach((line, id) => {
      if (!activeLineIds.has(id)) {
        chartRef.current!.removeSeries(line);
        lineMap.delete(id);
      }
    });
  }, [positions]);

  const totalPnL = positions.reduce((sum, pos) => sum + pos.profit, 0);

  return (
    <div className="relative w-full rounded-md bg-black overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-800/80 px-4 py-2 bg-[#050505]">
        <div className="flex items-center gap-3">
          {/* Pair Switcher: XAUUSD & BTCUSD */}
          <div className="flex items-center rounded-md bg-neutral-900/90 p-0.5 border border-neutral-800">
            <button
              onClick={() => onSymbolChange?.("BTCUSD")}
              className={`px-3 py-1 text-xs font-mono font-bold rounded transition-all ${
                symbol.toUpperCase().startsWith("BTC")
                  ? "bg-[#00FF66] text-black shadow-[0_0_10px_rgba(0,255,102,0.4)]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              BTC/USD
            </button>
            <button
              onClick={() => onSymbolChange?.("XAUUSD")}
              className={`px-3 py-1 text-xs font-mono font-bold rounded transition-all ${
                symbol.toUpperCase().startsWith("XAU") || symbol.toUpperCase().startsWith("PAXG")
                  ? "bg-[#00FF66] text-black shadow-[0_0_10px_rgba(0,255,102,0.4)]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              XAU/USD (GOLD)
            </button>
          </div>

          <span className="rounded bg-[#00FF66]/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#00FF66] border border-[#00FF66]/20">
            1M TIMEFRAME
          </span>
          {positions.length > 0 && (
            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-amber-400 border border-amber-500/20">
              {positions.length} OPEN POSITION{positions.length > 1 ? 'S' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] font-mono text-neutral-500 uppercase">CURRENT PRICE</div>
            <div className="text-sm font-mono font-bold text-[#00FF66]">
              {currentCandle ? `$${currentCandle.close.toFixed(2)}` : "Awaiting Data..."}
            </div>
          </div>
          {positions.length > 0 && (
            <div className="text-right">
              <div className="text-[10px] font-mono text-neutral-500 uppercase">FLOATING PnL</div>
              <div className={`text-sm font-mono font-bold ${totalPnL >= 0 ? "text-[#00FF66]" : "text-red-400"}`}>
                ${totalPnL.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full h-[640px]" />
    </div>
  );
};
