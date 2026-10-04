"use client";

import React, { useEffect, useRef, useState } from "react";
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

export interface AIMapping {
  supportLevel?: number;
  resistanceLevel?: number;
  trendDirection?: string;
  trendlineStart?: { time: number; price: number };
  trendlineEnd?: { time: number; price: number };
}

export interface AISignalOverlay {
  signal?: "BUY" | "SELL" | "WAIT";
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface TradingViewChartProps {
  currentCandle: CandleData | null;
  positions?: Position[];
  historicalCandles?: CandleData[];
  symbol?: string;
  timeframe?: string;
  onSymbolChange?: (symbol: string) => void;
  onTimeframeChange?: (timeframe: string) => void;
  lastTickTimestamp?: number;
  aiMapping?: AIMapping | null;
  aiSignal?: AISignalOverlay | null;
}

// Clean timeframe labels without parentheses or translation text
const TIMEFRAMES = [
  { label: "1s", value: "1s" },
  { label: "M1", value: "1m" },
  { label: "M3", value: "3m" },
  { label: "M5", value: "5m" },
  { label: "M15", value: "15m" },
  { label: "M30", value: "30m" },
  { label: "H1", value: "1h" },
  { label: "H4", value: "4h" },
  { label: "D1", value: "1d" },
];

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  currentCandle,
  positions = [],
  historicalCandles = [],
  symbol = "BTCUSD",
  timeframe = "1m",
  onSymbolChange,
  onTimeframeChange,
  lastTickTimestamp,
  aiMapping,
  aiSignal,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesMap = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const isDataSetRef = useRef(false);
  const [pulse, setPulse] = useState(false);

