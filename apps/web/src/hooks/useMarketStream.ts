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

export interface LiveTradeTick {
  id: string;
  time: number; // Unix ms
  price: number;
  qty: number;
  isBuyerMaker: boolean; // if true -> seller initiated (taker sell = RED), if false -> buyer initiated (taker buy = GREEN)
  side: "BUY" | "SELL";
}

export interface OrderbookDepthLevel {
  price: number;
  qty: number;
  total: number;
}

export interface MarketDepthState {
  bids: OrderbookDepthLevel[];
  asks: OrderbookDepthLevel[];
  maxBidQty: number;
  maxAskQty: number;
  totalBidLiquidity: number;
  totalAskLiquidity: number;
  spread: number;
  imbalancePct: number; // -100 to +100 (- is sell heavy, + is buy heavy)
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

export function getTimeframeSeconds(tf: string): number {
  const match = tf.match(/^(\d+)([smhdM])$/);
  if (!match) return 60;
  const val = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === "s") return val;
  if (unit === "m") return val * 60;
  if (unit === "h") return val * 3600;
  if (unit === "d") return val * 86400;
  if (unit === "M") return val * 2592000;
  return 60;
}

export function useMarketStream(activeSymbol: string = "BTCUSD", timeframe: string = "1m") {
  const [currentCandle, setCurrentCandle] = useState<CandleData | null>(null);
  const [historicalCandles, setHistoricalCandles] = useState<CandleData[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [recentTrades, setRecentTrades] = useState<LiveTradeTick[]>([]);
  const [marketDepth, setMarketDepth] = useState<MarketDepthState | null>(null);
  const [priceOffset, setPriceOffset] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastTickTimestamp, setLastTickTimestamp] = useState<number>(Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const offsetRef = useRef<number>(0);
  const currentCandleRef = useRef<CandleData | null>(null);
  // Time of the last bar folded into historicalCandles, so intra-bar kline
  // updates do not thrash the array on every tick.
  const streamBarTimeRef = useRef<number | null>(null);

  const binanceStream = normalizeBinanceStreamSymbol(activeSymbol);
  const intervalSeconds = getTimeframeSeconds(timeframe);

  // Keep currentCandleRef synchronized with state
  useEffect(() => {
    currentCandleRef.current = currentCandle;
  }, [currentCandle]);

  // 0. Load Broker Price Offset from PostgreSQL
  useEffect(() => {
    let isSubscribed = true;
    fetch("/api/vault?type=offsets")
      .then((res) => res.json())
      .then((data) => {
        if (!isSubscribed) return;
        if (data.offsets) {
          const symKey = activeSymbol.toUpperCase();
          const val = Number(data.offsets[symKey] || 0);
          setPriceOffset(val);
          offsetRef.current = val;
        }
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
    };
  }, [activeSymbol]);

  // 1. Initial Load: Fetch historical candles for immediate chart rendering
  const fetchHistorical = useCallback(async () => {
    // Clear old candles when switching symbol/timeframe to avoid mismatch glitch
    setHistoricalCandles([]);
    setCurrentCandle(null);
    currentCandleRef.current = null;
    streamBarTimeRef.current = null;
      try {
        const res = await fetch(`/api/market/candles?symbol=${encodeURIComponent(activeSymbol)}&interval=${encodeURIComponent(timeframe)}&limit=3000`);
        if (res.ok) {
          const data = await res.json();
          if (data.candles && Array.isArray(data.candles) && data.candles.length > 0) {
            const currentOffset = offsetRef.current;
            const calibrated = currentOffset === 0
              ? data.candles
              : data.candles.map((c: CandleData) => ({
                  ...c,
                  open: c.open + currentOffset,
                  high: c.high + currentOffset,
                  low: c.low + currentOffset,
                  close: c.close + currentOffset,
                }));
            setHistoricalCandles(calibrated);
            const latestBar = calibrated[calibrated.length - 1];
            setCurrentCandle(latestBar);
            currentCandleRef.current = latestBar;
            streamBarTimeRef.current = latestBar.time;
          }
        }
      } catch (err) {
        console.warn("Failed to fetch historical candles:", err);
      }
    }, [activeSymbol, timeframe]);

  // 1b. Keep growing the bar series from the stream.
  // Without this the array stays frozen at the REST snapshot, so a setup can
  // never be resolved by a later candle — the trade would stay ACTIVE forever
  // and the chart box would never widen.
  const foldStreamedBar = useCallback((candle: CandleData) => {
    const previousTime = streamBarTimeRef.current;
    streamBarTimeRef.current = candle.time;
    // Same forming bar and not closed yet: the live candle already covers it.
    if (previousTime === candle.time && !candle.is_closed) return;

    setHistoricalCandles((prev) => {
      if (prev.length === 0) return [candle];
      const last = prev[prev.length - 1];
      if (candle.time < last.time) return prev; // out-of-order frame
      if (candle.time === last.time) {
        if (last.is_closed && !candle.is_closed) return prev;
        const next = prev.slice(0, -1);
        next.push(candle);
        return next;
      }
      return [...prev, candle].slice(-3000);
    });
  }, []);

  useEffect(() => {
    fetchHistorical();
  }, [fetchHistorical]);

  // 2. Real-Time Stream: Connect directly to Binance multiplex WebSocket stream
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let isMounted = true;

    // Binance WebSocket supports 1s, 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
    const binanceInterval = timeframe;

    const klineStream = `${binanceStream}@kline_${binanceInterval}`;
    const depthStream = `${binanceStream}@depth20@100ms`;

    // Direct combined stream endpoint with trade tick (@trade), orderbook ticker (@bookTicker), and depth (@depth20@100ms)
    const streamUrl = `wss://data-stream.binance.vision/stream?streams=${klineStream}/${binanceStream}@trade/${binanceStream}@bookTicker/${depthStream}`;

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

        // Instant price tick dispatcher: updates forming candle at sub-millisecond precision
        const applyPriceTick = (tickPrice: number, tickTimeMs: number, tickQty: number = 0) => {
          const tickSec = Math.floor(tickTimeMs / 1000);
          const currentBarTime = Math.floor(tickSec / intervalSeconds) * intervalSeconds;
          const prevCandle = currentCandleRef.current;
          let nextCandle: CandleData;

          if (!prevCandle) {
            nextCandle = {
              time: currentBarTime,
              open: tickPrice,
              high: tickPrice,
              low: tickPrice,
              close: tickPrice,
              volume: tickQty,
              is_closed: false,
            };
          } else if (currentBarTime > prevCandle.time) {
            const closedPrev: CandleData = {
              ...prevCandle,
              is_closed: true,
            };
            foldStreamedBar(closedPrev);

            nextCandle = {
              time: currentBarTime,
              open: tickPrice,
              high: tickPrice,
              low: tickPrice,
              close: tickPrice,
              volume: tickQty,
              is_closed: false,
            };
          } else {
            nextCandle = {
              ...prevCandle,
              high: Math.max(prevCandle.high, tickPrice),
              low: Math.min(prevCandle.low, tickPrice),
              close: tickPrice,
              volume: (prevCandle.volume || 0) + tickQty,
            };
          }

          currentCandleRef.current = nextCandle;
          setCurrentCandle(nextCandle);
          setLastTickTimestamp(Date.now());
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const raw = JSON.parse(event.data);
            const payload = raw.data || raw;
            const eventType = payload.e;
            const streamName = raw.stream || "";

            const currentOffset = offsetRef.current;

            // Handle Depth 20 stream for Liquidity Heatmap & Orderbook Depth
            if (streamName.includes("@depth") || payload.bids || payload.asks) {
              const rawBids: [string, string][] = payload.bids || payload.b || [];
              const rawAsks: [string, string][] = payload.asks || payload.a || [];

              let runningBidTotal = 0;
              let maxBid = 0;
              const parsedBids: OrderbookDepthLevel[] = [];
              for (const [p, q] of rawBids.slice(0, 15)) {
                const price = parseFloat(p) + currentOffset;
                const qty = parseFloat(q);
                runningBidTotal += qty;
                if (qty > maxBid) maxBid = qty;
                parsedBids.push({ price, qty, total: runningBidTotal });
              }

              let runningAskTotal = 0;
              let maxAsk = 0;
              const parsedAsks: OrderbookDepthLevel[] = [];
              for (const [p, q] of rawAsks.slice(0, 15)) {
                const price = parseFloat(p) + currentOffset;
                const qty = parseFloat(q);
                runningAskTotal += qty;
                if (qty > maxAsk) maxAsk = qty;
                parsedAsks.push({ price, qty, total: runningAskTotal });
              }

              const bestBid = parsedBids[0]?.price || 0;
              const bestAsk = parsedAsks[0]?.price || 0;
              const spread = bestAsk > bestBid ? bestAsk - bestBid : 0;
              const totalLiq = runningBidTotal + runningAskTotal;
              const imbalance = totalLiq > 0 ? Math.round(((runningBidTotal - runningAskTotal) / totalLiq) * 100) : 0;

              setMarketDepth({
                bids: parsedBids,
                asks: parsedAsks,
                maxBidQty: maxBid,
                maxAskQty: maxAsk,
                totalBidLiquidity: runningBidTotal,
                totalAskLiquidity: runningAskTotal,
                spread,
                imbalancePct: imbalance,
              });

              // When best bid/ask is present, tick the chart price immediately if spread is tight
              if (bestBid > 0 && bestAsk > 0) {
                const midPrice = Number(((bestBid + bestAsk) / 2).toFixed(2));
                applyPriceTick(midPrice, Date.now(), 0);
              }
            }

            // Handle Book Ticker stream (@bookTicker) - FASTEST BID/ASK UPDATE IN BINANCE (10-100+ updates/sec)
            else if (streamName.includes("@bookTicker") || (payload.b && payload.a && !payload.bids)) {
              const bPrice = parseFloat(payload.b) + currentOffset;
              const aPrice = parseFloat(payload.a) + currentOffset;
              if (bPrice > 0 && aPrice > 0) {
                const midPrice = Number(((bPrice + aPrice) / 2).toFixed(2));
                applyPriceTick(midPrice, Date.now(), 0);
              }
            }

            // Handle kline stream
            else if (eventType === "kline" && payload.k) {
              const k = payload.k;
              const barOpenSec = Math.floor(Number(k.t) / 1000);
              const candle: CandleData = {
                time: barOpenSec,
                open: parseFloat(k.o) + currentOffset,
                high: parseFloat(k.h) + currentOffset,
                low: parseFloat(k.l) + currentOffset,
                close: parseFloat(k.c) + currentOffset,
                volume: parseFloat(k.v),
                is_closed: k.x,
              };
              currentCandleRef.current = candle;
              setCurrentCandle(candle);
              foldStreamedBar(candle);
              setLastTickTimestamp(Date.now());
            }
            // Handle individual real-time trade tick event (@trade) - SUB-SECOND ZERO DELAY
            else if (eventType === "trade" && payload.p) {
              const tradePrice = parseFloat(payload.p) + currentOffset;
              const qty = parseFloat(payload.q || "0");
              const isBuyerMaker = Boolean(payload.m); // true: seller initiated (taker sell), false: buyer initiated (taker buy)
              const side: "BUY" | "SELL" = isBuyerMaker ? "SELL" : "BUY";
              const tickTimeMs = Number(payload.T || Date.now());
              const tick: LiveTradeTick = {
                id: String(payload.t || Date.now() + Math.random()),
                time: tickTimeMs,
                price: tradePrice,
                qty,
                isBuyerMaker,
                side,
              };

              setRecentTrades((prev) => [tick, ...prev].slice(0, 50));
              applyPriceTick(tradePrice, tickTimeMs, qty);
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
              foldStreamedBar(latest);
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
      streamBarTimeRef.current = null;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [binanceStream, timeframe, activeSymbol]);

  return { currentCandle, historicalCandles, positions, recentTrades, marketDepth, isConnected, lastTickTimestamp };
}
