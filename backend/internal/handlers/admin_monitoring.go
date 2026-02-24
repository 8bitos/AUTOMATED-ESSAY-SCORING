package handlers

import (
	"api-backend/internal/models"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

func decodeReasonPayload(r *http.Request) (string, error) {
	var payload struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return "", fmt.Errorf("invalid request body")
	}
	reason := strings.TrimSpace(payload.Reason)
	if reason == "" {
		return "", fmt.Errorf("reason is required")
	}
	return reason, nil
}

func parsePageSizeWithMaxTen(r *http.Request) (int, int, error) {
	page := 1
	size := 10
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 {
			return 0, 0, fmt.Errorf("invalid page")
		}
		page = parsed
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("size")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 {
			return 0, 0, fmt.Errorf("invalid size")
		}
		size = parsed
	}
	if size > 10 {
		size = 10
	}
	return page, size, nil
}

func (h *AdminOpsHandlers) AdminMonitoringSubmissionsHandler(w http.ResponseWriter, r *http.Request) {
	page, size, err := parsePageSizeWithMaxTen(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	classID := strings.TrimSpace(r.URL.Query().Get("class_id"))

	clauses := []string{}
	args := []interface{}{}
	argPos := 1
	if q != "" {
		clauses = append(clauses, fmt.Sprintf("(u.nama_lengkap ILIKE $%d OR c.class_name ILIKE $%d OR m.judul ILIKE $%d OR eq.teks_soal ILIKE $%d)", argPos, argPos, argPos, argPos))
		args = append(args, "%"+q+"%")
		argPos++
	}
	if status != "" {
		clauses = append(clauses, fmt.Sprintf("es.ai_grading_status = $%d", argPos))
		args = append(args, status)
		argPos++
	}
	if classID != "" {
		clauses = append(clauses, fmt.Sprintf("c.id = $%d", argPos))
		args = append(args, classID)
		argPos++
	}
	where := ""
	if len(clauses) > 0 {
		where = " WHERE " + strings.Join(clauses, " AND ")
	}

	baseFrom := `
		FROM essay_submissions es
		JOIN users u ON u.id = es.siswa_id
		JOIN essay_questions eq ON eq.id = es.soal_id
		JOIN materials m ON m.id = eq.material_id
		JOIN classes c ON c.id = m.class_id
		LEFT JOIN ai_results ar ON ar.submission_id = es.id
	`

	var total int64
	if err := h.DB.QueryRow("SELECT COUNT(*) "+baseFrom+where, args...).Scan(&total); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to count submissions")
		return
	}

	offset := (page - 1) * size
	query := `
		SELECT
			es.id, es.submitted_at, es.ai_grading_status, es.ai_grading_error,
			u.id, u.nama_lengkap,
			c.id, c.class_name,
			m.id, m.judul,
			eq.id, eq.teks_soal,
			ar.skor_ai
	` + baseFrom + where + fmt.Sprintf(` ORDER BY es.submitted_at DESC LIMIT $%d OFFSET $%d`, argPos, argPos+1)
	rows, err := h.DB.Query(query, append(args, size, offset)...)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load submissions")
		return
	}
	defer rows.Close()

	items := make([]map[string]interface{}, 0)
	for rows.Next() {
		var (
			submissionID, studentID, studentName, clsID, clsName, materialID, materialTitle, questionID, questionText, gradingStatus string
			submittedAt                                                                                                              time.Time
			gradingErr                                                                                                               sql.NullString
			score                                                                                                                    sql.NullFloat64
		)
		if err := rows.Scan(
			&submissionID, &submittedAt, &gradingStatus, &gradingErr,
			&studentID, &studentName, &clsID, &clsName, &materialID, &materialTitle, &questionID, &questionText, &score,
		); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to parse submissions")
			return
		}
		row := map[string]interface{}{
			"submission_id":  submissionID,
			"submitted_at":   submittedAt,
			"status":         gradingStatus,
			"student_id":     studentID,
			"student_name":   studentName,
			"class_id":       clsID,
			"class_name":     clsName,
			"material_id":    materialID,
			"material_title": materialTitle,
			"question_id":    questionID,
			"question_text":  questionText,
		}
		if gradingErr.Valid {
			row["grading_error"] = gradingErr.String
		}
		if score.Valid {
			row["score"] = score.Float64
		}
		items = append(items, row)
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"items":    items,
		"total":    total,
		"page":     page,
		"size":     size,
		"has_next": int64(page*size) < total,
	})
}

