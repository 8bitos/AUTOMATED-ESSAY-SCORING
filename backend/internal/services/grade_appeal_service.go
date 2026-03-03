package services

import (
	"api-backend/internal/models"
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

type GradeAppealService struct {
	db *sql.DB
}

func NewGradeAppealService(db *sql.DB) *GradeAppealService {
	return &GradeAppealService{db: db}
}

func normalizeAppealStatus(status string) string {
	s := strings.TrimSpace(strings.ToLower(status))
	if s == "" {
		return "open"
	}
	return s
}

func normalizeReasonType(reasonType string) string {
	r := strings.TrimSpace(strings.ToLower(reasonType))
	if r == "" {
		return "nilai_tidak_sesuai"
	}
	return r
}

func (s *GradeAppealService) CreateAppeal(req *models.CreateGradeAppealRequest, studentID string) (*models.GradeAppeal, error) {
	if req == nil {
		return nil, fmt.Errorf("invalid request")
	}
	submissionID := strings.TrimSpace(req.SubmissionID)
	reasonText := strings.TrimSpace(req.ReasonText)
	if submissionID == "" {
		return nil, fmt.Errorf("submission_id is required")
	}
	if reasonText == "" {
		return nil, fmt.Errorf("reason_text is required")
	}

	var questionID, classID string
	err := s.db.QueryRowContext(
		context.Background(),
		`SELECT es.soal_id, m.class_id
		 FROM essay_submissions es
		 JOIN essay_questions eq ON eq.id = es.soal_id
		 JOIN materials m ON m.id = eq.material_id
		 WHERE es.id = $1 AND es.siswa_id = $2`,
		submissionID,
		studentID,
	).Scan(&questionID, &classID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("submission not found for student")
		}
		return nil, fmt.Errorf("failed to validate submission: %w", err)
	}

	reasonType := normalizeReasonType(req.ReasonType)
	var attachmentURL *string
	if req.AttachmentURL != nil {
		trimmed := strings.TrimSpace(*req.AttachmentURL)
		if trimmed != "" {
			attachmentURL = &trimmed
		}
	}

	row := s.db.QueryRowContext(
		context.Background(),
		`INSERT INTO grade_appeals (
			submission_id, question_id, class_id, student_id, reason_type, reason_text, attachment_url, status, created_at, updated_at
		 ) VALUES ($1,$2,$3,$4,$5,$6,$7,'open',NOW(),NOW())
		 RETURNING id, status, created_at, updated_at`,
		submissionID,
		questionID,
		classID,
		studentID,
		reasonType,
		reasonText,
		attachmentURL,
	)

	appeal := &models.GradeAppeal{
		SubmissionID:  submissionID,
		QuestionID:    questionID,
		ClassID:       classID,
		StudentID:     studentID,
		ReasonType:    reasonType,
		ReasonText:    reasonText,
		AttachmentURL: attachmentURL,
	}
	if err := row.Scan(&appeal.ID, &appeal.Status, &appeal.CreatedAt, &appeal.UpdatedAt); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "uq_grade_appeals_active_per_submission_student") {
			return nil, fmt.Errorf("kamu sudah punya banding aktif untuk submission ini")
		}
		return nil, fmt.Errorf("failed to create appeal: %w", err)
	}
	return appeal, nil
}

