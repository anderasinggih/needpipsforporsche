"use client";

import React, { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi } from "lightweight-charts";

export interface CandleData {
  time: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_closed?: boolean;
}

interface TradingViewChartProps {
  currentCandle: CandleData | null;
  historicalCandles?: CandleData[];
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  currentCandle,
  historicalCandles = [],
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create TradingView Chart Instance
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

    if (historicalCandles.length > 0) {
      candleSeries.setData(historicalCandles as any);
    }

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Handle responsive resize
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
    };
  }, []);

  // Update live tick/candle
  useEffect(() => {
    if (candleSeriesRef.current && currentCandle) {
      candleSeriesRef.current.update({
        time: currentCandle.time as any,
        open: currentCandle.open,
        high: currentCandle.high,
        low: currentCandle.low,
        close: currentCandle.close,
      });
    }
  }, [currentCandle]);

  return (
    <div className="relative w-full rounded-xl border border-border bg-[#0D0F17] p-2 shadow-2xl">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white tracking-wide">XAU/USD</span>
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            1M TIMEFRAME
          </span>
        </div>
        <div className="text-right">
          <div className="text-xs text-porsche-muted">CURRENT PRICE</div>
          <div className="text-base font-mono font-bold text-porsche-gold">
            {currentCandle ? `$${currentCandle.close.toFixed(2)}` : "Connecting..."}
          </div>
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
};
