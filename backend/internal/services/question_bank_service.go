package services

import (
	"api-backend/internal/models"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/lib/pq"
)

type QuestionBankService struct {
	db *sql.DB
}

func NewQuestionBankService(db *sql.DB) *QuestionBankService {
	return &QuestionBankService{db: db}
}

func (s *QuestionBankService) CreateQuestionBankEntry(req models.CreateQuestionBankEntryRequest, createdBy, classID string) (*models.QuestionBankEntry, error) {
	now := time.Now()

	var keywordsArray interface{} = nil
	if req.Keywords != nil && len(*req.Keywords) > 0 {
		keywordsArray = pq.Array(*req.Keywords)
	}

	rubrics := req.Rubrics
	if len(rubrics) == 0 || strings.TrimSpace(string(rubrics)) == "null" {
		rubrics = []byte("[]")
	}
	var sourceMaterialID interface{} = nil
	if req.MaterialID != nil && strings.TrimSpace(*req.MaterialID) != "" {
		sourceMaterialID = strings.TrimSpace(*req.MaterialID)
	}
	var sourceQuestionID interface{} = nil
	if req.QuestionID != nil && strings.TrimSpace(*req.QuestionID) != "" {
		sourceQuestionID = strings.TrimSpace(*req.QuestionID)
	}

	query := `
		INSERT INTO question_bank_entries (
			created_by, class_id, subject, source_material_id, source_question_id, teks_soal,
			level_kognitif, keywords, ideal_answer, weight, rubrics, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
		RETURNING id, created_by, class_id, subject, source_material_id, source_question_id, teks_soal,
			level_kognitif, keywords, ideal_answer, weight, rubrics, created_at, updated_at
	`
	var created models.QuestionBankEntry
	var keywords pq.StringArray
	if err := s.db.QueryRowContext(
		context.Background(),
		query,
		createdBy,
		classID,
		strings.TrimSpace(req.Subject),
		sourceMaterialID,
		sourceQuestionID,
		req.TeksSoal,
		req.LevelKognitif,
		keywordsArray,
		req.IdealAnswer,
		req.Weight,
		rubrics,
		now,
	).Scan(
		&created.ID,
		&created.CreatedBy,
		&created.ClassID,
		&created.Subject,
		&created.SourceMaterialID,
		&created.SourceQuestionID,
		&created.TeksSoal,
		&created.LevelKognitif,
		&keywords,
		&created.IdealAnswer,
		&created.Weight,
		&created.Rubrics,
		&created.CreatedAt,
		&created.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("error creating question bank entry: %w", err)
	}
	created.Keywords = []string(keywords)

	return &created, nil
}

