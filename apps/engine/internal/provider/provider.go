package provider

import "needpipsforporsche/engine/internal/types"

// DataProvider defines the interface for market data providers
type DataProvider interface {
	Start() (<-chan types.MarketTick, error)
	Stop()
	Name() string
}
