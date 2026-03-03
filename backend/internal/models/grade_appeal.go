package models

import "time"

type GradeAppeal struct {
	ID              string     `json:"id"`
	SubmissionID    string     `json:"submission_id"`
	QuestionID      string     `json:"question_id"`
	ClassID         string     `json:"class_id"`
	StudentID       string     `json:"student_id"`
	ReasonType      string     `json:"reason_type"`
	ReasonText      string     `json:"reason_text"`
	AttachmentURL   *string    `json:"attachment_url,omitempty"`
	Status          string     `json:"status"`
	TeacherResponse *string    `json:"teacher_response,omitempty"`
	ResolvedBy      *string    `json:"resolved_by,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	ResolvedAt      *time.Time `json:"resolved_at,omitempty"`
}

type GradeAppealView struct {
	GradeAppeal
	ClassName     *string  `json:"class_name,omitempty"`
	MaterialID    *string  `json:"material_id,omitempty"`
	MaterialTitle *string  `json:"material_title,omitempty"`
	QuestionText  *string  `json:"question_text,omitempty"`
	StudentName   *string  `json:"student_name,omitempty"`
	StudentEmail  *string  `json:"student_email,omitempty"`
	AIScore       *float64 `json:"ai_score,omitempty"`
	RevisedScore  *float64 `json:"revised_score,omitempty"`
}

type CreateGradeAppealRequest struct {
	SubmissionID  string  `json:"submission_id"`
	ReasonType    string  `json:"reason_type"`
	ReasonText    string  `json:"reason_text"`
	AttachmentURL *string `json:"attachment_url,omitempty"`
}

type ReviewGradeAppealRequest struct {
	Status          string   `json:"status"`
	TeacherResponse *string  `json:"teacher_response,omitempty"`
	RevisedScore    *float64 `json:"revised_score,omitempty"`
	TeacherFeedback *string  `json:"teacher_feedback,omitempty"`
}
