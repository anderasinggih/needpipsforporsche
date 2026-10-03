# ARCHITECTURE SPECIFICATION
## NeedPipsForPorsche — Technical Architecture & Dataflow

**Version:** 1.0.0  
**Target Audience:** Autonomous Coding Agents (OpenCode, Claude, Cursor, Copilot) & Engineers  
**Target Asset:** XAU/USD (Gold) Primary, Crypto Secondary  

---

## 1. System High-Level Topology

```
                  ┌──────────────────────────────────────────────┐
                  │          External Market Data Providers      │
                  │  1. VPS MT5 Terminal (Windows/Linux Wine)    │
                  │     -> Python Bridge / MQL5 ZeroMQ/Socket    │
                  │  2. Twelve Data / OANDA Cloud WS (Fallback)  │
                  └──────────────────────┬───────────────────────┘
                                         │ TCP / WebSocket Feed
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                           Go Ingestion Engine (`apps/engine`)                  │
│                                                                                │
│   ┌────────────────────┐     ┌─────────────────────┐    ┌──────────────────┐   │
│   │ Data Ingestion     │────▶│ Candle Aggregator   │───▶│ Indicator Engine │   │
│   │ Manager (Adapters) │     │ (1s -> 1m, 5m, 15m) │    │ (EMA, RSI, ATR)  │   │
│   └────────────────────┘     └─────────────────────┘    └────────┬─────────┘   │
│                                                                  │             │
│                                ┌─────────────────────────────────┴─────────┐   │
│                                │ Internal Broadcast Hub (Goroutines)       │   │
│                                └─────────────────┬─────────────────────────┘   │
└──────────────────────────────────────────────────┼─────────────────────────────┘

---

### 1.1. Rekomendasi Setup Deployment (VPS vs Client)

Untuk keandalan 24/5 streaming XAU/USD tanpa membebani Mac:
1. **Opsi VPS Windows Murah (Paling Mudah):**
   * Sewa VPS Windows (2 vCPU, 2-4 GB RAM, lokasi Singapore/London dekat server broker seperti Exness/IC Markets).
   * Install MT5 resmi broker + script Python bridge `MetaTrader5` yang langsung stream tick ke Go Engine.
2. **Opsi VPS Linux (Ubuntu + Docker):**
   * Menggunakan container `docker-mt5` (Wine headless) atau bridge data feed cloud, sementara Mac lokal hanya mengakses dashboard Next.js via browser.
3. **Kelebihan Setup VPS:**
   * Laptop Mac bebas mati/tidur (sleep) kapan saja tanpa memutus kalkulasi indikator atau logging trade.
   * Latensi ke server broker XAU/USD sangat kecil (< 5ms jika VPS di SG/London).
   * Web dashboard `NeedPipsForPorsche` bisa diakses dari mana saja (Mac, iPad, iPhone browser).
                                                   │
                      ┌────────────────────────────┴─────────────────────────────┐
                      │ Internal Redis Pub/Sub & Storage Pipeline                │
                      ▼                                                          ▼
             ┌─────────────────┐                                      ┌──────────────────┐
             │ Redis 7         │                                      │ PostgreSQL 16    │
             │ - Price stream  │                                      │ + TimescaleDB    │
             │ - Active state  │                                      │ - Raw candles    │
             │ - Channel bus   │                                      │ - Skills & Rules │
             └────────┬────────┘                                      │ - Journal trades │
                      │                                               └────────┬─────────┘
                      │                                                        │
                      ▼                                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                       Next.js Web Client (`apps/web`)                          │
│                                                                                │
│   ┌──────────────────────┐   ┌───────────────────────┐   ┌─────────────────┐   │
│   │ WebSocket Client     │   │ TradingView LWC       │   │ Trade Checklist │   │
│   │ (Live Tick / Candle) │   │ (Canvas Rendering)    │   │ & Skills Engine │   │
│   └──────────────────────┘   └───────────────────────┘   └─────────────────┘   │
│                                                                                │
│   ┌──────────────────────┐   ┌───────────────────────┐   ┌─────────────────┐   │
│   │ Encrypted Vault API  │   │ AI Trade Evaluator    │   │ Journaling &    │   │
│   │ (AES-256-GCM)        │   │ (Structured Context)  │   │ Performance PnL │   │
│   └──────────────────────┘   └───────────────────────┘   └─────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Ingestion Engine Architecture (Go)

### 2.1. Ingestion Adapter Interface
Setiap sumber data harus mengimplementasikan interface terpadu sehingga Go Engine tidak terikat pada satu vendor:

```go
type MarketDataProvider interface {
    Connect(ctx context.Context) error
    Subscribe(symbol string, timeframe string) error
    StreamTicks() <-chan MarketTick
    Close() error
}

type MarketTick struct {
    Symbol    string    `json:"symbol"`    // e.g. "XAU/USD"
    Timestamp int64     `json:"timestamp"` // Unix millisecond
    Bid       float64   `json:"bid"`
    Ask       float64   `json:"ask"`
    Price     float64   `json:"price"`     // Mid price
    Volume    float64   `json:"volume"`
}

