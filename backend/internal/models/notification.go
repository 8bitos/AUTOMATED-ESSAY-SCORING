package models

import (
	"encoding/json"
	"time"
)

type Notification struct {
	ID          string          `json:"id"`
	UserID      string          `json:"user_id"`
	Role        string          `json:"role"`
	ExternalKey string          `json:"external_key"`
	Category    string          `json:"category"`
	Title       string          `json:"title"`
	Message     string          `json:"message"`
	Href        *string         `json:"href,omitempty"`
	Payload     json.RawMessage `json:"payload,omitempty"`
	IsRead      bool            `json:"is_read"`
	ReadAt      *time.Time      `json:"read_at,omitempty"`
	IsActive    bool            `json:"is_active"`
	EventAt     time.Time       `json:"event_at"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type NotificationFeedResponse struct {
	Items       []Notification `json:"items"`
	UnreadCount int            `json:"unread_count"`
}

type MarkNotificationsReadRequest struct {
	IDs []string `json:"ids"`
}
