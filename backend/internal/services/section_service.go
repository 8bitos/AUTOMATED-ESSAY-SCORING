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

type SectionService struct {
	db *sql.DB
}

func NewSectionService(db *sql.DB) *SectionService {
	return &SectionService{db: db}
}

func normalizeSectionContentType(value string) string {
	v := strings.ToLower(strings.TrimSpace(value))
	switch v {
	case "soal":
		return "soal"
	case "tugas":
		return "tugas"
	case "penilaian":
		return "penilaian"
	default:
		return "materi"
	}
}

func (s *SectionService) ensureTeacherOwnsClass(ctx context.Context, classID, teacherID string) error {
	var owned bool
	if err := s.db.QueryRowContext(
		ctx,
		"SELECT EXISTS(SELECT 1 FROM classes WHERE id = $1 AND teacher_id = $2)",
		classID,
		teacherID,
	).Scan(&owned); err != nil {
		return fmt.Errorf("error validating class ownership: %w", err)
	}
	if !owned {
		return fmt.Errorf("class not found or access denied")
	}
	return nil
}

func (s *SectionService) ensureStudentInClass(ctx context.Context, classID, studentID string) error {
	var ok bool
	if err := s.db.QueryRowContext(
		ctx,
		"SELECT EXISTS(SELECT 1 FROM class_members WHERE class_id = $1 AND user_id = $2 AND status = 'approved')",
		classID,
		studentID,
	).Scan(&ok); err != nil {
		return fmt.Errorf("error validating class membership: %w", err)
	}
	if !ok {
		return fmt.Errorf("class not found or access denied")
	}
	return nil
}

type sectionCardsPayloadLocal struct {
	Format string `json:"format"`
	Items  []struct {
		ID   string `json:"id"`
		Type string `json:"type"`
	} `json:"items"`
}

func hasSectionCard(raw *string, sectionCardID string) bool {
	if raw == nil {
		return false
	}
	trimmed := strings.TrimSpace(*raw)
	if trimmed == "" || strings.TrimSpace(sectionCardID) == "" {
		return false
	}
	var parsed sectionCardsPayloadLocal
	if err := json.Unmarshal([]byte(trimmed), &parsed); err != nil || parsed.Format != "sage_section_cards_v1" {
		return false
	}
	for _, item := range parsed.Items {
		if strings.TrimSpace(item.ID) == strings.TrimSpace(sectionCardID) {
			return true
		}
	}
	return false
}

func (s *SectionService) ListSectionsByClassID(classID, teacherID string) ([]models.SectionWithContents, error) {
	ctx := context.Background()
	if err := s.ensureTeacherOwnsClass(ctx, classID, teacherID); err != nil {
		return nil, err
	}

	sectionRows, err := s.db.QueryContext(ctx, `
		SELECT id, class_id, title, description, display_order, created_at, updated_at
		FROM sections
		WHERE class_id = $1
		ORDER BY display_order ASC, created_at DESC
	`, classID)
	if err != nil {
		return nil, fmt.Errorf("error querying sections: %w", err)
	}
	defer sectionRows.Close()

	result := make([]models.SectionWithContents, 0)
	sectionMap := make(map[string]int)
	for sectionRows.Next() {
		var sec models.SectionWithContents
		if err := sectionRows.Scan(
			&sec.ID,
			&sec.ClassID,
			&sec.Title,
			&sec.Description,
			&sec.DisplayOrder,
			&sec.CreatedAt,
			&sec.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning section row: %w", err)
		}
		sec.Contents = []models.SectionContent{}
		sectionMap[sec.ID] = len(result)
		result = append(result, sec)
	}
	if err := sectionRows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating sections: %w", err)
	}
	if len(result) == 0 {
		return []models.SectionWithContents{}, nil
	}

	contentRows, err := s.db.QueryContext(ctx, `
		SELECT id, section_id, content_type, title, body, linked_material_id, display_order, status, created_at, updated_at
		FROM section_contents
		WHERE section_id IN (SELECT id FROM sections WHERE class_id = $1)
		ORDER BY display_order ASC, created_at ASC
	`, classID)
	if err != nil {
		return nil, fmt.Errorf("error querying section contents: %w", err)
	}
	defer contentRows.Close()

	for contentRows.Next() {
		var c models.SectionContent
		if err := contentRows.Scan(
			&c.ID,
			&c.SectionID,
			&c.ContentType,
			&c.Title,
			&c.Body,
			&c.LinkedMaterialID,
			&c.DisplayOrder,
			&c.Status,
			&c.CreatedAt,
			&c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning section content row: %w", err)
		}
		idx, ok := sectionMap[c.SectionID]
		if ok {
			result[idx].Contents = append(result[idx].Contents, c)
		}
	}
	if err := contentRows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating section contents: %w", err)
	}

	return result, nil
}

