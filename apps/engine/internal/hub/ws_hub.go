package hub

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

// Hub maintains set of active clients and broadcasts messages
type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mu         sync.RWMutex
}

// NewHub creates a new websocket hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte, 1024),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
}

// Run starts the hub event loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Println("👤 Client UI connected to Engine WS")

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
				log.Println("❌ Client UI disconnected")
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				err := client.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					log.Printf("⚠️ Error sending to client: %v", err)
					h.mu.RUnlock()
					h.mu.Lock()
					client.Close()
					delete(h.clients, client)
					h.mu.Unlock()
					h.mu.RLock()
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Register registers a client
func (h *Hub) Register(client *websocket.Conn) {
	h.register <- client
}

// Unregister unregisters a client
func (h *Hub) Unregister(client *websocket.Conn) {
	h.unregister <- client
}

// Broadcast sends message to all clients
func (h *Hub) Broadcast(data []byte) {
	h.broadcast <- data
}

// BroadcastJSON marshals and broadcasts JSON
func (h *Hub) BroadcastJSON(v interface{}) {
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("Error marshaling broadcast: %v", err)
		return
	}
	h.Broadcast(data)
}
