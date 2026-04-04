package services

import (
	"api-backend/internal/models"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type RubricTemplateService struct {
	db *sql.DB
}

func NewRubricTemplateService(db *sql.DB) *RubricTemplateService {
	return &RubricTemplateService{db: db}
}

func normalizeRubricsPayload(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 || strings.TrimSpace(string(raw)) == "" || strings.TrimSpace(string(raw)) == "null" {
		return []byte("[]")
	}
	return raw
}

func (s *RubricTemplateService) ListByUser(userID string) ([]models.RubricTemplate, error) {
	rows, err := s.db.QueryContext(
		context.Background(),
		`SELECT id, created_by, title, rubric_type, rubrics, created_at, updated_at
		 FROM rubric_templates
		 WHERE created_by = $1
		 ORDER BY updated_at DESC, created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("error querying rubric templates: %w", err)
	}
	defer rows.Close()

	templates := []models.RubricTemplate{}
	for rows.Next() {
		var item models.RubricTemplate
		if err := rows.Scan(
			&item.ID,
			&item.CreatedBy,
			&item.Title,
			&item.RubricType,
			&item.Rubrics,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning rubric template: %w", err)
		}
		if len(item.Rubrics) == 0 || strings.TrimSpace(string(item.Rubrics)) == "null" {
			item.Rubrics = []byte("[]")
		}
		templates = append(templates, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rubric templates: %w", err)
	}
	return templates, nil
}

func (s *RubricTemplateService) Create(userID string, req models.CreateRubricTemplateRequest) (*models.RubricTemplate, error) {
	now := time.Now()
	rubrics := normalizeRubricsPayload(req.Rubrics)
	query := `
		INSERT INTO rubric_templates (created_by, title, rubric_type, rubrics, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $5)
		RETURNING id, created_by, title, rubric_type, rubrics, created_at, updated_at
	`
	var created models.RubricTemplate
	if err := s.db.QueryRowContext(
		context.Background(),
		query,
		userID,
		strings.TrimSpace(req.Title),
		strings.TrimSpace(req.RubricType),
		rubrics,
		now,
	).Scan(
		&created.ID,
		&created.CreatedBy,
		&created.Title,
		&created.RubricType,
		&created.Rubrics,
		&created.CreatedAt,
		&created.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("error creating rubric template: %w", err)
	}
	return &created, nil
}

func (s *RubricTemplateService) Update(userID, templateID string, req models.UpdateRubricTemplateRequest) (*models.RubricTemplate, error) {
	updates := []string{}
	args := []interface{}{}
	argPos := 1

	if req.Title != nil {
		updates = append(updates, fmt.Sprintf("title = $%d", argPos))
		args = append(args, strings.TrimSpace(*req.Title))
		argPos++
	}
	if req.RubricType != nil {
		updates = append(updates, fmt.Sprintf("rubric_type = $%d", argPos))
		args = append(args, strings.TrimSpace(*req.RubricType))
		argPos++
	}
	if req.Rubrics != nil {
		updates = append(updates, fmt.Sprintf("rubrics = $%d", argPos))
		args = append(args, normalizeRubricsPayload(*req.Rubrics))
		argPos++
	}
	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	updates = append(updates, fmt.Sprintf("updated_at = $%d", argPos))
	args = append(args, time.Now())
	argPos++

	where := fmt.Sprintf("id = $%d AND created_by = $%d", argPos, argPos+1)
	args = append(args, templateID, userID)

	query := fmt.Sprintf("UPDATE rubric_templates SET %s WHERE %s", strings.Join(updates, ", "), where)
	res, err := s.db.ExecContext(context.Background(), query, args...)
	if err != nil {
		return nil, fmt.Errorf("error updating rubric template: %w", err)
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return nil, fmt.Errorf("rubric template not found")
	}

	var item models.RubricTemplate
	if err := s.db.QueryRowContext(
		context.Background(),
		`SELECT id, created_by, title, rubric_type, rubrics, created_at, updated_at
		 FROM rubric_templates
		 WHERE id = $1`,
		templateID,
	).Scan(
		&item.ID,
		&item.CreatedBy,
		&item.Title,
		&item.RubricType,
		&item.Rubrics,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("error reading updated rubric template: %w", err)
	}
	if len(item.Rubrics) == 0 || strings.TrimSpace(string(item.Rubrics)) == "null" {
		item.Rubrics = []byte("[]")
	}
	return &item, nil
}

func (s *RubricTemplateService) Delete(userID, templateID string) error {
	res, err := s.db.ExecContext(
		context.Background(),
		"DELETE FROM rubric_templates WHERE id = $1 AND created_by = $2",
		templateID,
		userID,
	)
	if err != nil {
		return fmt.Errorf("error deleting rubric template: %w", err)
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fmt.Errorf("rubric template not found")
	}
	return nil
}