func (h *AdminOpsHandlers) AdminMonitoringClassesHandler(w http.ResponseWriter, r *http.Request) {
	page, size, err := parsePageSizeWithMaxTen(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))

	clauses := []string{}
	args := []interface{}{}
	argPos := 1
	if q != "" {
		clauses = append(clauses, fmt.Sprintf("(c.class_name ILIKE $%d OR COALESCE(c.deskripsi,'') ILIKE $%d OR u.nama_lengkap ILIKE $%d)", argPos, argPos, argPos))
		args = append(args, "%"+q+"%")
		argPos++
	}
	where := ""
	if len(clauses) > 0 {
		where = " WHERE " + strings.Join(clauses, " AND ")
	}

	baseFrom := ` FROM classes c JOIN users u ON u.id = c.teacher_id `
	var total int64
	if err := h.DB.QueryRow("SELECT COUNT(*)"+baseFrom+where, args...).Scan(&total); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to count classes")
		return
	}
	offset := (page - 1) * size
	query := `
		SELECT c.id, c.class_name, c.deskripsi, c.class_code, c.is_archived, c.created_at, u.id, u.nama_lengkap
	` + baseFrom + where + fmt.Sprintf(` ORDER BY c.created_at DESC LIMIT $%d OFFSET $%d`, argPos, argPos+1)
	rows, err := h.DB.Query(query, append(args, size, offset)...)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load classes")
		return
	}
	defer rows.Close()
	items := make([]map[string]interface{}, 0)
	for rows.Next() {
		var (
			id, className, description, classCode, teacherID, teacherName string
			isArchived                                                    bool
			createdAt                                                     time.Time
		)
		if err := rows.Scan(&id, &className, &description, &classCode, &isArchived, &createdAt, &teacherID, &teacherName); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to parse classes")
			return
		}
		items = append(items, map[string]interface{}{
			"id":           id,
			"class_name":   className,
			"description":  description,
			"class_code":   classCode,
			"is_archived":  isArchived,
			"created_at":   createdAt,
			"teacher_id":   teacherID,
			"teacher_name": teacherName,
		})
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"items":    items,
		"total":    total,
		"page":     page,
		"size":     size,
		"has_next": int64(page*size) < total,
	})
}

