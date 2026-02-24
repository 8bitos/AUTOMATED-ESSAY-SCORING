package models

import (
	"time" // Mengimpor package time untuk timestamp.
)

// AIResult merepresentasikan hasil penilaian otomatis oleh AI untuk sebuah submission esai.
// Struktur ini berkorespondensi dengan tabel `ai_results` di database.
type AIResult struct {
	ID             string    `json:"id"`                      // ID unik untuk setiap hasil AI, biasanya UUID.
	SubmissionID   string    `json:"submission_id"`           // ID submission esai yang dinilai oleh AI. Ini adalah Foreign Key.
	SkorAI         float64   `json:"skor_ai"`                 // Skor numerik yang diberikan oleh AI.
	UmpanBalikAI   *string   `json:"umpan_balik_ai,omitempty"`// Umpan balik tekstual dari AI (opsional, bisa NULL di DB).
	LogsRAG        *string   `json:"logs_rag,omitempty"`      // Log dari proses Retrieval Augmented Generation (RAG) jika digunakan (opsional).
	RawResponse    string    `json:"raw_response,omitempty"`  // Respons mentah dari model AI (opsional).
	GeneratedAt    time.Time `json:"generated_at"`            // Timestamp ketika hasil AI ini dibuat.
}

// CreateAIResultRequest mendefinisikan struktur data untuk permintaan pembuatan hasil AI baru.
// Biasanya, hasil AI dihasilkan secara internal oleh sistem, sehingga ini mungkin digunakan oleh layanan yang berwenang.
type CreateAIResultRequest struct {
	SubmissionID   string  `json:"submission_id"`           // ID submission esai yang terkait.
	SkorAI         float64 `json:"skor_ai"`                 // Skor AI yang akan disimpan.
	UmpanBalikAI   *string `json:"umpan_balik_ai,omitempty"`// Umpan balik AI (opsional).
	LogsRAG        *string `json:"logs_rag,omitempty"`      // Log RAG (opsional).
}

// UpdateAIResultRequest mendefinisikan struktur data untuk permintaan pembaruan hasil AI yang sudah ada.
// Semua field bersifat opsional karena mungkin tidak semua field diperbarui.
type UpdateAIResultRequest struct {
	SkorAI         *float64 `json:"skor_ai,omitempty"`        // Pointer ke float64 agar bisa nil (opsional).
	UmpanBalikAI   *string  `json:"umpan_balik_ai,omitempty"` // Pointer ke string agar bisa nil (opsional).
	LogsRAG        *string  `json:"logs_rag,omitempty"`       // Pointer ke string agar bisa nil (opsional).
}