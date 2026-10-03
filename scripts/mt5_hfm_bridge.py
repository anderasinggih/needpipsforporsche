# MT5 HFM (HF Markets) Data Ingestion Bridge
import os
import sys
import time
import json
import asyncio
import websockets
import MetaTrader5 as mt5

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# --- KONFIGURASI HFM MT5 ---
HFM_ACCOUNT = int(os.getenv("MT5_ACCOUNT", "223052814"))
HFM_PASSWORD = os.getenv("MT5_PASSWORD", "Lalalalisa123!#")
HFM_SERVER = os.getenv("MT5_SERVER", "HFMarketsGlobal-Live18")
SYMBOL = os.getenv("MT5_SYMBOL", "XAUUSDc") # Auto-detects XAUUSDc, GOLDc, XAUUSD

# Endpoint Go Ingestion Engine
GO_ENGINE_WS_URL = os.getenv("GO_ENGINE_URL", "ws://localhost:8080/ws/ingest/mt5")

def initialize_mt5():
    """Inisialisasi koneksi ke terminal MT5 HFM yang terinstall di VPS"""
    global SYMBOL
    # Pastikan mengarah ke terminal64.exe HFM jika belum terbuka
    terminal_path = r"C:\Program Files\MetaTrader 5\terminal64.exe"
    if os.path.exists(terminal_path):
        init_ok = mt5.initialize(terminal_path)
    else:
        init_ok = mt5.initialize()

    if not init_ok:
        print(f"[!] Gagal inisialisasi MT5: {mt5.last_error()}")
        return False
    
    # Login otomatis ke akun HFM
    authorized = mt5.login(HFM_ACCOUNT, password=HFM_PASSWORD, server=HFM_SERVER)
    if authorized:
        print(f"✅ Berhasil terhubung ke Akun HFM: {HFM_ACCOUNT} di server {HFM_SERVER}")
        # Cek ketersediaan simbol (cent vs standard)
        for sym_candidate in [SYMBOL, "XAUUSDc", "GOLDc", "XAUUSD", "GOLD"]:
            if mt5.symbol_select(sym_candidate, True):
                SYMBOL = sym_candidate
                print(f"🎯 Simbol aktif terpilih: {SYMBOL}")
                break
        return True
    else:
        print(f"❌ Gagal login ke HFM: {mt5.last_error()}")
        return False


def execute_order(action, symbol, volume, sl=0.0, tp=0.0, magic=911911):
    """Execute BUY/SELL order via MT5 order_send"""
    if not mt5.symbol_select(symbol, True):
        return {"success": False, "error": f"Failed to select symbol {symbol}", "retcode": -1}
    
    symbol_info = mt5.symbol_info(symbol)
    if symbol_info is None:
        return {"success": False, "error": "Symbol info not available", "retcode": -2}
    
    # Set filling type if available
    filling_type = mt5.ORDER_FILLING_FOK
    if symbol_info.filling_mode & mt5.ORDER_FILLING_IOC:
        filling_type = mt5.ORDER_FILLING_IOC
    
    order_type = mt5.ORDER_TYPE_BUY if action.upper() == "BUY" else mt5.ORDER_TYPE_SELL
    price = mt5.symbol_info_tick(symbol).ask if action.upper() == "BUY" else mt5.symbol_info_tick(symbol).bid
    
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": float(volume),
        "type": order_type,
        "price": price,
        "sl": float(sl),
        "tp": float(tp),
        "deviation": 20,
        "magic": magic,
        "comment": "NeedPipsForPorsche AI",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": filling_type,
    }
    
    result = mt5.order_send(request)
    if result is None:
        return {"success": False, "error": "order_send returned None", "retcode": -3}
    
    if result.retcode == mt5.TRADE_RETCODE_DONE:
        return {
            "success": True,
            "retcode": result.retcode,
            "order": result.order,
            "volume": result.volume,
            "price": result.price,
            "bid": result.bid,
            "ask": result.ask,
            "comment": result.comment,
        }
    else:
        return {
            "success": False,
            "retcode": result.retcode,
            "error": f"Trade failed with retcode {result.retcode}",
            "order": getattr(result, 'order', 0),
        }


async def stream_hfm_ticks():
    """Membaca tick XAUUSD & open positions secara live dan mengirimkan ke Go Engine"""
    while True:
        try:
            print(f"🔌 Menghubungkan ke Go Engine di {GO_ENGINE_WS_URL}...")
            async with websockets.connect(GO_ENGINE_WS_URL) as ws:
                print(f"🚀 Streaming tick {SYMBOL} & open positions aktif...")
                last_time_msc = 0
                last_pos_check = 0

                async def handle_engine_message(msg):
                    try:
                        data = json.loads(msg)
                        if data.get("type") == "EXECUTE_ORDER":
                            res = execute_order(
                                data.get("action", "BUY"),
                                data.get("symbol", "XAUUSD"),
                                data.get("volume", 0.01),
                                data.get("sl", 0.0),
                                data.get("tp", 0.0),
                                data.get("magic", 911911),
                            )
                            resp = {
                                "type": "ORDER_RESPONSE",
                                "request_id": data.get("request_id"),
                                "symbol": data.get("symbol"),
                                "action": data.get("action"),
                                "volume": data.get("volume"),
                                "result": res,
                            }
                            await ws.send(json.dumps(resp))
                    except Exception as e:
                        await ws.send(json.dumps({"type": "ORDER_RESPONSE", "error": str(e)}))

                async def receive_loop():
                    try:
                        async for msg in ws:
                            await handle_engine_message(msg if isinstance(msg, str) else msg.decode())
                    except Exception:
                        pass

                receiver = asyncio.create_task(receive_loop())

                # Initial load: dapatkan candle/tick penutupan terakhir dari MT5 jika market sedang tutup
                rates = mt5.copy_rates_from_pos(SYMBOL, mt5.TIMEFRAME_M1, 0, 1)
                if rates is not None and len(rates) > 0:
                    last_rate = rates[0]
                    last_close_payload = {
                        "type": "TICK",
                        "symbol": SYMBOL,
                        "timestamp": int(last_rate["time"]) * 1000,
                        "bid": float(last_rate["close"]),
                        "ask": float(last_rate["close"]),
                        "price": float(last_rate["close"]),
                        "volume": float(last_rate["tick_volume"]),
                    }
                    await ws.send(json.dumps(last_close_payload))
                    print(f"📊 Initial price dikirim dari MT5: {SYMBOL} = {last_rate['close']}")

                while True:
                    now = time.time()
                    # 1. Stream Tick Harga
                    tick = mt5.symbol_info_tick(SYMBOL)
                    if tick is not None and tick.time_msc != last_time_msc:
                        last_time_msc = tick.time_msc
                        
                        tick_payload = {
                            "type": "TICK",
                            "symbol": SYMBOL,
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
