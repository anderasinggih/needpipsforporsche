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

export interface FibonacciLevel {
  ratio: number;
  label: string;
  price: number;
}

export interface HarmonicPoint {
  label: "X" | "A" | "B" | "C" | "D";
  time: number;
  price: number;
}

export interface HarmonicPattern {
  name: string; // e.g. "Gartley", "Bat", "Butterfly", "Cypher"
  type: "BULLISH" | "BEARISH";
  points: HarmonicPoint[]; // X, A, B, C, D
}

export interface AIMapping {
  supportLevel?: number;
  resistanceLevel?: number;
  trendDirection?: string;
  trendlineStart?: { time: number; price: number };
  trendlineEnd?: { time: number; price: number };
  fibonacciRetracement?: {
    high: { time: number; price: number };
    low: { time: number; price: number };
    levels: FibonacciLevel[];
  };
  harmonicPattern?: HarmonicPattern;
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
  slPips?: number;
  tpPips?: number;
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
  const isDataSetRef = useRef(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (lastTickTimestamp) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 200);
      return () => clearTimeout(timer);
    }
  }, [lastTickTimestamp, currentCandle?.close]);

  // Inisialisasi Chart: Pure Dark TradingView Standard (#089981 & #f23645)
  // BORDER MERAH KINI 100% MERAH (#f23645), TIDAK ADA LAGI BORDER IJO PADA CANDLE MERAH
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#71717A",
      },
      grid: {
        vertLines: { color: "#18181B" },
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

    // CANDLESTICK MURNI ASLI TRADINGVIEW:
    // UP: upColor #089981, borderUpColor #089981, wickUpColor #089981
    // DOWN: downColor #f23645, borderDownColor #f23645, wickDownColor #f23645
    // TIDAK ADA BORDER HIJAU PADA CANDLE MERAH
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#089981",
      downColor: "#f23645",
      borderVisible: true,
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

  // Scalping Bounded Overlays & Advanced AI Chart Tools:
  // - Bounded Position Box (Entry, SL, TP tanpa infinite horizontal line)
  // - XABCD Harmonic Pattern Mapping (XA, AB, BC, CD lines with labeled points)
  // - Fibonacci Retracement Levels (Bounded 0.236, 0.382, 0.5, 0.618, 0.786)
  // - Predictive Trajectory Line with Arrow
  useEffect(() => {
    if (!chartRef.current || !isDataSetRef.current || historicalCandles.length === 0) return;

    const lineMap = lineSeriesMap.current;
    const activeOverlayIds = new Set<string>();

    const lastHistoricalTime =
      historicalCandles[historicalCandles.length - 1]?.time || Math.floor(Date.now() / 1000);

    // 1. TradingView Bounded Position Box (Segment terikat tidak memenuhi layar)
    if (aiSignal?.entryPrice && aiSignal?.stopLoss && aiSignal?.takeProfit) {
      const boxStart = aiSignal.positionBox?.startTime || lastHistoricalTime;
      const boxEnd = aiSignal.positionBox?.endTime || boxStart + 60 * 12;

      // 1a. Bounded TP Level Line
      const tpLineId = "ai_box_tp_line";
      activeOverlayIds.add(tpLineId);
      if (!lineMap.has(tpLineId)) {
        const line = chartRef.current.addLineSeries({
          color: "#089981",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          title: `TP: $${aiSignal.takeProfit} (${aiSignal.tpPips ? `+${aiSignal.tpPips} pips` : ""})`,
        });
        line.setData([
          { time: boxStart as any, value: aiSignal.takeProfit },
          { time: boxEnd as any, value: aiSignal.takeProfit },
        ]);
        lineMap.set(tpLineId, line);
      }

      // 1b. Bounded Entry Level Line
      const entryLineId = "ai_box_entry_line";
      activeOverlayIds.add(entryLineId);
      if (!lineMap.has(entryLineId)) {
        const line = chartRef.current.addLineSeries({
          color: "#E4E4E7",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          title: `Entry: $${aiSignal.entryPrice}`,
        });
        line.setData([
          { time: boxStart as any, value: aiSignal.entryPrice },
          { time: boxEnd as any, value: aiSignal.entryPrice },
        ]);
        lineMap.set(entryLineId, line);
      }

      // 1c. Bounded SL Level Line
      const slLineId = "ai_box_sl_line";
      activeOverlayIds.add(slLineId);
      if (!lineMap.has(slLineId)) {
        const line = chartRef.current.addLineSeries({
          color: "#f23645",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          title: `SL: $${aiSignal.stopLoss} (${aiSignal.slPips ? `-${aiSignal.slPips} pips` : ""})`,
        });
        line.setData([
          { time: boxStart as any, value: aiSignal.stopLoss },
          { time: boxEnd as any, value: aiSignal.stopLoss },
        ]);
        lineMap.set(slLineId, line);
      }

      // 1d. Anchor vertical bracket kiri
      const startBracketId = "ai_box_start_bracket";
      activeOverlayIds.add(startBracketId);
      if (!lineMap.has(startBracketId)) {
        const line = chartRef.current.addLineSeries({
          color: "#3F3F46",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
        });
        line.setData([
          { time: boxStart as any, value: aiSignal.stopLoss },
          { time: boxStart as any, value: aiSignal.takeProfit },
        ]);
        lineMap.set(startBracketId, line);
      }

      // 1e. Anchor vertical bracket kanan
      const endBracketId = "ai_box_end_bracket";
      activeOverlayIds.add(endBracketId);
      if (!lineMap.has(endBracketId)) {
        const line = chartRef.current.addLineSeries({
          color: "#3F3F46",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
        });
        line.setData([
          { time: boxEnd as any, value: aiSignal.stopLoss },
          { time: boxEnd as any, value: aiSignal.takeProfit },
        ]);
        lineMap.set(endBracketId, line);
      }
    }

    // 2. Predictive Trajectory Line with Directional Arrow Markers
    if (aiSignal?.predictiveTrajectory && aiSignal.predictiveTrajectory.length > 0) {
      const trajId = "ai_predictive_trajectory";
      activeOverlayIds.add(trajId);
      if (!lineMap.has(trajId)) {
        const isBuy = (aiSignal.signal || "BUY") === "BUY";
        const trajColor = isBuy ? "#38BDF8" : "#F43F5E";
        const line = chartRef.current.addLineSeries({
          color: trajColor,
          lineWidth: 2,
          lineStyle: LineStyle.Dotted,
          title: `Trajectory Prediction &rarr;`,
        });
        const sortedTraj = [...aiSignal.predictiveTrajectory].sort((a, b) => a.time - b.time);
        const uniqueTraj = sortedTraj.filter((pt, idx, arr) => idx === 0 || pt.time > arr[idx - 1].time);
        line.setData(uniqueTraj.map((pt) => ({ time: pt.time as any, value: pt.price })));

        if (uniqueTraj.length > 0) {
          const lastPoint = uniqueTraj[uniqueTraj.length - 1];
          line.setMarkers([
            {
              time: lastPoint.time as any,
              position: isBuy ? "aboveBar" : "belowBar",
              color: trajColor,
              shape: isBuy ? "arrowUp" : "arrowDown",
              text: isBuy ? "TARGET &uarr;" : "TARGET &darr;",
            },
          ]);
        }
        lineMap.set(trajId, line);
      }
    }

    // 3. XABCD Harmonic Pattern Mapping Tool
    if (aiMapping?.harmonicPattern?.points && aiMapping.harmonicPattern.points.length >= 5) {
      const pts = aiMapping.harmonicPattern.points;
      const patternName = aiMapping.harmonicPattern.name || "Harmonic";
      const isHarmonicBullish = aiMapping.harmonicPattern.type === "BULLISH";

      // Draw legs: X-A, A-B, B-C, C-D
      for (let i = 0; i < 4; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const legId = `ai_harmonic_leg_${p1.label}_${p2.label}`;
        activeOverlayIds.add(legId);

        if (!lineMap.has(legId)) {
          const legLine = chartRef.current.addLineSeries({
            color: isHarmonicBullish ? "#10B981" : "#F59E0B",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            title: `${patternName} (${p1.label}-${p2.label})`,
          });
          legLine.setData([
            { time: p1.time as any, value: p1.price },
            { time: p2.time as any, value: p2.price },
          ]);

          // Set markers on each node point
          legLine.setMarkers([
            {
              time: p1.time as any,
              position: isHarmonicBullish ? "belowBar" : "aboveBar",
              color: isHarmonicBullish ? "#10B981" : "#F59E0B",
              shape: "circle",
              text: p1.label,
            },
            {
              time: p2.time as any,
              position: isHarmonicBullish ? "belowBar" : "aboveBar",
              color: isHarmonicBullish ? "#10B981" : "#F59E0B",
              shape: "circle",
              text: p2.label,
            },
          ]);

          lineMap.set(legId, legLine);
        }
      }
    }

    // 4. Fibonacci Retracement Levels (Bounded segments, clean without cluttering)
    if (aiMapping?.fibonacciRetracement?.levels && aiMapping.fibonacciRetracement.levels.length > 0) {
      const fib = aiMapping.fibonacciRetracement;
      const fibStart = fib.high.time < fib.low.time ? fib.high.time : fib.low.time;
      const fibEnd = lastHistoricalTime + 60 * 10;

      fib.levels.forEach((lvl, idx) => {
        const fibId = `ai_fib_level_${lvl.ratio}`;
        activeOverlayIds.add(fibId);

        if (!lineMap.has(fibId)) {
          // Color based on key fib ratios (0.5 and 0.618 golden pocket are gold/amber)
          const isGolden = lvl.ratio === 0.618 || lvl.ratio === 0.5;
          const fibLine = chartRef.current.addLineSeries({
            color: isGolden ? "#F59E0B" : "#A1A1AA",
            lineWidth: isGolden ? 2 : 1,
            lineStyle: isGolden ? LineStyle.Solid : LineStyle.Dashed,
            title: `Fib ${lvl.label} ($${lvl.price})`,
          });
          fibLine.setData([
            { time: fibStart as any, value: lvl.price },
            { time: fibEnd as any, value: lvl.price },
          ]);
          lineMap.set(fibId, fibLine);
        }
      });
    }

    // Clean up inactive lines
    lineMap.forEach((line, id) => {
      if (id.startsWith("ai_") && !activeOverlayIds.has(id)) {
        chartRef.current!.removeSeries(line);
        lineMap.delete(id);
      }
    });
  }, [aiMapping, aiSignal, historicalCandles]);

  const totalPnL = positions.reduce((sum, pos) => sum + pos.profit, 0);

  return (
    <div className="relative w-full rounded-md bg-black overflow-hidden border border-zinc-800 font-sans">
      {/* Top Chart Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 px-4 py-2 bg-zinc-950">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-md bg-black p-0.5 border border-zinc-800">
            <button
              type="button"
              onClick={() => onSymbolChange?.("BTCUSD")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
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
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                symbol.toUpperCase().startsWith("XAU") || symbol.toUpperCase().startsWith("PAXG")
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              XAU/USD (Gold)
            </button>
          </div>

          <div className="flex items-center">
            <select
              value={timeframe}
              onChange={(e) => onTimeframeChange?.(e.target.value)}
              className="bg-black border border-zinc-800 text-zinc-300 text-xs font-medium rounded px-2.5 py-1 focus:outline-none focus:border-zinc-600 cursor-pointer hover:bg-zinc-900 transition-colors"
            >
              {TIMEFRAMES.map((tf) => (
                <option key={tf.value} value={tf.value} className="bg-black text-zinc-200">
                  {tf.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black border border-zinc-800 text-[10px] text-zinc-400">
            <span
              className={`h-1.5 w-1.5 rounded-full ${pulse ? "bg-emerald-400" : "bg-zinc-600"} transition-colors duration-150`}
            />
            <span>FEED</span>
          </div>

          {aiSignal?.signal && (
            <span
              className={`rounded px-2.5 py-0.5 text-[10px] font-semibold border ${
                aiSignal.signal === "BUY"
                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60"
                  : aiSignal.signal === "SELL"
                  ? "bg-red-950/40 text-red-400 border-red-900/60"
                  : "bg-zinc-900 text-zinc-300 border-zinc-800"
              }`}
            >
              SCALP {aiSignal.signal}
            </span>
          )}

          {aiSignal?.slPips && (
            <span className="rounded bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400 border border-zinc-800">
              SL: {aiSignal.slPips} pips &bull; TP: {aiSignal.tpPips} pips
            </span>
          )}

          {aiMapping?.harmonicPattern?.name && (
            <span className="rounded bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-900/50">
              {aiMapping.harmonicPattern.name} (XABCD)
            </span>
          )}

          {aiMapping?.fibonacciRetracement && (
            <span className="rounded bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400 border border-zinc-800">
              Fib 0.618 Pocket
            </span>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] text-zinc-500 uppercase flex items-center justify-end gap-1.5">
              <span>MARKET PRICE</span>
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${pulse ? "bg-emerald-400" : "bg-zinc-700"} transition-colors`}
              />
            </div>
            <div className={`text-sm font-semibold transition-colors duration-150 ${pulse ? "text-white" : "text-zinc-200"}`}>
              {currentCandle ? `$${currentCandle.close.toFixed(2)}` : "---.--"}
            </div>
          </div>
          {positions.length > 0 && (
            <div className="text-right">
              <div className="text-[10px] text-zinc-500 uppercase">PnL</div>
              <div
                className={`text-sm font-semibold ${totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                ${totalPnL.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div ref={chartContainerRef} className="w-full h-[640px]" />

      {/* Floating Scalping Box Overlay Info on Chart */}
      {aiSignal && (aiSignal.stopLoss || aiSignal.takeProfit) && (
        <div className="absolute top-14 left-4 z-10 max-w-sm rounded border border-zinc-800 bg-zinc-950/90 p-2.5 backdrop-blur shadow-lg text-[11px] space-y-1.5 pointer-events-none">
          <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800/80 pb-1">
            <span className="text-zinc-300 font-semibold">SCALPING POSITION OVERLAY</span>
            <span className="text-[10px] text-emerald-400 font-semibold">RR 1:2.5</span>
          </div>
          <div className="grid grid-cols-3 gap-1 pt-0.5">
            <div>
              <span className="text-[10px] text-zinc-500 block">ENTRY</span>
              <span className="text-zinc-200 font-semibold">${aiSignal.entryPrice?.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[10px] text-red-400 block">STOP LOSS</span>
              <span className="text-red-400 font-semibold">
                ${aiSignal.stopLoss?.toFixed(2)}
                {aiSignal.slPips ? <span className="text-[9px] block text-red-500">(-{aiSignal.slPips} pips)</span> : null}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-400 block">TAKE PROFIT</span>
              <span className="text-emerald-400 font-semibold">
                ${aiSignal.takeProfit?.toFixed(2)}
                {aiSignal.tpPips ? <span className="text-[9px] block text-emerald-500">(+{aiSignal.tpPips} pips)</span> : null}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