func (h *AdminOpsHandlers) AdminMonitoringMaterialsHandler(w http.ResponseWriter, r *http.Request) {
	page, size, err := parsePageSizeWithMaxTen(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	classID := strings.TrimSpace(r.URL.Query().Get("class_id"))

	clauses := []string{}
	args := []interface{}{}
	argPos := 1
	if q != "" {
		clauses = append(clauses, fmt.Sprintf("(m.judul ILIKE $%d OR COALESCE(m.isi_materi,'') ILIKE $%d OR c.class_name ILIKE $%d)", argPos, argPos, argPos))
		args = append(args, "%"+q+"%")
		argPos++
	}
	if classID != "" {
		clauses = append(clauses, fmt.Sprintf("c.id = $%d", argPos))
		args = append(args, classID)
		argPos++
	}
	where := ""
	if len(clauses) > 0 {
		where = " WHERE " + strings.Join(clauses, " AND ")
	}

	baseFrom := ` FROM materials m JOIN classes c ON c.id = m.class_id JOIN users u ON u.id = m.uploader_id `
	var total int64
	if err := h.DB.QueryRow("SELECT COUNT(*)"+baseFrom+where, args...).Scan(&total); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to count materials")
		return
	}
	offset := (page - 1) * size
	query := `
		SELECT m.id, m.judul, 'materi'::text AS material_type, m.created_at, c.id, c.class_name, u.id, u.nama_lengkap
	` + baseFrom + where + fmt.Sprintf(` ORDER BY m.created_at DESC LIMIT $%d OFFSET $%d`, argPos, argPos+1)
	rows, err := h.DB.Query(query, append(args, size, offset)...)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load materials")
		return
	}
	defer rows.Close()
	items := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, title, materialType, clsID, clsName, uploaderID, uploaderName string
		var createdAt time.Time
		if err := rows.Scan(&id, &title, &materialType, &createdAt, &clsID, &clsName, &uploaderID, &uploaderName); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to parse materials")
			return
		}
		items = append(items, map[string]interface{}{
			"id":            id,
			"title":         title,
			"material_type": materialType,
			"created_at":    createdAt,
			"class_id":      clsID,
			"class_name":    clsName,
			"uploader_id":   uploaderID,
			"uploader_name": uploaderName,
		})
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"items":    items,
		"total":    total,
		"page":     page,
		"size":     size,
		"has_next": int64(page*size) < total,
	})
}

func (h *AdminOpsHandlers) AdminMonitoringQuestionBankHandler(w http.ResponseWriter, r *http.Request) {
	page, size, err := parsePageSizeWithMaxTen(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	classID := strings.TrimSpace(r.URL.Query().Get("class_id"))

	clauses := []string{}
	args := []interface{}{}
	argPos := 1
	if q != "" {
		clauses = append(clauses, fmt.Sprintf("(qb.teks_soal ILIKE $%d OR COALESCE(c.class_name,'') ILIKE $%d OR COALESCE(qb.subject,'') ILIKE $%d)", argPos, argPos, argPos))
		args = append(args, "%"+q+"%")
		argPos++
	}
	if classID != "" {
		clauses = append(clauses, fmt.Sprintf("qb.class_id = $%d", argPos))
		args = append(args, classID)
		argPos++
	}
	where := ""
	if len(clauses) > 0 {
		where = " WHERE " + strings.Join(clauses, " AND ")
	}
	baseFrom := ` FROM question_bank_entries qb LEFT JOIN classes c ON c.id = qb.class_id `
	var total int64
	if err := h.DB.QueryRow("SELECT COUNT(*)"+baseFrom+where, args...).Scan(&total); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to count question bank entries")
		return
	}
	offset := (page - 1) * size
	query := `
		SELECT qb.id, qb.teks_soal, COALESCE(c.class_name,''), COALESCE(qb.subject,''), qb.created_by::text, qb.updated_at
	` + baseFrom + where + fmt.Sprintf(` ORDER BY qb.updated_at DESC LIMIT $%d OFFSET $%d`, argPos, argPos+1)
	rows, err := h.DB.Query(query, append(args, size, offset)...)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load question bank entries")
		return
	}
	defer rows.Close()
	items := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, text, clsName, subject, createdBy string
		var updatedAt time.Time
		if err := rows.Scan(&id, &text, &clsName, &subject, &createdBy, &updatedAt); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to parse question bank entries")
			return
		}
		items = append(items, map[string]interface{}{
			"id":         id,
			"teks_soal":  text,
			"class_name": clsName,
			"subject":    subject,
			"created_by": createdBy,
			"updated_at": updatedAt,
		})
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"items":    items,
		"total":    total,
		"page":     page,
		"size":     size,
		"has_next": int64(page*size) < total,
	})
}

