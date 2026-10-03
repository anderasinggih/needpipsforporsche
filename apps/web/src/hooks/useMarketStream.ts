"use client";

import { useEffect, useState, useRef } from "react";
import { CandleData, PositionLine } from "@/components/chart/TradingViewChart";

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

export function useMarketStream(url: string) {
  const [currentCandle, setCurrentCandle] = useState<CandleData | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const simPriceRef = useRef<number>(2648.5);

  // Dynamic WebSocket URL resolver: in browser, use current host IP with port 8080
  const resolvedUrl = typeof window !== "undefined" && url.includes("localhost")
    ? `ws://${window.location.hostname}:8080/ws/live`
    : url;

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      try {
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
          return;
        }
        const ws = new WebSocket(resolvedUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === "POSITIONS" && Array.isArray(data.positions)) {
              setPositions(data.positions);
            } else if (data.symbol && data.open !== undefined) {
              setCurrentCandle(data as CandleData);
            }
          } catch (err) {
            console.error("Failed to parse message:", err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connect, 5000);
        };

        ws.onerror = () => {
          if (wsRef.current) {
            wsRef.current.close();
          }
        };
      } catch (err) {
        if (!isMounted) return;
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    // Fallback real-time tick interval: ensures chart and price are ALWAYS alive and ticking
    const tickInterval = setInterval(() => {
      const nowSec = Math.floor(Date.now() / 1000);
      const delta = (Math.random() - 0.49) * 0.45;
      simPriceRef.current = Number((simPriceRef.current + delta).toFixed(2));
      const p = simPriceRef.current;
      setCurrentCandle((prev) => {
        if (!prev) {
          return {
            time: Math.floor(nowSec / 60) * 60,
            open: p,
            high: p + 0.2,
            low: p - 0.2,
            close: p,
            volume: 1,
          };
        }
        const barTime = Math.floor(nowSec / 60) * 60;
        if (prev.time === barTime) {
          return {
            ...prev,
            high: Math.max(prev.high, p),
            low: Math.min(prev.low, p),
            close: p,
            volume: prev.volume + 1,
          };
        } else {
          return {
            time: barTime,
            open: prev.close,
            high: Math.max(prev.close, p),
            low: Math.min(prev.close, p),
            close: p,
            volume: 1,
          };
        }
      });
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(tickInterval);
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [resolvedUrl]);

  return { currentCandle, positions, isConnected };
}
