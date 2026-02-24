package services

import (
	"api-backend/internal/models" // Mengimpor definisi model Rubric.
	"database/sql"                         // Mengimpor package database/sql untuk interaksi dengan database.
	"fmt"                                  // Mengimpor package fmt untuk format string dan error.
	"strings"                              // Mengimpor package strings untuk manipulasi string (membangun query update).
)

// RubricService menyediakan metode untuk manajemen rubrik penilaian.
type RubricService struct {
	db *sql.DB // Koneksi database yang digunakan oleh layanan ini.
}

// NewRubricService membuat instance baru dari RubricService.
// Ini adalah constructor untuk RubricService.
func NewRubricService(db *sql.DB) *RubricService {
	return &RubricService{db: db}
}

// CreateRubric membuat rubrik baru untuk pertanyaan esai tertentu di database.
// Catatan: Model `models.Rubric` memiliki field `MaxScore` dan `Descriptors`
// yang tidak digunakan dalam fungsi `CreateRubric` ini. Ini mengindikasikan
// bahwa service ini mungkin belum sepenuhnya diperbarui untuk mendukung field tersebut.
func (s *RubricService) CreateRubric(questionID, namaAspek string, deskripsi *string, bobot float64) (*models.Rubric, error) {
	// Membuat objek Rubric baru dari parameter.
	newRubric := &models.Rubric{
		QuestionID: questionID,
		NamaAspek:  namaAspek,
		Deskripsi:  deskripsi,  // Nilai pointer bisa nil.
		Bobot:      bobot,
		// MaxScore dan Descriptors tidak diatur di sini.
	}

	// Query INSERT untuk menambahkan rubrik baru.
	// Field 'soal_id' di DB diasumsikan berkorespondensi dengan QuestionID.
	query := `
		INSERT INTO rubrics (soal_id, nama_aspek, deskripsi, bobot)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`

	// Menjalankan query dan memindai ID yang dikembalikan ke newRubric.ID.
	err := s.db.QueryRow(
		query,
		newRubric.QuestionID,
		newRubric.NamaAspek,
		newRubric.Deskripsi,
		newRubric.Bobot,
	).Scan(&newRubric.ID)

	if err != nil {
		return nil, fmt.Errorf("error inserting new rubric: %w", err)
	}

	return newRubric, nil
}

// GetRubricByID mengambil satu rubrik berdasarkan ID-nya.
func (s *RubricService) GetRubricByID(rubricID string) (*models.Rubric, error) {
	query := `
		SELECT id, soal_id, nama_aspek, deskripsi, bobot
		FROM rubrics
		WHERE id = $1
	`

	var r models.Rubric // Objek untuk menampung hasil query.
	// Menjalankan query dan memindai hasilnya.
	err := s.db.QueryRow(query, rubricID).Scan(
		&r.ID, &r.QuestionID, &r.NamaAspek, &r.Deskripsi, &r.Bobot,
		// Field MaxScore dan Descriptors tidak diambil di sini.
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("rubric not found")
		}
		return nil, fmt.Errorf("error querying rubric %s: %w", rubricID, err)
	}

	return &r, nil
}

// GetRubricsByQuestionID mengambil semua rubrik untuk pertanyaan esai tertentu.
func (s *RubricService) GetRubricsByQuestionID(questionID string) ([]models.Rubric, error) {
	query := `
		SELECT id, soal_id, nama_aspek, deskripsi, bobot
		FROM rubrics
		WHERE soal_id = $1
		ORDER BY nama_aspek
	`

	rows, err := s.db.Query(query, questionID)
	if err != nil {
		return nil, fmt.Errorf("error querying rubrics for question %s: %w", questionID, err)
	}
	defer rows.Close()

	var rubrics []models.Rubric
	for rows.Next() {
		var r models.Rubric
		if err := rows.Scan(&r.ID, &r.QuestionID, &r.NamaAspek, &r.Deskripsi, &r.Bobot); err != nil {
			return nil, fmt.Errorf("error scanning rubric row: %w", err)
		}
		// Field MaxScore dan Descriptors tidak diambil di sini.
		rubrics = append(rubrics, r)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}

	if rubrics == nil {
		rubrics = []models.Rubric{}
	}

	return rubrics, nil
}

// UpdateRubric memperbarui rubrik yang sudah ada.
// Catatan: Sama seperti CreateRubric, field `MaxScore` dan `Descriptors` dari model `models.Rubric`
// tidak ditangani dalam fungsi `UpdateRubric` ini.
func (s *RubricService) UpdateRubric(rubricID string, updateReq *models.UpdateRubricRequest) (*models.Rubric, error) {
	updates := make(map[string]interface{})
	if updateReq.NamaAspek != nil {
		updates["nama_aspek"] = *updateReq.NamaAspek
	}
	if updateReq.Deskripsi != nil {
		updates["deskripsi"] = *updateReq.Deskripsi
	}
	if updateReq.Bobot != nil {
		updates["bobot"] = *updateReq.Bobot
	}
	// Field MaxScore dan Descriptors tidak ditangani di sini.

	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for k, v := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, i))
		args = append(args, v)
		i++
	}

	query := fmt.Sprintf("UPDATE rubrics SET %s WHERE id = $%d RETURNING id, soal_id, nama_aspek, deskripsi, bobot",
		strings.Join(setClauses, ", "), i)
	args = append(args, rubricID)

	var r models.Rubric
	err := s.db.QueryRow(query, args...).Scan(
		&r.ID, &r.QuestionID, &r.NamaAspek, &r.Deskripsi, &r.Bobot,
		// Field MaxScore dan Descriptors tidak diambil di sini.
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("rubric not found for update")
		}
		return nil, fmt.Errorf("error updating rubric %s: %w", rubricID, err)
	}

	return &r, nil
}

// DeleteRubric menghapus rubrik berdasarkan ID-nya.
func (s *RubricService) DeleteRubric(rubricID string) error {
	result, err := s.db.Exec("DELETE FROM rubrics WHERE id = $1", rubricID)
	if err != nil {
		return fmt.Errorf("error deleting rubric %s: %w", rubricID, err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error getting rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("rubric not found with ID %s", rubricID)
	}

	return nil
}