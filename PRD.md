# PRD (Product Requirements Document)
## NeedPipsForPorsche — Personal Trade Analysis & Intelligence Platform

**Document Version:** 1.0.0  
**Target User:** Personal (Solo Trader / Self-Hosted)  
**Status:** Inception & Architectural Blueprint  

---

## 1. Executive Summary & Objective

**NeedPipsForPorsche** adalah platform web personal untuk analisis trading real-time, manajemen strategi/skill, dan journal intelligence. Aplikasi ini menggabungkan rendering chart berkinerja tinggi, streaming data pasar rendah latensi, manajemen API key exchange terenkripsi, serta modul analisis teknikal/AI untuk validasi setup trading sebelum eksekusi.

Platform ini dibangun dengan arsitektur decoupled berorientasi kinerja tinggi:
* **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS, TradingView Lightweight Charts).
* **Backend Core & Ingestion Engine:** Go (Golang) memanfaatkan Goroutines & Channels untuk streaming WebSocket multi-source.
* **Database & Caching:** PostgreSQL (+ TimescaleDB untuk deret waktu OHLCV/tick) + Redis (pub/sub & state cache).

---

## 2. Rekomendasi Sumber Data Stream Chart — Khusus XAU/USD (Gold)

Untuk **XAU/USD (Gold)**, penting dipahami: **Binance tidak menyediakan spot/CFD XAU/USD tradisional**. 
Di Binance hanya ada **PAXG/USDT** (tokenized gold backed by Paxos). Walaupun harganya berkorelasi dengan emas dunia, pergerakan tick, spread, dan likuiditasnya **berbeda dengan harga spot XAU/USD antar-bank / broker Forex**.

Berikut opsi terbaik stream data XAU/USD untuk akurasi trading riil:

| Sumber Provider | Tipe Koneksi | Akurasi vs Broker | Biaya | Latensi & Karakteristik |
|---|---|---|---|---|
| **1. MT5 / MT4 Local Bridge (ZeroMQ / Python Gateway)** *(Paling Direkomendasikan)* | TCP Socket / Local WebSocket | **100% Identik** dengan broker eksekusi Anda (Exness, IC Markets, dll.) | **Gratis** (via Akun Demo/Real Broker) | **0 delay** (<5ms lokal). Data tick, bid/ask spread, dan candlestick sama persis dengan yang Anda lihat di platform eksekusi. |
| **2. Twelve Data WebSocket** | WebSocket Cloud | Sangat Tinggi (Institutional Spot Feed) | Free tier (800 req/day) / Tier berbayar untuk WS real-time | Latensi ~50-150ms. API modern dan langsung support WebSocket `XAU/USD`. |
| **3. OANDA / IG / Interactive Brokers API** | Streaming REST / WebSocket | Sangat Tinggi (Retail/Institutional CFD) | Gratis dengan akun aktif | Feed spot Gold global resmi, sangat stabil untuk charting. |
| **4. Binance (PAXGUSDT)** | Binance WebSocket | Rendah/Subjektif (Tokenized Gold) | Gratis | Cepat (<50ms), tetapi **bukan XAU/USD murni**; terdapat selisih spread/premium/diskon crypto vs fisik dunia. Tidak disarankan untuk scalping XAU/USD. |

> **Rekomendasi Utama XAU/USD:**
> * Jika Anda trading XAU/USD di broker forex (Exness, HFM, XM, IC Markets, dll.): **Gunakan MT5 Gateway ke Go Engine**. Ini memberi data harga yang 100% sama dengan tempat Anda entry tanpa slippage visual.
> * Jika ingin solusi cloud murni tanpa install software MT5 di server: **Twelve Data WebSocket** atau **OANDA Streaming API**.

---

## 3. System Architecture & Topology

```
           [ Exchanges / External Providers ]
            (Binance / Bybit / MT5 Gateway)
                         │
                         │ Public/Private WebSocket
                         ▼
┌────────────────────────────────────────────────────────┐
│               Go Ingestion Engine                      │
│                                                        │
│  - WebSocket Connection Pool & Auto-reconnect          │
│  - Tick Aggregator & Candlestick Synthesizer           │
│  - Indicator Calculation Service (EMA, RSI, ATR, etc.) │
│  - Signal Detection Engine ("Trading Skills")          │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
        Publish Candles            Persist Historical
               ▼                          ▼
       ┌──────────────┐         ┌────────────────────┐
       │ Redis Pub/Sub│         │ PostgreSQL /       │
       │ & Memory KV  │         │ TimescaleDB        │
       └──────┬───────┘         └─────────┬──────────┘
              │                           │
              │ Subscribe Broadcast       │ Queries & Settings
              ▼                           ▼
┌────────────────────────────────────────────────────────┐
│            Next.js Fullstack Dashboard                 │
│                                                        │
│  - Server Components & Client Hooks                    │
│  - API Key Vault (AES-256 GCM Encryption)              │
│  - Trading Skills & Rule Configurator                  │
│  - AI Setup Evaluator (LLM Prompting & Chart Context)  │
│  - TradingView Lightweight Charts Visualizer           │
└────────────────────────────────────────────────────────┘
```

---

## 4. Key Functional Features & Requirements

