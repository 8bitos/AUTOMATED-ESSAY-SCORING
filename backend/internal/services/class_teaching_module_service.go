package services

import (
	"api-backend/internal/models"
	"database/sql"
	"fmt"
	"time"
)

type ClassTeachingModuleService struct {
	db *sql.DB
}

func NewClassTeachingModuleService(db *sql.DB) *ClassTeachingModuleService {
	return &ClassTeachingModuleService{db: db}
}

func (s *ClassTeachingModuleService) CreateClassTeachingModule(req models.CreateClassTeachingModuleRequest) (*models.ClassTeachingModule, error) {
	newModule := &models.ClassTeachingModule{
		ClassID:   req.ClassID,
		NamaModul: req.NamaModul,
		FileURL:   req.FileURL,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if req.UploadedBy != "" {
		newModule.UploadedBy = &req.UploadedBy
	}

	query := `
		INSERT INTO class_teaching_modules (class_id, uploaded_by, nama_modul, file_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`
	err := s.db.QueryRow(
		query,
		newModule.ClassID,
		newModule.UploadedBy,
		newModule.NamaModul,
		newModule.FileURL,
		newModule.CreatedAt,
		newModule.UpdatedAt,
	).Scan(&newModule.ID, &newModule.CreatedAt, &newModule.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("error inserting class teaching module: %w", err)
	}

	return newModule, nil
}

func (s *ClassTeachingModuleService) GetClassTeachingModulesByClassID(classID string) ([]models.ClassTeachingModule, error) {
	query := `
		SELECT id, class_id, uploaded_by, nama_modul, file_url, created_at, updated_at
		FROM class_teaching_modules
		WHERE class_id = $1
		ORDER BY updated_at DESC, created_at DESC
	`

	rows, err := s.db.Query(query, classID)
	if err != nil {
		return nil, fmt.Errorf("error querying class teaching modules for class %s: %w", classID, err)
	}
	defer rows.Close()

	modules := []models.ClassTeachingModule{}
	for rows.Next() {
		var m models.ClassTeachingModule
		if err := rows.Scan(
			&m.ID,
			&m.ClassID,
			&m.UploadedBy,
			&m.NamaModul,
			&m.FileURL,
			&m.CreatedAt,
			&m.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning class teaching module row: %w", err)
		}
		modules = append(modules, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during class teaching module rows iteration: %w", err)
	}

	return modules, nil
}

func (s *ClassTeachingModuleService) DeleteClassTeachingModule(moduleID string) error {
	result, err := s.db.Exec("DELETE FROM class_teaching_modules WHERE id = $1", moduleID)
	if err != nil {
		return fmt.Errorf("error deleting class teaching module %s: %w", moduleID, err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error checking rows affected for class teaching module deletion: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("class teaching module not found")
	}
	return nil
}
