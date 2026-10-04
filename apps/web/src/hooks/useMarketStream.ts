"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { CandleData } from "@/components/chart/TradingViewChart";

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

export function normalizeBinanceStreamSymbol(symbol: string): string {
  const upper = symbol.toUpperCase().trim();
  if (upper === "XAUUSD" || upper === "GOLD") return "paxgusdt";
  if (upper === "BTCUSD" || upper === "BTCUSDT") return "btcusdt";
  if (upper === "ETHUSD" || upper === "ETHUSDT") return "ethusdt";
  if (upper === "SOLUSD" || upper === "SOLUSDT") return "solusdt";
  if (upper.endsWith("USD") && !upper.endsWith("USDT")) {
    return `${upper.toLowerCase()}t`;
  }
  return upper.toLowerCase();
}

export function useMarketStream(activeSymbol: string = "BTCUSD", timeframe: string = "1m") {
  const [currentCandle, setCurrentCandle] = useState<CandleData | null>(null);
  const [historicalCandles, setHistoricalCandles] = useState<CandleData[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastTickTimestamp, setLastTickTimestamp] = useState<number>(Date.now());
  const wsRef = useRef<WebSocket | null>(null);

  const binanceStream = normalizeBinanceStreamSymbol(activeSymbol);

  // 1. Initial Load: Fetch historical candles for immediate chart rendering
  const fetchHistorical = useCallback(async () => {
    // Clear old candles when switching symbol/timeframe to avoid mismatch glitch
    setHistoricalCandles([]);
    setCurrentCandle(null);
    try {
      const res = await fetch(`/api/market/candles?symbol=${encodeURIComponent(activeSymbol)}&interval=${encodeURIComponent(timeframe)}&limit=150`);
      if (res.ok) {
        const data = await res.json();
        if (data.candles && Array.isArray(data.candles) && data.candles.length > 0) {
          setHistoricalCandles(data.candles);
          setCurrentCandle(data.candles[data.candles.length - 1]);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch historical candles:", err);
    }
  }, [activeSymbol, timeframe]);

  useEffect(() => {
    fetchHistorical();
  }, [fetchHistorical]);

  // 2. Real-Time Stream: Connect directly to Binance multiplex WebSocket stream
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let isMounted = true;

    // Map timeframe to Binance supported kline intervals: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
    // (Binance WS does not support 1s kline, fallback to 1m for kline but keep raw trade stream for sub-second ticks)
    let binanceInterval = timeframe;
    if (timeframe === "1s") binanceInterval = "1m";

    const klineStream = `${binanceStream}@kline_${binanceInterval}`;

    // Direct combined stream endpoint:
    const streamUrl = `wss://data-stream.binance.vision/stream?streams=${klineStream}/${binanceStream}@trade`;

    const connect = () => {
      if (!isMounted) return;
      try {
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
          return;
        }

        const ws = new WebSocket(streamUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const raw = JSON.parse(event.data);
            const payload = raw.data || raw;
            const eventType = payload.e;

            // Handle kline stream
            if (eventType === "kline" && payload.k) {
              const k = payload.k;
              const barOpenSec = Math.floor(Number(k.t) / 1000);
              const candle: CandleData = {
                time: barOpenSec,
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v),
                is_closed: k.x,
              };
              setCurrentCandle(candle);
              setLastTickTimestamp(Date.now());
            }
            // Handle individual real-time trade tick event (@trade)
            else if (eventType === "trade" && payload.p) {
              const tradePrice = parseFloat(payload.p);
              setCurrentCandle((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  high: Math.max(prev.high, tradePrice),
                  low: Math.min(prev.low, tradePrice),
                  close: tradePrice,
                };
              });
              setLastTickTimestamp(Date.now());
            }
          } catch (err) {
            console.error("Error parsing Binance stream message:", err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.close();
          }
        };
      } catch (err) {
        if (!isMounted) return;
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    connect();

    // 3. Fallback Heartbeat Poller: In case WebSocket is temporarily offline or filtered
    const pollInterval = setInterval(async () => {
      if (!isMounted) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        try {
          const res = await fetch(`/api/market/candles?symbol=${encodeURIComponent(activeSymbol)}&interval=${encodeURIComponent(timeframe)}&limit=2`);
          if (res.ok) {
            const data = await res.json();
            if (data.candles && data.candles.length > 0) {
              const latest = data.candles[data.candles.length - 1];
              setCurrentCandle(latest);
              setLastTickTimestamp(Date.now());
              setIsConnected(true);
            }
          }
        } catch (e) {}
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [binanceStream, timeframe, activeSymbol]);

  return { currentCandle, historicalCandles, positions, isConnected, lastTickTimestamp };
}
