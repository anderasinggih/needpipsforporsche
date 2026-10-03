# TASK EXECUTION PLAN & TESTING GUIDE
## NeedPipsForPorsche — Autonomous Agent Roadmap (OpenCode Ready)

**Instruction for OpenCode / Agent:**
Jalankan task secara berurutan (*sequential*). Jangan beralih ke task berikutnya sebelum **Acceptance & Verification Tests** di task aktif berhasil 100%.

---

## 📋 Task Breakdown & Dependency Graph

```
[Task 1: Monorepo & Infra]
            │
            ▼
[Task 2: Go Data Engine & WS]
            │
            ▼
[Task 3: Next.js + TradingView LWC]
            │
            ▼
[Task 4: Trading Skills & Vault DB]
            │
            ▼
[Task 5: AI Evaluator & Trade Journal]
            │
            ▼
[Task 6: End-to-End Testing & Polish]
```

---

### Task 1: Environment, Database & Monorepo Initialization
* **Objective:** Menyiapkan struktur monorepo, docker environment (Postgres + TimescaleDB + Redis), dan environment configuration.
* **Files to create/modify:**
  * `docker-compose.yml`
  * `.env.example`
  * `scripts/init-db.sql` (schema dari `ARCHITECTURE.md`)
  * Root `package.json` / workspace configuration
* **Implementation Steps:**
  1. Buat `docker-compose.yml` berisi:
     - `postgres` (image `timescale/timescaledb:latest-pg16`, port `5432`).
     - `redis` (image `redis:7-alpine`, port `6379`).
  2. Setup SQL initialization script yang mengaktifkan ekstensi `timescaledb` dan membuat tabel `market_candles`, `trading_skills`, `api_credentials`, `trade_journals`.
  3. Buat folder `apps/web` (Next.js) dan `apps/engine` (Go).
* **Verification & Testing Command:**
  ```bash
  docker compose up -d
  docker compose ps
  # Verifikasi koneksi DB dan ekstensi timescale
  docker compose exec postgres psql -U postgres -d needpipsforporsche -c "SELECT extname FROM pg_extension WHERE extname = 'timescaledb';"
  # Verifikasi Redis ping
  docker compose exec redis redis-cli ping
  ```
* **Success Criteria:** Container Postgres dan Redis berjalan `healthy`, ekstensi `timescaledb` aktif, Redis membalas `PONG`.

---

### Task 2: Go Ingestion Engine & WebSocket Server
* **Objective:** Membangun service Go berkinerja tinggi untuk streaming tick/candle XAU/USD dan mengekspos WebSocket server lokal untuk client.
* **Files to create/modify:**
  * `apps/engine/go.mod`
  * `apps/engine/cmd/server/main.go`
  * `apps/engine/internal/provider/provider.go` (Interface data feed)
  * `apps/engine/internal/provider/twelvedata.go` & `apps/engine/internal/provider/mock.go` (Synthetic XAU/USD generator for testing)
  * `apps/engine/internal/aggregator/candle_aggregator.go`
  * `apps/engine/internal/hub/ws_hub.go`
* **Implementation Steps:**
  1. Inisialisasi Go module: `go mod init needpipsforporsche/engine`.
  2. Buat `MockProvider` yang menghasilkan pergerakan harga realistis XAU/USD (misal base price $2,650.00, spread 0.20-0.35, update setiap 100-300ms) untuk pengujian offline tanpa API key.
  3. Buat `TwelveDataProvider` (atau MT5 adapter) yang membaca koneksi WebSocket riil.
  4. Buat `CandleAggregator` yang mengubah tick menjadi candle 1m, 5m, 15m.
  5. Buat WebSocket server di endpoint `ws://localhost:8080/ws/live?symbol=XAUUSD&tf=1m`.
* **Verification & Testing Command:**
  ```bash
  cd apps/engine
  go test ./... -v
  go run cmd/server/main.go &
  ENGINE_PID=$!
  sleep 2
  # Uji stream menggunakan wscat atau websocat
  npx -y wscat -c "ws://localhost:8080/ws/live?symbol=XAUUSD&tf=1m" --connect-timeout 5 -x "ping"
  kill $ENGINE_PID
  ```
* **Success Criteria:** Client WebSocket menerima JSON payload `Candle` atau `Tick` XAU/USD secara berkala dengan interval < 500ms tanpa memory leak.

---

### Task 3: Next.js Frontend & TradingView Lightweight Charts
* **Objective:** Membangun dashboard analitik dengan tampilan chart TradingView yang menerima update realtime dari Go Engine.
* **Files to create/modify:**
  * `apps/web/package.json`
  * `apps/web/src/components/chart/TradingViewChart.tsx`
  * `apps/web/src/hooks/useMarketStream.ts`
  * `apps/web/src/app/page.tsx`
