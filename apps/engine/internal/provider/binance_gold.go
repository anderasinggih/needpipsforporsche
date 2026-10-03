package provider

import (
	"encoding/json"
	"log"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"needpipsforporsche/engine/internal/types"
)

// BinanceGoldProvider streams real-time physical gold price (PAXG/USDT) 24/7 without API keys
type BinanceGoldProvider struct {
	symbol    string
	wsURL     string
	tickChan  chan types.MarketTick
	stopChan  chan struct{}
	conn      *websocket.Conn
	mu        sync.Mutex
	isRunning bool
}

type binanceTradeMessage struct {
	EventTime int64  `json:"E"`
	Symbol    string `json:"s"`
	PriceStr  string `json:"p"`
	QtyStr    string `json:"q"`
}

// NewBinanceGoldProvider connects to Binance Public Spot Stream for gold
func NewBinanceGoldProvider() *BinanceGoldProvider {
	return &BinanceGoldProvider{
		symbol:   "XAUUSD",
		wsURL:    "wss://stream.binance.com:9443/ws/paxgusdt@aggTrade",
		tickChan: make(chan types.MarketTick, 2048),
		stopChan: make(chan struct{}),
	}
}

func (b *BinanceGoldProvider) Name() string {
	return "binance_gold"
}

func (b *BinanceGoldProvider) Start() (<-chan types.MarketTick, error) {
	b.mu.Lock()
	if b.isRunning {
		b.mu.Unlock()
		return b.tickChan, nil
	}
	b.isRunning = true
	b.mu.Unlock()

	go b.connectAndStream()
	return b.tickChan, nil
}

func (b *BinanceGoldProvider) connectAndStream() {
	for {
		select {
		case <-b.stopChan:
			return
		default:
		}

		log.Printf("🔌 [Binance Gold] Connecting to %s...", b.wsURL)
		conn, _, err := websocket.DefaultDialer.Dial(b.wsURL, nil)
		if err != nil {
			log.Printf("❌ [Binance Gold] Dial failed: %v. Retrying in 5s...", err)
			time.Sleep(5 * time.Second)
			continue
		}

		b.mu.Lock()
		b.conn = conn
		b.mu.Unlock()

		log.Println("🟢 [Binance Gold] Real-Time 24/7 Gold Feed CONNECTED successfully!")

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("⚠️ [Binance Gold] Read error: %v", err)
				break
			}

			var trade binanceTradeMessage
			if err := json.Unmarshal(message, &trade); err == nil {
				price, errP := strconv.ParseFloat(trade.PriceStr, 64)
				qty, _ := strconv.ParseFloat(trade.QtyStr, 64)
				if errP == nil && price > 0 {
					tick := types.MarketTick{
						Symbol:    "XAUUSD",
						Price:     price,
						Bid:       price - 0.15,
						Ask:       price + 0.15,
						Volume:    qty,
						Timestamp: trade.EventTime,
					}
					select {
					case b.tickChan <- tick:
					default:
					}
				}
			}
		}

		conn.Close()
		time.Sleep(2 * time.Second)
	}
}

func (b *BinanceGoldProvider) Stop() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if !b.isRunning {
		return
	}
	b.isRunning = false
	close(b.stopChan)
	if b.conn != nil {
		b.conn.Close()
	}
}
