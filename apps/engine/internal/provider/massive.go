package provider

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"needpipsforporsche/engine/internal/types"
)

// MassiveProvider connects to Massive.com Forex WebSocket stream
type MassiveProvider struct {
	apiKey    string
	symbol    string
	wsURL     string
	tickChan  chan types.MarketTick
	stopChan  chan struct{}
	conn      *websocket.Conn
	mu        sync.Mutex
	isRunning bool
}

// MassiveMessage represents incoming WebSocket message from Massive.com
type MassiveMessage struct {
	Ev     string  `json:"ev"`
	Status string  `json:"status"`
	Msg    string  `json:"message"`
	Sym    string  `json:"sym"`
	Price  float64 `json:"p"`
	Bid    float64 `json:"b"`
	Ask    float64 `json:"a"`
	Close  float64 `json:"c"`
	Open   float64 `json:"o"`
	High   float64 `json:"h"`
	Low    float64 `json:"l"`
	Vol    float64 `json:"v"`
	Start  int64   `json:"s"`
	Time   int64   `json:"t"`
}

// NewMassiveProvider creates a new Massive.com WebSocket provider
func NewMassiveProvider(apiKey string, symbol string) *MassiveProvider {
	if symbol == "" {
		symbol = "C:XAUUSD"
	}
	return &MassiveProvider{
		apiKey:   apiKey,
		symbol:   symbol,
		wsURL:    "wss://socket.massive.com/forex",
		tickChan: make(chan types.MarketTick, 2048),
		stopChan: make(chan struct{}),
	}
}

func (m *MassiveProvider) Name() string {
	return "massive"
}

func (m *MassiveProvider) Start() (<-chan types.MarketTick, error) {
	m.mu.Lock()
	if m.isRunning {
		m.mu.Unlock()
		return m.tickChan, nil
	}
	m.isRunning = true
	m.mu.Unlock()

	go m.connectAndStream()
	return m.tickChan, nil
}

func (m *MassiveProvider) connectAndStream() {
	for {
		select {
		case <-m.stopChan:
			return
		default:
		}

		log.Printf("🔌 [Massive Provider] Connecting to %s...", m.wsURL)
		conn, _, err := websocket.DefaultDialer.Dial(m.wsURL, nil)
		if err != nil {
			log.Printf("❌ [Massive Provider] Dial failed: %v. Retrying in 5s...", err)
			time.Sleep(5 * time.Second)
			continue
		}

		m.mu.Lock()
		m.conn = conn
		m.mu.Unlock()

		// 2. Read messages loop: wait for connected before auth
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("⚠️ [Massive Provider] Read error: %v", err)
				break
			}
			log.Printf("📥 [Massive Raw Message]: %s", string(message))

			var msgs []MassiveMessage
			if err := json.Unmarshal(message, &msgs); err != nil {
				// Single object message fallback
				var singleMsg MassiveMessage
				if err2 := json.Unmarshal(message, &singleMsg); err2 == nil {
					msgs = []MassiveMessage{singleMsg}
				} else {
					continue
				}
			}

			for _, msg := range msgs {
				if msg.Ev == "status" {
					if msg.Status == "connected" {
						log.Printf("🟢 [Massive Provider] Connected: %s -> Sending Auth...", msg.Msg)
						authReq := map[string]string{
							"action": "auth",
							"params": m.apiKey,
						}
						_ = conn.WriteJSON(authReq)
					} else if msg.Status == "auth_success" {
						log.Printf("🔑 [Massive Provider] Authentication Successful!")
						// Subscribe to per-minute aggregates (AM) and quotes
						subReq := map[string]string{
							"action": "subscribe",
							"params": fmt.Sprintf("AM.%s,%s", m.symbol, m.symbol),
						}
						_ = conn.WriteJSON(subReq)
						log.Printf("📡 [Massive Provider] Subscribed to %s", m.symbol)
					}
					continue
				}

				// Handle Quote or Aggregate bar
				var price float64
				var timestamp int64

				if msg.Close > 0 {
					price = msg.Close
					timestamp = msg.Start
				} else if msg.Price > 0 {
					price = msg.Price
					timestamp = msg.Time
				} else if msg.Bid > 0 && msg.Ask > 0 {
					price = (msg.Bid + msg.Ask) / 2.0
					timestamp = msg.Time
				}

				if price > 0 {
					if timestamp == 0 {
						timestamp = time.Now().UnixMilli()
					}
					tick := types.MarketTick{
						Symbol:    "XAUUSD",
						Price:     price,
						Bid:       msg.Bid,
						Ask:       msg.Ask,
						Volume:    msg.Vol,
						Timestamp: timestamp,
					}
					select {
					case m.tickChan <- tick:
					default:
					}
				}
			}
		}

		conn.Close()
		time.Sleep(3 * time.Second)
	}
}

func (m *MassiveProvider) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.isRunning {
		return
	}
	m.isRunning = false
	close(m.stopChan)
	if m.conn != nil {
		m.conn.Close()
	}
}