func (s *GradeAppealService) ListStudentAppeals(studentID string, classID string) ([]models.GradeAppealView, error) {
	rows, err := s.db.QueryContext(
		context.Background(),
		`SELECT ga.id, ga.submission_id, ga.question_id, ga.class_id, ga.student_id,
			ga.reason_type, ga.reason_text, ga.attachment_url, ga.status, ga.teacher_response,
			ga.resolved_by, ga.created_at, ga.updated_at, ga.resolved_at,
			c.class_name, m.id AS material_id, m.judul AS material_title,
			eq.teks_soal, ar.skor_ai, tr.revised_score
		 FROM grade_appeals ga
		 JOIN classes c ON c.id = ga.class_id
		 JOIN essay_questions eq ON eq.id = ga.question_id
		 JOIN materials m ON m.id = eq.material_id
		 LEFT JOIN ai_results ar ON ar.submission_id = ga.submission_id
		 LEFT JOIN teacher_reviews tr ON tr.submission_id = ga.submission_id
		 WHERE ga.student_id = $1
		   AND ($2 = '' OR ga.class_id = $2)
		 ORDER BY ga.created_at DESC`,
		studentID,
		strings.TrimSpace(classID),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list student appeals: %w", err)
	}
	defer rows.Close()

	out := make([]models.GradeAppealView, 0)
	for rows.Next() {
		var row models.GradeAppealView
		if err := rows.Scan(
			&row.ID,
			&row.SubmissionID,
			&row.QuestionID,
			&row.ClassID,
			&row.StudentID,
			&row.ReasonType,
			&row.ReasonText,
			&row.AttachmentURL,
			&row.Status,
			&row.TeacherResponse,
			&row.ResolvedBy,
			&row.CreatedAt,
			&row.UpdatedAt,
			&row.ResolvedAt,
			&row.ClassName,
			&row.MaterialID,
			&row.MaterialTitle,
			&row.QuestionText,
			&row.AIScore,
			&row.RevisedScore,
		); err != nil {
			return nil, fmt.Errorf("failed to scan student appeal: %w", err)
		}
		out = append(out, row)
	}
	return out, nil
}

func (s *GradeAppealService) ListTeacherAppeals(teacherID string, classID string, status string) ([]models.GradeAppealView, error) {
	normalizedStatus := normalizeAppealStatus(status)
	if normalizedStatus == "all" {
		normalizedStatus = ""
	}
	rows, err := s.db.QueryContext(
		context.Background(),
		`SELECT ga.id, ga.submission_id, ga.question_id, ga.class_id, ga.student_id,
			ga.reason_type, ga.reason_text, ga.attachment_url, ga.status, ga.teacher_response,
			ga.resolved_by, ga.created_at, ga.updated_at, ga.resolved_at,
			c.class_name, m.id AS material_id, m.judul AS material_title,
			eq.teks_soal, u.nama_lengkap AS student_name, u.email AS student_email,
			ar.skor_ai, tr.revised_score
		 FROM grade_appeals ga
		 JOIN classes c ON c.id = ga.class_id
		 JOIN users u ON u.id = ga.student_id
		 JOIN essay_questions eq ON eq.id = ga.question_id
		 JOIN materials m ON m.id = eq.material_id
		 LEFT JOIN ai_results ar ON ar.submission_id = ga.submission_id
		 LEFT JOIN teacher_reviews tr ON tr.submission_id = ga.submission_id
		 WHERE c.teacher_id = $1
		   AND ($2 = '' OR ga.class_id = $2)
		   AND ($3 = '' OR ga.status = $3)
		 ORDER BY CASE WHEN ga.status IN ('open','in_review') THEN 0 ELSE 1 END, ga.created_at DESC`,
		teacherID,
		strings.TrimSpace(classID),
		normalizedStatus,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list teacher appeals: %w", err)
	}
	defer rows.Close()

	out := make([]models.GradeAppealView, 0)
	for rows.Next() {
		var row models.GradeAppealView
		if err := rows.Scan(
			&row.ID,
			&row.SubmissionID,
			&row.QuestionID,
			&row.ClassID,
			&row.StudentID,
			&row.ReasonType,
			&row.ReasonText,
			&row.AttachmentURL,
			&row.Status,
			&row.TeacherResponse,
			&row.ResolvedBy,
			&row.CreatedAt,
			&row.UpdatedAt,
			&row.ResolvedAt,
			&row.ClassName,
			&row.MaterialID,
			&row.MaterialTitle,
			&row.QuestionText,
			&row.StudentName,
			&row.StudentEmail,
			&row.AIScore,
			&row.RevisedScore,
		); err != nil {
			return nil, fmt.Errorf("failed to scan teacher appeal: %w", err)
		}
		out = append(out, row)
	}
	return out, nil
}

