package aggregator

import (
	"sync"
	"time"

	"needpipsforporsche/engine/internal/types"
)

// CandleAggregator aggregates ticks into candles
type CandleAggregator struct {
	symbol           string
	timeframeSeconds int64
	currentCandle    *types.Candle
	lastCandleTime   int64
	mu               sync.Mutex
	candleChan       chan types.Candle
}

// NewCandleAggregator creates new candle aggregator
func NewCandleAggregator(symbol string, timeframeSeconds int64) *CandleAggregator {
	return &CandleAggregator{
		symbol:           symbol,
		timeframeSeconds: timeframeSeconds,
		candleChan:       make(chan types.Candle, 1024),
	}
}

// ProcessTick processes incoming tick and emits candles
func (ca *CandleAggregator) ProcessTick(tick types.MarketTick) {
	ca.mu.Lock()
	defer ca.mu.Unlock()

	candleSec := (tick.Timestamp / 1000 / ca.timeframeSeconds) * ca.timeframeSeconds

	if ca.currentCandle == nil || candleSec > ca.lastCandleTime {
		if ca.currentCandle != nil {
			ca.currentCandle.IsClosed = true
			ca.candleChan <- *ca.currentCandle
		}

		ca.currentCandle = &types.Candle{
			Symbol:    tick.Symbol,
			Timeframe: getTimeframeString(ca.timeframeSeconds),
			Time:      candleSec,
			Open:      tick.Price,
			High:      tick.Price,
			Low:       tick.Price,
			Close:     tick.Price,
			Volume:    tick.Volume,
			IsClosed:  false,
		}
		ca.lastCandleTime = candleSec
	} else {
		if tick.Price > ca.currentCandle.High {
			ca.currentCandle.High = tick.Price
		}
		if tick.Price < ca.currentCandle.Low {
			ca.currentCandle.Low = tick.Price
		}
		ca.currentCandle.Close = tick.Price
		ca.currentCandle.Volume += tick.Volume
	}

	ca.candleChan <- *ca.currentCandle
}

// GetCandleChannel returns channel for emitted candles
func (ca *CandleAggregator) GetCandleChannel() <-chan types.Candle {
	return ca.candleChan
}

// Flush closes current candle
func (ca *CandleAggregator) Flush() {
	ca.mu.Lock()
	defer ca.mu.Unlock()
	if ca.currentCandle != nil {
		ca.currentCandle.IsClosed = true
		ca.candleChan <- *ca.currentCandle
		ca.currentCandle = nil
	}
}

func getTimeframeString(seconds int64) string {
	switch seconds {
	case 60:
		return "1m"
	case 300:
		return "5m"
	case 900:
		return "15m"
	case 3600:
		return "1h"
	case 14400:
		return "4h"
	case 86400:
		return "1d"
	default:
		return time.Duration(seconds * 1e9).String()
	}
}
