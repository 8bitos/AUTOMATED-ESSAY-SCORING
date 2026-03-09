package handlers

import (
	"api-backend/internal/services"
	"fmt"
	"net/http"
	"time"
)

type NotificationRealtimeHandlers struct{}

func NewNotificationRealtimeHandlers() *NotificationRealtimeHandlers {
	return &NotificationRealtimeHandlers{}
}

func (h *NotificationRealtimeHandlers) StreamHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	userRole, _ := r.Context().Value("userRole").(string)
	if userID == "" || userRole == "" {
		respondWithError(w, http.StatusUnauthorized, "User context not found")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		respondWithError(w, http.StatusInternalServerError, "Streaming is not supported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	msgCh, unsubscribe := services.NotificationHub().Subscribe(userID, userRole)
	defer unsubscribe()

	fmt.Fprintf(w, "event: connected\ndata: {\"type\":\"connected\",\"at\":\"%s\"}\n\n", time.Now().UTC().Format(time.RFC3339Nano))
	flusher.Flush()

	heartbeat := time.NewTicker(20 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case msg, ok := <-msgCh:
			if !ok {
				return
			}
			fmt.Fprintf(w, "event: invalidate\ndata: %s\n\n", msg)
			flusher.Flush()
		case <-heartbeat.C:
			fmt.Fprintf(w, "event: heartbeat\ndata: {\"type\":\"heartbeat\",\"at\":\"%s\"}\n\n", time.Now().UTC().Format(time.RFC3339Nano))
			flusher.Flush()
		}
	}
}
