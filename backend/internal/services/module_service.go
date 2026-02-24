package services

import (
	"api-backend/internal/models" // Mengimpor definisi model Module.
	"database/sql"                         // Mengimpor package database/sql untuk interaksi dengan database.
	"fmt"                                  // Mengimpor package fmt untuk format string dan error.
	"time"                                 // Mengimpor package time untuk timestamp.
)

// ModuleService menyediakan metode untuk manajemen modul pembelajaran.
type ModuleService struct {
	db *sql.DB // Koneksi database yang digunakan oleh layanan ini.
}

// NewModuleService membuat instance baru dari ModuleService.
// Ini adalah constructor untuk ModuleService.
func NewModuleService(db *sql.DB) *ModuleService {
	return &ModuleService{db: db}
}

// CreateModule membuat modul baru untuk materi tertentu di database.
func (s *ModuleService) CreateModule(req models.CreateModuleRequest) (*models.Module, error) {
	// Membuat objek Module baru dari data permintaan.
	newModule := &models.Module{
		MaterialID: req.MaterialID,
		NamaModul:  req.NamaModul,
		FileUrl:    req.FileUrl,
		CreatedAt:  time.Now(), // Mengatur timestamp CreatedAt.
	}

	// Query INSERT untuk menambahkan modul baru.
	query := `
		INSERT INTO modules (material_id, nama_modul, file_url, created_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at
	`
	// Menjalankan query dan memindai ID serta CreatedAt yang dikembalikan.
	err := s.db.QueryRow(query, newModule.MaterialID, newModule.NamaModul, newModule.FileUrl, newModule.CreatedAt).Scan(&newModule.ID, &newModule.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("error inserting new module: %w", err)
	}
	return newModule, nil
}

// GetModulesByMaterialID mengambil semua modul yang terkait dengan materi tertentu.
func (s *ModuleService) GetModulesByMaterialID(materialID string) ([]models.Module, error) {
	query := `
		SELECT id, material_id, nama_modul, file_url, created_at
		FROM modules
		WHERE material_id = $1
		ORDER BY created_at ASC
	`
	rows, err := s.db.Query(query, materialID)
	if err != nil {
		return nil, fmt.Errorf("error querying modules for material %s: %w", materialID, err)
	}
	defer rows.Close() // Pastikan baris ditutup setelah selesai.

	var modules []models.Module
	for rows.Next() {
		var m models.Module
		if err := rows.Scan(&m.ID, &m.MaterialID, &m.NamaModul, &m.FileUrl, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("error scanning module row: %w", err)
		}
		modules = append(modules, m)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during module rows iteration: %w", err)
	}

	// Mengembalikan slice kosong jika tidak ada modul ditemukan, bukan nil.
	if modules == nil {
		modules = []models.Module{}
	}
	return modules, nil
}