package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

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

type ExecuteTradeRequest struct {
	Symbol string  `json:"symbol"`
	Action string  `json:"action"` // BUY/SELL
	Volume float64 `json:"volume"`
	SL     float64 `json:"sl"`
	TP     float64 `json:"tp"`
	Magic  int     `json:"magic"`
}

type ExecuteTradeResponse struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message,omitempty"`
	Result  map[string]interface{} `json:"result,omitempty"`
	Error   string                 `json:"error,omitempty"`
}

func main() {
	port := os.Getenv("ENGINE_PORT")
	if port == "" {
		port = "8080"
	}

	wsHub := hub.NewHub()
	tradeHub := hub.NewTradeHub()
	go wsHub.Run()

	// Create aggregator for 1m candles
	candleAgg := aggregator.NewCandleAggregator("XAUUSD", 60)

	// Massive.com WebSocket Provider: Live real-time Forex/Gold streaming
	massiveKey := os.Getenv("MASSIVE_API_KEY")
	if massiveKey == "" {
		massiveKey = "isbqihiqbZ3b9gOxZQUQGxOpCJDfj47f"
	}

	if massiveKey != "" {
		massiveSym := os.Getenv("MASSIVE_SYMBOL")
		if massiveSym == "" {
			massiveSym = "C:XAUUSD"
		}
		massiveProvider := provider.NewMassiveProvider(massiveKey, massiveSym)
		tickChan, err := massiveProvider.Start()
		if err != nil {
			log.Printf("Failed to start Massive provider: %v", err)
		} else {
			go func() {
				for tick := range tickChan {
					candleAgg.ProcessTick(tick)
				}
			}()
			log.Printf("🚀 Massive.com live feed provider ACTIVE for %s", massiveSym)
		}
	} else if os.Getenv("ENABLE_MOCK_PROVIDER") == "true" {
		mockProvider := provider.NewMockProvider()
		tickChan, err := mockProvider.Start()
		if err != nil {
			log.Printf("Failed to start mock provider: %v", err)
		} else {
			go func() {
				for tick := range tickChan {
					candleAgg.ProcessTick(tick)
				}
			}()
			log.Println("🧪 Mock provider explicitly enabled")
		}
	} else {
		log.Println("🚫 Mock provider DISABLED — accepting ONLY live tick data from MT5 broker bridge")
	}

	// Broadcast candles from aggregator
	go func() {
		for candle := range candleAgg.GetCandleChannel() {
			wsHub.BroadcastJSON(candle)
		}
	}()

	// MT5 ingest endpoint
	http.HandleFunc("/ws/ingest/mt5", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("Failed to upgrade MT5 ingestion: %v", err)
			return
		}
		tradeHub.SetMT5Bridge(conn)
		log.Println("🔥 MT5 HFM Python Bridge Connected successfully!")

		defer func() {
			conn.Close()
			tradeHub.RemoveMT5Bridge()
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
					posData := map[string]interface{}{
						"type":      "POSITIONS",
						"positions": mt5Msg.Positions,
					}
					wsHub.BroadcastJSON(posData)
				}
			}

			// Handle order response
			var orderResp map[string]interface{}
			if err := json.Unmarshal(msg, &orderResp); err == nil {
				if orderResp["type"] == "ORDER_RESPONSE" {
					reqID, _ := orderResp["request_id"].(string)
					tradeResp := hub.TradeOrderResponse{
						Type:      "ORDER_RESPONSE",
						RequestID: reqID,
						Symbol:    fmt.Sprintf("%v", orderResp["symbol"]),
						Action:    fmt.Sprintf("%v", orderResp["action"]),
						Result:    orderResp["result"].(map[string]interface{}),
					}
					if errStr, ok := orderResp["error"].(string); ok {
						tradeResp.Error = errStr
					}
					tradeHub.HandleResponse(tradeResp)
				}
			}
		}
	})

	// REST endpoint to execute trade
	http.HandleFunc("/api/trade/execute", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req ExecuteTradeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(ExecuteTradeResponse{Success: false, Error: "Invalid request body"})
			return
		}

		if !tradeHub.IsConnected() {
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(ExecuteTradeResponse{Success: false, Error: "MT5 bridge not connected. Cannot execute trade."})
			return
		}

		if req.Symbol == "" {
			req.Symbol = "XAUUSD"
		}
		if req.Magic == 0 {
			req.Magic = 911911
		}
		if req.Volume <= 0 {
			req.Volume = 0.01
		}

		tradeReq := hub.TradeOrderRequest{
			RequestID: fmt.Sprintf("req_%d", time.Now().UnixNano()),
			Type:      "EXECUTE_ORDER",
			Symbol:    req.Symbol,
			Action:    req.Action,
			Volume:    req.Volume,
			SL:        req.SL,
			TP:        req.TP,
			Magic:     req.Magic,
		}

		resp, err := tradeHub.ExecuteOrder(tradeReq)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(ExecuteTradeResponse{Success: false, Error: err.Error()})
			return
		}

		result := ExecuteTradeResponse{
			Success: true,
			Message: "Order executed",
			Result:  resp.Result,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	})

	// Live stream endpoint
	http.HandleFunc("/ws/live", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("Failed to upgrade client: %v", err)
			return
		}
		wsHub.Register(conn)

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
	log.Printf("🎯 Trade Execute REST: http://localhost%s/api/trade/execute", serverAddr)

	if err := http.ListenAndServe(serverAddr, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
