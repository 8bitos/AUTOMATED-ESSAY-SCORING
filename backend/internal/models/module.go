package models

import (
	"time" // Mengimpor package time untuk timestamp.
)

// Module merepresentasikan sebuah file modul pembelajaran dalam suatu materi.
// Struktur ini berkorespondensi dengan tabel `modules` di database.
type Module struct {
	ID         string    `json:"id"`           // ID unik modul, biasanya UUID.
	MaterialID string    `json:"material_id"`  // ID materi tempat modul ini berada (Foreign Key ke tabel materials).
	NamaModul  string    `json:"nama_modul"`   // Nama dari modul pembelajaran.
	FileUrl    string    `json:"file_url"`     // URL ke file modul (misalnya, PDF, presentasi).
	CreatedAt  time.Time `json:"created_at"`   // Timestamp ketika modul dibuat.
}

// CreateModuleRequest mendefinisikan struktur data untuk permintaan pembuatan modul baru.
// Ini adalah data yang diharapkan diterima dari client saat membuat modul.
type CreateModuleRequest struct {
	MaterialID string `json:"material_id"`  // ID materi terkait.
	NamaModul  string `json:"nama_modul"`   // Nama modul yang akan dibuat.
	FileUrl    string `json:"file_url"`     // URL ke file modul.
}