package models

import (
	"time"
)

// TeacherReview represents a teacher's review of a student's essay submission.
type TeacherReview struct {
	ID             string    `json:"id"`
	SubmissionID   string    `json:"submission_id"`
	TeacherID      string    `json:"teacher_id"`
	RevisedScore   float64   `json:"revised_score"`
	TeacherFeedback *string  `json:"teacher_feedback,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// CreateTeacherReviewRequest defines the structure for a request to create a new teacher review.
type CreateTeacherReviewRequest struct {
	SubmissionID   string  `json:"submission_id"`
	RevisedScore   float64 `json:"revised_score"`
	TeacherFeedback *string `json:"teacher_feedback,omitempty"`
}

// UpdateTeacherReviewRequest defines the structure for a request to update an existing teacher review.
type UpdateTeacherReviewRequest struct {
	RevisedScore   *float64 `json:"revised_score,omitempty"`
	TeacherFeedback *string  `json:"teacher_feedback,omitempty"`
}