func (s *QuestionBankService) ListQuestionBankEntries(_ string, _ string, classID, materialID, q *string) ([]models.QuestionBankEntry, error) {
	base := `
		SELECT
			qb.id, qb.created_by, COALESCE(u.nama_lengkap, '') as created_by_name, qb.class_id, COALESCE(c.class_name, '') as class_name,
			COALESCE(qb.subject, '') as subject,
			qb.source_material_id, COALESCE(m.judul, '') as material_title, qb.source_question_id,
			qb.teks_soal, qb.level_kognitif, qb.keywords, qb.ideal_answer, qb.weight, qb.rubrics,
			qb.created_at, qb.updated_at
		FROM question_bank_entries qb
		LEFT JOIN classes c ON c.id = qb.class_id
		LEFT JOIN materials m ON m.id = qb.source_material_id
		LEFT JOIN users u ON u.id = qb.created_by
	`
	clauses := make([]string, 0, 4)
	args := make([]interface{}, 0, 4)
	argPos := 1

	if classID != nil && strings.TrimSpace(*classID) != "" {
		clauses = append(clauses, fmt.Sprintf("qb.class_id = $%d", argPos))
		args = append(args, strings.TrimSpace(*classID))
		argPos++
	}
	if materialID != nil && strings.TrimSpace(*materialID) != "" {
		clauses = append(clauses, fmt.Sprintf("qb.source_material_id = $%d", argPos))
		args = append(args, strings.TrimSpace(*materialID))
		argPos++
	}
	if q != nil && strings.TrimSpace(*q) != "" {
		clauses = append(clauses, fmt.Sprintf("(LOWER(qb.teks_soal) LIKE LOWER($%d) OR LOWER(COALESCE(m.judul, '')) LIKE LOWER($%d) OR LOWER(COALESCE(c.class_name, '')) LIKE LOWER($%d) OR LOWER(COALESCE(qb.subject, '')) LIKE LOWER($%d))", argPos, argPos, argPos, argPos))
		args = append(args, "%"+strings.TrimSpace(*q)+"%")
		argPos++
	}

	query := base
	if len(clauses) > 0 {
		query += " WHERE " + strings.Join(clauses, " AND ")
	}
	query += " ORDER BY qb.updated_at DESC, qb.created_at DESC"

	rows, err := s.db.QueryContext(context.Background(), query, args...)
	if err != nil {
		return nil, fmt.Errorf("error querying question bank entries: %w", err)
	}
	defer rows.Close()

	entries := []models.QuestionBankEntry{}
	for rows.Next() {
		var item models.QuestionBankEntry
		var keywords pq.StringArray
		if err := rows.Scan(
			&item.ID,
			&item.CreatedBy,
			&item.CreatedByName,
			&item.ClassID,
			&item.ClassName,
			&item.Subject,
			&item.SourceMaterialID,
			&item.MaterialTitle,
			&item.SourceQuestionID,
			&item.TeksSoal,
			&item.LevelKognitif,
			&keywords,
			&item.IdealAnswer,
			&item.Weight,
			&item.Rubrics,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning question bank row: %w", err)
		}
		item.Keywords = []string(keywords)

		if len(item.Rubrics) == 0 || string(item.Rubrics) == "null" {
			emptyRubrics, _ := json.Marshal([]interface{}{})
			item.Rubrics = emptyRubrics
		}
		entries = append(entries, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating question bank rows: %w", err)
	}

	return entries, nil
}

func (s *QuestionBankService) UpdateQuestionBankEntry(entryID string, req models.UpdateQuestionBankEntryRequest, userID, userRole string) (*models.QuestionBankEntry, error) {
	updates := []string{}
	args := []interface{}{}
	argPos := 1

	if req.ClassID != nil && strings.TrimSpace(*req.ClassID) != "" {
		updates = append(updates, fmt.Sprintf("class_id = $%d", argPos))
		args = append(args, strings.TrimSpace(*req.ClassID))
		argPos++
	}
	if req.Subject != nil {
		updates = append(updates, fmt.Sprintf("subject = $%d", argPos))
		args = append(args, strings.TrimSpace(*req.Subject))
		argPos++
	}
	if req.MaterialID != nil {
		trimmed := strings.TrimSpace(*req.MaterialID)
		if trimmed == "" {
			updates = append(updates, fmt.Sprintf("source_material_id = NULL"))
		} else {
			updates = append(updates, fmt.Sprintf("source_material_id = $%d", argPos))
			args = append(args, trimmed)
			argPos++
		}
	}
	if req.TeksSoal != nil {
		updates = append(updates, fmt.Sprintf("teks_soal = $%d", argPos))
		args = append(args, strings.TrimSpace(*req.TeksSoal))
		argPos++
	}
	if req.LevelKognitif != nil {
		updates = append(updates, fmt.Sprintf("level_kognitif = $%d", argPos))
		args = append(args, strings.TrimSpace(*req.LevelKognitif))
		argPos++
	}
	if req.Keywords != nil {
		updates = append(updates, fmt.Sprintf("keywords = $%d", argPos))
		args = append(args, pq.Array(*req.Keywords))
		argPos++
	}
	if req.IdealAnswer != nil {
		updates = append(updates, fmt.Sprintf("ideal_answer = $%d", argPos))
		args = append(args, strings.TrimSpace(*req.IdealAnswer))
		argPos++
	}
	if req.Weight != nil {
		updates = append(updates, fmt.Sprintf("weight = $%d", argPos))
		args = append(args, *req.Weight)
		argPos++
	}
	if req.Rubrics != nil {
		rubrics := *req.Rubrics
		if len(rubrics) == 0 || strings.TrimSpace(string(rubrics)) == "null" {
			rubrics = []byte("[]")
		}
		updates = append(updates, fmt.Sprintf("rubrics = $%d", argPos))
		args = append(args, rubrics)
		argPos++
	}
	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	updates = append(updates, fmt.Sprintf("updated_at = $%d", argPos))
	args = append(args, time.Now())
	argPos++

	where := fmt.Sprintf("id = $%d", argPos)
	args = append(args, entryID)
	argPos++
	if userRole == "teacher" {
		where += fmt.Sprintf(" AND created_by = $%d", argPos)
		args = append(args, userID)
		argPos++
	}

	query := fmt.Sprintf("UPDATE question_bank_entries SET %s WHERE %s", strings.Join(updates, ", "), where)
	res, err := s.db.ExecContext(context.Background(), query, args...)
	if err != nil {
		return nil, fmt.Errorf("error updating question bank entry: %w", err)
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return nil, fmt.Errorf("question bank entry not found")
	}

	getQuery := `
		SELECT
			qb.id, qb.created_by, COALESCE(u.nama_lengkap, '') as created_by_name, qb.class_id, COALESCE(c.class_name, '') as class_name,
			COALESCE(qb.subject, '') as subject,
			qb.source_material_id, COALESCE(m.judul, '') as material_title, qb.source_question_id,
			qb.teks_soal, qb.level_kognitif, qb.keywords, qb.ideal_answer, qb.weight, qb.rubrics,
			qb.created_at, qb.updated_at
		FROM question_bank_entries qb
		LEFT JOIN classes c ON c.id = qb.class_id
		LEFT JOIN materials m ON m.id = qb.source_material_id
		LEFT JOIN users u ON u.id = qb.created_by
		WHERE qb.id = $1
	`
	var item models.QuestionBankEntry
	var keywords pq.StringArray
	if err := s.db.QueryRowContext(context.Background(), getQuery, entryID).Scan(
		&item.ID,
		&item.CreatedBy,
		&item.CreatedByName,
		&item.ClassID,
		&item.ClassName,
		&item.Subject,
		&item.SourceMaterialID,
		&item.MaterialTitle,
		&item.SourceQuestionID,
		&item.TeksSoal,
		&item.LevelKognitif,
		&keywords,
		&item.IdealAnswer,
		&item.Weight,
		&item.Rubrics,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("error reading updated question bank entry: %w", err)
	}
	item.Keywords = []string(keywords)
	if len(item.Rubrics) == 0 || string(item.Rubrics) == "null" {
		emptyRubrics, _ := json.Marshal([]interface{}{})
		item.Rubrics = emptyRubrics
	}
	return &item, nil
}

func (s *QuestionBankService) DeleteQuestionBankEntry(entryID, userID, userRole string) error {
	var (
		res sql.Result
		err error
	)
	if userRole == "teacher" {
		res, err = s.db.ExecContext(
			context.Background(),
			"DELETE FROM question_bank_entries WHERE id = $1 AND created_by = $2",
			entryID,
			userID,
		)
	} else {
		res, err = s.db.ExecContext(context.Background(), "DELETE FROM question_bank_entries WHERE id = $1", entryID)
	}
	if err != nil {
		return fmt.Errorf("error deleting question bank entry: %w", err)
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fmt.Errorf("question bank entry not found")
	}
	return nil
}
