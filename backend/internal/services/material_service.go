package services

import (
	"api-backend/internal/models" // Mengimpor definisi model yang diperlukan (Material, CreateMaterialRequest, dll.).
	"context"                     // Mengimpor package context untuk mengelola batas waktu dan pembatalan operasi DB.
	"database/sql"                // Mengimpor package database/sql untuk interaksi dengan database.
	"encoding/json"
	"fmt"     // Mengimpor package fmt untuk format string dan error.
	"strings" // Mengimpor package strings untuk manipulasi string (membangun query update, split keywords).
	"time"    // Mengimpor package time untuk timestamp.

	"github.com/google/uuid"
	"github.com/lib/pq" // Mengimpor driver PostgreSQL khusus untuk fitur array (pq.Array).
)

const materialTypeKeywordPrefix = "__type:"

func normalizeMaterialType(value string) string {
	v := strings.ToLower(strings.TrimSpace(value))
	switch v {
	case "soal":
		return "soal"
	case "tugas":
		return "tugas"
	default:
		return "materi"
	}
}

func extractMaterialTypeAndKeywords(keywords []string) (string, []string) {
	materialType := "materi"
	clean := make([]string, 0, len(keywords))
	for _, kw := range keywords {
		token := strings.TrimSpace(kw)
		if token == "" {
			continue
		}
		if strings.HasPrefix(strings.ToLower(token), materialTypeKeywordPrefix) {
			materialType = normalizeMaterialType(strings.TrimPrefix(strings.ToLower(token), materialTypeKeywordPrefix))
			continue
		}
		clean = append(clean, token)
	}
	return materialType, clean
}

func applyMaterialTypeToKeywords(keywords []string, materialType string) []string {
	mt := normalizeMaterialType(materialType)
	_, clean := extractMaterialTypeAndKeywords(keywords)
	return append(clean, fmt.Sprintf("%s%s", materialTypeKeywordPrefix, mt))
}

// MaterialService menyediakan metode untuk manajemen materi pembelajaran.
// Ini termasuk pembuatan materi bersamaan dengan pertanyaan esai terkait.
type MaterialService struct {
	db *sql.DB // Koneksi database yang digunakan oleh layanan ini.
}

// NewMaterialService membuat instance baru dari MaterialService.
// Ini adalah constructor untuk MaterialService.
func NewMaterialService(db *sql.DB) *MaterialService {
	return &MaterialService{db: db}
}

