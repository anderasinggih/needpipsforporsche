package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"

	"github.com/gorilla/websocket"

	"needpipsforporsche/engine/internal/aggregator"
	"needpipsforporsche/engine/internal/hub"
	"needpipsforporsche/engine/internal/provider"
	"needpipsforporsche/engine/internal/types"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all for development & local Next.js client
	},
}

func main() {
	port := os.Getenv("ENGINE_PORT")
	if port == "" {
		port = "8080"
	}

	wsHub := hub.NewHub()
	go wsHub.Run()

	// Create aggregator for 1m candles (XAUUSD)
	candleAgg := aggregator.NewCandleAggregator("XAUUSD", 60)

	// Start mock provider
	mockProvider := provider.NewMockProvider()
	tickChan, err := mockProvider.Start()
	if err != nil {
		log.Fatalf("Failed to start mock provider: %v", err)
	}

	// Process ticks from provider
	go func() {
		for tick := range tickChan {
			candleAgg.ProcessTick(tick)
		}
	}()

	// Broadcast candles from aggregator
	go func() {
		for candle := range candleAgg.GetCandleChannel() {
			wsHub.BroadcastJSON(candle)
		}
	}()

	// 1. Endpoint for MT5 Python Bridge in VPS to send tick data and positions
	mt5Clients := make(map[*websocket.Conn]bool)
	var mt5Mu sync.Mutex
	http.HandleFunc("/ws/ingest/mt5", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("Failed to upgrade MT5 ingestion: %v", err)
			return
		}
		mt5Mu.Lock()
		mt5Clients[conn] = true
		mt5Mu.Unlock()
		log.Println("🔥 MT5 HFM Python Bridge Connected successfully!")

		defer func() {
			conn.Close()
			mt5Mu.Lock()
			delete(mt5Clients, conn)
			mt5Mu.Unlock()
			log.Println("⚠️ MT5 Bridge disconnected")
		}()

		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				break
			}

			var mt5Msg types.MT5Message
			if err := json.Unmarshal(msg, &mt5Msg); err == nil {
				if mt5Msg.Type == "TICK" || mt5Msg.Type == "" {
					tick := types.MarketTick{
						Symbol:    mt5Msg.Symbol,
						Timestamp: mt5Msg.Timestamp,
						Bid:       mt5Msg.Bid,
						Ask:       mt5Msg.Ask,
						Price:     mt5Msg.Price,
						Volume:    mt5Msg.Volume,
					}
					if tick.Symbol == "" {
						tick.Symbol = "XAUUSD"
					}
					candleAgg.ProcessTick(tick)
				} else if mt5Msg.Type == "POSITIONS" {
					// Broadcast positions to clients
					posData := map[string]interface{}{
						"type":      "POSITIONS",
						"positions": mt5Msg.Positions,
					}
					wsHub.BroadcastJSON(posData)
				}
			}
		}
	})

	// 2. Endpoint for Next.js Frontend Dashboard - live stream (candles + positions)
	http.HandleFunc("/ws/live", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("Failed to upgrade client: %v", err)
			return
		}
		wsHub.Register(conn)

		// Read pump to detect disconnection
		go func() {
			for {
				if _, _, err := conn.NextReader(); err != nil {
					wsHub.Unregister(conn)
					break
				}
			}
		}()
	})

	serverAddr := fmt.Sprintf(":%s", port)
	log.Printf("🚀 NeedPipsForPorsche Engine listening on http://localhost%s", serverAddr)
	log.Printf("📡 Live Chart WS: ws://localhost%s/ws/live", serverAddr)
	log.Printf("📥 MT5 Ingestion WS: ws://localhost%s/ws/ingest/mt5", serverAddr)

	if err := http.ListenAndServe(serverAddr, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
