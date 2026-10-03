package types

// MarketTick represents a real-time market tick
type MarketTick struct {
	Symbol    string  `json:"symbol"`
	Timestamp int64   `json:"timestamp"`
	Bid       float64 `json:"bid"`
	Ask       float64 `json:"ask"`
	Price     float64 `json:"price"`
	Volume    float64 `json:"volume"`
}

// Candle represents OHLCV candle data
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

// Position represents an open position from MT5
type Position struct {
	Ticket       int64   `json:"ticket"`
	Symbol       string  `json:"symbol"`
	Type         string  `json:"type"`
	Volume       float64 `json:"volume"`
	OpenPrice    float64 `json:"open_price"`
	CurrentPrice float64 `json:"current_price"`
	SL           float64 `json:"sl"`
	TP           float64 `json:"tp"`
	Profit       float64 `json:"profit"`
	Time         int64   `json:"time"`
}

// MT5Message represents messages from MT5 bridge
type MT5Message struct {
	Type      string     `json:"type"`
	Symbol    string     `json:"symbol"`
	Timestamp int64      `json:"timestamp"`
	Bid       float64    `json:"bid"`
	Ask       float64    `json:"ask"`
	Price     float64    `json:"price"`
	Volume    float64    `json:"volume"`
	Positions []Position `json:"positions,omitempty"`
}
