package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"api-backend/internal/models"
)

type notificationSeed struct {
	ExternalKey string
	Category    string
	Title       string
	Message     string
	Href        *string
	EventAt     time.Time
	Payload     map[string]interface{}
}

type NotificationService struct {
	db *sql.DB
}

func NewNotificationService(db *sql.DB) *NotificationService {
	return &NotificationService{db: db}
}

func (s *NotificationService) SyncAndList(userID, role string, limit int) (*models.NotificationFeedResponse, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, fmt.Errorf("user ID is required")
	}
	role = strings.TrimSpace(strings.ToLower(role))
	if role == "" {
		return nil, fmt.Errorf("role is required")
	}
	if limit <= 0 {
		limit = 60
	}

	seeds, err := s.buildSeeds(userID, role)
	if err != nil {
		return nil, err
	}
	if err := s.syncSeeds(userID, role, seeds); err != nil {
		return nil, err
	}
	items, unreadCount, err := s.listNotifications(userID, limit)
	if err != nil {
		return nil, err
	}
	return &models.NotificationFeedResponse{
		Items:       items,
		UnreadCount: unreadCount,
	}, nil
}

func (s *NotificationService) MarkRead(userID string, ids []string) error {
	if strings.TrimSpace(userID) == "" || len(ids) == 0 {
		return nil
	}
	args := make([]interface{}, 0, len(ids)+1)
	placeholders := make([]string, 0, len(ids))
	args = append(args, userID)
	for i, id := range ids {
		args = append(args, id)
		placeholders = append(placeholders, fmt.Sprintf("$%d", i+2))
	}
	query := fmt.Sprintf(
		`UPDATE notifications
		 SET is_read = TRUE, read_at = COALESCE(read_at, NOW()), updated_at = NOW()
		 WHERE user_id = $1 AND id IN (%s)`,
		strings.Join(placeholders, ", "),
	)
	_, err := s.db.ExecContext(context.Background(), query, args...)
	return err
}

func (s *NotificationService) MarkAllRead(userID string) error {
	if strings.TrimSpace(userID) == "" {
		return nil
	}
	_, err := s.db.ExecContext(
		context.Background(),
		`UPDATE notifications
		 SET is_read = TRUE, read_at = COALESCE(read_at, NOW()), updated_at = NOW()
		 WHERE user_id = $1 AND is_active = TRUE AND is_read = FALSE`,
		userID,
	)
	return err
}

func (s *NotificationService) listNotifications(userID string, limit int) ([]models.Notification, int, error) {
	rows, err := s.db.QueryContext(
		context.Background(),
		`SELECT id, user_id, role, external_key, category, title, message, href, payload, is_read, read_at, is_active, event_at, created_at, updated_at
		 FROM notifications
		 WHERE user_id = $1 AND is_active = TRUE
		 ORDER BY is_read ASC, event_at DESC
		 LIMIT $2`,
		userID, limit,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("error listing notifications: %w", err)
	}
	defer rows.Close()

	items := make([]models.Notification, 0, limit)
	for rows.Next() {
		var item models.Notification
		var href sql.NullString
		var payload []byte
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.Role, &item.ExternalKey, &item.Category, &item.Title, &item.Message,
			&href, &payload, &item.IsRead, &item.ReadAt, &item.IsActive, &item.EventAt, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("error scanning notification row: %w", err)
		}
		if href.Valid {
			item.Href = &href.String
		}
		item.Payload = payload
		items = append(items, item)
	}
	var unreadCount int
	if err := s.db.QueryRowContext(
		context.Background(),
		`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_active = TRUE AND is_read = FALSE`,
		userID,
	).Scan(&unreadCount); err != nil {
		return nil, 0, fmt.Errorf("error counting unread notifications: %w", err)
	}
	return items, unreadCount, nil
}

