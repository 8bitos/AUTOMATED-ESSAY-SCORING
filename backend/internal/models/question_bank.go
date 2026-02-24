package models

import (
	"encoding/json"
	"time"
)

type QuestionBankEntry struct {
	ID               string          `json:"id"`
	CreatedBy        string          `json:"created_by"`
	ClassID          string          `json:"class_id"`
	ClassName        string          `json:"class_name,omitempty"`
	Subject          string          `json:"subject,omitempty"`
	SourceMaterialID *string         `json:"source_material_id,omitempty"`
	MaterialTitle    string          `json:"material_title,omitempty"`
	SourceQuestionID *string         `json:"source_question_id,omitempty"`
	TeksSoal         string          `json:"teks_soal"`
	LevelKognitif    *string         `json:"level_kognitif,omitempty"`
	Keywords         []string        `json:"keywords,omitempty"`
	IdealAnswer      *string         `json:"ideal_answer,omitempty"`
	Weight           *float64        `json:"weight,omitempty"`
	Rubrics          json.RawMessage `json:"rubrics,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
}

type CreateQuestionBankEntryRequest struct {
	ClassID       *string         `json:"class_id,omitempty"`
	Subject       string          `json:"subject,omitempty"`
	MaterialID    *string         `json:"material_id,omitempty"`
	QuestionID    *string         `json:"question_id,omitempty"`
	TeksSoal      string          `json:"teks_soal"`
	LevelKognitif *string         `json:"level_kognitif,omitempty"`
	Keywords      *[]string       `json:"keywords,omitempty"`
	IdealAnswer   *string         `json:"ideal_answer,omitempty"`
	Weight        *float64        `json:"weight,omitempty"`
	Rubrics       json.RawMessage `json:"rubrics,omitempty"`
}

type UpdateQuestionBankEntryRequest struct {
	ClassID       *string          `json:"class_id,omitempty"`
	Subject       *string          `json:"subject,omitempty"`
	MaterialID    *string          `json:"material_id,omitempty"`
	TeksSoal      *string          `json:"teks_soal,omitempty"`
	LevelKognitif *string          `json:"level_kognitif,omitempty"`
	Keywords      *[]string        `json:"keywords,omitempty"`
	IdealAnswer   *string          `json:"ideal_answer,omitempty"`
	Weight        *float64         `json:"weight,omitempty"`
	Rubrics       *json.RawMessage `json:"rubrics,omitempty"`
}