func (h *AdminOpsHandlers) AdminMonitoringGradesHandler(w http.ResponseWriter, r *http.Request) {
	page, size, err := parsePageSizeWithMaxTen(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	classID := strings.TrimSpace(r.URL.Query().Get("class_id"))

	clauses := []string{"ar.submission_id = es.id"}
	args := []interface{}{}
	argPos := 1
	if q != "" {
		clauses = append(clauses, fmt.Sprintf("(u.nama_lengkap ILIKE $%d OR c.class_name ILIKE $%d OR eq.teks_soal ILIKE $%d)", argPos, argPos, argPos))
		args = append(args, "%"+q+"%")
		argPos++
	}
	if classID != "" {
		clauses = append(clauses, fmt.Sprintf("c.id = $%d", argPos))
		args = append(args, classID)
		argPos++
	}
	where := " WHERE " + strings.Join(clauses, " AND ")

	baseFrom := `
		FROM ai_results ar
		JOIN essay_submissions es ON es.id = ar.submission_id
		JOIN essay_questions eq ON eq.id = es.soal_id
		JOIN materials m ON m.id = eq.material_id
		JOIN classes c ON c.id = m.class_id
		JOIN users u ON u.id = es.siswa_id
		LEFT JOIN teacher_reviews tr ON tr.submission_id = es.id
	`
	var total int64
	if err := h.DB.QueryRow("SELECT COUNT(*) "+baseFrom+where, args...).Scan(&total); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to count grades")
		return
	}
	offset := (page - 1) * size
	query := `
		SELECT
			es.id, u.nama_lengkap, c.class_name, eq.teks_soal,
			ar.skor_ai, COALESCE(ar.umpan_balik_ai,''), tr.revised_score, COALESCE(tr.teacher_feedback,''), ar.generated_at
	` + baseFrom + where + fmt.Sprintf(` ORDER BY ar.generated_at DESC LIMIT $%d OFFSET $%d`, argPos, argPos+1)
	rows, err := h.DB.Query(query, append(args, size, offset)...)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load grades")
		return
	}
	defer rows.Close()
	items := make([]map[string]interface{}, 0)
	for rows.Next() {
		var submissionID, studentName, className, questionText, feedback, teacherFeedback string
		var score float64
		var revisedScore sql.NullFloat64
		var generatedAt time.Time
		if err := rows.Scan(&submissionID, &studentName, &className, &questionText, &score, &feedback, &revisedScore, &teacherFeedback, &generatedAt); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to parse grades")
			return
		}
		row := map[string]interface{}{
			"submission_id":    submissionID,
			"student_name":     studentName,
			"class_name":       className,
			"question_text":    questionText,
			"score":            score,
			"feedback":         feedback,
			"teacher_feedback": teacherFeedback,
			"generated_at":     generatedAt,
		}
		if revisedScore.Valid {
			row["revised_score"] = revisedScore.Float64
		}
		items = append(items, row)
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"items":    items,
		"total":    total,
		"page":     page,
		"size":     size,
		"has_next": int64(page*size) < total,
	})
}

func (h *AdminOpsHandlers) AdminMonitoringInteractionsHandler(w http.ResponseWriter, r *http.Request) {
	if h.AuditService == nil {
		respondWithError(w, http.StatusInternalServerError, "Audit service unavailable")
		return
	}
	page, size, err := parsePageSizeWithMaxTen(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	action := strings.TrimSpace(r.URL.Query().Get("action"))
	resp, err := h.AuditService.ListLogs("", action, q, page, size)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load interactions")
		return
	}
	respondWithJSON(w, http.StatusOK, resp)
}

