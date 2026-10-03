package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type MarketTick struct {
	Symbol    string  `json:"symbol"`
	Timestamp int64   `json:"timestamp"`
	Bid       float64 `json:"bid"`
	Ask       float64 `json:"ask"`
	Price     float64 `json:"price"`
	Volume    float64 `json:"volume"`
}

type Candle struct {
	Symbol    string  `json:"symbol"`
	Timeframe string  `json:"timeframe"`
	Time      int64   `json:"time"` // Unix seconds
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Close     float64 `json:"close"`
	Volume    float64 `json:"volume"`
	IsClosed  bool    `json:"is_closed"`
}

type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mutex      sync.RWMutex
}

func newHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte, 1024),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			h.mutex.Unlock()
			log.Println("👤 Client UI connected to Engine WS")

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
				log.Println("❌ Client UI disconnected")
			}
			h.mutex.Unlock()

		case message := <-h.broadcast:
			h.mutex.RLock()
			for client := range h.clients {
				err := client.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					log.Printf("⚠️ Error sending to client: %v", err)
					client.Close()
					delete(h.clients, client)
				}
			}
			h.mutex.RUnlock()
		}
	}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all for development & local Next.js client
	},
}

// Current active candle state (1m)
var (
	currentCandle   *Candle
	candleMutex     sync.Mutex
	lastCandleTime  int64
)

func processTick(tick MarketTick, hub *Hub) {
	candleMutex.Lock()
	defer candleMutex.Unlock()

	// Align to 1m (60 seconds) boundary
	candleSec := (tick.Timestamp / 1000 / 60) * 60

	if currentCandle == nil || candleSec > lastCandleTime {
		if currentCandle != nil {
			currentCandle.IsClosed = true
			data, _ := json.Marshal(currentCandle)
			hub.broadcast <- data
		}

		currentCandle = &Candle{
			Symbol:    tick.Symbol,
			Timeframe: "1m",
			Time:      candleSec,
			Open:      tick.Price,
			High:      tick.Price,
			Low:       tick.Price,
			Close:     tick.Price,
			Volume:    tick.Volume,
			IsClosed:  false,
		}
		lastCandleTime = candleSec
	} else {
		if tick.Price > currentCandle.High {
			currentCandle.High = tick.Price
		}
		if tick.Price < currentCandle.Low {
			currentCandle.Low = tick.Price
		}
		currentCandle.Close = tick.Price
		currentCandle.Volume += tick.Volume
	}

	data, _ := json.Marshal(currentCandle)
	hub.broadcast <- data
}

// Synthetic Mock Generator for offline/local dev before VPS MT5 is connected
func startMockXAUUSDGenerator(hub *Hub) {
	log.Println("🧪 Mock XAU/USD Tick Generator active (Base Price: ~$2650.00)")
	price := 2650.00
	ticker := time.NewTicker(250 * time.Millisecond)

	for range ticker.C {
		delta := (rand.Float64() - 0.495) * 0.40 // Slight fluctuation
		price += delta
		spread := 0.20

		tick := MarketTick{
			Symbol:    "XAUUSD",
			Timestamp: time.Now().UnixMilli(),
			Bid:       price,
			Ask:       price + spread,
			Price:     price,
			Volume:    float64(rand.Intn(10) + 1),
		}

		processTick(tick, hub)
	}
}

func main() {
	port := os.Getenv("ENGINE_PORT")
	if port == "" {
		port = "8080"
	}

	hub := newHub()
	go hub.run()

	// 1. Endpoint untuk MT5 Python Bridge di VPS mengirim tick
	http.HandleFunc("/ws/ingest/mt5", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("Failed to upgrade MT5 ingestion: %v", err)
			return
		}
		defer conn.Close()
		log.Println("🔥 MT5 HFM Python Bridge Connected successfully!")

		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				log.Println("⚠️ MT5 Bridge disconnected")
				break
			}

			var tick MarketTick
			if err := json.Unmarshal(msg, &tick); err == nil {
				processTick(tick, hub)
			}
		}
	})

	// 2. Endpoint untuk Next.js Frontend Dashboard subscribe live candlestick stream
	http.HandleFunc("/ws/live", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("Failed to upgrade client: %v", err)
			return
		}
		hub.register <- conn

		// Read pump to detect disconnection
		go func() {
			for {
				if _, _, err := conn.NextReader(); err != nil {
					hub.unregister <- conn
					break
				}
			}
		}()
	})

	// Jalankan Mock Generator jika MT5 belum tersambung
	go startMockXAUUSDGenerator(hub)

	serverAddr := fmt.Sprintf(":%s", port)
	log.Printf("🚀 NeedPipsForPorsche Engine listening on http://localhost%s", serverAddr)
	log.Printf("📡 Live Chart WS: ws://localhost%s/ws/live", serverAddr)
	log.Printf("📥 MT5 Ingestion WS: ws://localhost%s/ws/ingest/mt5", serverAddr)

	if err := http.ListenAndServe(serverAddr, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
