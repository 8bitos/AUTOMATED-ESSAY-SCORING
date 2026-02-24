package models

import (
	"time" // Mengimpor package time untuk timestamp.
)

// Material merepresentasikan sebuah materi pembelajaran dalam sistem.
// Struktur ini berkorespondensi dengan tabel `materials` di database.
type Material struct {
	ID                  string          `json:"id"`                             // ID unik materi, biasanya UUID.
	ClassID             string          `json:"class_id"`                       // ID kelas tempat materi ini berada (Foreign Key ke tabel classes).
	UploaderID          string          `json:"uploader_id"`                    // ID pengguna yang mengunggah materi ini (Foreign Key ke tabel users).
	Judul               string          `json:"judul"`                          // Judul materi pembelajaran.
	MaterialType        string          `json:"material_type"`                  // Tipe konten: materi/soal/tugas.
	IsiMateri           *string         `json:"isi_materi,omitempty"`           // Isi atau deskripsi materi (opsional, bisa NULL).
	FileUrl             *string         `json:"file_url,omitempty"`             // URL ke file terkait materi (opsional).
	CreatedAt           time.Time       `json:"created_at"`                     // Timestamp ketika materi dibuat.
	UpdatedAt           time.Time       `json:"updated_at"`                     // Timestamp terakhir kali materi diperbarui.
	CapaianPembelajaran *string         `json:"capaian_pembelajaran,omitempty"` // Deskripsi capaian pembelajaran dari materi ini (opsional).
	KataKunci           []string        `json:"kata_kunci,omitempty"`           // Daftar kata kunci terkait materi, disimpan sebagai array string.
	EssayQuestions      []EssayQuestion `json:"essay_questions,omitempty"`      // Daftar pertanyaan esai yang terkait dengan materi ini (opsional untuk output JSON).
}

// CreateMaterialRequest mendefinisikan struktur data untuk permintaan pembuatan materi baru.
// Ini adalah data yang diharapkan diterima dari client saat membuat materi.
type CreateMaterialRequest struct {
	ClassID             string   `json:"class_id"`                       // ID kelas tempat materi akan ditambahkan.
	Judul               string   `json:"judul"`                          // Judul materi.
	MaterialType        string   `json:"material_type,omitempty"`        // Tipe konten: materi/soal/tugas.
	IsiMateri           *string  `json:"isi_materi,omitempty"`           // Isi materi (opsional).
	FileUrl             *string  `json:"file_url,omitempty"`             // URL file (opsional).
	CapaianPembelajaran *string  `json:"capaian_pembelajaran,omitempty"` // Capaian pembelajaran (opsional).
	KataKunci           []string `json:"kata_kunci,omitempty"`           // Daftar kata kunci (opsional).
}

// UpdateMaterialRequest mendefinisikan struktur data untuk permintaan pembaruan materi yang sudah ada.
// Semua field bersifat opsional (omitempty) karena tidak semua field mungkin diperbarui dalam satu waktu.
type UpdateMaterialRequest struct {
	Judul               *string  `json:"judul,omitempty"`                // Pointer ke string untuk judul (opsional).
	MaterialType        *string  `json:"material_type,omitempty"`        // Pointer tipe konten: materi/soal/tugas.
	IsiMateri           *string  `json:"isi_materi,omitempty"`           // Pointer ke string untuk isi materi (opsional).
	FileUrl             *string  `json:"file_url,omitempty"`             // Pointer ke string untuk URL file (opsional).
	CapaianPembelajaran *string  `json:"capaian_pembelajaran,omitempty"` // Pointer ke string untuk capaian pembelajaran (opsional).
	KataKunci           []string `json:"kata_kunci,omitempty"`           // Slice string untuk kata kunci (opsional).
}
