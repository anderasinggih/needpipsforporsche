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

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          console.log(" Connected to Market Data Engine WebSocket");
        };

        ws.onmessage = (event) => {
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
          setIsConnected(false);
          console.log("⚠️ WebSocket disconnected. Reconnecting in 2s...");
          reconnectTimeout = setTimeout(connect, 2000);
        };

        ws.onerror = (err) => {
          console.error("WebSocket error:", err);
          ws.close();
        };
      } catch (err) {
        console.error("Connection error:", err);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url]);

  return { currentCandle, positions, isConnected };
}
