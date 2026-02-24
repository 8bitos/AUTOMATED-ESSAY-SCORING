package models

import "time"

type AdminQueueSummary struct {
	Queued     int64 `json:"queued"`
	Processing int64 `json:"processing"`
	Completed  int64 `json:"completed"`
	Failed     int64 `json:"failed"`
	Total      int64 `json:"total"`
}

type AdminQueueJob struct {
	SubmissionID    string     `json:"submission_id"`
	QuestionID      string     `json:"question_id"`
	QuestionText    string     `json:"question_text"`
	StudentID       string     `json:"student_id"`
	StudentName     string     `json:"student_name"`
	ClassID         string     `json:"class_id"`
	ClassName       string     `json:"class_name"`
	MaterialID      string     `json:"material_id"`
	MaterialTitle   string     `json:"material_title"`
	Status          string     `json:"status"`
	GradingError    *string    `json:"grading_error,omitempty"`
	SubmittedAt     time.Time  `json:"submitted_at"`
	AIGradedAt      *time.Time `json:"ai_graded_at,omitempty"`
	Score           *float64   `json:"score,omitempty"`
	FeedbackPreview *string    `json:"feedback_preview,omitempty"`
}

type AdminQueueJobListResponse struct {
	Items []AdminQueueJob `json:"items"`
	Total int64           `json:"total"`
	Page  int             `json:"page"`
	Size  int             `json:"size"`
}

type RetryQueueItemResult struct {
	SubmissionID string `json:"submission_id"`
	Status       string `json:"status"`
	Message      string `json:"message,omitempty"`
}

type RetryQueueResponse struct {
	Accepted int                    `json:"accepted"`
	Skipped  int                    `json:"skipped"`
	Details  []RetryQueueItemResult `json:"details"`
}
