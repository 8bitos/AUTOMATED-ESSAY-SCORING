package services

import (
	"api-backend/internal/models" // Mengimpor definisi model yang diperlukan (EssayQuestion).
	"context"                     // Mengimpor package context untuk mengelola batas waktu dan pembatalan operasi DB.
	"crypto/rand"                 // Mengimpor package crypto/rand untuk UUID generation
	"database/sql"                // Mengimpor package database/sql untuk interaksi dengan database.
	"encoding/json"               // Mengimpor package encoding/json untuk bekerja dengan JSON.
	"fmt"                         // Mengimpor package fmt untuk format string dan error.
	"strings"                     // Mengimpor package strings untuk manipulasi string (membangun query update).
	"time"                        // Mengimpor package time untuk timestamp.

	"github.com/lib/pq" // Mengimpor driver PostgreSQL khusus untuk fitur array (pq.Array).
)

// EssayQuestionService menyediakan metode untuk manajemen pertanyaan esai.
type EssayQuestionService struct {
	db *sql.DB // Koneksi database yang digunakan oleh layanan ini.
}

// NewEssayQuestionService membuat instance baru dari EssayQuestionService.
// Ini adalah constructor untuk EssayQuestionService.
func NewEssayQuestionService(db *sql.DB) *EssayQuestionService {
	return &EssayQuestionService{db: db}
}

// CreateEssayQuestion membuat pertanyaan esai baru di database.
func (s *EssayQuestionService) CreateEssayQuestion(req *models.CreateEssayQuestionRequest) (*models.EssayQuestion, error) {
	newID := generateUUID() // Fungsi generateUUID harus tersedia atau dibuat.
	now := time.Now()

	// Menyiapkan keywords untuk disimpan ke database.
	var keywordsArray interface{} = nil
	if req.Keywords != nil && len(*req.Keywords) > 0 {
		keywordsArray = pq.Array(*req.Keywords)
	}

	// Ensure rubrics is a valid JSON array string, even if empty.
	// If req.Rubrics is an empty json.RawMessage (which happens if the frontend sends null or []),
	// it will be {} when decoded. We want to store "[]" in the DB.
	var rubricsToStore json.RawMessage
	if len(req.Rubrics) == 0 || string(req.Rubrics) == "null" {
		rubricsToStore = []byte("[]")
	} else {
		rubricsToStore = req.Rubrics
	}

	query := `
		INSERT INTO essay_questions (id, material_id, teks_soal, keywords, ideal_answer, weight, rubrics, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, material_id, teks_soal, keywords, ideal_answer, weight, rubrics, created_at, updated_at
	`
	var createdQuestion models.EssayQuestion
	var scannedKeywords pq.StringArray
	err := s.db.QueryRowContext(
		context.Background(),
		query,
		newID,
		req.MaterialID,
		req.TeksSoal,
		keywordsArray,
		req.IdealAnswer,
		req.Weight,
		rubricsToStore, // Use rubricsToStore here
		now,
		now,
	).Scan(
		&createdQuestion.ID,
		&createdQuestion.MaterialID,
		&createdQuestion.TeksSoal,
		&scannedKeywords,
		&createdQuestion.IdealAnswer,
		&createdQuestion.Weight,
		&createdQuestion.Rubrics, // Use createdQuestion.Rubrics (plural)
		&createdQuestion.CreatedAt,
		&createdQuestion.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("error inserting new essay question: %w", err)
	}

	if len(scannedKeywords) > 0 {
		joined := strings.Join(scannedKeywords, ", ")
		createdQuestion.Keywords = &joined
	}

	return &createdQuestion, nil
}

