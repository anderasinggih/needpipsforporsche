package provider

import (
	"math/rand"
	"sync"
	"time"

	"needpipsforporsche/engine/internal/types"
)

// MockProvider generates synthetic XAU/USD tick data for testing
type MockProvider struct {
	mu     sync.Mutex
	price  float64
	spread float64
	vol    float64
	stop   chan struct{}
	name   string
}

// NewMockProvider creates a new mock data provider
func NewMockProvider() *MockProvider {
	rand.Seed(time.Now().UnixNano())
	return &MockProvider{
		price:  2650.00,
		spread: 0.20,
		vol:    1.0,
		stop:   make(chan struct{}),
		name:   "mock",
	}
}

// Name returns provider name
func (m *MockProvider) Name() string {
	return m.name
}

// Start generates market ticks and sends them through channel
func (m *MockProvider) Start() (<-chan types.MarketTick, error) {
	tickChan := make(chan types.MarketTick, 1024)
	go func() {
		ticker := time.NewTicker(250 * time.Millisecond)
		defer ticker.Stop()
		defer close(tickChan)

		for {
			select {
			case <-m.stop:
				return
			case <-ticker.C:
				m.mu.Lock()
				delta := (rand.Float64() - 0.495) * 0.40
				m.price += delta
				if m.price < 2600 {
					m.price = 2600
				}
				if m.price > 2700 {
					m.price = 2700
				}
				price := m.price
				spread := m.spread + (rand.Float64()-0.5)*0.05
				m.mu.Unlock()

				tick := types.MarketTick{
					Symbol:    "XAUUSD",
					Timestamp: time.Now().UnixMilli(),
					Bid:       price,
					Ask:       price + spread,
					Price:     price,
					Volume:    float64(rand.Intn(10) + 1),
				}
				tickChan <- tick
			}
		}
	}()
	return tickChan, nil
}

// Stop stops the provider
func (m *MockProvider) Stop() {
	close(m.stop)
}