func (h *AdminOpsHandlers) AdminMonitoringUsersActivityHandler(w http.ResponseWriter, r *http.Request) {
	page, size, err := parsePageSizeWithMaxTen(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	role := strings.TrimSpace(r.URL.Query().Get("role"))

	clauses := []string{}
	args := []interface{}{}
	argPos := 1
	if q != "" {
		clauses = append(clauses, fmt.Sprintf("(u.nama_lengkap ILIKE $%d OR u.email ILIKE $%d OR COALESCE(u.username,'') ILIKE $%d)", argPos, argPos, argPos))
		args = append(args, "%"+q+"%")
		argPos++
	}
	if role != "" {
		clauses = append(clauses, fmt.Sprintf("u.peran::text = $%d", argPos))
		args = append(args, role)
		argPos++
	}
	where := ""
	if len(clauses) > 0 {
		where = " WHERE " + strings.Join(clauses, " AND ")
	}

	baseFrom := `
		FROM users u
		LEFT JOIN LATERAL (
			SELECT MAX(es.submitted_at) AS last_submission_at
			FROM essay_submissions es
			WHERE es.siswa_id = u.id
		) sub ON true
		LEFT JOIN LATERAL (
			SELECT MAX(cm.requested_at) AS last_join_request_at
			FROM class_members cm
			WHERE cm.user_id = u.id
		) cmreq ON true
	`

	var total int64
	if err := h.DB.QueryRow("SELECT COUNT(*) "+baseFrom+where, args...).Scan(&total); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to count users activity")
		return
	}

	offset := (page - 1) * size
	query := `
		SELECT
			u.id, u.nama_lengkap, u.email, u.peran::text, u.last_login_at,
			sub.last_submission_at, cmreq.last_join_request_at, u.created_at
	` + baseFrom + where + fmt.Sprintf(` ORDER BY COALESCE(u.last_login_at, u.created_at) DESC LIMIT $%d OFFSET $%d`, argPos, argPos+1)

	rows, err := h.DB.Query(query, append(args, size, offset)...)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load users activity")
		return
	}
	defer rows.Close()

	items := make([]map[string]interface{}, 0)
	for rows.Next() {
		var (
			id, name, email, userRole                        string
			lastLoginAt, lastSubmissionAt, lastJoinRequestAt sql.NullTime
			createdAt                                        time.Time
		)
		if err := rows.Scan(&id, &name, &email, &userRole, &lastLoginAt, &lastSubmissionAt, &lastJoinRequestAt, &createdAt); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to parse users activity")
			return
		}
		row := map[string]interface{}{
			"user_id":    id,
			"name":       name,
			"email":      email,
			"role":       userRole,
			"created_at": createdAt,
		}
		if lastLoginAt.Valid {
			row["last_login_at"] = lastLoginAt.Time
		}
		if lastSubmissionAt.Valid {
			row["last_submission_at"] = lastSubmissionAt.Time
		}
		if lastJoinRequestAt.Valid {
			row["last_join_request_at"] = lastJoinRequestAt.Time
		}
		items = append(items, row)
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"items":    items,
		"total":    total,
		"page":     page,
		"size":     size,
		"has_next": int64(page*size) < total,
	})
}

