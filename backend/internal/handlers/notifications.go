package handlers

import (
	"api-backend/internal/models"
	"api-backend/internal/services"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

type NotificationHandlers struct {
	Service *services.NotificationService
}

func NewNotificationHandlers(service *services.NotificationService) *NotificationHandlers {
	return &NotificationHandlers{Service: service}
}

func (h *NotificationHandlers) ListNotificationsHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	userRole, _ := r.Context().Value("userRole").(string)
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(userRole) == "" {
		respondWithError(w, http.StatusUnauthorized, "User context not found")
		return
	}
	limit := 60
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}
	feed, err := h.Service.SyncAndList(userID, userRole, limit)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load notifications")
		return
	}
	respondWithJSON(w, http.StatusOK, feed)
}

func (h *NotificationHandlers) MarkNotificationsReadHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	if strings.TrimSpace(userID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User context not found")
		return
	}
	var payload models.MarkNotificationsReadRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.Service.MarkRead(userID, payload.IDs); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to mark notifications as read")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]any{"success": true})
}

func (h *NotificationHandlers) MarkAllNotificationsReadHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	if strings.TrimSpace(userID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User context not found")
		return
	}
	if err := h.Service.MarkAllRead(userID); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to mark all notifications as read")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]any{"success": true})
}
