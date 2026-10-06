"use client";

import React, { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, LineStyle, ColorType } from "lightweight-charts";
import { CandleData } from "@/components/chart/TradingViewChart";
import { PossibilityScenario } from "@/lib/ai/types";

interface PossibilityChartProps {
  candles: CandleData[];
  currentPrice: number;
  scenarios: PossibilityScenario[];
  symbol: string;
  timeframe: string;
}

export const PossibilityMonteCarloChart: React.FC<PossibilityChartProps> = ({
  candles,
  currentPrice,
  scenarios,
  symbol,
  timeframe,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const scenarioLinesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const [activeScenarioId, setActiveScenarioId] = useState<string>("all");

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#71717A",
      },
      grid: {
        vertLines: { color: "#121215" },
        horzLines: { color: "#121215" },
      },
      crosshair: {
        vertLine: { color: "#3F3F46", width: 1, style: LineStyle.Dashed },
        horzLine: { color: "#3F3F46", width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: "#27272A",
        autoScale: true,
      },
      timeScale: {
        borderColor: "#27272A",
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: 520,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#089981",
      downColor: "#f23645",
      borderVisible: true,
      borderUpColor: "#089981",
      borderDownColor: "#f23645",
      wickUpColor: "#089981",
      wickDownColor: "#f23645",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      scenarioLinesRef.current.clear();
    };
  }, []);

  // Update Candles
  useEffect(() => {
    if (candleSeriesRef.current && candles.length > 0) {
      const sorted = [...candles].sort((a, b) => a.time - b.time);
      const unique = sorted.filter((c, i, a) => i === 0 || c.time > a[i - 1].time);
      candleSeriesRef.current.setData(
        unique.map((c) => ({
          time: c.time as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );
    }
  }, [candles]);

  // Draw Possibility Lines (Monte Carlo / Wave Forecasts)
  useEffect(() => {
    if (!chartRef.current) return;

    // Clean old lines
    scenarioLinesRef.current.forEach((line) => {
      try {
        chartRef.current?.removeSeries(line);
      } catch {}
    });
    scenarioLinesRef.current.clear();

    const filteredScenarios =
      activeScenarioId === "all"
        ? scenarios
        : scenarios.filter((s) => s.id === activeScenarioId);

    filteredScenarios.forEach((sc) => {
      if (!sc.points || sc.points.length === 0) return;

      const isPrimary = sc.id === "primary";
      const isSweep = sc.id === "alternative_sweep";

      const line = chartRef.current!.addLineSeries({
        color: sc.color || (isPrimary ? "#06B6D4" : isSweep ? "#F59E0B" : "#EF4444"),
        lineWidth: isPrimary ? 3 : 2,
        lineStyle: isPrimary ? LineStyle.Solid : isSweep ? LineStyle.Dotted : LineStyle.Dashed,
        lastValueVisible: true,
        priceLineVisible: true,
        crosshairMarkerVisible: true,
        title: `${sc.name} (${sc.probability}%)`,
      });

      const sorted = [...sc.points].sort((a, b) => a.time - b.time);
      const unique = sorted.filter((pt, idx, arr) => idx === 0 || pt.time > arr[idx - 1].time);

      line.setData(unique.map((pt) => ({ time: pt.time as any, value: pt.price })));

      if (unique.length > 0) {
        const lastPt = unique[unique.length - 1];
        line.setMarkers([
          {
            time: lastPt.time as any,
            position: "aboveBar",
            color: sc.color,
            shape: "circle",
            text: `${sc.name}: $${lastPt.price}`,
          },
        ]);
      }

      scenarioLinesRef.current.set(sc.id, line);
    });
  }, [scenarios, activeScenarioId]);

  return (
    <div className="relative w-full rounded-md bg-black overflow-hidden border border-zinc-800">
      {/* Top Controller */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-zinc-950 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">POSSIBILITY FILTER:</span>
          <div className="flex items-center gap-1 bg-black p-0.5 rounded border border-zinc-800">
            <button
              onClick={() => setActiveScenarioId("all")}
              className={`px-2.5 py-1 text-xs rounded font-mono transition-colors ${
                activeScenarioId === "all"
                  ? "bg-zinc-800 text-white font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              ALL LINES
            </button>
            {scenarios.map((sc) => (
              <button
                key={sc.id}
                onClick={() => setActiveScenarioId(sc.id)}
                className={`px-2.5 py-1 text-xs rounded font-mono transition-colors flex items-center gap-1.5 ${
                  activeScenarioId === sc.id
                    ? "bg-zinc-800 text-white font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: sc.color }}
                />
                {sc.name} ({sc.probability}%)
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs font-mono text-zinc-400">
          MONTE CARLO PROJECTION • {symbol} ({timeframe})
        </div>
      </div>

      {/* Chart Canvas */}
      <div ref={containerRef} className="w-full relative" />
    </div>
  );
};
