package services

import (
	"api-backend/internal/models" // Mengimpor definisi model AIResult.
	"database/sql"                         // Mengimpor package database/sql untuk interaksi DB.
	"fmt"                                  // Mengimpor package fmt untuk format string dan error.
	"strings"                              // Mengimpor package strings untuk manipulasi string.
	"time"                                 // Mengimpor package time untuk timestamp.
)

// AIResultService menyediakan metode untuk manajemen hasil penilaian AI.
type AIResultService struct {
	db *sql.DB // Koneksi database yang digunakan oleh layanan ini.
}

// NewAIResultService membuat instance baru dari AIResultService.
// Ini adalah constructor untuk AIResultService.
func NewAIResultService(db *sql.DB) *AIResultService {
	return &AIResultService{db: db}
}

// CreateAIResult membuat hasil AI baru di database.
// Mengembalikan objek AIResult yang baru dibuat, atau error jika gagal.
func (s *AIResultService) CreateAIResult(submissionID string, skorAI float64, umpanBalikAI, logsRAG *string) (*models.AIResult, error) {
	newResult := &models.AIResult{
		SubmissionID: submissionID,
		SkorAI:       skorAI,
		UmpanBalikAI: umpanBalikAI, // Nilai pointer bisa nil.
		LogsRAG:      logsRAG,      // Nilai pointer bisa nil.
		GeneratedAt:  time.Now(),
	}

	// Query INSERT untuk menambahkan hasil AI baru.
	query := `
		INSERT INTO ai_results (submission_id, skor_ai, umpan_balik_ai, logs_rag, generated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`

	// Menjalankan query dan memindai ID yang dikembalikan ke newResult.ID.
	err := s.db.QueryRow(
		query,
		newResult.SubmissionID,
		newResult.SkorAI,
		newResult.UmpanBalikAI,
		newResult.LogsRAG,
		newResult.GeneratedAt,
	).Scan(&newResult.ID)

	if err != nil {
		return nil, fmt.Errorf("error inserting new AI result: %w", err)
	}

	return newResult, nil
}

// GetAIResultByID mengambil satu hasil AI berdasarkan ID-nya.
// Mengembalikan objek AIResult atau error jika tidak ditemukan.
func (s *AIResultService) GetAIResultByID(resultID string) (*models.AIResult, error) {
	query := `
		SELECT id, submission_id, skor_ai, umpan_balik_ai, logs_rag, generated_at
		FROM ai_results
		WHERE id = $1
	`

	var ar models.AIResult // Objek untuk menampung hasil query.
	// Menjalankan query dan memindai hasilnya.
	err := s.db.QueryRow(query, resultID).Scan(
		&ar.ID, &ar.SubmissionID, &ar.SkorAI, &ar.UmpanBalikAI, &ar.LogsRAG, &ar.GeneratedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("AI result not found") // Hasil AI tidak ditemukan.
		}
		return nil, fmt.Errorf("error querying AI result %s: %w", resultID, err) // Error query lainnya.
	}

	return &ar, nil
}

// GetAIResultBySubmissionID mengambil hasil AI untuk submission esai tertentu.
// Mengembalikan objek AIResult atau error jika tidak ditemukan.
func (s *AIResultService) GetAIResultBySubmissionID(submissionID string) (*models.AIResult, error) {
	query := `
		SELECT id, submission_id, skor_ai, umpan_balik_ai, logs_rag, generated_at
		FROM ai_results
		WHERE submission_id = $1
	`

	var ar models.AIResult
	// Menjalankan query dan memindai hasilnya.
	err := s.db.QueryRow(query, submissionID).Scan(
		&ar.ID, &ar.SubmissionID, &ar.SkorAI, &ar.UmpanBalikAI, &ar.LogsRAG, &ar.GeneratedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("AI result for submission %s not found", submissionID) // Hasil AI tidak ditemukan.
		}
		return nil, fmt.Errorf("error querying AI result for submission %s: %w", submissionID, err) // Error query lainnya.
	}

	return &ar, nil
}

// UpdateAIResult memperbarui hasil AI yang sudah ada.
// Menerima ID hasil AI dan permintaan update (UpdateAIResultRequest)
// Mengembalikan objek AIResult yang diperbarui, atau error jika gagal.
func (s *AIResultService) UpdateAIResult(resultID string, updateReq *models.UpdateAIResultRequest) (*models.AIResult, error) {
	updates := make(map[string]interface{}) // Map untuk menampung field yang akan diupdate.
	// Memeriksa field mana yang ada di updateReq dan menambahkannya ke map updates.
	if updateReq.SkorAI != nil {
		updates["skor_ai"] = *updateReq.SkorAI
	}
	if updateReq.UmpanBalikAI != nil {
		updates["umpan_balik_ai"] = *updateReq.UmpanBalikAI
	}
	if updateReq.LogsRAG != nil {
		updates["logs_rag"] = *updateReq.LogsRAG
	}

	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update") // Jika tidak ada field yang perlu diupdate.
	}

	setClauses := []string{} // Slice untuk menampung klausa SET query SQL.
	args := []interface{}{}  // Slice untuk menampung argumen query SQL.
	i := 1                   // Counter untuk placeholder query ($1, $2, dst.).
	for k, v := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, i)) // Menambahkan klausa SET.
		args = append(args, v)                                        // Menambahkan nilai argumen.
		i++
	}

	// Membangun query UPDATE secara dinamis.
	query := fmt.Sprintf("UPDATE ai_results SET %s WHERE id = $%d RETURNING id, submission_id, skor_ai, umpan_balik_ai, logs_rag, generated_at",
		strings.Join(setClauses, ", "), i) // Menggabungkan klausa SET.
	args = append(args, resultID) // Menambahkan ID hasil AI sebagai argumen terakhir.

	var ar models.AIResult
	// Menjalankan query UPDATE dan memindai hasilnya yang diperbarui.
	err := s.db.QueryRow(query, args...).Scan(
		&ar.ID, &ar.SubmissionID, &ar.SkorAI, &ar.UmpanBalikAI, &ar.LogsRAG, &ar.GeneratedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("AI result not found for update") // Hasil AI tidak ditemukan saat update.
		}
		return nil, fmt.Errorf("error updating AI result %s: %w", resultID, err) // Error update lainnya.
	}

	return &ar, nil
}

// DeleteAIResult menghapus hasil AI berdasarkan ID-nya.
// Mengembalikan error jika gagal menghapus atau hasil AI tidak ditemukan.
func (s *AIResultService) DeleteAIResult(resultID string) error {
	// Menjalankan query DELETE.
	result, err := s.db.Exec("DELETE FROM ai_results WHERE id = $1", resultID)
	if err != nil {
		return fmt.Errorf("error deleting AI result %s: %w", resultID, err)
	}

	// Memeriksa berapa banyak baris yang terpengaruh oleh query DELETE.
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error getting rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("AI result not found with ID %s", resultID) // Jika tidak ada baris yang terhapus.
	}

	return nil
}