func (h *AdminOpsHandlers) AdminOverrideUpdateGradeHandler(w http.ResponseWriter, r *http.Request) {
	submissionID := mux.Vars(r)["submissionId"]
	if strings.TrimSpace(submissionID) == "" {
		respondWithError(w, http.StatusBadRequest, "Submission ID is required")
		return
	}
	actorID, _ := r.Context().Value("userID").(string)
	allowed, allowErr := h.isOverrideAllowed("superadmin_allow_override_grade")
	if allowErr != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to check permission")
		return
	}
	if !allowed {
		respondWithError(w, http.StatusForbidden, "Override grade is disabled by settings")
		return
	}

	var payload struct {
		SkorAI          *float64 `json:"skor_ai,omitempty"`
		UmpanBalikAI    *string  `json:"umpan_balik_ai,omitempty"`
		RevisedScore    *float64 `json:"revised_score,omitempty"`
		TeacherFeedback *string  `json:"teacher_feedback,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if payload.SkorAI != nil || payload.UmpanBalikAI != nil {
		var existingID string
		err := h.DB.QueryRow("SELECT id FROM ai_results WHERE submission_id = $1", submissionID).Scan(&existingID)
		if err == sql.ErrNoRows {
			score := 0.0
			if payload.SkorAI != nil {
				score = *payload.SkorAI
			}
			_, err = h.DB.Exec(`
				INSERT INTO ai_results (submission_id, skor_ai, umpan_balik_ai, generated_at)
				VALUES ($1, $2, $3, NOW())
			`, submissionID, score, payload.UmpanBalikAI)
		} else if err == nil {
			_, err = h.DB.Exec(`
				UPDATE ai_results
				SET skor_ai = COALESCE($1, skor_ai),
				    umpan_balik_ai = COALESCE($2, umpan_balik_ai),
				    generated_at = NOW()
				WHERE submission_id = $3
			`, payload.SkorAI, payload.UmpanBalikAI, submissionID)
		}
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to update AI result")
			return
		}
	}

	if payload.RevisedScore != nil || payload.TeacherFeedback != nil {
		var reviewID string
		err := h.DB.QueryRow("SELECT id FROM teacher_reviews WHERE submission_id = $1", submissionID).Scan(&reviewID)
		if err == sql.ErrNoRows {
			revised := 0.0
			if payload.RevisedScore != nil {
				revised = *payload.RevisedScore
			}
			_, err = h.DB.Exec(`
				INSERT INTO teacher_reviews (submission_id, teacher_id, revised_score, teacher_feedback, created_at, updated_at)
				VALUES ($1, $2, $3, $4, NOW(), NOW())
			`, submissionID, actorID, revised, payload.TeacherFeedback)
		} else if err == nil {
			_, err = h.DB.Exec(`
				UPDATE teacher_reviews
				SET revised_score = COALESCE($1, revised_score),
				    teacher_feedback = COALESCE($2, teacher_feedback),
				    updated_at = NOW()
				WHERE submission_id = $3
			`, payload.RevisedScore, payload.TeacherFeedback, submissionID)
		}
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to update teacher review")
			return
		}
	}

	_ = h.AuditService.LogAction(actorID, "override_update_grade", "essay_submission", &submissionID, payload)
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Grade updated"})
}

func (h *AdminOpsHandlers) AdminOverrideDeleteGradeHandler(w http.ResponseWriter, r *http.Request) {
	submissionID := mux.Vars(r)["submissionId"]
	if strings.TrimSpace(submissionID) == "" {
		respondWithError(w, http.StatusBadRequest, "Submission ID is required")
		return
	}
	actorID, _ := r.Context().Value("userID").(string)
	allowed, allowErr := h.isOverrideAllowed("superadmin_allow_override_grade")
	if allowErr != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to check permission")
		return
	}
	if !allowed {
		respondWithError(w, http.StatusForbidden, "Delete grade is disabled by settings")
		return
	}
	reason, err := decodeReasonPayload(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	tx, err := h.DB.BeginTx(context.Background(), nil)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to start transaction")
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM teacher_reviews WHERE submission_id = $1", submissionID); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete teacher review")
		return
	}
	if _, err := tx.Exec("DELETE FROM ai_results WHERE submission_id = $1", submissionID); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete AI result")
		return
	}
	if _, err := tx.Exec(`
		UPDATE essay_submissions
		SET ai_grading_status = 'queued',
		    ai_grading_error = NULL,
		    ai_graded_at = NULL
		WHERE id = $1
	`, submissionID); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to reset submission status")
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to commit transaction")
		return
	}

	_ = h.AuditService.LogAction(actorID, "override_delete_grade", "essay_submission", &submissionID, map[string]interface{}{
		"reason": reason,
	})
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Grade deleted"})
}

func (h *AdminOpsHandlers) AdminOverrideDeleteClassHandler(w http.ResponseWriter, r *http.Request) {
	classID := mux.Vars(r)["classId"]
	if strings.TrimSpace(classID) == "" {
		respondWithError(w, http.StatusBadRequest, "Class ID is required")
		return
	}
	actorID, _ := r.Context().Value("userID").(string)
	allowed, allowErr := h.isOverrideAllowed("superadmin_allow_delete_class")
	if allowErr != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to check permission")
		return
	}
	if !allowed {
		respondWithError(w, http.StatusForbidden, "Delete class is disabled by settings")
		return
	}
	reason, err := decodeReasonPayload(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	res, err := h.DB.Exec("DELETE FROM classes WHERE id = $1", classID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete class")
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		respondWithError(w, http.StatusNotFound, "Class not found")
		return
	}
	_ = h.AuditService.LogAction(actorID, "override_delete_class", "class", &classID, map[string]interface{}{
		"reason": reason,
	})
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Class deleted"})
}

func (h *AdminOpsHandlers) AdminOverrideDeleteMaterialHandler(w http.ResponseWriter, r *http.Request) {
	materialID := mux.Vars(r)["materialId"]
	if strings.TrimSpace(materialID) == "" {
		respondWithError(w, http.StatusBadRequest, "Material ID is required")
		return
	}
	actorID, _ := r.Context().Value("userID").(string)
	allowed, allowErr := h.isOverrideAllowed("superadmin_allow_delete_material")
	if allowErr != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to check permission")
		return
	}
	if !allowed {
		respondWithError(w, http.StatusForbidden, "Delete material is disabled by settings")
		return
	}
	reason, err := decodeReasonPayload(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	res, err := h.DB.Exec("DELETE FROM materials WHERE id = $1", materialID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete material")
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		respondWithError(w, http.StatusNotFound, "Material not found")
		return
	}
	_ = h.AuditService.LogAction(actorID, "override_delete_material", "material", &materialID, map[string]interface{}{
		"reason": reason,
	})
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Material deleted"})
}

func (h *AdminOpsHandlers) AdminOverrideUpdateQuestionBankHandler(w http.ResponseWriter, r *http.Request) {
	entryID := mux.Vars(r)["entryId"]
	if strings.TrimSpace(entryID) == "" {
		respondWithError(w, http.StatusBadRequest, "Entry ID is required")
		return
	}
	actorID, _ := r.Context().Value("userID").(string)
	allowed, allowErr := h.isOverrideAllowed("superadmin_allow_override_question_bank")
	if allowErr != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to check permission")
		return
	}
	if !allowed {
		respondWithError(w, http.StatusForbidden, "Override question bank is disabled by settings")
		return
	}

	var req models.UpdateQuestionBankEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	updated, err := h.QuestionBankService.UpdateQuestionBankEntry(entryID, req, actorID, "superadmin")
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	_ = h.AuditService.LogAction(actorID, "override_update_question_bank", "question_bank", &entryID, req)
	respondWithJSON(w, http.StatusOK, updated)
}

func (h *AdminOpsHandlers) AdminOverrideDeleteQuestionBankHandler(w http.ResponseWriter, r *http.Request) {
	entryID := mux.Vars(r)["entryId"]
	if strings.TrimSpace(entryID) == "" {
		respondWithError(w, http.StatusBadRequest, "Entry ID is required")
		return
	}
	actorID, _ := r.Context().Value("userID").(string)
	allowed, allowErr := h.isOverrideAllowed("superadmin_allow_override_question_bank")
	if allowErr != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to check permission")
		return
	}
	if !allowed {
		respondWithError(w, http.StatusForbidden, "Delete question bank is disabled by settings")
		return
	}
	reason, err := decodeReasonPayload(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.QuestionBankService.DeleteQuestionBankEntry(entryID, actorID, "superadmin"); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	_ = h.AuditService.LogAction(actorID, "override_delete_question_bank", "question_bank", &entryID, map[string]interface{}{
		"reason": reason,
	})
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Question bank entry deleted"})
}
