package models

import "time"

type ClassTeachingModule struct {
	ID         string    `json:"id"`
	ClassID    string    `json:"class_id"`
	UploadedBy *string   `json:"uploaded_by,omitempty"`
	NamaModul  string    `json:"nama_modul"`
	FileURL    string    `json:"file_url"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type CreateClassTeachingModuleRequest struct {
	ClassID    string `json:"class_id"`
	UploadedBy string `json:"uploaded_by,omitempty"`
	NamaModul  string `json:"nama_modul"`
	FileURL    string `json:"file_url"`
}