func (s *NotificationService) syncSeeds(userID, role string, seeds []notificationSeed) error {
	tx, err := s.db.BeginTx(context.Background(), nil)
	if err != nil {
		return fmt.Errorf("error starting notifications sync tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.ExecContext(
		context.Background(),
		`UPDATE notifications
		 SET is_active = FALSE, updated_at = NOW()
		 WHERE user_id = $1 AND role = $2 AND is_active = TRUE`,
		userID, role,
	); err != nil {
		return fmt.Errorf("error deactivating notifications: %w", err)
	}

	for _, seed := range seeds {
		payload, _ := json.Marshal(seed.Payload)
		_, err = tx.ExecContext(
			context.Background(),
			`INSERT INTO notifications
			 (user_id, role, external_key, category, title, message, href, payload, is_active, event_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::jsonb, '{}'::jsonb), TRUE, $9, NOW())
			 ON CONFLICT (user_id, external_key) DO UPDATE SET
			     role = EXCLUDED.role,
			     category = EXCLUDED.category,
			     title = EXCLUDED.title,
			     message = EXCLUDED.message,
			     href = EXCLUDED.href,
			     payload = EXCLUDED.payload,
			     is_active = TRUE,
			     event_at = EXCLUDED.event_at,
			     updated_at = NOW()`,
			userID, role, seed.ExternalKey, seed.Category, seed.Title, seed.Message, seed.Href, string(payload), seed.EventAt,
		)
		if err != nil {
			return fmt.Errorf("error upserting notification: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("error committing notifications sync tx: %w", err)
	}
	return nil
}

func (s *NotificationService) buildSeeds(userID, role string) ([]notificationSeed, error) {
	switch role {
	case "student":
		return s.buildStudentSeeds(userID)
	case "teacher":
		return s.buildTeacherSeeds(userID)
	case "superadmin":
		return s.buildSuperadminSeeds(userID)
	default:
		return []notificationSeed{}, nil
	}
}

func stringPtr(value string) *string {
	v := strings.TrimSpace(value)
	if v == "" {
		return nil
	}
	return &v
}

func parseTaskDueAtFromContent(raw sql.NullString) *time.Time {
	if !raw.Valid || strings.TrimSpace(raw.String) == "" {
		return nil
	}
	var parsed struct {
		Format string `json:"format"`
		Items  []struct {
			Type string `json:"type"`
			Meta struct {
				TaskDueAt string `json:"tugas_due_at"`
			} `json:"meta"`
		} `json:"items"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw.String)), &parsed); err != nil {
		return nil
	}
	if parsed.Format != "sage_section_cards_v1" {
		return nil
	}
	var earliest *time.Time
	for _, item := range parsed.Items {
		if strings.TrimSpace(strings.ToLower(item.Type)) != "tugas" {
			continue
		}
		dueText := strings.TrimSpace(item.Meta.TaskDueAt)
		if dueText == "" {
			continue
		}
		parsedDue, err := time.Parse(time.RFC3339, dueText)
		if err != nil {
			if parsedDueLocal, localErr := time.Parse("2006-01-02T15:04", dueText); localErr == nil {
				parsedDue = parsedDueLocal
			} else {
				continue
			}
		}
		if earliest == nil || parsedDue.Before(*earliest) {
			value := parsedDue
			earliest = &value
		}
	}
	return earliest
}

func classifyStudentMembership(requestedAt time.Time, approvedAt sql.NullTime) string {
	if !approvedAt.Valid {
		return ""
	}
	delta := approvedAt.Time.Sub(requestedAt)
	if delta < 10*time.Second && delta > -10*time.Second {
		return "class_invite"
	}
	return "class_approval"
}

func requestTypeLabel(value string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "teacher_verification":
		return "verifikasi akun guru"
	case "profile_change":
		return "perubahan profil"
	default:
		return "approval"
	}
}

func (s *NotificationService) buildStudentSeeds(userID string) ([]notificationSeed, error) {
	seeds := make([]notificationSeed, 0)

	approvalRows, err := s.db.QueryContext(context.Background(),
		`SELECT id, request_type, status, reason, created_at, reviewed_at
		 FROM profile_change_requests
		 WHERE user_id = $1
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("error querying student profile approvals: %w", err)
	}
	defer approvalRows.Close()
	for approvalRows.Next() {
		var id, requestType, status string
		var reason sql.NullString
		var createdAt time.Time
		var reviewedAt sql.NullTime
		if err := approvalRows.Scan(&id, &requestType, &status, &reason, &createdAt, &reviewedAt); err != nil {
			return nil, fmt.Errorf("error scanning student profile approval: %w", err)
		}
		title := "Approval Diproses"
		message := fmt.Sprintf("Permintaan %s kamu sedang diproses admin.", requestTypeLabel(requestType))
		eventAt := createdAt
		switch strings.ToLower(status) {
		case "approved":
			title = "Approval Disetujui"
			message = fmt.Sprintf("Permintaan %s kamu sudah disetujui.", requestTypeLabel(requestType))
			if reviewedAt.Valid {
				eventAt = reviewedAt.Time
			}
		case "rejected":
			title = "Approval Ditolak"
			if reason.Valid && strings.TrimSpace(reason.String) != "" {
				message = fmt.Sprintf("Permintaan %s ditolak: %s", requestTypeLabel(requestType), strings.TrimSpace(reason.String))
			} else {
				message = fmt.Sprintf("Permintaan %s kamu ditolak.", requestTypeLabel(requestType))
			}
			if reviewedAt.Valid {
				eventAt = reviewedAt.Time
			}
		}
		seeds = append(seeds, notificationSeed{
			ExternalKey: fmt.Sprintf("student-profile-%s-%s", id, strings.ToLower(status)),
			Category:    "profile_approval",
			Title:       title,
			Message:     message,
			Href:        stringPtr("/dashboard/student/settings/profile"),
			EventAt:     eventAt,
		})
	}

	announcementRows, err := s.db.QueryContext(context.Background(),
		`SELECT id, title, content, created_at
		 FROM announcements
		 WHERE is_active = TRUE
		   AND target_role IN ('all', 'student')
		   AND (starts_at IS NULL OR starts_at <= NOW())
		   AND (ends_at IS NULL OR ends_at >= NOW())
		 ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("error querying student announcements: %w", err)
	}
	defer announcementRows.Close()
	for announcementRows.Next() {
		var id, title, content string
		var createdAt time.Time
		if err := announcementRows.Scan(&id, &title, &content, &createdAt); err != nil {
			return nil, fmt.Errorf("error scanning student announcement: %w", err)
		}
		seeds = append(seeds, notificationSeed{
			ExternalKey: fmt.Sprintf("student-system-announcement-%s", id),
			Category:    "system_announcement",
			Title:       title,
			Message:     content,
			Href:        stringPtr("/dashboard/student/announcements"),
			EventAt:     createdAt,
		})
	}

	classRows, err := s.db.QueryContext(context.Background(),
		`SELECT c.id, c.class_name, u.nama_lengkap, cm.requested_at, cm.approved_at,
		        c.announcement_title, c.announcement_content, c.announcement_enabled,
		        c.announcement_starts_at, c.announcement_ends_at
		 FROM class_members cm
		 JOIN classes c ON c.id = cm.class_id
		 JOIN users u ON u.id = c.teacher_id
		 WHERE cm.user_id = $1
		   AND cm.status = 'approved'
		   AND c.is_archived = FALSE`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("error querying student classes: %w", err)
	}
	defer classRows.Close()

	classIDs := make([]string, 0)
	for classRows.Next() {
		var classID, className, teacherName, annTitle, annContent string
		var requestedAt time.Time
		var approvedAt, annStartsAt, annEndsAt sql.NullTime
		var annEnabled bool
		if err := classRows.Scan(
			&classID, &className, &teacherName, &requestedAt, &approvedAt,
			&annTitle, &annContent, &annEnabled, &annStartsAt, &annEndsAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning student class notification seed: %w", err)
		}
		classIDs = append(classIDs, classID)
		category := classifyStudentMembership(requestedAt, approvedAt)
		if approvedAt.Valid && category != "" {
			title := "ACC Masuk Kelas"
			message := fmt.Sprintf("Permintaan masuk kamu ke kelas %s sudah disetujui.", className)
			if category == "class_invite" {
				title = "Diundang ke Kelas"
				message = fmt.Sprintf("Kamu diundang masuk ke kelas %s oleh %s.", className, teacherName)
			}
			seeds = append(seeds, notificationSeed{
				ExternalKey: fmt.Sprintf("student-membership-%s-%s", classID, category),
				Category:    category,
				Title:       title,
				Message:     message,
				Href:        stringPtr("/dashboard/student/my-classes"),
				EventAt:     approvedAt.Time,
			})
		}
		if annEnabled && strings.TrimSpace(annTitle) != "" && strings.TrimSpace(annContent) != "" {
			now := time.Now()
			if (!annStartsAt.Valid || !now.Before(annStartsAt.Time)) && (!annEndsAt.Valid || !now.After(annEndsAt.Time)) {
				eventAt := now
				if annStartsAt.Valid {
					eventAt = annStartsAt.Time
				}
				seeds = append(seeds, notificationSeed{
					ExternalKey: fmt.Sprintf("student-class-announcement-%s-%s", classID, strings.TrimSpace(annTitle)),
					Category:    "class_announcement",
					Title:       annTitle,
					Message:     fmt.Sprintf("%s: %s", className, annContent),
					Href:        stringPtr(fmt.Sprintf("/dashboard/student/classes/%s", classID)),
					EventAt:     eventAt,
				})
			}
		}
	}

	materialRows, err := s.db.QueryContext(context.Background(),
		`SELECT m.id, m.class_id, c.class_name, m.judul, m.updated_at, m.created_at, m.isi_materi,
		        COALESCE(q.question_count, 0) AS question_count
		 FROM class_members cm
		 JOIN classes c ON c.id = cm.class_id
		 JOIN materials m ON m.class_id = c.id
		 LEFT JOIN (
		     SELECT material_id, COUNT(*) AS question_count
		     FROM essay_questions
		     GROUP BY material_id
		 ) q ON q.material_id = m.id
		 WHERE cm.user_id = $1
		   AND cm.status = 'approved'
		   AND c.is_archived = FALSE`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("error querying student materials: %w", err)
	}
	defer materialRows.Close()
	for materialRows.Next() {
		var materialID, classID, className, title string
		var updatedAt, createdAt time.Time
		var isiMateri sql.NullString
		var questionCount int
		if err := materialRows.Scan(&materialID, &classID, &className, &title, &updatedAt, &createdAt, &isiMateri, &questionCount); err != nil {
			return nil, fmt.Errorf("error scanning student material notification seed: %w", err)
		}
		eventAt := updatedAt
		if eventAt.IsZero() {
			eventAt = createdAt
		}
		seeds = append(seeds, notificationSeed{
			ExternalKey: fmt.Sprintf("student-material-%s-%d", materialID, eventAt.Unix()),
			Category:    "material_update",
			Title:       "Materi Baru / Diperbarui",
			Message:     fmt.Sprintf("%s di %s memiliki update terbaru.", title, className),
			Href:        stringPtr("/dashboard/student/assignments"),
			EventAt:     eventAt,
		})
		if questionCount > 0 {
			seeds = append(seeds, notificationSeed{
				ExternalKey: fmt.Sprintf("student-question-%s-%d", materialID, questionCount),
				Category:    "question_new",
				Title:       "Soal Baru",
				Message:     fmt.Sprintf("%d soal tersedia di %s (%s).", questionCount, title, className),
				Href:        stringPtr("/dashboard/student/assignments"),
				EventAt:     eventAt,
			})
		}
		if dueAt := parseTaskDueAtFromContent(isiMateri); dueAt != nil {
			diff := dueAt.Sub(time.Now())
			category := ""
			titleText := ""
			message := ""
			if diff < 0 {
				category = "task_overdue"
				titleText = "Tugas Lewat Deadline"
				message = fmt.Sprintf("%s di %s sudah melewati tenggat.", title, className)
			} else if diff <= 24*time.Hour {
				category = "task_due_soon"
				titleText = "Deadline Tugas Mendekat"
				message = fmt.Sprintf("%s di %s jatuh tempo kurang dari 24 jam.", title, className)
			}
			if category != "" {
				seeds = append(seeds, notificationSeed{
					ExternalKey: fmt.Sprintf("student-task-deadline-%s-%s", materialID, category),
					Category:    category,
					Title:       titleText,
					Message:     message,
					Href:        stringPtr("/dashboard/student/assignments"),
					EventAt:     *dueAt,
				})
			}
		}
	}

	submissionRows, err := s.db.QueryContext(context.Background(),
		`SELECT es.id, es.submitted_at, es.ai_grading_status, es.ai_graded_at, tr.revised_score, tr.teacher_feedback,
		        m.judul, c.class_name, tr.updated_at
		 FROM essay_submissions es
		 JOIN essay_questions eq ON eq.id = es.soal_id
		 JOIN materials m ON m.id = eq.material_id
		 JOIN classes c ON c.id = m.class_id
		 LEFT JOIN teacher_reviews tr ON tr.submission_id = es.id
		 WHERE es.siswa_id = $1`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("error querying student submissions: %w", err)
	}
	defer submissionRows.Close()
	for submissionRows.Next() {
		var submissionID, aiStatus, materialTitle, className string
		var submittedAt time.Time
		var aiGradedAt, reviewUpdatedAt sql.NullTime
		var revisedScore sql.NullFloat64
		var teacherFeedback sql.NullString
		if err := submissionRows.Scan(
			&submissionID, &submittedAt, &aiStatus, &aiGradedAt, &revisedScore, &teacherFeedback, &materialTitle, &className, &reviewUpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning student submission notification seed: %w", err)
		}
		if strings.EqualFold(aiStatus, "completed") {
			eventAt := submittedAt
			if aiGradedAt.Valid {
				eventAt = aiGradedAt.Time
			}
			seeds = append(seeds, notificationSeed{
				ExternalKey: fmt.Sprintf("student-ai-graded-%s", submissionID),
				Category:    "ai_graded",
				Title:       "Penilaian AI Selesai",
				Message:     fmt.Sprintf("Jawabanmu di %s (%s) sudah selesai dinilai AI.", materialTitle, className),
				Href:        stringPtr("/dashboard/student/grades"),
				EventAt:     eventAt,
			})
		}
		if revisedScore.Valid || strings.TrimSpace(teacherFeedback.String) != "" {
			eventAt := submittedAt
			if reviewUpdatedAt.Valid {
				eventAt = reviewUpdatedAt.Time
			}
			seeds = append(seeds, notificationSeed{
				ExternalKey: fmt.Sprintf("student-review-%s", submissionID),
				Category:    "teacher_review",
				Title:       "Nilai Direview Guru",
				Message:     fmt.Sprintf("Guru sudah mereview jawabanmu di %s (%s).", materialTitle, className),
				Href:        stringPtr("/dashboard/student/grades"),
				EventAt:     eventAt,
			})
		}
	}

	appealRows, err := s.db.QueryContext(context.Background(),
		`SELECT ga.id, ga.status, ga.created_at, ga.updated_at, c.class_name, COALESCE(eq.teks_soal, '')
		 FROM grade_appeals ga
		 JOIN classes c ON c.id = ga.class_id
		 JOIN essay_questions eq ON eq.id = ga.question_id
		 WHERE ga.student_id = $1`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("error querying student appeals: %w", err)
	}
	defer appealRows.Close()
	for appealRows.Next() {
		var id, status, className, questionText string
		var createdAt, updatedAt time.Time
		if err := appealRows.Scan(&id, &status, &createdAt, &updatedAt, &className, &questionText); err != nil {
			return nil, fmt.Errorf("error scanning student appeal notification seed: %w", err)
		}
		title := "Update Banding Nilai"
		switch strings.ToLower(status) {
		case "open":
			title = "Banding Nilai Terkirim"
		case "in_review":
			title = "Banding Sedang Direview"
		case "resolved_accepted":
			title = "Banding Diterima"
		case "resolved_rejected":
			title = "Banding Ditolak"
		}
		seeds = append(seeds, notificationSeed{
			ExternalKey: fmt.Sprintf("student-appeal-%s-%s", id, strings.ToLower(status)),
			Category:    "appeal_update",
			Title:       title,
			Message:     fmt.Sprintf("%s di %s berstatus %s.", questionText, className, strings.ToLower(status)),
			Href:        stringPtr("/dashboard/student/grades"),
			EventAt:     updatedAt,
		})
	}

	return seeds, nil
}

func (s *NotificationService) buildTeacherSeeds(userID string) ([]notificationSeed, error) {
	seeds := make([]notificationSeed, 0)

	classRequestRows, err := s.db.QueryContext(context.Background(),
		`SELECT cm.id, cm.requested_at, u.nama_lengkap, c.class_name
		 FROM class_members cm
		 JOIN classes c ON c.id = cm.class_id
		 JOIN users u ON u.id = cm.user_id
		 WHERE c.teacher_id = $1
		   AND c.is_archived = FALSE
		   AND cm.status = 'pending'
		 ORDER BY cm.requested_at ASC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("error querying teacher class requests: %w", err)
	}
	defer classRequestRows.Close()
	for classRequestRows.Next() {
		var id, studentName, className string
		var requestedAt time.Time
		if err := classRequestRows.Scan(&id, &requestedAt, &studentName, &className); err != nil {
			return nil, fmt.Errorf("error scanning teacher class request seed: %w", err)
		}
		seeds = append(seeds, notificationSeed{
			ExternalKey: fmt.Sprintf("teacher-join-request-%s", id),
			Category:    "class_request",
			Title:       "Join Request Baru",
			Message:     fmt.Sprintf("%s meminta bergabung ke %s.", studentName, className),
			Href:        stringPtr("/dashboard/teacher/classes"),
			EventAt:     requestedAt,
		})
	}

	assessmentRows, err := s.db.QueryContext(context.Background(),
		`SELECT es.id, es.submitted_at, u.nama_lengkap, m.judul, c.class_name
		 FROM essay_submissions es
		 JOIN users u ON u.id = es.siswa_id
		 JOIN essay_questions eq ON eq.id = es.soal_id
		 JOIN materials m ON m.id = eq.material_id
		 JOIN classes c ON c.id = m.class_id
		 LEFT JOIN teacher_reviews tr ON tr.submission_id = es.id
		 WHERE c.teacher_id = $1
		   AND c.is_archived = FALSE
		   AND tr.id IS NULL`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("error querying teacher assessments: %w", err)
	}
	defer assessmentRows.Close()
	for assessmentRows.Next() {
		var submissionID, studentName, materialTitle, className string
		var submittedAt time.Time
		if err := assessmentRows.Scan(&submissionID, &submittedAt, &studentName, &materialTitle, &className); err != nil {
			return nil, fmt.Errorf("error scanning teacher assessment seed: %w", err)
		}
		seeds = append(seeds, notificationSeed{
			ExternalKey: fmt.Sprintf("teacher-assessment-%s", submissionID),
			Category:    "assessment_update",
			Title:       "Submission Perlu Review",
			Message:     fmt.Sprintf("%s mengirim jawaban di %s (%s).", studentName, materialTitle, className),
			Href:        stringPtr("/dashboard/teacher/penilaian"),
			EventAt:     submittedAt,
		})
	}

	appealRows, err := s.db.QueryContext(context.Background(),
		`SELECT ga.id, ga.updated_at, u.nama_lengkap, c.class_name, COALESCE(eq.teks_soal, '')
		 FROM grade_appeals ga
		 JOIN users u ON u.id = ga.student_id
		 JOIN classes c ON c.id = ga.class_id
		 JOIN essay_questions eq ON eq.id = ga.question_id
		 WHERE c.teacher_id = $1
		   AND ga.status IN ('open', 'in_review')`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("error querying teacher appeals: %w", err)
	}
	defer appealRows.Close()
	for appealRows.Next() {
		var id, studentName, className, questionText string
		var updatedAt time.Time
		if err := appealRows.Scan(&id, &updatedAt, &studentName, &className, &questionText); err != nil {
			return nil, fmt.Errorf("error scanning teacher appeal seed: %w", err)
		}
		seeds = append(seeds, notificationSeed{
			ExternalKey: fmt.Sprintf("teacher-appeal-%s", id),
			Category:    "appeal_request",
			Title:       "Banding Nilai Baru",
			Message:     fmt.Sprintf("%s mengajukan banding pada %s di %s.", studentName, questionText, className),
			Href:        stringPtr("/dashboard/teacher/penilaian"),
			EventAt:     updatedAt,
		})
	}

	profileRows, err := s.db.QueryContext(context.Background(),
		`SELECT id, request_type, status, reason, created_at, reviewed_at
		 FROM profile_change_requests
		 WHERE user_id = $1
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("error querying teacher profile approvals: %w", err)
	}
	defer profileRows.Close()
	for profileRows.Next() {
		var id, requestType, status string
		var reason sql.NullString
		var createdAt time.Time
		var reviewedAt sql.NullTime
		if err := profileRows.Scan(&id, &requestType, &status, &reason, &createdAt, &reviewedAt); err != nil {
			return nil, fmt.Errorf("error scanning teacher profile approval seed: %w", err)
		}
		title := "Approval Profil Diproses"
		message := fmt.Sprintf("Permintaan %s kamu sedang diproses admin.", requestTypeLabel(requestType))
		eventAt := createdAt
		switch strings.ToLower(status) {
		case "approved":
			title = "Approval Profil Disetujui"
			message = fmt.Sprintf("Permintaan %s kamu sudah disetujui admin.", requestTypeLabel(requestType))
			if reviewedAt.Valid {
				eventAt = reviewedAt.Time
			}
		case "rejected":
			title = "Approval Profil Ditolak"
			if reason.Valid && strings.TrimSpace(reason.String) != "" {
				message = fmt.Sprintf("Permintaan %s ditolak: %s", requestTypeLabel(requestType), strings.TrimSpace(reason.String))
			} else {
				message = fmt.Sprintf("Permintaan %s kamu ditolak admin.", requestTypeLabel(requestType))
			}
			if reviewedAt.Valid {
				eventAt = reviewedAt.Time
			}
		}
		seeds = append(seeds, notificationSeed{
			ExternalKey: fmt.Sprintf("teacher-profile-%s-%s", id, strings.ToLower(status)),
			Category:    "profile_approval",
			Title:       title,
			Message:     message,
			Href:        stringPtr("/dashboard/teacher/settings/profile"),
			EventAt:     eventAt,
		})
	}

	systemAnnouncementRows, err := s.db.QueryContext(context.Background(),
		`SELECT id, title, content, created_at
		 FROM announcements
		 WHERE is_active = TRUE
		   AND target_role IN ('all', 'teacher')
		   AND (starts_at IS NULL OR starts_at <= NOW())
		   AND (ends_at IS NULL OR ends_at >= NOW())
		 ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("error querying teacher system announcements: %w", err)
	}
	defer systemAnnouncementRows.Close()
	for systemAnnouncementRows.Next() {
		var id, title, content string
		var createdAt time.Time
		if err := systemAnnouncementRows.Scan(&id, &title, &content, &createdAt); err != nil {
			return nil, fmt.Errorf("error scanning teacher system announcement seed: %w", err)
		}
		seeds = append(seeds, notificationSeed{
			ExternalKey: fmt.Sprintf("teacher-system-announcement-%s", id),
			Category:    "system_announcement",
			Title:       title,
			Message:     content,
			Href:        stringPtr("/dashboard/teacher"),
			EventAt:     createdAt,
		})
	}

	classAnnouncementRows, err := s.db.QueryContext(context.Background(),
		`SELECT id, class_name, announcement_title, announcement_content, announcement_starts_at, updated_at
		 FROM classes
		 WHERE teacher_id = $1
		   AND is_archived = FALSE
		   AND announcement_enabled = TRUE
		   AND announcement_title <> ''
		   AND announcement_content <> ''
		   AND (announcement_starts_at IS NULL OR announcement_starts_at <= NOW())
		   AND (announcement_ends_at IS NULL OR announcement_ends_at >= NOW())`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("error querying teacher class announcements: %w", err)
	}
	defer classAnnouncementRows.Close()
	for classAnnouncementRows.Next() {
		var classID, className, title, content string
		var startsAt, updatedAt sql.NullTime
		if err := classAnnouncementRows.Scan(&classID, &className, &title, &content, &startsAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("error scanning teacher class announcement seed: %w", err)
		}
		eventAt := time.Now()
		if startsAt.Valid {
			eventAt = startsAt.Time
		} else if updatedAt.Valid {
			eventAt = updatedAt.Time
		}
		seeds = append(seeds, notificationSeed{
			ExternalKey: fmt.Sprintf("teacher-class-announcement-%s-%s", classID, title),
			Category:    "class_announcement",
			Title:       title,
			Message:     fmt.Sprintf("%s: %s", className, content),
			Href:        stringPtr(fmt.Sprintf("/dashboard/teacher/class/%s", classID)),
			EventAt:     eventAt,
		})
	}

	return seeds, nil
}

func (s *NotificationService) buildSuperadminSeeds(_ string) ([]notificationSeed, error) {
	seeds := make([]notificationSeed, 0)

	profileRows, err := s.db.QueryContext(context.Background(),
		`SELECT id, COALESCE(user_name, 'User'), COALESCE(user_role, '-'), COALESCE(request_type, 'profile_change'), created_at
		 FROM (
		     SELECT pcr.id, u.nama_lengkap AS user_name, u.peran AS user_role, pcr.request_type, pcr.created_at
		     FROM profile_change_requests pcr
		     JOIN users u ON u.id = pcr.user_id
		     WHERE pcr.status = 'pending'
		 ) rows
		 ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("error querying superadmin profile requests: %w", err)
	}
	defer profileRows.Close()
	for profileRows.Next() {
		var id, userName, userRole, requestType string
		var createdAt time.Time
		if err := profileRows.Scan(&id, &userName, &userRole, &requestType, &createdAt); err != nil {
			return nil, fmt.Errorf("error scanning superadmin profile request seed: %w", err)
		}
		seeds = append(seeds, notificationSeed{
			ExternalKey: fmt.Sprintf("superadmin-profile-%s", id),
			Category:    "approval_request",
			Title:       "Approval Pending",
			Message:     fmt.Sprintf("%s (%s) menunggu approval (%s).", userName, userRole, requestType),
			Href:        stringPtr("/dashboard/superadmin/profile-requests?status=pending"),
			EventAt:     createdAt,
		})
	}

	var failedCount, totalCount int64
	if err := s.db.QueryRowContext(
		context.Background(),
		`SELECT
		     COALESCE(SUM(CASE WHEN ai_grading_status = 'failed' THEN 1 ELSE 0 END), 0),
		     COUNT(*)
		 FROM essay_submissions
		 WHERE submitted_at >= NOW() - INTERVAL '7 day'`,
	).Scan(&failedCount, &totalCount); err == nil && totalCount > 0 {
		failedRate := (float64(failedCount) / float64(totalCount)) * 100
		if failedRate >= 10 {
			level := "warning"
			if failedRate >= 20 {
				level = "critical"
			}
			seeds = append(seeds, notificationSeed{
				ExternalKey: fmt.Sprintf("superadmin-anomaly-ai-failed-rate-%s", level),
				Category:    "anomaly_alert",
				Title:       "AI failed rate tinggi",
				Message:     fmt.Sprintf("Gagal grading %.1f%% (%d/%d) dalam 7 hari terakhir.", failedRate, failedCount, totalCount),
				Href:        stringPtr("/dashboard/superadmin/monitoring"),
				EventAt:     time.Now(),
				Payload: map[string]interface{}{
					"level": level,
					"value": failedRate,
				},
			})
		}
	}

	var queuedCount int64
	if err := s.db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM essay_submissions WHERE ai_grading_status = 'queued'`).Scan(&queuedCount); err == nil && queuedCount >= 1000 {
		seeds = append(seeds, notificationSeed{
			ExternalKey: "superadmin-anomaly-ai-queue-high",
			Category:    "anomaly_alert",
			Title:       "Queue grading tinggi",
			Message:     fmt.Sprintf("Terdapat %d submission dalam antrean grading AI.", queuedCount),
			Href:        stringPtr("/dashboard/superadmin/queue-monitor"),
			EventAt:     time.Now(),
			Payload: map[string]interface{}{
				"queued_count": queuedCount,
			},
		})
	}

	return seeds, nil
}
