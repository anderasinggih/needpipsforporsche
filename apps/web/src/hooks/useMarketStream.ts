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
          console.log("🟢 [Engine WS] Connected to:", resolvedUrl);
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            console.log("📨 [Engine WS Message]:", data);
            if (data.type === "POSITIONS" && Array.isArray(data.positions)) {
              setPositions(data.positions);
            } else if (data.open !== undefined && data.close !== undefined) {
              setCurrentCandle(data as CandleData);
            } else if (data.type === "TICK" && data.price !== undefined) {
              const nowSec = Math.floor((data.timestamp || Date.now()) / 1000);
              const barTime = Math.floor(nowSec / 60) * 60;
              const p = Number(data.price);
              setCurrentCandle((prev) => {
                if (prev && prev.time === barTime) {
                  return {
                    ...prev,
                    high: Math.max(prev.high, p),
                    low: Math.min(prev.low, p),
                    close: p,
                    volume: prev.volume + (data.volume || 1),
                  };
                }
                return {
                  time: barTime,
                  open: prev ? prev.close : p,
                  high: p,
                  low: p,
                  close: p,
                  volume: data.volume || 1,
                };
              });
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

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [resolvedUrl]);

  return { currentCandle, positions, isConnected };
}
