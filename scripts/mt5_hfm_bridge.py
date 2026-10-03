# MT5 HFM (HF Markets) Data Ingestion Bridge
import os
import time
import json
import asyncio
import websockets
import MetaTrader5 as mt5

# --- KONFIGURASI HFM MT5 ---
HFM_ACCOUNT = int(os.getenv("MT5_ACCOUNT", "12345678")) # Nomor akun HFM (bisa akun demo/real)
HFM_PASSWORD = os.getenv("MT5_PASSWORD", "your_password")
HFM_SERVER = os.getenv("MT5_SERVER", "HFMarketsSV-Live") # atau HFMarkets-Demo
SYMBOL = "XAUUSD" # atau "GOLD" sesuai penamaan di Market Watch HFM

# Endpoint Go Ingestion Engine
GO_ENGINE_WS_URL = os.getenv("GO_ENGINE_URL", "ws://localhost:8080/ws/ingest/mt5")

def initialize_mt5():
    """Inisialisasi koneksi ke terminal MT5 HFM yang terinstall di VPS"""
    if not mt5.initialize():
        print(f"❌ Gagal inisialisasi MT5: {mt5.last_error()}")
        return False
    
    # Login otomatis ke akun HFM
    authorized = mt5.login(HFM_ACCOUNT, password=HFM_PASSWORD, server=HFM_SERVER)
    if authorized:
        print(f"✅ Berhasil terhubung ke Akun HFM: {HFM_ACCOUNT} di server {HFM_SERVER}")
        # Pastikan simbol XAUUSD aktif di Market Watch
        mt5.symbol_select(SYMBOL, True)
        return True
    else:
        print(f"❌ Gagal login ke HFM: {mt5.last_error()}")
        return False

async def stream_hfm_ticks():
    """Membaca tick XAUUSD secara live dan mengirimkan via WebSocket ke Go Engine"""
    while True:
        try:
            print(f"🔌 Menghubungkan ke Go Engine di {GO_ENGINE_WS_URL}...")
            async with websockets.connect(GO_ENGINE_WS_URL) as ws:
                print(f"🚀 Streaming tick {SYMBOL} dari HFM aktif...")
                last_time_msc = 0

                while True:
                    # Ambil tick paling mutakhir dari terminal MT5
                    tick = mt5.symbol_info_tick(SYMBOL)
                    if tick is not None and tick.time_msc != last_time_msc:
                        last_time_msc = tick.time_msc
                        
                        payload = {
                            "symbol": "XAUUSD",
                            "timestamp": tick.time_msc,
                            "bid": tick.bid,
                            "ask": tick.ask,
                            "price": (tick.bid + tick.ask) / 2.0,
                            "volume": float(tick.volume_real if tick.volume_real > 0 else tick.volume)
                        }
                        
                        await ws.send(json.dumps(payload))
                    
                    # Polling 10-20ms untuk zero-latency
                    await asyncio.sleep(0.01)

        except (websockets.ConnectionClosed, ConnectionRefusedError):
            print("⚠️ Koneksi ke Go Engine terputus. Mencoba reconnect dalam 3 detik...")
            await asyncio.sleep(3)
        except Exception as e:
            print(f"⚠️ Error: {e}")
            await asyncio.sleep(1)

if __name__ == "__main__":
    if initialize_mt5():
        try:
            asyncio.run(stream_hfm_ticks())
        finally:
            mt5.shutdown()
            print("🛑 MT5 Disconnected")
