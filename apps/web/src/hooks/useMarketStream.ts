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

export function useMarketStream(activeSymbol: string = "BTCUSDT") {
  const [currentCandle, setCurrentCandle] = useState<CandleData | null>(null);
  const [historicalCandles, setHistoricalCandles] = useState<CandleData[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  const binanceStream = normalizeBinanceStreamSymbol(activeSymbol);

  // 1. Initial Load: Fetch 120 historical 1m candles for immediate chart rendering
  const fetchHistorical = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/candles?symbol=${encodeURIComponent(activeSymbol)}&limit=150`);
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
  }, [activeSymbol]);

  useEffect(() => {
    fetchHistorical();
  }, [fetchHistorical]);

  // 2. Real-Time Stream: Connect directly to Binance 1m Kline WebSocket
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let isMounted = true;

    const streamUrl = `wss://stream.binance.com:9443/ws/${binanceStream}@kline_1m`;

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
            const data = JSON.parse(event.data);
            if (data.k) {
              const k = data.k;
              const candle: CandleData = {
                time: Math.floor(Number(k.t) / 1000), // bar open time in seconds
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v),
                is_closed: k.x,
              };
              setCurrentCandle(candle);
            }
          } catch (err) {
            console.error("Error parsing Binance kline stream:", err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          if (wsRef.current) {
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

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [binanceStream]);

  return { currentCandle, historicalCandles, positions, isConnected };
}
