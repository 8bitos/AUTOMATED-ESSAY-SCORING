package models

import (
	"encoding/json" // Mengimpor package encoding/json untuk bekerja dengan JSON.
	"time"          // Mengimpor package time untuk timestamp.
)

// EssayQuestion merepresentasikan struktur tabel 'essay_questions' di database.
// Struktur ini mencerminkan skema setelah penambahan kolom-kolom baru.
type EssayQuestion struct {
	ID            string          `json:"id"`                     // ID unik pertanyaan esai, biasanya UUID.
	MaterialID    string          `json:"material_id"`            // ID materi tempat pertanyaan ini berada (Foreign Key ke tabel materials).
	TeksSoal      string          `json:"teks_soal"`              // Teks lengkap dari pertanyaan esai.
	Keywords      *string         `json:"keywords,omitempty"`     // Kata kunci relevan untuk penilaian (opsional, bisa NULL).
	IdealAnswer   *string         `json:"ideal_answer,omitempty"` // Jawaban ideal atau contoh (opsional, bisa NULL).
	Weight        *float64        `json:"weight,omitempty"`       // Bobot soal untuk kalkulasi nilai akhir (opsional).
	RoundScoreTo5 bool            `json:"round_score_to_5"`       // Jika true, skor AI dibulatkan ke kelipatan 5 (post-processing).
	Rubrics       json.RawMessage `json:"rubrics,omitempty"`      // Rubrik penilaian dalam format JSON mentah.
	CreatedAt     time.Time       `json:"created_at"`             // Timestamp ketika pertanyaan dibuat.
	UpdatedAt     time.Time       `json:"updated_at"`             // Timestamp terakhir kali pertanyaan diperbarui.

	// Fields for student's submission data (denormalized for student view)
	SubmissionID     *string                 `json:"submission_id,omitempty"`
	StudentEssayText *string                 `json:"student_essay_text,omitempty"`
	SkorAI           *float64                `json:"skor_ai,omitempty"`
	UmpanBalikAI     *string                 `json:"umpan_balik_ai,omitempty"`
	RevisedScore     *float64                `json:"revised_score,omitempty"`
	TeacherFeedback  *string                 `json:"teacher_feedback,omitempty"`
	RubricScores     []GradeEssayAspectScore `json:"rubric_scores,omitempty"`
}

// QuestionFromRequest digunakan untuk mendekode satu pertanyaan dari array yang
// dikirim oleh frontend dalam permintaan pembuatan materi.
type QuestionFromRequest struct {
	Text        string          `json:"text"`        // Teks pertanyaan.
	Keywords    string          `json:"keywords"`    // Kata kunci.
	IdealAnswer string          `json:"idealAnswer"` // Jawaban ideal.
	Rubrics     json.RawMessage `json:"rubrics"`     // Rubrik dalam format JSON.
}

// CreateMaterialAndQuestionsRequest digunakan untuk mendekode seluruh permintaan
// dari formulir guru saat membuat materi baru beserta pertanyaan-pertanyaannya.
type CreateMaterialAndQuestionsRequest struct {
	MaterialName string                `json:"materialName"` // Nama materi yang akan dibuat.
	ClassID      string                `json:"classId"`      // ID kelas tempat materi ini akan ditambahkan.
	Questions    []QuestionFromRequest `json:"questions"`    // Daftar pertanyaan esai yang terkait dengan materi ini.
}

// UpdateEssayQuestionRequest mendefinisikan field-field yang dapat diperbarui
// untuk sebuah pertanyaan esai. Semua field bersifat opsional (omitempty)
// karena tidak semua field mungkin diperbarui dalam satu waktu.
type UpdateEssayQuestionRequest struct {
	TeksSoal      *string          `json:"teks_soal,omitempty"`        // Pointer ke string untuk teks soal (opsional).
	Keywords      *[]string        `json:"keywords,omitempty"`         // Pointer ke slice string untuk kata kunci (opsional).
	IdealAnswer   *string          `json:"ideal_answer,omitempty"`     // Pointer ke string untuk jawaban ideal (opsional).
	Weight        *float64         `json:"weight,omitempty"`           // Pointer ke float64 untuk bobot (opsional).
	RoundScoreTo5 *bool            `json:"round_score_to_5,omitempty"` // Pointer ke bool untuk pembulatan skor AI (opsional).
	Rubrics       *json.RawMessage `json:"rubrics,omitempty"`          // Pointer ke json.RawMessage untuk rubrik (opsional).
}

// CreateEssayQuestionRequest mendefinisikan field-field yang dibutuhkan
// untuk membuat pertanyaan esai baru.
type CreateEssayQuestionRequest struct {
	MaterialID    string          `json:"material_id"`            // ID materi tempat pertanyaan ini berada.
	TeksSoal      string          `json:"teks_soal"`              // Teks lengkap dari pertanyaan esai.
	Keywords      *[]string       `json:"keywords,omitempty"`     // Kata kunci relevan untuk penilaian (opsional).
	IdealAnswer   *string         `json:"ideal_answer,omitempty"` // Jawaban ideal atau contoh (opsional).
	Weight        *float64        `json:"weight,omitempty"`       // Bobot soal (opsional).
	RoundScoreTo5 bool            `json:"round_score_to_5"`       // Aktifkan pembulatan skor AI ke kelipatan 5.
	Rubrics       json.RawMessage `json:"rubrics,omitempty"`      // Rubrik penilaian dalam format JSON mentah.
}

// AutoGenerateEssayQuestionRequest adalah payload untuk generate soal otomatis dari materi.
type AutoGenerateEssayQuestionRequest struct {
	RubricType          string  `json:"rubric_type,omitempty"`           // "analitik" atau "holistik"
	ReferenceMaterialID *string `json:"reference_material_id,omitempty"` // Acuan materi untuk RAG. Nil kosong => gabungan materi satu kelas.
}

// GeneratedDescriptor merepresentasikan satu baris skor rubrik dari AI.
type GeneratedDescriptor struct {
	Score       int    `json:"score"`
	Description string `json:"description"`
}

// GeneratedRubricAspect merepresentasikan satu aspek rubrik hasil generate AI.
type GeneratedRubricAspect struct {
	NamaAspek   string                `json:"nama_aspek"`
	Descriptors []GeneratedDescriptor `json:"descriptors"`
}

// AutoGeneratedEssayQuestion adalah draft soal hasil generate AI.
type AutoGeneratedEssayQuestion struct {
	TeksSoal    string                  `json:"teks_soal"`
	Keywords    []string                `json:"keywords"`
	IdealAnswer string                  `json:"ideal_answer"`
	Weight      *float64                `json:"weight,omitempty"`
	RubricType  string                  `json:"rubric_type"`
	Rubrics     []GeneratedRubricAspect `json:"rubrics"`
}
