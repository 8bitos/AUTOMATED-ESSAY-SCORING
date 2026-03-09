package services

import (
	"encoding/json"
	"sync"
	"time"
)

type NotificationRealtimeMessage struct {
	Type   string   `json:"type"`
	Reason string   `json:"reason,omitempty"`
	Roles  []string `json:"roles,omitempty"`
	Users  []string `json:"users,omitempty"`
	At     string   `json:"at"`
}

type notificationSubscriber struct {
	userID string
	role   string
	ch     chan []byte
}

type NotificationRealtimeHub struct {
	mu          sync.RWMutex
	nextID      int
	subscribers map[int]notificationSubscriber
}

func NewNotificationRealtimeHub() *NotificationRealtimeHub {
	return &NotificationRealtimeHub{
		subscribers: make(map[int]notificationSubscriber),
	}
}

func (h *NotificationRealtimeHub) Subscribe(userID, role string) (chan []byte, func()) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.nextID++
	id := h.nextID
	ch := make(chan []byte, 8)
	h.subscribers[id] = notificationSubscriber{
		userID: userID,
		role:   role,
		ch:     ch,
	}

	return ch, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if sub, ok := h.subscribers[id]; ok {
			delete(h.subscribers, id)
			close(sub.ch)
		}
	}
}

func (h *NotificationRealtimeHub) Publish(reason string, roles []string, users []string) {
	msg, err := json.Marshal(NotificationRealtimeMessage{
		Type:   "invalidate",
		Reason: reason,
		Roles:  roles,
		Users:  users,
		At:     time.Now().UTC().Format(time.RFC3339Nano),
	})
	if err != nil {
		return
	}

	roleSet := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		if role == "" {
			continue
		}
		roleSet[role] = struct{}{}
	}

	userSet := make(map[string]struct{}, len(users))
	for _, userID := range users {
		if userID == "" {
			continue
		}
		userSet[userID] = struct{}{}
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, sub := range h.subscribers {
		if len(roleSet) > 0 {
			if _, ok := roleSet[sub.role]; !ok {
				if len(userSet) == 0 {
					continue
				}
			}
		}
		if len(userSet) > 0 {
			if _, ok := userSet[sub.userID]; !ok {
				if len(roleSet) == 0 {
					continue
				}
				if _, roleMatch := roleSet[sub.role]; !roleMatch {
					continue
				}
			}
		}
		select {
		case sub.ch <- msg:
		default:
		}
	}
}

var notificationRealtimeHub = NewNotificationRealtimeHub()

func NotificationHub() *NotificationRealtimeHub {
	return notificationRealtimeHub
}

func PublishNotificationInvalidation(reason string, roles []string, users []string) {
	notificationRealtimeHub.Publish(reason, roles, users)
}
