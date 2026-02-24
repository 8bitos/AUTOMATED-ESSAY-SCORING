package models

import (
	"time" // Mengimpor package time untuk menangani data waktu.

	"github.com/google/uuid" // Mengimpor package uuid untuk generate ID unik.
)

// Material merepresentasikan skema data untuk sebuah materi/bahan ajar dalam sebuah kelas.
// Struct ini akan dipetakan ke tabel 'materials'.
type Material struct {
	// ID adalah primary key unik untuk setiap materi.
	// Menggunakan UUID untuk memastikan keunikan global.
	ID uuid.UUID `json:"id" gorm:"type:uuid;primary_key;"`

	// ClassID adalah UUID dari kelas tempat materi ini berada.
	// Ini adalah foreign key yang mereferensikan tabel 'classes'.
	ClassID uuid.UUID `json:"class_id" gorm:"type:uuid;not null"`

	// Title adalah judul materi (misalnya, "Pengantar Algoritma").
	Title string `json:"title" gorm:"not null"`

	// Content adalah isi/deskripsi dari materi.
	Content string `json:"content" gorm:"type:text"` // Menggunakan type:text untuk konten yang lebih panjang.

	// FileURL adalah URL ke file terkait materi (misalnya, PDF, PPT, video).
	// Bisa kosong jika materi tidak memiliki file.
	FileURL string `json:"file_url"`

	// CreatedAt adalah waktu ketika materi dibuat.
	CreatedAt time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`

	// UpdatedAt adalah waktu terakhir kali data materi diperbarui.
	UpdatedAt time.Time `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
}
