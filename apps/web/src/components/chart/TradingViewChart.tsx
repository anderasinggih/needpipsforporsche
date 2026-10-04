"use client";

import React, { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, LineStyle, ColorType, CrosshairMode } from "lightweight-charts";

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
        mode: CrosshairMode.Normal, // Normal free movement (exact cursor position, no magnet snapping to candle)
        vertLine: {
          color: "#3F3F46",
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: "#3F3F46",
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
    // DOWN: downColor #f23645, borderDownColor #f23645 (tanpa outline beda warna), wickDownColor #f23645
    // TIDAK ADA BORDER HIJAU ATAU CONSTRASTING BORDER PADA CANDLE MERAH
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
    // Clear old timeframe overlays so new timeframe redraws with accurate coordinates
    if (chartRef.current) {
      lineSeriesMap.current.forEach((line) => {
        try {
          chartRef.current?.removeSeries(line);
        } catch (e) {}
      });
      lineSeriesMap.current.clear();
    }
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

  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Scalping Bounded Overlays & Advanced AI Chart Tools:
  // - Render Position Box (TradingView Component Style: Green Target Area, Red Stop Area, Middle Ratio Badge, Corner Grips)
  // - Predictive Trajectory Line with directional Arrow
  // - XABCD Harmonic Pattern Multi-Leg Segments
  // - Clean bounded Fibonacci lines without horizontal overflow
  useEffect(() => {
    if (!chartRef.current || !isDataSetRef.current || historicalCandles.length === 0) return;

    const lineMap = lineSeriesMap.current;
    const activeOverlayIds = new Set<string>();

    const lastHistoricalTime =
      historicalCandles[historicalCandles.length - 1]?.time || Math.floor(Date.now() / 1000);

    // 1. Predictive Trajectory Line with Directional Arrow Markers
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
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
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
              text: isBuy ? "Target" : "Target",
            },
          ]);
        }
        lineMap.set(trajId, line);
      }
    }

    // 2. Dynamic Trendline (when market is trending)
    if (aiMapping?.trendlineStart && aiMapping?.trendlineEnd) {
      const trendId = "ai_dynamic_trendline";
      activeOverlayIds.add(trendId);
      if (!lineMap.has(trendId)) {
        const isUp = (aiSignal?.signal || "BUY") === "BUY";
        const trendLine = chartRef.current.addLineSeries({
          color: isUp ? "#10B981" : "#EF4444",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        trendLine.setData([
          { time: aiMapping.trendlineStart.time as any, value: aiMapping.trendlineStart.price },
          { time: aiMapping.trendlineEnd.time as any, value: aiMapping.trendlineEnd.price },
        ]);
        trendLine.setMarkers([
          {
            time: aiMapping.trendlineStart.time as any,
            position: isUp ? "belowBar" : "aboveBar",
            color: isUp ? "#10B981" : "#EF4444",
            shape: "circle",
            text: isUp ? "Swing Low" : "Swing High",
          },
        ]);
        lineMap.set(trendId, trendLine);
      }
    }

    // 3. XABCD Harmonic Pattern Mapping Tool (Only rendered if genuine swing pivots were found)
    if (aiMapping?.harmonicPattern?.points && aiMapping.harmonicPattern.points.length >= 5) {
      const pts = aiMapping.harmonicPattern.points;
      const isHarmonicBullish = aiMapping.harmonicPattern.type === "BULLISH";

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
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          legLine.setData([
            { time: p1.time as any, value: p1.price },
            { time: p2.time as any, value: p2.price },
          ]);

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

    // 4. Fibonacci Retracement Levels (Standard TradingView Fib Tool from genuine Swing Anchor)
    if (aiMapping?.fibonacciRetracement?.levels && aiMapping.fibonacciRetracement.levels.length > 0) {
      const fib = aiMapping.fibonacciRetracement;
      // Start strictly from the genuine Swing High or Swing Low pivot time
      const fibStart = Math.min(fib.high.time, fib.low.time);
      // Extend across to the position box & recent candles
      const fibEnd = Math.max(lastHistoricalTime + 60 * 8, Math.max(fib.high.time, fib.low.time) + 60 * 8);

      fib.levels.forEach((lvl) => {
        const fibId = `ai_fib_level_${lvl.ratio}`;
        activeOverlayIds.add(fibId);

        if (!lineMap.has(fibId)) {
          const isGolden = lvl.ratio === 0.618 || lvl.ratio === 0.5;
          const fibLine = chartRef.current.addLineSeries({
            color: isGolden ? "#F59E0B" : "#71717A",
            lineWidth: isGolden ? 2 : 1,
            lineStyle: isGolden ? LineStyle.Solid : LineStyle.Dashed,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          fibLine.setData([
            { time: fibStart as any, value: lvl.price },
            { time: fibEnd as any, value: lvl.price },
          ]);

          // Label the key golden pocket level on chart
          if (isGolden) {
            fibLine.setMarkers([
              {
                time: fibStart as any,
                position: (aiSignal?.signal || "BUY") === "BUY" ? "belowBar" : "aboveBar",
                color: "#F59E0B",
                shape: "circle",
                text: lvl.ratio === 0.618 ? "Fib 0.618 Pocket" : "Fib 0.50 Eq",
              },
            ]);
          }

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

  const [isBoxSelected, setIsBoxSelected] = useState(true);
  const positionBoxBoundsRef = useRef<{ left: number; right: number; top: number; bottom: number } | null>(null);

  // Synchronize TradingView Long/Short Position Box canvas overlay with chart coordinate space
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!canvas || !chart || !candleSeries) return;

    let animId: number;

    const renderPositionBox = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      if (!aiSignal?.entryPrice || !aiSignal?.stopLoss || !aiSignal?.takeProfit) {
        positionBoxBoundsRef.current = null;
        return;
      }

      const timeScale = chart.timeScale();
      const lastCandle = historicalCandles[historicalCandles.length - 1];
      const prevCandle = historicalCandles.length > 1 ? historicalCandles[historicalCandles.length - 2] : null;
      const lastTime = lastCandle?.time || Math.floor(Date.now() / 1000);

      // Detect candle spacing interval dynamically from historical data for seamless multi-timeframe scaling
      const candleIntervalSec = (prevCandle && lastCandle) ? Math.max(1, lastCandle.time - prevCandle.time) : 60;
      
      // Keep box bounded to ~4 candles in the past and ~14 candles in the future on ANY timeframe (M1, M5, M15, H1)
      const startTime = aiSignal.positionBox?.startTime || (lastTime - candleIntervalSec * 4);
      const endTime = aiSignal.positionBox?.endTime || (startTime + candleIntervalSec * 16);

      let x1 = timeScale.timeToCoordinate(startTime as any) as number | null;
      let x2 = timeScale.timeToCoordinate(endTime as any) as number | null;

      // Robust fallback if time falls outside visible range on different timeframe
      const lastCoord = timeScale.timeToCoordinate(lastTime as any) as number | null;
      if (x1 === null && lastCoord !== null) {
        x1 = Math.max(20, lastCoord - 80);
      }
      if (x2 === null && lastCoord !== null) {
        x2 = Math.min(width - 20, lastCoord + 140);
      }

      const yEntry = candleSeries.priceToCoordinate(aiSignal.entryPrice);
      const yTP = candleSeries.priceToCoordinate(aiSignal.takeProfit);
      const ySL = candleSeries.priceToCoordinate(aiSignal.stopLoss);

      if (x1 === null || x2 === null || yEntry === null || yTP === null || ySL === null) {
        positionBoxBoundsRef.current = null;
        return;
      }

      const boxLeft = Math.min(x1, x2);
      const boxWidth = Math.max(Math.abs(x2 - x1), 120);
      const isLong = (aiSignal.signal || "BUY") === "BUY";

      // 1. Draw Target (Green) Profit Box
      const tpTop = Math.min(yEntry, yTP);
      const tpHeight = Math.abs(yTP - yEntry);
      ctx.fillStyle = isBoxSelected ? "rgba(8, 153, 129, 0.28)" : "rgba(8, 153, 129, 0.18)";
      ctx.fillRect(boxLeft, tpTop, boxWidth, tpHeight);

      // Target area border
      ctx.strokeStyle = isBoxSelected ? "rgba(8, 153, 129, 1)" : "rgba(8, 153, 129, 0.7)";
      ctx.lineWidth = isBoxSelected ? 1.5 : 1;
      ctx.strokeRect(boxLeft, tpTop, boxWidth, tpHeight);

      // 2. Draw Stop Loss (Red) Risk Box
      const slTop = Math.min(yEntry, ySL);
      const slHeight = Math.abs(ySL - yEntry);
      ctx.fillStyle = isBoxSelected ? "rgba(242, 54, 69, 0.3)" : "rgba(242, 54, 69, 0.18)";
      ctx.fillRect(boxLeft, slTop, boxWidth, slHeight);

      // Stop area border
      ctx.strokeStyle = isBoxSelected ? "rgba(242, 54, 69, 1)" : "rgba(242, 54, 69, 0.7)";
      ctx.lineWidth = isBoxSelected ? 1.5 : 1;
      ctx.strokeRect(boxLeft, slTop, boxWidth, slHeight);

      // 3. Middle Entry Separator Line
      ctx.beginPath();
      ctx.moveTo(boxLeft, yEntry);
      ctx.lineTo(boxLeft + boxWidth, yEntry);
      ctx.strokeStyle = isBoxSelected ? "#FFFFFF" : "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Store bounds for click selection detection
      positionBoxBoundsRef.current = {
        left: boxLeft - 10,
        right: boxLeft + boxWidth + 160,
        top: Math.min(yTP, ySL) - 20,
        bottom: Math.max(yTP, ySL) + 20,
      };

      // 4. Corner Drag / Grip Handles (Blue square grips like TradingView when selected)
      if (isBoxSelected) {
        const handleSize = 7;
        const drawGrip = (x: number, y: number) => {
          ctx.fillStyle = "#2962FF";
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.5;
          ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        };

        drawGrip(boxLeft, yTP);
        drawGrip(boxLeft + boxWidth, yTP);
        drawGrip(boxLeft, yEntry);
        drawGrip(boxLeft + boxWidth, yEntry);
        drawGrip(boxLeft, ySL);
        drawGrip(boxLeft + boxWidth, ySL);
      }

      // Format Price Values (with 2 decimal places and formatted thousands)
      const formatPrice = (p: number) => p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const tpPriceStr = formatPrice(aiSignal.takeProfit);
      const entryPriceStr = formatPrice(aiSignal.entryPrice);
      const slPriceStr = formatPrice(aiSignal.stopLoss);

      // 5. In-Chart Price Badges with Labels on the Top, Middle & Bottom edges of the Box
      ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

      const drawBoxPriceLabel = (
        text: string,
        priceVal: string,
        x: number,
        y: number,
        bgColor: string,
        borderColor: string
      ) => {
        const fullText = `${text}: ${priceVal}`;
        const textWidth = ctx.measureText(fullText).width;
        const padX = 6;
        const padY = 3;
        const badgeW = textWidth + padX * 2;
        const badgeH = 18;
        const badgeX = x + 8;
        const badgeY = y - badgeH / 2;

        ctx.fillStyle = bgColor;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
        } else {
          ctx.rect(badgeX, badgeY, badgeW, badgeH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(fullText, badgeX + padX, badgeY + badgeH / 2);
      };

      // Draw inside/edge badges for TP, Entry, SL
      drawBoxPriceLabel(
        "TP",
        tpPriceStr,
        boxLeft,
        yTP,
        "rgba(8, 153, 129, 0.9)",
        "#089981"
      );
      drawBoxPriceLabel(
        "Entry",
        entryPriceStr,
        boxLeft,
        yEntry,
        "rgba(39, 39, 42, 0.9)",
        "#71717A"
      );
      drawBoxPriceLabel(
        "SL",
        slPriceStr,
        boxLeft,
        ySL,
        "rgba(242, 54, 69, 0.9)",
        "#f23645"
      );

      // 6. Right Price Scale Floating Badges (Persis TradingView: Gambar 2)
      // When the component is active/selected, render vivid price tags on the far right price scale
      // Width of right price axis is ~55-70px in TradingView
      const priceScaleWidth = 65;
      const scaleX = width - priceScaleWidth;

      const drawScaleBadge = (priceStr: string, yCoord: number, bg: string, textColor: string = "#FFFFFF") => {
        const badgeH = 19;
        const badgeY = Math.max(2, Math.min(height - badgeH - 2, yCoord - badgeH / 2));
        
        ctx.fillStyle = bg;
        ctx.fillRect(scaleX, badgeY, priceScaleWidth, badgeH);

        // Small left pointer accent bar
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(scaleX, badgeY, 2, badgeH);

        ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillStyle = textColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(priceStr, scaleX + priceScaleWidth / 2 + 1, badgeY + badgeH / 2);
      };

      // Target Price Scale Badge (Pure TV Green: #089981)
      drawScaleBadge(tpPriceStr, yTP, "#089981");

      // Entry Price Scale Badge (TV Charcoal/Slate: #3F3F46 with white text)
      drawScaleBadge(entryPriceStr, yEntry, "#3F3F46");

      // Stop Loss Price Scale Badge (Pure TV Red: #f23645)
      drawScaleBadge(slPriceStr, ySL, "#f23645");

      // 7. Floating TradingView PnL & Risk/Reward Badge
      const rewardDist = Math.abs(aiSignal.takeProfit - aiSignal.entryPrice);
      const riskDist = Math.max(0.01, Math.abs(aiSignal.entryPrice - aiSignal.stopLoss));
      const rrRatio = (rewardDist / riskDist).toFixed(2);
      const tpPipsText = aiSignal.tpPips ? `${aiSignal.tpPips} pips` : `${(rewardDist * 10).toFixed(0)} pips`;
      const slPipsText = aiSignal.slPips ? `${aiSignal.slPips} pips` : `${(riskDist * 10).toFixed(0)} pips`;

      const badgeText1 = `${isLong ? "Long" : "Short"} Target: +${tpPipsText} | Risk: -${slPipsText}`;
      const badgeText2 = `Rasio Risk/Reward: 1:${rrRatio}`;

      ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif";
      const w1 = ctx.measureText(badgeText1).width;
      const w2 = ctx.measureText(badgeText2).width;
      const badgeW = Math.max(w1, w2) + 16;
      const badgeH = 34;

      let badgeX = boxLeft + boxWidth + 8;
      if (badgeX + badgeW > width - priceScaleWidth - 10) {
        badgeX = Math.max(10, boxLeft + boxWidth - badgeW - 6);
      }
      const badgeY = yEntry - badgeH / 2;

      // Rounded background pill
      ctx.fillStyle = isLong ? "rgba(8, 153, 129, 0.95)" : "rgba(242, 54, 69, 0.95)";
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5);
      } else {
        ctx.rect(badgeX, badgeY, badgeW, badgeH);
      }
      ctx.fill();
      ctx.stroke();

      // Text labels
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badgeText1, badgeX + badgeW / 2, badgeY + 11);
      ctx.fillText(badgeText2, badgeX + badgeW / 2, badgeY + 23);
    };

    const loop = () => {
      renderPositionBox();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    chart.timeScale().subscribeVisibleLogicalRangeChange(renderPositionBox);

    return () => {
      cancelAnimationFrame(animId);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(renderPositionBox);
    };
  }, [aiSignal, historicalCandles, isBoxSelected]);

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

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black border border-zinc-800 text-[11px] text-zinc-400">
            <span
              className={`h-1.5 w-1.5 rounded-full ${pulse ? "bg-emerald-400" : "bg-zinc-600"} transition-colors duration-150`}
            />
            <span>Feed</span>
          </div>

          {aiSignal?.signal && (
            <span
              className={`rounded px-2.5 py-0.5 text-[11px] font-medium border ${
                aiSignal.signal === "BUY"
                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60"
                  : aiSignal.signal === "SELL"
                  ? "bg-red-950/40 text-red-400 border-red-900/60"
                  : "bg-zinc-900 text-zinc-300 border-zinc-800"
              }`}
            >
              Scalp {aiSignal.signal === "BUY" ? "Buy" : aiSignal.signal === "SELL" ? "Sell" : "Wait"}
            </span>
          )}

          {aiSignal?.slPips && (
            <span className="rounded bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400 border border-zinc-800">
              SL: {aiSignal.slPips} pips &bull; TP: {aiSignal.tpPips} pips
            </span>
          )}

          {aiMapping?.harmonicPattern?.name && (
            <span className="rounded bg-amber-950/40 px-2 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-900/50">
              {aiMapping.harmonicPattern.name} (XABCD)
            </span>
          )}

          {aiMapping?.fibonacciRetracement && (
            <span className="rounded bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400 border border-zinc-800">
              Fib 0.618 Pocket
            </span>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[11px] text-zinc-500 flex items-center justify-end gap-1.5">
              <span>Market Price</span>
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
              <div className="text-[11px] text-zinc-500">PnL</div>
              <div
                className={`text-sm font-semibold ${totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                ${totalPnL.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div 
        className="relative w-full h-[640px]"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;
          const bounds = positionBoxBoundsRef.current;
          if (bounds) {
            if (
              clickX >= bounds.left &&
              clickX <= bounds.right &&
              clickY >= bounds.top &&
              clickY <= bounds.bottom
            ) {
              setIsBoxSelected(true);
              return;
            }
          }
          // If clicked outside, keep selected or toggle
        }}
      >
        <div ref={chartContainerRef} className="w-full h-full" />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 pointer-events-none w-full h-full z-10"
        />
      </div>
    </div>
  );
};
