package services

import (
	"api-backend/internal/models"
	"context"
	"database/sql"
	"fmt"
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
		SubmissionID:   req.SubmissionID,
		TeacherID:      teacherID,
		RevisedScore:   req.RevisedScore,
		TeacherFeedback: req.TeacherFeedback,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
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