type Candle struct {
    Symbol    string  `json:"symbol"`
    Timeframe string  `json:"timeframe"` // "1m", "5m", "15m", "1h"
    Time      int64   `json:"time"`      // Unix seconds (TradingView requirement)
    Open      float64 `json:"open"`
    High      float64 `json:"high"`
    Low       float64 `json:"low"`
    Close     float64 `json:"close"`
    Volume    float64 `json:"volume"`
    IsClosed  bool    `json:"is_closed"`
}
```

### 2.2. Concurrency & Hub Model
* **Collector Goroutine:** Menangani parsing payload WS eksternal, auto-reconnect dengan exponential backoff (`1s -> 2s -> 4s -> max 30s`).
* **Aggregator Goroutine:** Menerima `MarketTick`, merakit bar candlestick (OHLCV). Saat bar periode selesai (misal `second == 0` untuk 1m candle), tanda `IsClosed = true` dikirim.
* **Client Hub:** Mengelola koneksi WebSocket dari browser frontend menggunakan `sync.RWMutex` dan unbuffered/buffered channels untuk mencegah satu slow-client memblokir seluruh pipeline.

---

## 3. Database Schema (PostgreSQL + TimescaleDB)

```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 1. Table Candles (Timescale Hypertable)
CREATE TABLE IF NOT EXISTS market_candles (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    open NUMERIC(12, 4) NOT NULL,
    high NUMERIC(12, 4) NOT NULL,
    low NUMERIC(12, 4) NOT NULL,
    close NUMERIC(12, 4) NOT NULL,
    volume NUMERIC(16, 4) NOT NULL,
    PRIMARY KEY (time, symbol, timeframe)
);
SELECT create_hypertable('market_candles', 'time', if_not_exists => TRUE);

-- 2. Table Trading Skills / Rules
CREATE TABLE IF NOT EXISTS trading_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(100) NOT NULL,
    description TEXT,
    timeframes VARCHAR(50)[], -- e.g. ["15m", "1h"]
    rules_checklist JSONB NOT NULL, -- [{ "id": "rule_1", "text": "HTF Trend Bullish", "required": true }]
    risk_reward_min NUMERIC(4, 2) DEFAULT 2.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table API Key Vault (Encrypted)
CREATE TABLE IF NOT EXISTS api_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL, -- e.g. "twelvedata", "exness_bridge", "binance"
    key_identifier VARCHAR(100) NOT NULL,
    encrypted_secret TEXT NOT NULL, -- AES-256-GCM ciphertext
    iv VARCHAR(32) NOT NULL,
    tag VARCHAR(32) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table Trade Journal
CREATE TABLE IF NOT EXISTS trade_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID REFERENCES trading_skills(id),
    symbol VARCHAR(20) NOT NULL,
    direction VARCHAR(4) NOT NULL CHECK (direction IN ('BUY', 'SELL')),
    entry_price NUMERIC(12, 4) NOT NULL,
    exit_price NUMERIC(12, 4),
    stop_loss NUMERIC(12, 4) NOT NULL,
    take_profit NUMERIC(12, 4) NOT NULL,
    lot_size NUMERIC(8, 2) NOT NULL,
    pnl NUMERIC(12, 2),
    rules_compliance JSONB, -- Record checklist checked at entry
    chart_snapshot_url TEXT,
    notes TEXT,
    ai_validation_summary TEXT,
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);
```

---

## 4. Frontend Component & State Architecture (Next.js)

### 4.1. TradingView Lightweight Charts Lifecycle
* Komponen `ChartContainer.tsx` harus menangani resizing observer dan cleanup instance TradingView saat unmount.
* **Dual Series Rendering:**
  1. `CandlestickSeries`: Merender candle OHLCV.
  2. `LineSeries`: Merender indikator overlay (EMA 20, 50, 200).
  3. `HistogramSeries` (subpane): Volume & RSI.
* **Tick Handling:**
  Saat WebSocket mengirim update tick realtime, panggil method:
  `candlestickSeries.update({ time: candle.time, open, high, low, close })`.

### 4.2. Secure Key Vault (Zero-Leak Policy)
* API Key Secret **tidak pernah** dikirim ke client (browser).
* Server Action / Next.js Route Handler membaca dari `api_credentials`, melakukan dekripsi menggunakan `ENCRYPTION_MASTER_KEY` (ENV lokal), lalu melakukan request ke external service di server-side.

---

## 5. Security & Communication Protocols

1. **Local Communication:**
   * Browser <--> Next.js: HTTPS / Secure Cookie Session.
   * Browser <--> Go Ingestion Engine: WebSocket (`ws://localhost:8080/ws/live?symbol=XAUUSD&tf=1m`).
2. **Encryption at Rest:**
   * Secret keys di database dienkripsi dengan `AES-256-GCM` dengan 96-bit random IV per baris.
3. **Graceful Degradation:**
   * Jika stream XAU/USD utama offline, UI menampilkan status banner merah: `STREAM_OFFLINE` dan menghentikan tombol entry checklist agar trader tidak mengeksekusi dengan data kadaluarsa.