* **Implementation Steps:**
  1. Inisialisasi Next.js dengan Tailwind CSS dan TypeScript di `apps/web`.
  2. Install library: `npm i lightweight-charts lucide-react clsx tailwind-merge`.
  3. Buat hook `useMarketStream` dengan auto-reconnect ke Go WebSocket server.
  4. Implementasikan `TradingViewChart.tsx`:
     - Candlestick Series warna dark-modern (Up: `#10B981`, Down: `#EF4444`).
     - Real-time indicator EMA 20 (biru), EMA 50 (oranye), EMA 200 (ungu).
     - Status koneksi banner (LIVE / RECONNECTING / OFFLINE).
* **Verification & Testing Command:**
  ```bash
  cd apps/web
  npm run build
  npm run test || true
  ```
* **Success Criteria:** Tampilan web me-render chart candlestick XAU/USD yang bergerak hidup mengikuti tick dari Go engine tanpa lag atau re-render seluruh halaman.

---

### Task 4: Encrypted API Vault & Trading Skills Engine
* **Objective:** Sistem penyimpanan API Key terenkripsi (AES-256-GCM) dan modul konfigurasi "Trading Skill / Setup Checklist".
* **Files to create/modify:**
  * `apps/web/src/lib/crypto.ts` (AES-256-GCM encrypt/decrypt helpers)
  * `apps/web/src/app/api/vault/route.ts`
  * `apps/web/src/app/api/skills/route.ts`
  * `apps/web/src/components/skills/SkillChecklistModal.tsx`
* **Implementation Steps:**
  1. Implementasikan fungsi `encryptSecret(secret: string)` dan `decryptSecret(payload: EncryptedData)`.
  2. Buat API endpoint untuk menyimpan API key provider dengan aman di tabel `api_credentials`.
  3. Buat endpoint CRUD untuk tabel `trading_skills`.
  4. Tambahkan modal checklist di UI: sebelum trader mencatat atau mengeksekusi trade, trader harus mencentang rule (misal: "HTF Break of Structure", "Liquidity Sweep Terjadi", "RR >= 1:2").
* **Verification & Testing Command:**
  ```bash
  # Test enkripsi round-trip di Node/Jest
  node -e '
  const crypto = require("crypto");
  // Enkripsi dan dekripsi harus menghasilkan string asli yang sama persis
  console.log("Crypto helper verified");
  '
  ```
* **Success Criteria:** Secret tersimpan di PostgreSQL dalam format ciphertext (bukan plain text), dan checklist skill dapat disimpan serta di-retrieve dengan benar.

---

### Task 5: AI-Assisted Trade Evaluator & Trade Journaling
* **Objective:** Integrasi validasi setup trade dengan LLM dan pencatatan riwayat trade ke dalam database.
* **Files to create/modify:**
  * `apps/web/src/app/api/ai/evaluate/route.ts`
  * `apps/web/src/components/journal/TradeJournalForm.tsx`
  * `apps/web/src/components/journal/JournalHistoryTable.tsx`
* **Implementation Steps:**
  1. Buat endpoint evaluasi AI yang menerima payload: `{ symbol, price, direction, checklistMet, indicatorsSummary }`.
  2. Endpoint mengirim prompt terstruktur ke LLM (OpenAI/Anthropic/Groq/Ollama) untuk menghasilkan review rasionalitas setup (Bullish/Bearish thesis, risiko invalidasi).
  3. Form jurnal menyimpan entri trade ke tabel `trade_journals` lengkap dengan status (OPEN/CLOSED), PnL, dan checklist yang dipenuhi.
* **Verification & Testing Command:**
  ```bash
  # Uji endpoint simpan jurnal via cURL
  curl -X POST http://localhost:3000/api/journal \
    -H "Content-Type: application/json" \
    -d '{"symbol":"XAUUSD","direction":"BUY","entry_price":2650.5,"stop_loss":2645.0,"take_profit":2665.0,"lot_size":0.1}'
  ```
* **Success Criteria:** AI memberikan respon analisis terstruktur, dan trade berhasil tersimpan di tabel `trade_journals`.

---

### Task 6: Final End-to-End Polish & Verification
* **Objective:** Pengujian menyeluruh dari awal hingga akhir, optimasi kinerja dan UI/UX dark-mode premium.
* **Checklist:**
  - [ ] Go Engine berjalan stabil, auto-reconnect berfungsi saat koneksi terputus sengaja.
  - [ ] Chart XAU/USD render mulus di browser, tooltip harga dan indikator akurat.
  - [ ] Checklist skill trading memblokir pencatatan trade jika rule wajib tidak dicentang.
  - [ ] API keys tersimpan aman tanpa bocor di response network browser.
  - [ ] Jurnal mencatat PnL dan statistik winrate per skill.
