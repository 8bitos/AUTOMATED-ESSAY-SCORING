package models

import (
	"encoding/json"
	"time"
)

type RubricTemplate struct {
	ID         string          `json:"id"`
	CreatedBy  string          `json:"created_by"`
	Title      string          `json:"title"`
	RubricType string          `json:"rubric_type"`
	Rubrics    json.RawMessage `json:"rubrics"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

type CreateRubricTemplateRequest struct {
	Title      string          `json:"title"`
	RubricType string          `json:"rubric_type"`
	Rubrics    json.RawMessage `json:"rubrics"`
}

type UpdateRubricTemplateRequest struct {
	Title      *string          `json:"title,omitempty"`
	RubricType *string          `json:"rubric_type,omitempty"`
	Rubrics    *json.RawMessage `json:"rubrics,omitempty"`
}