// GetEssayQuestionsByMaterialID mengambil semua pertanyaan esai yang terkait dengan materi tertentu.
func (s *EssayQuestionService) GetEssayQuestionsByMaterialID(materialID string) ([]models.EssayQuestion, error) {
	query := `
		SELECT id, material_id, teks_soal, keywords, ideal_answer, weight, rubrics, created_at, updated_at
		FROM essay_questions
		WHERE material_id = $1
		ORDER BY created_at ASC
	`
	rows, err := s.db.QueryContext(context.Background(), query, materialID)
	if err != nil {
		return nil, fmt.Errorf("error querying essay questions for material %s: %w", materialID, err)
	}
	defer rows.Close() // Pastikan baris ditutup setelah selesai.

	var questions []models.EssayQuestion
	for rows.Next() {
		var q models.EssayQuestion
		var keywords pq.StringArray
		if err := rows.Scan(&q.ID, &q.MaterialID, &q.TeksSoal, &keywords, &q.IdealAnswer, &q.Weight, &q.Rubrics, &q.CreatedAt, &q.UpdatedAt); err != nil {
			return nil, fmt.Errorf("error scanning essay question row: %w", err)
		}
		if len(keywords) > 0 {
			joined := strings.Join(keywords, ", ")
			q.Keywords = &joined
		}
		questions = append(questions, q)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}
	if questions == nil {
		questions = []models.EssayQuestion{}
	}
	return questions, nil
}

// GetEssayQuestionsByMaterialIDForStudent retrieves all essay questions for a material,
// including the student's submission data if it exists.
func (s *EssayQuestionService) GetEssayQuestionsByMaterialIDForStudent(materialID, studentID string) ([]models.EssayQuestion, error) {
	query := `
		SELECT 
			eq.id, eq.material_id, eq.teks_soal, eq.keywords, eq.ideal_answer, eq.weight, eq.rubrics, eq.created_at, eq.updated_at,
			es.id as submission_id, es.teks_jawaban as student_essay_text,
			ar.skor_ai, ar.umpan_balik_ai,
			tr.revised_score, tr.teacher_feedback,
			ar.logs_rag
		FROM essay_questions eq
		LEFT JOIN essay_submissions es ON eq.id = es.soal_id AND es.siswa_id = $2
		LEFT JOIN ai_results ar ON es.id = ar.submission_id
		LEFT JOIN teacher_reviews tr ON es.id = tr.submission_id
		WHERE eq.material_id = $1
		ORDER BY eq.created_at ASC
	`
	rows, err := s.db.QueryContext(context.Background(), query, materialID, studentID)
	if err != nil {
		return nil, fmt.Errorf("error querying essay questions for student %s in material %s: %w", studentID, materialID, err)
	}
	defer rows.Close()

	var questions []models.EssayQuestion
	for rows.Next() {
		var q models.EssayQuestion
		var keywords pq.StringArray
		var logsRAG sql.NullString

		if err := rows.Scan(
			&q.ID, &q.MaterialID, &q.TeksSoal, &keywords, &q.IdealAnswer, &q.Weight, &q.Rubrics, &q.CreatedAt, &q.UpdatedAt,
			&q.SubmissionID, &q.StudentEssayText, &q.SkorAI, &q.UmpanBalikAI, &q.RevisedScore, &q.TeacherFeedback, &logsRAG,
		); err != nil {
			return nil, fmt.Errorf("error scanning essay question row for student: %w", err)
		}
		if len(keywords) > 0 {
			joined := strings.Join(keywords, ", ")
			q.Keywords = &joined
		}
		if logsRAG.Valid && strings.TrimSpace(logsRAG.String) != "" {
			var parsedScores []models.GradeEssayAspectScore
			if unmarshalErr := json.Unmarshal([]byte(logsRAG.String), &parsedScores); unmarshalErr == nil {
				q.RubricScores = parsedScores
			}
		}
		questions = append(questions, q)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration for student questions: %w", err)
	}
	if questions == nil {
		questions = []models.EssayQuestion{}
	}
	return questions, nil
}

