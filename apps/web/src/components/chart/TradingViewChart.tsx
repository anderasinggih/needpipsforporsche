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

export interface PositionBox {
  startTime: number;
  endTime: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
}

export interface AISignalOverlay {
  signal?: "BUY" | "SELL" | "WAIT";
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  positionBox?: PositionBox;
  predictiveTrajectory?: Array<{ time: number; price: number }>;
  note?: string;
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
  const areaSeriesMap = useRef<Map<string, ISeriesApi<"Area">>>(new Map());
  const isDataSetRef = useRef(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (lastTickTimestamp) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 200);
      return () => clearTimeout(timer);
    }
  }, [lastTickTimestamp, currentCandle?.close]);

  // Initialize TradingView Chart: Standard TradingView Candlestick Colors (#089981 & #f23645)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#71717A", // zinc-500
      },
      grid: {
        vertLines: { color: "#18181B" }, // zinc-900
        horzLines: { color: "#18181B" },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "#27272A",
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: "#27272A",
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: "#27272A",
        autoScale: true,
      },
      timeScale: {
        borderColor: "#27272A",
        timeVisible: true,
        secondsVisible: timeframe.endsWith("s"),
      },
      width: chartContainerRef.current.clientWidth,
      height: 640,
    });

    // Standard TradingView Candlestick Palette: Green #089981 / Red #f23645
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#089981",
      downColor: "#f23645",
      borderVisible: true,
      borderColor: "#089981",
      borderUpColor: "#089981",
      borderDownColor: "#f23645",
      wickUpColor: "#089981",
      wickDownColor: "#f23645",
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
      areaSeriesMap.current.clear();
      isDataSetRef.current = false;
    };
  }, []);

  useEffect(() => {
    isDataSetRef.current = false;
  }, [symbol, timeframe]);

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

  // AI Overlays: Bounded Position Box (SL/TP like Gambar 2) + Predictive Trajectory Line + Support/Resistance Lines
  useEffect(() => {
    if (!chartRef.current || !isDataSetRef.current || historicalCandles.length === 0) return;

    const lineMap = lineSeriesMap.current;
    const areaMap = areaSeriesMap.current;
    const activeOverlayIds = new Set<string>();

    const firstTime = historicalCandles[0]?.time;
    const lastHistoricalTime = historicalCandles[historicalCandles.length - 1]?.time || Math.floor(Date.now() / 1000);

    // 1. Support Line (bounded to recent range)
    if (aiMapping?.supportLevel && firstTime) {
      const id = "ai_support_line";
      activeOverlayIds.add(id);
      if (!lineMap.has(id)) {
        const line = chartRef.current.addLineSeries({
          color: "#3B82F6",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          title: `Support @ ${aiMapping.supportLevel}`,
        });
        line.setData([
          { time: firstTime as any, value: aiMapping.supportLevel },
          { time: lastHistoricalTime as any, value: aiMapping.supportLevel },
        ]);
        lineMap.set(id, line);
      }
    }

    // 2. Resistance Line
    if (aiMapping?.resistanceLevel && firstTime) {
      const id = "ai_resistance_line";
      activeOverlayIds.add(id);
      if (!lineMap.has(id)) {
        const line = chartRef.current.addLineSeries({
          color: "#F59E0B",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          title: `Resistance @ ${aiMapping.resistanceLevel}`,
        });
        line.setData([
          { time: firstTime as any, value: aiMapping.resistanceLevel },
          { time: lastHistoricalTime as any, value: aiMapping.resistanceLevel },
        ]);
        lineMap.set(id, line);
      }
    }

    // 3. AI Trendline
    if (aiMapping?.trendlineStart && aiMapping?.trendlineEnd) {
      const id = "ai_trend_line";
      activeOverlayIds.add(id);
      if (!lineMap.has(id)) {
        const line = chartRef.current.addLineSeries({
          color: "#93C5FD",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          title: `Trendline (${aiMapping.trendDirection || "MAPPING"})`,
        });
        line.setData([
          {
            time: (firstTime > aiMapping.trendlineStart.time ? firstTime : aiMapping.trendlineStart.time) as any,
            value: aiMapping.trendlineStart.price,
          },
          { time: lastHistoricalTime as any, value: aiMapping.trendlineEnd.price },
        ]);
        lineMap.set(id, line);
      }
    }

    // 4. TradingView Long/Short Position Box (Gambar 2):
    // Bounded box from entry time to target end time (NOT infinite lines)
    if (aiSignal?.entryPrice && aiSignal?.stopLoss && aiSignal?.takeProfit) {
      const boxStart = aiSignal.positionBox?.startTime || lastHistoricalTime;
      const boxEnd = aiSignal.positionBox?.endTime || boxStart + 60 * 15;
      const isBuy = (aiSignal.signal || "BUY") === "BUY";

      // 4a. Green Profit Box Area Series (Entry to TP)
      const tpAreaId = "ai_box_tp_area";
      activeOverlayIds.add(tpAreaId);
      if (!areaMap.has(tpAreaId)) {
        const area = chartRef.current.addAreaSeries({
          topColor: "rgba(8, 153, 129, 0.28)",
          bottomColor: "rgba(8, 153, 129, 0.08)",
          lineColor: "#089981",
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          title: `TP: ${aiSignal.takeProfit}`,
        });
        area.setData([
          { time: boxStart as any, value: aiSignal.takeProfit },
          { time: boxEnd as any, value: aiSignal.takeProfit },
        ]);
        areaMap.set(tpAreaId, area);
      }

      // 4b. Red Loss Box Area Series (Entry to SL)
      const slAreaId = "ai_box_sl_area";
      activeOverlayIds.add(slAreaId);
      if (!areaMap.has(slAreaId)) {
        const area = chartRef.current.addAreaSeries({
          topColor: "rgba(242, 54, 69, 0.08)",
          bottomColor: "rgba(242, 54, 69, 0.28)",
          lineColor: "#f23645",
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          title: `SL: ${aiSignal.stopLoss}`,
        });
        area.setData([
          { time: boxStart as any, value: aiSignal.stopLoss },
          { time: boxEnd as any, value: aiSignal.stopLoss },
        ]);
        areaMap.set(slAreaId, area);
      }

      // 4c. Bounded Middle Entry Line
      const entryLineId = "ai_box_entry_line";
      activeOverlayIds.add(entryLineId);
      if (!lineMap.has(entryLineId)) {
        const line = chartRef.current.addLineSeries({
          color: "#E4E4E7", // zinc-200
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          title: `Entry @ ${aiSignal.entryPrice}`,
        });
        line.setData([
          { time: boxStart as any, value: aiSignal.entryPrice },
          { time: boxEnd as any, value: aiSignal.entryPrice },
        ]);
        lineMap.set(entryLineId, line);
      }

      // 4d. Bounded Vertical Anchor Line at box start
      const anchorStartId = "ai_box_anchor_start";
      activeOverlayIds.add(anchorStartId);
      if (!lineMap.has(anchorStartId)) {
        const line = chartRef.current.addLineSeries({
          color: "#52525B", // zinc-600
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
        });
        line.setData([
          { time: boxStart as any, value: aiSignal.stopLoss },
          { time: boxStart as any, value: aiSignal.takeProfit },
        ]);
        lineMap.set(anchorStartId, line);
      }

      // 4e. Bounded Vertical Anchor Line at box end
      const anchorEndId = "ai_box_anchor_end";
      activeOverlayIds.add(anchorEndId);
      if (!lineMap.has(anchorEndId)) {
        const line = chartRef.current.addLineSeries({
          color: "#52525B", // zinc-600
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
        });
        line.setData([
          { time: boxEnd as any, value: aiSignal.stopLoss },
          { time: boxEnd as any, value: aiSignal.takeProfit },
        ]);
        lineMap.set(anchorEndId, line);
      }
    }

    // 5. Predictive Trajectory Line (Garis Prediksi Masa Depan dari AI)
    if (aiSignal?.predictiveTrajectory && aiSignal.predictiveTrajectory.length > 0) {
      const trajId = "ai_predictive_trajectory";
      activeOverlayIds.add(trajId);
      if (!lineMap.has(trajId)) {
        const trajColor = (aiSignal.signal || "BUY") === "BUY" ? "#38BDF8" : "#F43F5E";
        const line = chartRef.current.addLineSeries({
          color: trajColor,
          lineWidth: 2,
          lineStyle: LineStyle.Dotted,
          title: `AI Trajectory Projection`,
        });
        // Sort and ensure strictly ascending times
        const sortedTraj = [...aiSignal.predictiveTrajectory].sort((a, b) => a.time - b.time);
        const uniqueTraj = sortedTraj.filter((pt, idx, arr) => idx === 0 || pt.time > arr[idx - 1].time);
        line.setData(uniqueTraj.map((pt) => ({ time: pt.time as any, value: pt.price })));
        lineMap.set(trajId, line);
      }
    }

    // Clean up inactive lines
    lineMap.forEach((line, id) => {
      if (id.startsWith("ai_") && !activeOverlayIds.has(id)) {
        chartRef.current!.removeSeries(line);
        lineMap.delete(id);
      }
    });

    // Clean up inactive areas
    areaMap.forEach((area, id) => {
      if (id.startsWith("ai_") && !activeOverlayIds.has(id)) {
        chartRef.current!.removeSeries(area);
        areaMap.delete(id);
      }
    });
  }, [aiMapping, aiSignal, historicalCandles]);

  // Render open broker positions (bounded)
  useEffect(() => {
    if (!chartRef.current) return;

    const lineMap = lineSeriesMap.current;
    const activeLineIds = new Set<string>();

    positions.forEach((pos) => {
      const entryId = `pos_${pos.ticket}_entry`;
      activeLineIds.add(entryId);
      if (!lineMap.has(entryId)) {
        const line = chartRef.current!.addLineSeries({
          color: pos.type === "BUY" ? "#089981" : "#f23645",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          title: `${pos.type} Entry @ ${pos.open_price.toFixed(2)}`,
        });
        line.setData([{ time: pos.time as any, value: pos.open_price }]);
        lineMap.set(entryId, line);
      }

      if (pos.sl > 0) {
        const slId = `pos_${pos.ticket}_sl`;
        activeLineIds.add(slId);
        if (!lineMap.has(slId)) {
          const line = chartRef.current!.addLineSeries({
            color: "#f23645",
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            title: `SL @ ${pos.sl.toFixed(2)}`,
          });
          line.setData([{ time: pos.time as any, value: pos.sl }]);
          lineMap.set(slId, line);
        }
      }

      if (pos.tp > 0) {
        const tpId = `pos_${pos.ticket}_tp`;
        activeLineIds.add(tpId);
        if (!lineMap.has(tpId)) {
          const line = chartRef.current!.addLineSeries({
            color: "#089981",
            lineWidth: 1,
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
    <div className="relative w-full rounded-md bg-black overflow-hidden border border-zinc-800">
      {/* Top Chart Toolbar: Clean Shadcn / Pure Black & Zinc */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 px-4 py-2 bg-zinc-950">
        <div className="flex items-center gap-3">
          {/* Symbol Pair Selector */}
          <div className="flex items-center rounded-md bg-black p-0.5 border border-zinc-800">
            <button
              type="button"
              onClick={() => onSymbolChange?.("BTCUSD")}
              className={`px-3 py-1 text-xs font-mono font-medium rounded transition-colors ${
                symbol.toUpperCase().startsWith("BTC")
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              BTC/USD
            </button>
            <button
              type="button"
              onClick={() => onSymbolChange?.("XAUUSD")}
              className={`px-3 py-1 text-xs font-mono font-medium rounded transition-colors ${
                symbol.toUpperCase().startsWith("XAU") || symbol.toUpperCase().startsWith("PAXG")
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              XAU/USD
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center">
            <select
              value={timeframe}
              onChange={(e) => onTimeframeChange?.(e.target.value)}
              className="bg-black border border-zinc-800 text-zinc-300 text-xs font-mono font-medium rounded px-2.5 py-1 focus:outline-none focus:border-zinc-600 cursor-pointer hover:bg-zinc-900 transition-colors"
            >
              {TIMEFRAMES.map((tf) => (
                <option key={tf.value} value={tf.value} className="bg-black text-zinc-200 font-mono">
                  {tf.label}
                </option>
              ))}
            </select>
          </div>

          {/* Real-time Feed Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black border border-zinc-800 text-[10px] font-mono text-zinc-400">
            <span
              className={`h-1.5 w-1.5 rounded-full ${pulse ? "bg-emerald-400" : "bg-zinc-600"} transition-colors duration-150`}
            />
            <span>FEED</span>
          </div>

          {/* Active AI Signal Pill */}
          {aiSignal?.signal && (
            <span
              className={`rounded px-2.5 py-0.5 text-[10px] font-mono font-semibold border ${
                aiSignal.signal === "BUY"
                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60"
                  : aiSignal.signal === "SELL"
                  ? "bg-red-950/40 text-red-400 border-red-900/60"
                  : "bg-zinc-900 text-zinc-300 border-zinc-800"
              }`}
            >
              AI: {aiSignal.signal}
            </span>
          )}

          {positions.length > 0 && (
            <span className="rounded bg-zinc-900 px-2 py-0.5 text-[10px] font-mono font-medium text-zinc-300 border border-zinc-800">
              {positions.length} OPEN
            </span>
          )}
        </div>

        {/* Real-time Price and PnL */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center justify-end gap-1.5">
              <span>MARKET PRICE</span>
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${pulse ? "bg-emerald-400" : "bg-zinc-700"} transition-colors`}
              />
            </div>
            <div className={`text-sm font-mono font-semibold transition-colors duration-150 ${pulse ? "text-white" : "text-zinc-200"}`}>
              {currentCandle ? `$${currentCandle.close.toFixed(2)}` : "---.--"}
            </div>
          </div>
          {positions.length > 0 && (
            <div className="text-right">
              <div className="text-[10px] font-mono text-zinc-500 uppercase">PnL</div>
              <div
                className={`text-sm font-mono font-semibold ${totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                ${totalPnL.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightweight Chart Container */}
      <div ref={chartContainerRef} className="w-full h-[640px]" />

      {/* Floating Chart AI Note Overlay (if available) */}
      {aiSignal && (aiSignal.stopLoss || aiSignal.takeProfit) && (
        <div className="absolute top-14 left-4 z-10 max-w-sm rounded border border-zinc-800 bg-zinc-950/90 p-2.5 backdrop-blur shadow-lg text-[11px] font-mono space-y-1 pointer-events-none">
          <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800/80 pb-1">
            <span className="text-zinc-300 font-semibold">AI POSITION OVERLAY</span>
            <span className="text-[10px] text-zinc-500">BOUNDED TARGET BOX</span>
          </div>
          <div className="grid grid-cols-3 gap-1 pt-0.5">
            <div>
              <span className="text-[10px] text-zinc-500 block">ENTRY</span>
              <span className="text-zinc-200 font-semibold">${aiSignal.entryPrice?.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[10px] text-red-400 block">STOP LOSS</span>
              <span className="text-red-400 font-semibold">${aiSignal.stopLoss?.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-400 block">TAKE PROFIT</span>
              <span className="text-emerald-400 font-semibold">${aiSignal.takeProfit?.toFixed(2)}</span>
            </div>
          </div>
          {aiSignal.note && (
            <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60 leading-tight">
              {aiSignal.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