  // Trigger visual pulse on real-time tick update
  useEffect(() => {
    if (lastTickTimestamp) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 250);
      return () => clearTimeout(timer);
    }
  }, [lastTickTimestamp, currentCandle?.close]);

  // Inisialisasi Chart: Candlestick TETAP Hijau & Merah standar trader, latar belakang gelap MT5
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#64748B",
      },
      grid: {
        vertLines: { color: "#0B132B" },
        horzLines: { color: "#0B132B" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: "#1E293B",
        autoScale: true,
      },
      timeScale: {
        borderColor: "#1E293B",
        timeVisible: true,
        secondsVisible: timeframe.endsWith("s"),
      },
      width: chartContainerRef.current.clientWidth,
      height: 640,
    });

    // Chart Candlestick TETAP HIJAU & MERAH
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#00FF66",
      downColor: "#FF3344",
      borderVisible: true,
      borderColor: "#00FF66",
      borderUpColor: "#00FF66",
      borderDownColor: "#FF3344",
      wickUpColor: "#00FF66",
      wickDownColor: "#FF3344",
      priceFormat: {
        type: "price",
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
      isDataSetRef.current = false;
    };
  }, []);

  // Reset viewport state saat symbol atau timeframe berganti
  useEffect(() => {
    isDataSetRef.current = false;
  }, [symbol, timeframe]);

  // Update whole series saat historicalCandles tiba
  useEffect(() => {
    if (candleSeriesRef.current && historicalCandles.length > 0) {
      const sorted = [...historicalCandles].sort((a, b) => a.time - b.time);
      const unique = sorted.filter((item, index, self) => 
        index === 0 || item.time > self[index - 1].time
      );
      candleSeriesRef.current.setData(unique as any);
      
      if (chartRef.current && !isDataSetRef.current) {
        chartRef.current.timeScale().fitContent();
      }
      isDataSetRef.current = true;
    }
  }, [historicalCandles, symbol, timeframe]);

  // Real-time tick update
  useEffect(() => {
    if (candleSeriesRef.current && isDataSetRef.current && currentCandle) {
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

  // AI Mapping & Sinyal Overlay (Trendline, Support, Resistance, SL, TP)
  useEffect(() => {
    if (!chartRef.current || !isDataSetRef.current || historicalCandles.length === 0) return;

    const lineMap = lineSeriesMap.current;
    const activeOverlayIds = new Set<string>();

    const firstTime = historicalCandles[0]?.time;
    const lastTime = historicalCandles[historicalCandles.length - 1]?.time || Math.floor(Date.now() / 1000);

    // 1. Garis Support AI (Navy/Blue dashed khas MT5)
    if (aiMapping?.supportLevel && firstTime) {
      const id = "ai_support_line";
      activeOverlayIds.add(id);
      if (!lineMap.has(id)) {
        const line = chartRef.current.addLineSeries({
          color: "#3B82F6",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          title: `AI Support @ ${aiMapping.supportLevel}`,
        });
        line.setData([
          { time: firstTime as any, value: aiMapping.supportLevel },
          { time: lastTime as any, value: aiMapping.supportLevel },
        ]);
        lineMap.set(id, line);
      }
    }

    // 2. Garis Resistance AI (Orange dashed)
    if (aiMapping?.resistanceLevel && firstTime) {
      const id = "ai_resistance_line";
      activeOverlayIds.add(id);
      if (!lineMap.has(id)) {
        const line = chartRef.current.addLineSeries({
          color: "#F59E0B",
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          title: `AI Resistance @ ${aiMapping.resistanceLevel}`,
        });
        line.setData([
          { time: firstTime as any, value: aiMapping.resistanceLevel },
          { time: lastTime as any, value: aiMapping.resistanceLevel },
        ]);
        lineMap.set(id, line);
      }
    }

    // 3. Garis Tren AI (Trendline)
    if (aiMapping?.trendlineStart && aiMapping?.trendlineEnd) {
      const id = "ai_trend_line";
      activeOverlayIds.add(id);
      if (!lineMap.has(id)) {
        const line = chartRef.current.addLineSeries({
          color: "#60A5FA",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          title: `AI Trendline (${aiMapping.trendDirection || "MAPPING"})`,
        });
        line.setData([
          { time: (firstTime > aiMapping.trendlineStart.time ? firstTime : aiMapping.trendlineStart.time) as any, value: aiMapping.trendlineStart.price },
          { time: lastTime as any, value: aiMapping.trendlineEnd.price },
        ]);
        lineMap.set(id, line);
      }
    }

    // 4. Sinyal Saran Entry AI (TP Hijau & SL Merah)
    if (aiSignal?.stopLoss && firstTime) {
      const id = "ai_signal_sl";
      activeOverlayIds.add(id);
      if (!lineMap.has(id)) {
        const line = chartRef.current.addLineSeries({
          color: "#EF4444",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          title: `Saran SL @ ${aiSignal.stopLoss}`,
        });
        line.setData([
          { time: firstTime as any, value: aiSignal.stopLoss },
          { time: lastTime as any, value: aiSignal.stopLoss },
        ]);
        lineMap.set(id, line);
      }
    }

    if (aiSignal?.takeProfit && firstTime) {
      const id = "ai_signal_tp";
      activeOverlayIds.add(id);
      if (!lineMap.has(id)) {
        const line = chartRef.current.addLineSeries({
          color: "#10B981",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          title: `Saran TP @ ${aiSignal.takeProfit}`,
        });
        line.setData([
          { time: firstTime as any, value: aiSignal.takeProfit },
          { time: lastTime as any, value: aiSignal.takeProfit },
        ]);
        lineMap.set(id, line);
      }
    }

    // Bersihkan garis overlay lama jika mapping berganti
    lineMap.forEach((line, id) => {
      if (id.startsWith("ai_") && !activeOverlayIds.has(id)) {
        chartRef.current!.removeSeries(line);
        lineMap.delete(id);
      }
    });
  }, [aiMapping, aiSignal, historicalCandles]);

  // Position SL/TP markers dari Trade/Engine
  useEffect(() => {
    if (!chartRef.current) return;

    const lineMap = lineSeriesMap.current;
    const activeLineIds = new Set<string>();

    positions.forEach((pos) => {
      const entryId = `pos_${pos.ticket}_entry`;
      activeLineIds.add(entryId);
      if (!lineMap.has(entryId)) {
        const line = chartRef.current!.addLineSeries({
          color: pos.type === "BUY" ? "#00FF66" : "#FF3344",
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
      if (!id.startsWith("ai_") && !activeLineIds.has(id)) {
        chartRef.current!.removeSeries(line);
        lineMap.delete(id);
      }
    });
  }, [positions]);

  const totalPnL = positions.reduce((sum, pos) => sum + pos.profit, 0);

  return (
    <div className="relative w-full rounded-md bg-black overflow-hidden border border-slate-900">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 px-4 py-2 bg-[#060D1F]">
        <div className="flex items-center gap-3">
          {/* Pair Switcher: XAUUSD & BTCUSD */}
          <div className="flex items-center rounded-md bg-slate-950 p-0.5 border border-slate-800">
            <button
              onClick={() => onSymbolChange?.("BTCUSD")}
              className={`px-3 py-1 text-xs font-mono font-bold rounded transition-all ${
                symbol.toUpperCase().startsWith("BTC")
                  ? "bg-[#1E40AF] text-white shadow-[0_0_12px_rgba(30,64,175,0.6)] border border-[#3B82F6]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              BTC/USD
            </button>
            <button
              onClick={() => onSymbolChange?.("XAUUSD")}
              className={`px-3 py-1 text-xs font-mono font-bold rounded transition-all ${
                symbol.toUpperCase().startsWith("XAU") || symbol.toUpperCase().startsWith("PAXG")
                  ? "bg-[#1E40AF] text-white shadow-[0_0_12px_rgba(30,64,175,0.6)] border border-[#3B82F6]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              XAU/USD
            </button>
          </div>

          {/* Timeframe Dropdown Bersih Tanpa Terjemahan / Tanpa Kurung */}
          <div className="flex items-center">
            <select
              value={timeframe}
              onChange={(e) => onTimeframeChange?.(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-[#60A5FA] text-xs font-mono font-bold rounded px-2.5 py-1 focus:outline-none focus:border-[#3B82F6] cursor-pointer hover:bg-slate-900 transition-colors"
            >
              {TIMEFRAMES.map((tf) => (
                <option key={tf.value} value={tf.value} className="bg-slate-950 text-white font-mono">
                  {tf.label}
                </option>
              ))}
            </select>
          </div>

          {/* Live Feed Status */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${pulse ? "bg-[#3B82F6] scale-125 shadow-[0_0_8px_#3B82F6]" : "bg-slate-600"} transition-all duration-150`} />
            <span className="text-[#60A5FA]">FEED</span>
          </div>

          {/* AI Signal Badge jika ada */}
          {aiSignal?.signal && (
            <span className={`rounded px-2.5 py-0.5 text-[10px] font-mono font-bold border ${
              aiSignal.signal === "BUY"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : aiSignal.signal === "SELL"
                ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                : "bg-amber-500/15 text-amber-400 border-amber-500/30"
            }`}>
              AI: {aiSignal.signal}
            </span>
          )}

          {positions.length > 0 && (
            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-amber-400 border border-amber-500/20">
              {positions.length} OPEN
            </span>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center justify-end gap-1.5">
              <span>PRICE</span>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${pulse ? "bg-[#3B82F6]" : "bg-slate-700"} transition-all`} />
            </div>
            <div className={`text-sm font-mono font-bold transition-colors duration-150 ${pulse ? "text-white" : "text-[#60A5FA]"}`}>
              {currentCandle ? `$${currentCandle.close.toFixed(2)}` : "---.--"}
            </div>
          </div>
          {positions.length > 0 && (
            <div className="text-right">
              <div className="text-[10px] font-mono text-slate-400 uppercase">PnL</div>
              <div className={`text-sm font-mono font-bold ${totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
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
