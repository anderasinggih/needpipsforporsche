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
    """Membaca tick XAUUSD & open positions secara live dan mengirimkan ke Go Engine"""
    while True:
        try:
            print(f"🔌 Menghubungkan ke Go Engine di {GO_ENGINE_WS_URL}...")
            async with websockets.connect(GO_ENGINE_WS_URL) as ws:
                print(f"🚀 Streaming tick {SYMBOL} & open positions aktif...")
                last_time_msc = 0
                last_pos_check = 0

                while True:
                    now = time.time()
                    # 1. Stream Tick Harga XAUUSD
                    tick = mt5.symbol_info_tick(SYMBOL)
                    if tick is not None and tick.time_msc != last_time_msc:
                        last_time_msc = tick.time_msc
                        
                        tick_payload = {
                            "type": "TICK",
                            "symbol": "XAUUSD",
                            "timestamp": tick.time_msc,
                            "bid": tick.bid,
                            "ask": tick.ask,
                            "price": (tick.bid + tick.ask) / 2.0,
                            "volume": float(tick.volume_real if tick.volume_real > 0 else tick.volume)
                        }
                        await ws.send(json.dumps(tick_payload))

                    # 2. Baca Posisi Trading Aktif (Setiap 500ms)
                    if now - last_pos_check > 0.5:
                        last_pos_check = now
                        positions = mt5.positions_get(symbol=SYMBOL)
                        pos_list = []
                        if positions is not None:
                            for pos in positions:
                                pos_list.append({
                                    "ticket": pos.ticket,
                                    "symbol": pos.symbol,
                                    "type": "BUY" if pos.type == mt5.ORDER_TYPE_BUY else "SELL",
                                    "volume": pos.volume,
                                    "open_price": pos.price_open,
                                    "current_price": pos.price_current,
                                    "sl": pos.sl,
                                    "tp": pos.tp,
                                    "profit": pos.profit,
                                    "time": pos.time
                                })
                        
                        pos_payload = {
                            "type": "POSITIONS",
                            "positions": pos_list
                        }
                        await ws.send(json.dumps(pos_payload))
                    
                    # Polling 15ms untuk real-time update
                    await asyncio.sleep(0.015)

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
