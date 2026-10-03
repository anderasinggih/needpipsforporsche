# NEEDPIPSFORPORSCHE 🏎️📈
> High-Performance Personal Trading Analysis, Real-Time Charting & Strategy Intelligence Platform focusing on **XAU/USD (Gold)**.

---

## 📌 Project Overview
Platform ini dirancang khusus untuk analisis trading pribadi dengan performa tingkat tinggi, latensi rendah, serta pengelolaan disiplin trading (*trading skills & rules*):
- **Core Engine (Go):** Menangani streaming tick & candlestick XAU/USD berlatensi rendah (<50ms), kalkulasi indikator cepat, dan WebSocket hub.
- **Frontend Dashboard (Next.js 14+ / React):** Visualisasi interaktif menggunakan TradingView Lightweight Charts, panel checklist rule strategi, dan AI-assisted setup validation.
- **Storage & State:** PostgreSQL 16 + TimescaleDB (time-series OHLCV) + Redis (pub/sub & real-time cache).

---

## 📚 Agent & Developer Documentation Kit

Semua spesifikasi teknis dan panduan pengerjaan telah disiapkan secara komprehensif agar **OpenCode / Autonomous Agents** dapat mengeksekusi project ini secara mandiri:

1. 📄 **[PRD.md](file:///Volumes/LVNPC/needpipsforporsche/PRD.md)**  
   *Product Requirements Document*: Latar belakang, kebutuhan fungsional & non-fungsional, perbandingan provider data feed XAU/USD (MT5 Bridge vs Twelve Data vs OANDA vs Binance PAXG).
2. 📐 **[ARCHITECTURE.md](file:///Volumes/LVNPC/needpipsforporsche/ARCHITECTURE.md)**  
   *Technical Architecture*: Topologi sistem, interface provider Go, model konkurensi (Goroutines/Channels), schema DDL PostgreSQL + TimescaleDB, arsitektur enkripsi API vault (AES-256-GCM), dan siklus hidup chart.
3. 🛠️ **[TASKS.md](file:///Volumes/LVNPC/needpipsforporsche/TASKS.md)**  
   *Step-by-Step Execution Plan & Testing Guide*: 6 Task berurutan untuk OpenCode lengkap dengan:
   * Target file yang dibuat/diubah
   * Langkah implementasi teknis
   * Perintah verifikasi & testing otomatis (CLI commands)
   * Kriteria kelulusan (Success Criteria)

---

## 🚀 Quick Start (Development)

### 1. Jalankan Infrastruktur (Docker)
```bash
docker compose up -d
```

### 2. Jalankan Go Ingestion Engine
```bash
cd apps/engine
go run cmd/server/main.go
```

### 3. Jalankan Next.js Web Dashboard
```bash
cd apps/web
npm install
npm run dev
```
Buka `http://localhost:3000` di browser.
