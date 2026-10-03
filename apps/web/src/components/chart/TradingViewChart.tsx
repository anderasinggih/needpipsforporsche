"use client";

import React, { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, LineType, LineStyle } from "lightweight-charts";

export interface CandleData {
  time: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_closed?: boolean;
}

export interface PositionLine {
  id: string;
  price: number;
  type: "ENTRY" | "SL" | "TP";
  direction: "BUY" | "SELL";
  label: string;
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
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  currentCandle,
  positions = [],
  historicalCandles = [],
  symbol = "XAUUSD",
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesMap = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "#0D0F17" },
        textColor: "#94A3B8",
      },
      grid: {
        vertLines: { color: "#1A1D2B" },
        horzLines: { color: "#1A1D2B" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: "#1E2230",
      },
      timeScale: {
        borderColor: "#1E2230",
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 520,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10B981",
      downColor: "#EF4444",
      borderVisible: false,
      wickUpColor: "#10B981",
      wickDownColor: "#EF4444",
    });

    // Only load candles when provided from real data feed
    if (historicalCandles.length > 0) {
      candleSeries.setData(historicalCandles as any);
    }

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

  const lastBarTimeRef = useRef<number>(0);

  useEffect(() => {
    if (candleSeriesRef.current && currentCandle) {
      try {
        const candleTime = Number(currentCandle.time);
        if (candleTime >= lastBarTimeRef.current) {
          lastBarTimeRef.current = candleTime;
          candleSeriesRef.current.update({
            time: candleTime as any,
            open: currentCandle.open,
            high: currentCandle.high,
            low: currentCandle.low,
            close: currentCandle.close,
          });
        }
      } catch (err) {
        console.warn("Skipping out-of-order candle update:", err);
      }
    }
  }, [currentCandle]);

  useEffect(() => {
    if (!chartRef.current) return;

    const lineMap = lineSeriesMap.current;
    const activeLineIds = new Set<string>();

    positions.forEach((pos) => {
      const entryId = `pos_${pos.ticket}_entry`;
      activeLineIds.add(entryId);
      if (!lineMap.has(entryId)) {
        const line = chartRef.current!.addLineSeries({
          color: pos.type === "BUY" ? "#10B981" : "#EF4444",
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
            color: "#EF4444",
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
            color: "#10B981",
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
    <div className="relative w-full rounded-xl border border-border bg-[#0D0F17] p-2 shadow-2xl">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white tracking-wide">{symbol}</span>
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            1M TIMEFRAME
          </span>
          {positions.length > 0 && (
            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
              {positions.length} OPEN POSITION{positions.length > 1 ? 'S' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-porsche-muted">CURRENT PRICE</div>
            <div className="text-base font-mono font-bold text-porsche-gold">
              {currentCandle ? `$${currentCandle.close.toFixed(2)}` : "Awaiting Data..."}
            </div>
          </div>
          {positions.length > 0 && (
            <div className="text-right">
              <div className="text-xs text-porsche-muted">FLOATING PnL</div>
              <div className={`text-base font-mono font-bold ${totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                ${totalPnL.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
};
