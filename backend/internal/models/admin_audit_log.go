package models

import (
	"encoding/json"
	"time"
)

type AdminAuditLogItem struct {
	ID         string          `json:"id"`
	ActorID    string          `json:"actor_id"`
	ActorName  string          `json:"actor_name"`
	Action     string          `json:"action"`
	TargetType string          `json:"target_type"`
	TargetID   *string         `json:"target_id,omitempty"`
	Metadata   json.RawMessage `json:"metadata,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
}

type AdminAuditLogListResponse struct {
	Items []AdminAuditLogItem `json:"items"`
	Total int64               `json:"total"`
	Page  int                 `json:"page"`
	Size  int                 `json:"size"`
}
