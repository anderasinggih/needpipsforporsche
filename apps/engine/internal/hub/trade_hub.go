package hub

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

// TradeOrderRequest represents order execution request
type TradeOrderRequest struct {
	RequestID string  `json:"request_id"`
	Type      string  `json:"type"` // EXECUTE_ORDER
	Symbol    string  `json:"symbol"`
	Action    string  `json:"action"` // BUY/SELL
	Volume    float64 `json:"volume"`
	SL        float64 `json:"sl"`
	TP        float64 `json:"tp"`
	Magic     int     `json:"magic"`
}

// TradeOrderResponse represents order execution response from MT5
type TradeOrderResponse struct {
	Type      string                 `json:"type"` // ORDER_RESPONSE
	RequestID string                 `json:"request_id"`
	Symbol    string                 `json:"symbol"`
	Action    string                 `json:"action"`
	Volume    float64                `json:"volume"`
	Result    map[string]interface{} `json:"result"`
	Error     string                 `json:"error,omitempty"`
}

// TradeHub manages MT5 bridge connection for order execution
type TradeHub struct {
	mt5Conn    *websocket.Conn
	mt5Mu      sync.RWMutex
	responders map[string]chan TradeOrderResponse
	respMu     sync.RWMutex
}

// NewTradeHub creates new trade execution hub
func NewTradeHub() *TradeHub {
	return &TradeHub{
		responders: make(map[string]chan TradeOrderResponse),
	}
}

// SetMT5Bridge sets active MT5 bridge connection
func (th *TradeHub) SetMT5Bridge(conn *websocket.Conn) {
	th.mt5Mu.Lock()
	th.mt5Conn = conn
	th.mt5Mu.Unlock()
	log.Println("📊 MT5 Bridge registered for trade execution")
}

// RemoveMT5Bridge removes bridge connection
func (th *TradeHub) RemoveMT5Bridge() {
	th.mt5Mu.Lock()
	th.mt5Conn = nil
	th.mt5Mu.Unlock()
	log.Println("📊 MT5 Bridge unregistered from trade execution")
}

// IsConnected checks if MT5 bridge is connected
func (th *TradeHub) IsConnected() bool {
	th.mt5Mu.RLock()
	defer th.mt5Mu.RUnlock()
	return th.mt5Conn != nil
}

// HandleResponse processes response from MT5 bridge
func (th *TradeHub) HandleResponse(resp TradeOrderResponse) {
	th.respMu.RLock()
	ch, ok := th.responders[resp.RequestID]
	th.respMu.RUnlock()
	if ok {
		select {
		case ch <- resp:
		default:
			log.Printf("Warning: responder channel full for %s", resp.RequestID)
		}
	}
}

// ExecuteOrder sends order to MT5 and waits for response
func (th *TradeHub) ExecuteOrder(req TradeOrderRequest) (*TradeOrderResponse, error) {
	th.mt5Mu.RLock()
	conn := th.mt5Conn
	th.mt5Mu.RUnlock()

	if conn == nil {
		return nil, ErrBridgeNotConnected
	}

	ch := make(chan TradeOrderResponse, 1)
	th.respMu.Lock()
	th.responders[req.RequestID] = ch
	th.respMu.Unlock()

	defer func() {
		th.respMu.Lock()
		delete(th.responders, req.RequestID)
		th.respMu.Unlock()
		close(ch)
	}()

	data, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		return nil, err
	}

	select {
	case resp := <-ch:
		return &resp, nil
	case <-make(chan struct{}):
		return nil, ErrTimeout
	}
}

var (
	ErrBridgeNotConnected = &TradeError{msg: "MT5 bridge not connected"}
	ErrTimeout            = &TradeError{msg: "Request timeout waiting for MT5 response"}
)

// TradeError custom error
type TradeError struct {
	msg string
}

func (e *TradeError) Error() string {
	return e.msg
}