// CreateMaterialWithQuestions menangani pembuatan transaksional sebuah materi dan pertanyaan esai terkait.
// Ini memastikan bahwa materi dan semua pertanyaan esai dibuat atau tidak sama sekali (atomik).
func (s *MaterialService) CreateMaterialWithQuestions(req models.CreateMaterialAndQuestionsRequest, uploaderID string, materialText *string, fileURL *string) (*models.Material, error) {
	// Memulai transaksi database.
	tx, err := s.db.BeginTx(context.Background(), nil)
	if err != nil {
		return nil, fmt.Errorf("could not begin transaction: %w", err)
	}
	defer tx.Rollback() // Pastikan rollback jika terjadi error.

	now := time.Now()
	// Membuat objek Material baru.
	newMaterial := &models.Material{
		ClassID:      req.ClassID,
		UploaderID:   uploaderID,
		Judul:        req.MaterialName,
		MaterialType: "materi",
		IsiMateri:    materialText,
		FileUrl:      fileURL,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	// Query INSERT untuk materi.
	materialQuery := `
		INSERT INTO materials (class_id, uploader_id, judul, isi_materi, file_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $6)
		RETURNING id, created_at, updated_at
	`
	// Menjalankan query dan mendapatkan ID materi yang baru dibuat.
	err = tx.QueryRowContext(context.Background(),
		materialQuery,
		newMaterial.ClassID,
		newMaterial.UploaderID,
		newMaterial.Judul,
		newMaterial.IsiMateri,
		newMaterial.FileUrl,
		newMaterial.CreatedAt,
	).Scan(&newMaterial.ID, &newMaterial.CreatedAt, &newMaterial.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("error inserting new material: %w", err)
	}

	// Menyiapkan statement untuk insert pertanyaan esai (untuk efisiensi dalam loop).
	questionStmt, err := tx.PrepareContext(context.Background(), `
		INSERT INTO essay_questions (material_id, teks_soal, keywords, ideal_answer, rubrics, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $6)
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare question statement: %w", err)
	}
	defer questionStmt.Close() // Pastikan statement ditutup.

	// Iterasi melalui setiap pertanyaan dalam permintaan dan memasukkannya.
	for _, q := range req.Questions {
		var idealAnswer sql.NullString // Menangani idealAnswer yang bisa NULL.
		if q.IdealAnswer != "" {
			idealAnswer = sql.NullString{String: q.IdealAnswer, Valid: true}
		}

		var keywordsSlice []string // Slice untuk kata kunci.
		if q.Keywords != "" {
			// Memisahkan string kata kunci menjadi slice string.
			keywordsSlice = strings.Split(q.Keywords, ",")
			for i, kw := range keywordsSlice {
				keywordsSlice[i] = strings.TrimSpace(kw) // Menghilangkan spasi ekstra.
			}
		}

		_, err := questionStmt.ExecContext(context.Background(),
			newMaterial.ID,
			q.Text,
			pq.Array(keywordsSlice), // Menggunakan pq.Array untuk menyimpan slice string.
			idealAnswer,
			q.Rubrics, // Change to Rubrics (plural)
			time.Now(),
		)
		if err != nil {
			return nil, fmt.Errorf("error inserting essay question '%s': %w", q.Text, err)
		}
	}

	// Melakukan commit transaksi jika semua operasi berhasil.
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return newMaterial, nil
}

// CreateMaterial creates a new material from a request object.
// Ini adalah metode untuk membuat materi tanpa pertanyaan esai terkait.
func (s *MaterialService) CreateMaterial(req models.CreateMaterialRequest, uploaderID string) (*models.Material, error) {
	now := time.Now()
	newMaterial := &models.Material{
		ClassID:             req.ClassID,
		UploaderID:          uploaderID,
		Judul:               req.Judul,
		MaterialType:        normalizeMaterialType(req.MaterialType),
		IsiMateri:           req.IsiMateri,
		FileUrl:             req.FileUrl,
		CreatedAt:           now,
		UpdatedAt:           now,
		CapaianPembelajaran: req.CapaianPembelajaran,
		KataKunci:           applyMaterialTypeToKeywords(req.KataKunci, req.MaterialType),
	}

	// Query INSERT untuk materi.
	query := `
		INSERT INTO materials (class_id, uploader_id, judul, isi_materi, file_url, created_at, updated_at, capaian_pembelajaran, kata_kunci)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at
	`
	err := s.db.QueryRowContext(context.Background(),
		query,
		newMaterial.ClassID,
		newMaterial.UploaderID,
		newMaterial.Judul,
		newMaterial.IsiMateri,
		newMaterial.FileUrl,
		newMaterial.CreatedAt,
		newMaterial.UpdatedAt,
		newMaterial.CapaianPembelajaran,
		pq.Array(newMaterial.KataKunci), // Menggunakan pq.Array untuk KataKunci.
	).Scan(&newMaterial.ID, &newMaterial.CreatedAt, &newMaterial.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("error inserting new material: %w", err)
	}

	// For "tugas" type, create one default hidden submission prompt so students can submit without manual question setup.
	if newMaterial.MaterialType == "tugas" {
		emptyRubrics, _ := json.Marshal([]interface{}{})
		defaultPrompt := "Kumpulkan tugas Anda pada form jawaban di bawah ini."
		if _, err := s.db.ExecContext(
			context.Background(),
			`INSERT INTO essay_questions (id, material_id, teks_soal, keywords, ideal_answer, weight, rubrics, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, NULL, 1, $5, $6, $6)`,
			uuid.New().String(),
			newMaterial.ID,
			defaultPrompt,
			pq.Array([]string{"tugas_submission"}),
			emptyRubrics,
			now,
		); err != nil {
			return nil, fmt.Errorf("error creating default task submission prompt: %w", err)
		}
	}

	return newMaterial, nil
}

// GetMaterialByID retrieves a single material by its ID.
func (s *MaterialService) GetMaterialByID(materialID string) (*models.Material, error) {
	query := `
		SELECT id, class_id, uploader_id, judul, isi_materi, file_url, created_at, updated_at, capaian_pembelajaran, kata_kunci
		FROM materials
		WHERE id = $1
	`
	var m models.Material
	var kataKunci pq.StringArray // Untuk memindai kolom array string dari PostgreSQL.

	// Menjalankan query dan memindai hasilnya.
	err := s.db.QueryRowContext(context.Background(), query, materialID).Scan(
		&m.ID, &m.ClassID, &m.UploaderID, &m.Judul, &m.IsiMateri, &m.FileUrl, &m.CreatedAt, &m.UpdatedAt, &m.CapaianPembelajaran, &kataKunci,
	)
	m.MaterialType, m.KataKunci = extractMaterialTypeAndKeywords([]string(kataKunci)) // Pisahkan tipe internal dan kata kunci publik.

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("material not found")
		}
		return nil, fmt.Errorf("error querying material %s: %w", materialID, err)
	}

	return &m, nil
}

// GetMaterialsByClassID retrieves all materials for a specific class.
func (s *MaterialService) GetMaterialsByClassID(classID string) ([]models.Material, error) {
	query := `
		SELECT id, class_id, uploader_id, judul, isi_materi, file_url, created_at, updated_at, capaian_pembelajaran, kata_kunci
		FROM materials
		WHERE class_id = $1
		ORDER BY created_at DESC
	`
	rows, err := s.db.QueryContext(context.Background(), query, classID)
	if err != nil {
		return nil, fmt.Errorf("error querying materials for class %s: %w", classID, err)
	}
	defer rows.Close()

	var materials []models.Material
	for rows.Next() {
		var m models.Material
		var kataKunci pq.StringArray // Untuk memindai kolom array string.

		if err := rows.Scan(
			&m.ID, &m.ClassID, &m.UploaderID, &m.Judul, &m.IsiMateri, &m.FileUrl, &m.CreatedAt, &m.UpdatedAt, &m.CapaianPembelajaran, &kataKunci); err != nil {
			return nil, fmt.Errorf("error scanning material row: %w", err)
		}
		m.MaterialType, m.KataKunci = extractMaterialTypeAndKeywords([]string(kataKunci))
		materials = append(materials, m)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}

	if materials == nil {
		materials = []models.Material{}
	}

	return materials, nil
}

// UpdateMaterial updates an existing material.
func (s *MaterialService) UpdateMaterial(materialID string, req *models.UpdateMaterialRequest) (*models.Material, error) {
	updates := []string{}
	args := []interface{}{}
	argId := 1
	var existingKeywords []string
	existingKeywordsLoaded := false

	// Membangun klausa SET dan argumen secara dinamis.
	if req.Judul != nil {
		updates = append(updates, fmt.Sprintf("judul = $%d", argId))
		args = append(args, *req.Judul)
		argId++
	}
	if req.IsiMateri != nil {
		updates = append(updates, fmt.Sprintf("isi_materi = $%d", argId))
		args = append(args, *req.IsiMateri)
		argId++
	}
	if req.FileUrl != nil {
		updates = append(updates, fmt.Sprintf("file_url = $%d", argId))
		args = append(args, *req.FileUrl)
		argId++
	}
	if req.CapaianPembelajaran != nil {
		updates = append(updates, fmt.Sprintf("capaian_pembelajaran = $%d", argId))
		args = append(args, *req.CapaianPembelajaran)
		argId++
	}
	if req.KataKunci != nil {
		keywords := req.KataKunci
		if req.MaterialType != nil {
			keywords = applyMaterialTypeToKeywords(keywords, *req.MaterialType)
		}
		updates = append(updates, fmt.Sprintf("kata_kunci = $%d", argId))
		args = append(args, pq.Array(keywords))
		argId++
	} else if req.MaterialType != nil {
		if !existingKeywordsLoaded {
			var existing pq.StringArray
			if err := s.db.QueryRowContext(context.Background(), "SELECT kata_kunci FROM materials WHERE id = $1", materialID).Scan(&existing); err != nil {
				if err == sql.ErrNoRows {
					return nil, fmt.Errorf("material not found")
				}
				return nil, fmt.Errorf("error loading existing keywords: %w", err)
			}
			existingKeywords = []string(existing)
			existingKeywordsLoaded = true
		}
		nextKeywords := applyMaterialTypeToKeywords(existingKeywords, *req.MaterialType)
		updates = append(updates, fmt.Sprintf("kata_kunci = $%d", argId))
		args = append(args, pq.Array(nextKeywords))
		argId++
	}

	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	// Menambahkan updated_at secara otomatis.
	updates = append(updates, fmt.Sprintf("updated_at = $%d", argId))
	args = append(args, time.Now())
	argId++

	args = append(args, materialID) // Menambahkan ID materi sebagai argumen terakhir.
	// Membangun query UPDATE lengkap.
	query := fmt.Sprintf("UPDATE materials SET %s WHERE id = $%d", strings.Join(updates, ", "), argId)

	_, err := s.db.ExecContext(context.Background(), query, args...)
	if err != nil {
		return nil, fmt.Errorf("error updating material: %w", err)
	}

	// Mengambil dan mengembalikan materi yang sudah diperbarui.
	return s.GetMaterialByID(materialID) // Asumsi GetMaterialByID sudah ada dan berfungsi.
}

// DeleteMaterial deletes a material by its ID.
func (s *MaterialService) DeleteMaterial(materialID string) error {
	result, err := s.db.ExecContext(context.Background(), "DELETE FROM materials WHERE id = $1", materialID)
	if err != nil {
		return fmt.Errorf("error deleting material %s: %w", materialID, err)
	}
	rowsAffected, _ := result.RowsAffected() // Mengabaikan error dari RowsAffected().
	if rowsAffected == 0 {
		return fmt.Errorf("material not found with ID %s", materialID)
	}
	return nil
}

// GetMaterialsForStudentByClassID retrieves all materials for a specific class,
// memastikan bahwa siswa adalah anggota dari kelas tersebut.
func (s *MaterialService) GetMaterialsForStudentByClassID(classID, studentID string) ([]models.Material, error) {
	// 1. Periksa Keanggotaan Siswa: Memastikan siswa adalah anggota kelas ini.
	var memberID string
	err := s.db.QueryRowContext(context.Background(),
		"SELECT id FROM class_members WHERE class_id = $1 AND user_id = $2 AND status = 'approved'",
		classID, studentID).Scan(&memberID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("student is not a member of this class") // Siswa bukan anggota.
		}
		return nil, fmt.Errorf("error checking student membership: %w", err)
	}

	// 2. Ambil Materi (jika siswa adalah anggota).
	query := `
		SELECT id, class_id, uploader_id, judul, isi_materi, file_url, created_at, updated_at, capaian_pembelajaran, kata_kunci
		FROM materials
		WHERE class_id = $1
		ORDER BY created_at DESC
	`
	rows, err := s.db.QueryContext(context.Background(), query, classID)
	if err != nil {
		return nil, fmt.Errorf("error querying materials for class %s: %w", classID, err)
	}
	defer rows.Close()

	var materials []models.Material
	for rows.Next() {
		var m models.Material
		var kataKunci pq.StringArray // Untuk memindai kolom array string.

		if err := rows.Scan(
			&m.ID, &m.ClassID, &m.UploaderID, &m.Judul, &m.IsiMateri, &m.FileUrl, &m.CreatedAt, &m.UpdatedAt, &m.CapaianPembelajaran, &kataKunci); err != nil {
			return nil, fmt.Errorf("error scanning material row: %w", err)
		}
		m.MaterialType, m.KataKunci = extractMaterialTypeAndKeywords([]string(kataKunci))
		materials = append(materials, m)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}

	if materials == nil {
		materials = []models.Material{}
	}

	return materials, nil
}
