package models

import "time"

type Section struct {
	ID           string    `json:"id"`
	ClassID      string    `json:"class_id"`
	Title        string    `json:"title"`
	Description  *string   `json:"description,omitempty"`
	DisplayOrder int       `json:"display_order"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type SectionContent struct {
	ID               string    `json:"id"`
	SectionID        string    `json:"section_id"`
	ContentType      string    `json:"content_type"` // materi | soal | tugas | penilaian
	Title            string    `json:"title"`
	Body             *string   `json:"body,omitempty"`
	LinkedMaterialID *string   `json:"linked_material_id,omitempty"`
	DisplayOrder     int       `json:"display_order"`
	Status           string    `json:"status"` // draft | published
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type SectionWithContents struct {
	Section
	Contents []SectionContent `json:"contents"`
}

type CreateSectionRequest struct {
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
}

type CreateSectionContentRequest struct {
	ContentType string  `json:"content_type"`
	Title       string  `json:"title"`
	Body        *string `json:"body,omitempty"`
}