### 4.1. Real-Time Chart & Technical Indicators
* **TradingView Lightweight Charts Integration:**
  * Render Candlestick Series (OHLCV) dengan update tick real-time tanpa flickering.
  * Dukungan multi-timeframe: 1m, 5m, 15m, 1h, 4h, 1D.
  * Overlay indikator teknikal: EMA (9, 21, 50, 200), Bollinger Bands, VWAP.
  * Separate pane indicator: RSI, MACD, Volume.
  * Custom drawing support atau markers (Buy/Sell signals, FVG box, Liquidity sweep level).

### 4.2. "Trading Skill" & Rule Evaluation Engine
* **Konfigurasi Aturan / Skill:**
  * Pengguna dapat mendaftarkan "Skill" (misal: *SMC Liquidity Sweep*, *Breakout Trend Following*, *Mean Reversion Scalping*).
  * Filter checklist sebelum open trade:
    * Contoh: Trend alignment, HTF zone confirmation, Risk-to-Reward minimum (misal 1:2.5), spread checklist.
* **Automated Signal Triggers:**
  * Engine Go mendeteksi kondisi teknikal (misal: RSI Divergence + EMA 200 touch) dan memancarkan notifikasi/alert ke UI dashboard.

### 4.3. API Key & Security Management
* **Encrypted Vault:**
  * Penyimpanan Read-Only API Keys dari exchange (Binance, Bybit, dll.) untuk menarik saldo portofolio aktual, riwayat trade, dan open orders.
  * Kunci rahasia dienkripsi dengan standar **AES-256-GCM** menggunakan master key environment yang tidak pernah masuk ke version control.
  * Zero-Exposure: Secret key tidak boleh dikirim ke browser client. Semua panggilan private exchange dijalankan di sisi server (backend proxy).

### 4.4. AI-Assisted Trade Analysis
* Modul analisa semi-otomatis:
  * Mengambil snapshot harga terakhir + status indikator + level support/resistance.
  * Mengirim konteks ke model AI untuk mendapatkan analisa skenario (Bullish/Bearish thesis, invalidated level, dan rekomendasi stop loss rasional).

### 4.5. Trade Journaling & Post-Trade Review
* Log setiap trade dengan metadata:
  * Setup screenshot/chart reference, skill yang dipakai, emosi/catatan psikologi, PnL, RR aktual vs rencana.
  * Statistik performa per skill (Winrate %, Profit Factor, Max Drawdown).

---

## 5. Non-Functional Requirements (NFR)

* **Latency & Performance:**
  * Latensi chart update dari WebSocket Go engine ke client browser < 100ms.
  * Konsumsi memori Go engine tetap stabil (< 50MB idle, < 150MB under multi-pair load).
* **Reliability:**
  * Auto-reconnect dengan exponential backoff jika koneksi WebSocket exchange terputus.
  * Graceful degradation saat koneksi internet bermasalah.
* **Security:**
  * Proteksi dashboard personal menggunakan autentikasi sederhana & aman (Auth.js / NextAuth dengan session cookie terenkripsi).
  * Rate-limiting internal untuk mencegah ban IP dari bursa.

---

## 6. Project Directory Structure (Monorepo Recommendation)

```
needpipsforporsche/
├── apps/
│   ├── web/                     # Next.js (Dashboard & UI)
│   │   ├── src/
│   │   │   ├── app/             # App Router pages
│   │   │   ├── components/      # UI & Chart components
│   │   │   │   ├── chart/       # TradingView Lightweight Chart wrapper
│   │   │   │   ├── skills/      # Trading skill configurator
│   │   │   │   └── journal/     # Trade journal UI
│   │   │   ├── hooks/           # useWebSocket, useMarketData
│   │   │   └── lib/             # API clients, encryption helpers
│   │   ├── package.json
│   │   └── tailwind.config.ts
│   └── engine/                  # Go Backend Service
│       ├── cmd/server/main.go   # Entrypoint
│       ├── internal/
│       │   ├── collector/       # Binance/Bybit WS clients
│       │   ├── indicators/      # High-performance math calculation
│       │   ├── hub/             # Client WebSocket Hub (Goroutines)
│       │   └── storage/         # Postgres & Redis connectors
│       ├── go.mod
│       └── go.sum
├── docker-compose.yml           # Postgres + TimescaleDB, Redis
├── README.md
└── PRD.md
```

---

## 7. Implementation Roadmap

1. **Sprint 1: Core Stream & Chart Baseline**
   * Setup Docker compose (Postgres + Redis).
   * Implementasi Go WS collector untuk Binance public klines (BTCUSDT, ETHUSDT).
   * Implementasi Next.js frontend dengan TradingView Lightweight Charts + real-time candlestick update.
2. **Sprint 2: Skill Engine & Indicators**
   * Kalkulasi indikator teknikal (EMA, RSI) di Go engine.
   * Modul pendefinisian Trading Skills di UI.
3. **Sprint 3: API Vault & Exchange Integration**
   * CRUD Exchange API Key terenkripsi.
   * Fetch balance & open positions dari exchange.
4. **Sprint 4: AI Analysis & Trade Journal**
   * Integrasi prompt analisis trade dengan AI.
   * Form Trade Journal lengkap dengan tagging skill dan evaluasi performa.
