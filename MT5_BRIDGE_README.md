# MT5 HFM Bridge Integration

## VPS Setup
The bridge runs on Windows VPS (195.88.211.100). SSH access: Administrator / Lalalalisa123! (port 22).

## On VPS (Windows)
1. Install Python 3.10+ and MetaTrader 5 terminal (HFM)
2. Install dependencies: `pip install MetaTrader5 websockets asyncio`
3. Copy `scripts/mt5_hfm_bridge.py` to VPS
4. Create `.env` with credentials:
```env
MT5_ACCOUNT=YOUR_ACCOUNT
MT5_PASSWORD=YOUR_PASSWORD
MT5_SERVER=HFMarketsSV-Live
GO_ENGINE_URL=ws://195.88.211.100:8080/ws/ingest/mt5
```
5. Run: `python mt5_hfm_bridge.py`

## Local Go Engine
Engine listens on:
- Live WS (clients): `ws://localhost:8080/ws/live?symbol=XAUUSD&tf=1m`
- MT5 Ingest (bridge): `ws://localhost:8080/ws/ingest/mt5`

When bridge connects, it sends TICK and POSITIONS messages. Engine aggregates ticks into 1m candles and broadcasts both candles and positions to all live clients.

## Switching from Mock to Live
- Mock provider runs automatically in engine now (starts on boot)
- When MT5 bridge connects and sends real TICKs, engine processes them via the MT5 ingest handler
- Both sources can coexist; mock is for local dev without bridge
- To disable mock, set `DISABLE_MOCK_PROVIDER=true` in engine env