// UpdateEssayQuestion memperbarui field-field dari pertanyaan esai secara dinamis.
// Menerima ID pertanyaan dan objek UpdateEssayQuestionRequest.
func (s *EssayQuestionService) UpdateEssayQuestion(questionID string, req *models.UpdateEssayQuestionRequest) (*models.EssayQuestion, error) {
	updates := []string{}   // Slice untuk menampung klausa SET.
	args := []interface{}{} // Slice untuk menampung argumen query.
	argId := 1              // Counter untuk placeholder ($1, $2, dst.).

	// Membangun klausa SET dan argumen berdasarkan field yang tidak nil di request.
	if req.TeksSoal != nil {
		updates = append(updates, fmt.Sprintf("teks_soal = $%d", argId))
		args = append(args, *req.TeksSoal)
		argId++
	}
	if req.IdealAnswer != nil {
		updates = append(updates, fmt.Sprintf("ideal_answer = $%d", argId))
		args = append(args, *req.IdealAnswer)
		argId++
	}
	if req.Weight != nil {
		updates = append(updates, fmt.Sprintf("weight = $%d", argId))
		args = append(args, *req.Weight)
		argId++
	}
	if req.Keywords != nil {
		updates = append(updates, fmt.Sprintf("keywords = $%d", argId))
		// Menggunakan pq.Array untuk menyimpan slice string sebagai array di PostgreSQL.
		args = append(args, pq.Array(*req.Keywords))
		argId++
	}
	if req.Rubrics != nil {
		updates = append(updates, fmt.Sprintf("rubrics = $%d", argId))
		args = append(args, *req.Rubrics)
		argId++
	}

	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update") // Jika tidak ada field yang perlu diupdate.
	}

	// Menambahkan updated_at secara otomatis.
	updates = append(updates, fmt.Sprintf("updated_at = $%d", argId))
	args = append(args, time.Now())
	argId++

	args = append(args, questionID) // Menambahkan ID pertanyaan sebagai argumen terakhir.
	// Membangun query UPDATE lengkap.
	query := fmt.Sprintf("UPDATE essay_questions SET %s WHERE id = $%d", strings.Join(updates, ", "), argId)

	_, err := s.db.ExecContext(context.Background(), query, args...)
	if err != nil {
		return nil, fmt.Errorf("error updating essay question: %w", err)
	}

	// Mengambil dan mengembalikan pertanyaan yang sudah diperbarui.
	return s.GetEssayQuestionByID(questionID) // Asumsi GetEssayQuestionByID sudah ada dan berfungsi.
}

// GetEssayQuestionByID mengambil satu pertanyaan esai berdasarkan ID-nya.
func (s *EssayQuestionService) GetEssayQuestionByID(questionID string) (*models.EssayQuestion, error) {
	query := `
		SELECT id, material_id, teks_soal, keywords, ideal_answer, weight, rubrics, created_at, updated_at
		FROM essay_questions
		WHERE id = $1
	`
	var q models.EssayQuestion
	var keywords pq.StringArray
	err := s.db.QueryRowContext(context.Background(), query, questionID).Scan(
		&q.ID, &q.MaterialID, &q.TeksSoal, &keywords, &q.IdealAnswer, &q.Weight, &q.Rubrics, &q.CreatedAt, &q.UpdatedAt,
	)
	if len(keywords) > 0 {
		joined := strings.Join(keywords, ", ")
		q.Keywords = &joined
	}
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("essay question not found")
		}
		return nil, fmt.Errorf("error querying essay question %s: %w", questionID, err)
	}
	return &q, nil
}

// DeleteEssayQuestion menghapus pertanyaan esai berdasarkan ID-nya.
func (s *EssayQuestionService) DeleteEssayQuestion(questionID string) error {
	result, err := s.db.ExecContext(context.Background(), "DELETE FROM essay_questions WHERE id = $1", questionID)
	if err != nil {
		return fmt.Errorf("error deleting essay question %s: %w", questionID, err)
	}
	rowsAffected, _ := result.RowsAffected() // Mengabaikan error dari RowsAffected().
	if rowsAffected == 0 {
		return fmt.Errorf("essay question not found with ID %s", questionID) // Jika tidak ada baris yang terpengaruh.
	}
	return nil
}

// generateUUID menghasilkan UUID baru.
func generateUUID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		panic(err) // Atau tangani error dengan cara yang lebih elegan.
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
