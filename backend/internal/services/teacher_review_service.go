package services

import (
	"api-backend/internal/models"
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// TeacherReviewService provides methods for managing teacher reviews.
type TeacherReviewService struct {
	db *sql.DB
}

// NewTeacherReviewService creates a new instance of TeacherReviewService.
func NewTeacherReviewService(db *sql.DB) *TeacherReviewService {
	return &TeacherReviewService{db: db}
}

// CreateTeacherReview creates a new teacher review for a submission.
func (s *TeacherReviewService) CreateTeacherReview(req *models.CreateTeacherReviewRequest, teacherID string) (*models.TeacherReview, error) {
	newReview := &models.TeacherReview{
		SubmissionID:    req.SubmissionID,
		TeacherID:       teacherID,
		RevisedScore:    req.RevisedScore,
		TeacherFeedback: req.TeacherFeedback,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	query := `
		INSERT INTO teacher_reviews (submission_id, teacher_id, revised_score, teacher_feedback, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`
	err := s.db.QueryRowContext(context.Background(),
		query,
		newReview.SubmissionID,
		newReview.TeacherID,
		newReview.RevisedScore,
		newReview.TeacherFeedback,
		newReview.CreatedAt,
		newReview.UpdatedAt,
	).Scan(&newReview.ID, &newReview.CreatedAt, &newReview.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("error inserting new teacher review: %w", err)
	}

	return newReview, nil
}

// UpdateTeacherReview updates an existing teacher review.
func (s *TeacherReviewService) UpdateTeacherReview(reviewID string, req *models.UpdateTeacherReviewRequest) (*models.TeacherReview, error) {
	// For simplicity, this example fetches and then updates.
	// A more optimized version might use a single UPDATE query.

	// First, get the existing review to check for existence
	var existing models.TeacherReview
	err := s.db.QueryRowContext(context.Background(), "SELECT id, submission_id, teacher_id, revised_score, teacher_feedback, created_at, updated_at FROM teacher_reviews WHERE id = $1", reviewID).Scan(
		&existing.ID, &existing.SubmissionID, &existing.TeacherID, &existing.RevisedScore, &existing.TeacherFeedback, &existing.CreatedAt, &existing.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("teacher review not found")
		}
		return nil, fmt.Errorf("error getting teacher review: %w", err)
	}

	// Update fields if provided
	if req.RevisedScore != nil {
		existing.RevisedScore = *req.RevisedScore
	}
	if req.TeacherFeedback != nil {
		existing.TeacherFeedback = req.TeacherFeedback
	}
	existing.UpdatedAt = time.Now()

	query := `
		UPDATE teacher_reviews
		SET revised_score = $1, teacher_feedback = $2, updated_at = $3
		WHERE id = $4
	`
	_, err = s.db.ExecContext(context.Background(),
		query,
		existing.RevisedScore,
		existing.TeacherFeedback,
		existing.UpdatedAt,
		reviewID,
	)

	if err != nil {
		return nil, fmt.Errorf("error updating teacher review: %w", err)
	}

	return &existing, nil
}

// GetTeacherReviewBySubmissionID retrieves a teacher review by its submission ID.
func (s *TeacherReviewService) GetTeacherReviewBySubmissionID(submissionID string) (*models.TeacherReview, error) {
	query := `
		SELECT id, submission_id, teacher_id, revised_score, teacher_feedback, created_at, updated_at
		FROM teacher_reviews
		WHERE submission_id = $1
	`
	var review models.TeacherReview
	err := s.db.QueryRowContext(context.Background(), query, submissionID).Scan(
		&review.ID, &review.SubmissionID, &review.TeacherID, &review.RevisedScore, &review.TeacherFeedback, &review.CreatedAt, &review.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("teacher review not found for submission %s", submissionID)
		}
		return nil, fmt.Errorf("error querying teacher review by submission ID: %w", err)
	}
	return &review, nil
}

func (s *TeacherReviewService) UpsertTeacherReviewsBatch(req *models.BatchTeacherReviewRequest, teacherID string) (*models.BatchTeacherReviewResponse, error) {
	response := &models.BatchTeacherReviewResponse{
		Updated: 0,
		Failed:  []models.BatchTeacherReviewItemError{},
	}
	if req == nil || len(req.Updates) == 0 {
		return response, nil
	}

	for _, item := range req.Updates {
		submissionID := strings.TrimSpace(item.SubmissionID)
		if submissionID == "" {
			response.Failed = append(response.Failed, models.BatchTeacherReviewItemError{
				SubmissionID: item.SubmissionID,
				Message:      "submission_id is required",
			})
			continue
		}
		if item.RevisedScore == nil {
			response.Failed = append(response.Failed, models.BatchTeacherReviewItemError{
				SubmissionID: submissionID,
				Message:      "revised_score is required",
			})
			continue
		}
		if *item.RevisedScore < 0 || *item.RevisedScore > 100 {
			response.Failed = append(response.Failed, models.BatchTeacherReviewItemError{
				SubmissionID: submissionID,
				Message:      "revised_score must be between 0 and 100",
			})
			continue
		}

		feedback := item.TeacherFeedback
		if feedback != nil {
			trimmed := strings.TrimSpace(*feedback)
			feedback = &trimmed
			if trimmed == "" {
				feedback = nil
			}
		}

		_, err := s.db.ExecContext(
			context.Background(),
			`INSERT INTO teacher_reviews (submission_id, teacher_id, revised_score, teacher_feedback, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, NOW(), NOW())
			 ON CONFLICT (submission_id) DO UPDATE
			 SET teacher_id = EXCLUDED.teacher_id,
			     revised_score = EXCLUDED.revised_score,
			     teacher_feedback = EXCLUDED.teacher_feedback,
			     updated_at = NOW()`,
			submissionID,
			teacherID,
			*item.RevisedScore,
			feedback,
		)
		if err != nil {
			response.Failed = append(response.Failed, models.BatchTeacherReviewItemError{
				SubmissionID: submissionID,
				Message:      err.Error(),
			})
			continue
		}
		response.Updated++
	}

	return response, nil
}
