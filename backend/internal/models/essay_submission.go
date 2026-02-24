package models

import (
	"time" // Mengimpor package time untuk timestamp.
)

// EssaySubmission merepresentasikan submission esai seorang siswa untuk sebuah pertanyaan esai.
// Struktur ini berkorespondensi dengan tabel `essay_submissions` di database.
type EssaySubmission struct {
	ID              string                  `json:"id"`                         // ID unik submission esai, biasanya UUID.
	QuestionID      string                  `json:"question_id"`                // ID pertanyaan esai yang dijawab (Foreign Key ke tabel essay_questions).
	StudentID       string                  `json:"student_id"`                 // ID siswa yang membuat submission (Foreign Key ke tabel users).
	TeksJawaban     string                  `json:"teks_jawaban"`               // Teks jawaban esai yang disubmit.
	SubmittedAt     time.Time               `json:"submitted_at"`               // Timestamp ketika esai disubmit.
	AIGradingStatus string                  `json:"ai_grading_status"`          // queued|processing|completed|failed
	AIGradingError  *string                 `json:"ai_grading_error,omitempty"` // Error terakhir proses AI (opsional).
	AIGradedAt      *time.Time              `json:"ai_graded_at,omitempty"`     // Waktu selesai dinilai AI (opsional).
	StudentName     string                  `json:"student_name"`               // Nama siswa yang melakukan submission (denormalized).
	StudentEmail    string                  `json:"student_email"`              // Email siswa yang melakukan submission (denormalized).
	SkorAI          *float64                `json:"skor_ai,omitempty"`          // Skor AI untuk submission ini (opsional).
	UmpanBalikAI    *string                 `json:"umpan_balik_ai,omitempty"`   // Umpan balik AI untuk submission ini (opsional).
	ReviewID        *string                 `json:"review_id,omitempty"`        // ID review guru yang terkait (opsional).
	RevisedScore    *float64                `json:"revised_score,omitempty"`    // Skor revisi dari guru (opsional).
	TeacherFeedback *string                 `json:"teacher_feedback,omitempty"` // Umpan balik dari guru (opsional).
	RubricScores    []GradeEssayAspectScore `json:"rubric_scores,omitempty"`    // Skor AI per aspek rubrik (opsional).
}

// CreateEssaySubmissionRequest mendefinisikan struktur data untuk permintaan
// pembuatan submission esai baru oleh siswa.
type CreateEssaySubmissionRequest struct {
	QuestionID  string `json:"question_id"`  // ID pertanyaan esai yang dijawab.
	TeksJawaban string `json:"teks_jawaban"` // Teks jawaban esai.
}

// UpdateEssaySubmissionRequest mendefinisikan field-field yang dapat diperbarui
// untuk sebuah submission esai. Semua field bersifat opsional (omitempty).
type UpdateEssaySubmissionRequest struct {
	TeksJawaban *string `json:"teks_jawaban,omitempty"` // Pointer ke string untuk teks jawaban (opsional).
}
