package models

import (
	"time" // Mengimpor package time untuk menangani data waktu.

	"github.com/google/uuid" // Mengimpor package uuid untuk generate ID unik.
)

// User merepresentasikan skema data untuk seorang pengguna dalam database.
// Struct ini akan dipetakan ke tabel 'users'.
type User struct {
	// ID adalah primary key unik untuk setiap user.
	// Menggunakan UUID untuk memastikan keunikan global.
	ID uuid.UUID `json:"id" gorm:"type:uuid;primary_key;"`

	// Name adalah nama lengkap dari pengguna.
	Name string `json:"name" gorm:"not null"`

	// Username adalah nama unik yang digunakan untuk login.
	Username string `json:"username" gorm:"unique;not null"`

	// Email adalah alamat email unik yang digunakan untuk login dan komunikasi.
	Email string `json:"email" gorm:"unique;not null"`

	// Password adalah hash dari password pengguna.
	// Seharusnya tidak pernah disimpan sebagai teks biasa.
	Password string `json:"password" gorm:"not null"`

	// Role menentukan hak akses pengguna (misalnya, 'student', 'teacher', 'superadmin').
	Role string `json:"role" gorm:"not null"`

	// CreatedAt adalah waktu ketika akun pengguna dibuat.
	CreatedAt time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`

	// UpdatedAt adalah waktu terakhir kali data pengguna diperbarui.
	UpdatedAt time.Time `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
}