func (s *SectionService) CreateSection(classID, teacherID string, req models.CreateSectionRequest) (*models.Section, error) {
	ctx := context.Background()
	if strings.TrimSpace(req.Title) == "" {
		return nil, fmt.Errorf("section title is required")
	}
	if err := s.ensureTeacherOwnsClass(ctx, classID, teacherID); err != nil {
		return nil, err
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("could not begin transaction: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx,
		"UPDATE sections SET display_order = display_order + 1 WHERE class_id = $1",
		classID,
	); err != nil {
		return nil, fmt.Errorf("error shifting section order: %w", err)
	}

	created := &models.Section{}
	now := time.Now()
	if err := tx.QueryRowContext(ctx, `
		INSERT INTO sections (class_id, title, description, display_order, created_at, updated_at)
		VALUES ($1, $2, $3, 1, $4, $4)
		RETURNING id, class_id, title, description, display_order, created_at, updated_at
	`, classID, strings.TrimSpace(req.Title), req.Description, now).Scan(
		&created.ID,
		&created.ClassID,
		&created.Title,
		&created.Description,
		&created.DisplayOrder,
		&created.CreatedAt,
		&created.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("error creating section: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit create section transaction: %w", err)
	}
	return created, nil
}

func (s *SectionService) CreateSectionContent(sectionID, teacherID string, req models.CreateSectionContentRequest) (*models.SectionContent, error) {
	ctx := context.Background()
	if strings.TrimSpace(req.Title) == "" {
		return nil, fmt.Errorf("content title is required")
	}
	contentType := normalizeSectionContentType(req.ContentType)

	var classID string
	if err := s.db.QueryRowContext(ctx, `
		SELECT s.class_id
		FROM sections s
		JOIN classes c ON c.id = s.class_id
		WHERE s.id = $1 AND c.teacher_id = $2
	`, sectionID, teacherID).Scan(&classID); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("section not found or access denied")
		}
		return nil, fmt.Errorf("error validating section ownership: %w", err)
	}

	_ = classID
	created := &models.SectionContent{}
	now := time.Now()
	if err := s.db.QueryRowContext(ctx, `
		INSERT INTO section_contents (section_id, content_type, title, body, display_order, status, created_at, updated_at)
		VALUES (
			$1, $2, $3, $4,
			(SELECT COALESCE(MAX(display_order), 0) + 1 FROM section_contents WHERE section_id = $1),
			'draft',
			$5, $5
		)
		RETURNING id, section_id, content_type, title, body, linked_material_id, display_order, status, created_at, updated_at
	`, sectionID, contentType, strings.TrimSpace(req.Title), req.Body, now).Scan(
		&created.ID,
		&created.SectionID,
		&created.ContentType,
		&created.Title,
		&created.Body,
		&created.LinkedMaterialID,
		&created.DisplayOrder,
		&created.Status,
		&created.CreatedAt,
		&created.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("error creating section content: %w", err)
	}

	return created, nil
}

func (s *SectionService) IsSectionCardRead(classID, materialID, sectionCardID, studentID string) (bool, error) {
	ctx := context.Background()
	if err := s.ensureStudentInClass(ctx, classID, studentID); err != nil {
		return false, err
	}

	var raw sql.NullString
	if err := s.db.QueryRowContext(ctx, `
		SELECT isi_materi
		FROM materials
		WHERE id = $1 AND class_id = $2
	`, materialID, classID).Scan(&raw); err != nil {
		if err == sql.ErrNoRows {
			return false, fmt.Errorf("material not found or access denied")
		}
		return false, fmt.Errorf("error validating material access: %w", err)
	}
	if !hasSectionCard(&raw.String, sectionCardID) {
		return false, fmt.Errorf("section card not found")
	}

	var exists bool
	if err := s.db.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM section_card_reads
			WHERE student_id = $1 AND material_id = $2 AND section_card_id = $3
		)
	`, studentID, materialID, sectionCardID).Scan(&exists); err != nil {
		return false, fmt.Errorf("error checking section card read: %w", err)
	}
	return exists, nil
}

func (s *SectionService) MarkSectionCardRead(classID, materialID, sectionCardID, studentID string) error {
	ctx := context.Background()
	if err := s.ensureStudentInClass(ctx, classID, studentID); err != nil {
		return err
	}

	var raw sql.NullString
	if err := s.db.QueryRowContext(ctx, `
		SELECT isi_materi
		FROM materials
		WHERE id = $1 AND class_id = $2
	`, materialID, classID).Scan(&raw); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("material not found or access denied")
		}
		return fmt.Errorf("error validating material access: %w", err)
	}
	if !hasSectionCard(&raw.String, sectionCardID) {
		return fmt.Errorf("section card not found")
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO section_card_reads (class_id, material_id, student_id, section_card_id, read_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (student_id, material_id, section_card_id) DO NOTHING
	`, classID, materialID, studentID, strings.TrimSpace(sectionCardID), time.Now())
	if err != nil {
		return fmt.Errorf("error marking section card read: %w", err)
	}
	return nil
}
