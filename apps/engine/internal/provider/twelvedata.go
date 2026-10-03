package provider

import (
	"needpipsforporsche/engine/internal/types"
)

// TwelveDataProvider placeholder for real-time data feed
type TwelveDataProvider struct {
	name string
}

// NewTwelveDataProvider creates new TwelveData provider
func NewTwelveDataProvider() *TwelveDataProvider {
	return &TwelveDataProvider{
		name: "twelvedata",
	}
}

// Name returns provider name
func (t *TwelveDataProvider) Name() string {
	return t.name
}

// Start starts the provider
func (t *TwelveDataProvider) Start() (<-chan types.MarketTick, error) {
	tickChan := make(chan types.MarketTick, 1024)
	return tickChan, nil
}

// Stop stops the provider
func (t *TwelveDataProvider) Stop() {
}