func (s *GradeAppealService) ReviewAppeal(appealID string, teacherID string, req *models.ReviewGradeAppealRequest) (*models.GradeAppeal, error) {
	if req == nil {
		return nil, fmt.Errorf("invalid request")
	}
	status := normalizeAppealStatus(req.Status)
	if status != "in_review" && status != "resolved_accepted" && status != "resolved_rejected" {
		return nil, fmt.Errorf("status is invalid")
	}

	var submissionID string
	err := s.db.QueryRowContext(
		context.Background(),
		`SELECT ga.submission_id
		 FROM grade_appeals ga
		 JOIN classes c ON c.id = ga.class_id
		 WHERE ga.id = $1 AND c.teacher_id = $2`,
		appealID,
		teacherID,
	).Scan(&submissionID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("appeal not found")
		}
		return nil, fmt.Errorf("failed to validate appeal: %w", err)
	}

	teacherResponse := req.TeacherResponse
	if teacherResponse != nil {
		trimmed := strings.TrimSpace(*teacherResponse)
		teacherResponse = &trimmed
		if trimmed == "" {
			teacherResponse = nil
		}
	}

	var resolvedAt *time.Time
	var resolvedBy *string
	if status == "resolved_accepted" || status == "resolved_rejected" {
		now := time.Now()
		resolvedAt = &now
		resolvedBy = &teacherID
	}

	_, err = s.db.ExecContext(
		context.Background(),
		`UPDATE grade_appeals
		 SET status = $1,
		     teacher_response = $2,
		     resolved_by = $3,
		     resolved_at = $4,
		     updated_at = NOW()
		 WHERE id = $5`,
		status,
		teacherResponse,
		resolvedBy,
		resolvedAt,
		appealID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update appeal: %w", err)
	}

	if status == "resolved_accepted" && (req.RevisedScore != nil || req.TeacherFeedback != nil) {
		feedback := req.TeacherFeedback
		if feedback != nil {
			trimmed := strings.TrimSpace(*feedback)
			feedback = &trimmed
			if trimmed == "" {
				feedback = nil
			}
		}

		var score float64
		if req.RevisedScore != nil {
			score = *req.RevisedScore
		} else {
			_ = s.db.QueryRowContext(context.Background(), `SELECT COALESCE(revised_score, 0) FROM teacher_reviews WHERE submission_id = $1`, submissionID).Scan(&score)
		}
		_, err = s.db.ExecContext(
			context.Background(),
			`INSERT INTO teacher_reviews (submission_id, teacher_id, revised_score, teacher_feedback, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, NOW(), NOW())
			 ON CONFLICT (submission_id) DO UPDATE
			 SET teacher_id = EXCLUDED.teacher_id,
			     revised_score = EXCLUDED.revised_score,
			     teacher_feedback = COALESCE(EXCLUDED.teacher_feedback, teacher_reviews.teacher_feedback),
			     updated_at = NOW()`,
			submissionID,
			teacherID,
			score,
			feedback,
		)
		if err != nil {
			return nil, fmt.Errorf("appeal status updated but failed to save teacher review: %w", err)
		}
	}

	var appeal models.GradeAppeal
	err = s.db.QueryRowContext(
		context.Background(),
		`SELECT id, submission_id, question_id, class_id, student_id,
			reason_type, reason_text, attachment_url, status, teacher_response,
			resolved_by, created_at, updated_at, resolved_at
		 FROM grade_appeals
		 WHERE id = $1`,
		appealID,
	).Scan(
		&appeal.ID,
		&appeal.SubmissionID,
		&appeal.QuestionID,
		&appeal.ClassID,
		&appeal.StudentID,
		&appeal.ReasonType,
		&appeal.ReasonText,
		&appeal.AttachmentURL,
		&appeal.Status,
		&appeal.TeacherResponse,
		&appeal.ResolvedBy,
		&appeal.CreatedAt,
		&appeal.UpdatedAt,
		&appeal.ResolvedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch updated appeal: %w", err)
	}
	return &appeal, nil
}
