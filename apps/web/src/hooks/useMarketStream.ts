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

export function useMarketStream(activeSymbol: string = "BTCUSD") {
  const [currentCandle, setCurrentCandle] = useState<CandleData | null>(null);
  const [historicalCandles, setHistoricalCandles] = useState<CandleData[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastTickTimestamp, setLastTickTimestamp] = useState<number>(Date.now());
  const wsRef = useRef<WebSocket | null>(null);

  const binanceStream = normalizeBinanceStreamSymbol(activeSymbol);

  // 1. Initial Load: Fetch historical 1m candles for immediate chart rendering
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

  // 2. Real-Time Stream: Connect directly to Binance multiplex WebSocket stream
  // Streams: <stream>@kline_1m, <stream>@trade, and <stream>@ticker for guaranteed constant updates
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let isMounted = true;

    // Use Binance multiplex stream endpoint: /stream?streams=<stream1>/<stream2>/<stream3>
    const streamUrl = `wss://stream.binance.com:9443/stream?streams=${binanceStream}@kline_1m/${binanceStream}@trade/${binanceStream}@ticker`;

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

            // Handle kline stream (1m interval bar)
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
            // Handle individual trade tick event (@trade)
            else if (eventType === "trade" && payload.p) {
              const tradePrice = parseFloat(payload.p);
              const tradeTimeMs = Number(payload.T || payload.E || Date.now());
              const barStartTime = Math.floor(tradeTimeMs / 60000) * 60;

              setCurrentCandle((prev) => {
                if (!prev) {
                  return {
                    time: barStartTime,
                    open: tradePrice,
                    high: tradePrice,
                    low: tradePrice,
                    close: tradePrice,
                    volume: parseFloat(payload.q || "0"),
                  };
                }

                if (prev.time === barStartTime) {
                  return {
                    ...prev,
                    high: Math.max(prev.high, tradePrice),
                    low: Math.min(prev.low, tradePrice),
                    close: tradePrice,
                  };
                } else if (barStartTime > prev.time) {
                  return {
                    time: barStartTime,
                    open: tradePrice,
                    high: tradePrice,
                    low: tradePrice,
                    close: tradePrice,
                    volume: parseFloat(payload.q || "0"),
                  };
                }
                return prev;
              });
              setLastTickTimestamp(Date.now());
            }
            // Handle ticker heartbeat event (@ticker - fired every second)
            else if (eventType === "24hrTicker" && payload.c) {
              const currentPrice = parseFloat(payload.c);
              const eventTimeMs = Number(payload.E || Date.now());
              const barStartTime = Math.floor(eventTimeMs / 60000) * 60;

              setCurrentCandle((prev) => {
                if (!prev) {
                  return {
                    time: barStartTime,
                    open: currentPrice,
                    high: currentPrice,
                    low: currentPrice,
                    close: currentPrice,
                    volume: 0,
                  };
                }

                if (prev.time === barStartTime) {
                  return {
                    ...prev,
                    high: Math.max(prev.high, currentPrice),
                    low: Math.min(prev.low, currentPrice),
                    close: currentPrice,
                  };
                } else if (barStartTime > prev.time) {
                  return {
                    time: barStartTime,
                    open: currentPrice,
                    high: currentPrice,
                    low: currentPrice,
                    close: currentPrice,
                    volume: 0,
                  };
                }
                return prev;
              });
              setLastTickTimestamp(Date.now());
            }
          } catch (err) {
            console.error("Error parsing Binance stream message:", err);
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

  return { currentCandle, historicalCandles, positions, isConnected, lastTickTimestamp };
}
