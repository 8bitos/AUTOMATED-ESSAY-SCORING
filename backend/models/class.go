package models

import (
	"time" // Mengimpor package time untuk menangani data waktu.

	"github.com/google/uuid" // Mengimpor package uuid untuk generate ID unik.
)

// Class merepresentasikan skema data untuk sebuah kelas/kursus.
// Struct ini akan dipetakan ke tabel 'classes'.
type Class struct {
	// ID adalah primary key unik untuk setiap kelas.
	// Menggunakan UUID untuk memastikan keunikan global.
	ID uuid.UUID `json:"id" gorm:"type:uuid;primary_key;"`

	// Name adalah nama dari kelas (misalnya, "Matematika Tingkat Lanjut").
	Name string `json:"name" gorm:"not null"`

	// Description memberikan penjelasan singkat tentang kelas.
	Description string `json:"description"`

	// TeacherID adalah UUID dari pengguna yang berperan sebagai guru untuk kelas ini.
	// Ini adalah foreign key yang mereferensikan tabel 'users'.
	TeacherID uuid.UUID `json:"teacher_id" gorm:"type:uuid;not null"`

	// CreatedAt adalah waktu ketika kelas dibuat.
	CreatedAt time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`

	// UpdatedAt adalah waktu terakhir kali data kelas diperbarui.
	UpdatedAt time.Time `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
}
