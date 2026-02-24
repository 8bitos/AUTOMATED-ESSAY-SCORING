package handlers

import (
	"api-backend/internal/utils"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

type featureFlagMeta struct {
	Key         string `json:"key"`
	Description string `json:"description"`
	Value       bool   `json:"value"`
}

var featureFlagWhitelist = map[string]string{
	"feature_enable_impersonation":  "Aktifkan mode impersonate user",
	"feature_enable_anomaly_alerts": "Aktifkan deteksi alert anomali",
	"feature_enable_report_builder": "Aktifkan report builder superadmin",
}

func boolFromSettingValue(raw string, defaultValue bool) bool {
	v := strings.ToLower(strings.TrimSpace(raw))
	if v == "" {
		return defaultValue
	}
	return v == "true"
}

func (h *AdminOpsHandlers) isFeatureEnabled(key string, defaultValue bool) (bool, error) {
	if h.SettingService == nil {
		return defaultValue, nil
	}
	raw, err := h.SettingService.GetSetting(key)
	if err != nil {
		if err == sql.ErrNoRows {
			return defaultValue, nil
		}
		return false, err
	}
	return boolFromSettingValue(raw, defaultValue), nil
}

func setAuthCookie(w http.ResponseWriter, value string, expiresAt time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     "auth_token",
		Value:    value,
		Expires:  expiresAt,
		HttpOnly: true,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
	})
}

func setSuperadminTokenCookie(w http.ResponseWriter, value string, expiresAt time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     "superadmin_token",
		Value:    value,
		Expires:  expiresAt,
		HttpOnly: true,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
	})
}

func clearSuperadminTokenCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "superadmin_token",
		Value:    "",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
	})
}

func setImpersonationIndicator(w http.ResponseWriter, active bool) {
	value := "0"
	if active {
		value = "1"
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "is_impersonating",
		Value:    value,
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: false,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
	})
}

func clearImpersonationIndicator(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "is_impersonating",
		Value:    "",
		Expires:  time.Unix(0, 0),
		HttpOnly: false,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
	})
}

func (h *AdminOpsHandlers) AdminStartImpersonationHandler(w http.ResponseWriter, r *http.Request) {
	enabled, err := h.isFeatureEnabled("feature_enable_impersonation", true)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to validate feature flag")
		return
	}
	if !enabled {
		respondWithError(w, http.StatusForbidden, "Impersonation feature is disabled")
		return
	}

	actorID, _ := r.Context().Value("userID").(string)
	if strings.TrimSpace(actorID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	var payload struct {
		UserID   string `json:"user_id"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	payload.UserID = strings.TrimSpace(payload.UserID)
	if payload.UserID == "" {
		respondWithError(w, http.StatusBadRequest, "user_id is required")
		return
	}
	if payload.UserID == actorID {
		respondWithError(w, http.StatusBadRequest, "Cannot impersonate your own account")
		return
	}
	if err := h.AuthService.VerifyPassword(actorID, payload.Password); err != nil {
		respondWithError(w, http.StatusUnauthorized, "Password admin tidak valid")
		return
	}

	targetUser, err := h.AuthService.GetUserByID(payload.UserID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Target user not found")
		return
	}
	if targetUser.Peran == "superadmin" {
		respondWithError(w, http.StatusBadRequest, "Cannot impersonate another superadmin")
		return
	}

	currentAuthCookie, err := r.Cookie("auth_token")
	if err != nil || strings.TrimSpace(currentAuthCookie.Value) == "" {
		respondWithError(w, http.StatusUnauthorized, "Current auth token not found")
		return
	}

	impersonatedToken, err := utils.GenerateJWT(targetUser)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate impersonation token")
		return
	}

	exp := time.Now().Add(24 * time.Hour)
	setSuperadminTokenCookie(w, currentAuthCookie.Value, exp)
	setAuthCookie(w, impersonatedToken, exp)
	setImpersonationIndicator(w, true)

	_ = h.AuditService.LogAction(actorID, "start_impersonation", "user", &payload.UserID, map[string]interface{}{
		"target_role": targetUser.Peran,
		"target_name": targetUser.NamaLengkap,
	})

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Impersonation active",
		"target": map[string]interface{}{
			"id":           targetUser.ID,
			"nama_lengkap": targetUser.NamaLengkap,
			"peran":        targetUser.Peran,
		},
	})
}

func (h *AdminOpsHandlers) ImpersonationStatusHandler(w http.ResponseWriter, r *http.Request) {
	result := map[string]interface{}{
		"active": false,
	}
	cookie, err := r.Cookie("superadmin_token")
	if err != nil || strings.TrimSpace(cookie.Value) == "" {
		respondWithJSON(w, http.StatusOK, result)
		return
	}
	claims, err := utils.ValidateJWT(cookie.Value)
	if err != nil {
		respondWithJSON(w, http.StatusOK, result)
		return
	}
	result["active"] = true
	result["superadmin_id"] = claims.UserID
	result["superadmin_role"] = claims.UserRole
	respondWithJSON(w, http.StatusOK, result)
}

func (h *AdminOpsHandlers) StopImpersonationHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	superadminCookie, err := r.Cookie("superadmin_token")
	if err != nil || strings.TrimSpace(superadminCookie.Value) == "" {
		respondWithError(w, http.StatusBadRequest, "Impersonation is not active")
		return
	}
	claims, err := utils.ValidateJWT(superadminCookie.Value)
	if err != nil || claims.UserRole != "superadmin" {
		respondWithError(w, http.StatusUnauthorized, "Stored superadmin token is invalid")
		return
	}

	exp := time.Now().Add(24 * time.Hour)
	setAuthCookie(w, superadminCookie.Value, exp)
	clearSuperadminTokenCookie(w)
	clearImpersonationIndicator(w)

	_ = h.AuditService.LogAction(claims.UserID, "stop_impersonation", "user", &userID, map[string]interface{}{
		"impersonated_user_id": userID,
	})
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Returned to superadmin session"})
}

func (h *AdminOpsHandlers) AdminListFeatureFlagsHandler(w http.ResponseWriter, r *http.Request) {
	items := make([]featureFlagMeta, 0, len(featureFlagWhitelist))
	for key, desc := range featureFlagWhitelist {
		enabled, err := h.isFeatureEnabled(key, true)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to load feature flags")
			return
		}
		items = append(items, featureFlagMeta{
			Key:         key,
			Description: desc,
			Value:       enabled,
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Key < items[j].Key })
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}

func (h *AdminOpsHandlers) AdminUpdateFeatureFlagHandler(w http.ResponseWriter, r *http.Request) {
	if h.SettingService == nil {
		respondWithError(w, http.StatusInternalServerError, "Settings service is unavailable")
		return
	}
	key := strings.TrimSpace(mux.Vars(r)["key"])
	if _, ok := featureFlagWhitelist[key]; !ok {
		respondWithError(w, http.StatusBadRequest, "Feature flag is not allowed")
		return
	}

	var payload struct {
		Value bool `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.SettingService.SetSetting(key, strconv.FormatBool(payload.Value)); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to save feature flag")
		return
	}
	actorID, _ := r.Context().Value("userID").(string)
	_ = h.AuditService.LogAction(actorID, "update_feature_flag", "feature_flag", &key, map[string]interface{}{
		"value": payload.Value,
	})

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"key":   key,
		"value": payload.Value,
	})
}

func (h *AdminOpsHandlers) AdminAnomalyAlertsHandler(w http.ResponseWriter, r *http.Request) {
	enabled, err := h.isFeatureEnabled("feature_enable_anomaly_alerts", true)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to validate feature flag")
		return
	}
	if !enabled {
		respondWithError(w, http.StatusForbidden, "Anomaly alerts feature is disabled")
		return
	}

	days := 7
	if raw := strings.TrimSpace(r.URL.Query().Get("days")); raw != "" {
		parsed, parseErr := strconv.Atoi(raw)
		if parseErr != nil || parsed < 1 || parsed > 90 {
			respondWithError(w, http.StatusBadRequest, "days must be between 1 and 90")
			return
		}
		days = parsed
	}

	type alert struct {
		ID       string  `json:"id"`
		Level    string  `json:"level"`
		Title    string  `json:"title"`
		Detail   string  `json:"detail"`
		Value    float64 `json:"value"`
		Unit     string  `json:"unit"`
		Observed string  `json:"observed_at"`
	}

	alerts := make([]alert, 0)

	var failedCount, totalCount int64
	if err := h.DB.QueryRow(`
		SELECT
			COALESCE(SUM(CASE WHEN ai_grading_status = 'failed' THEN 1 ELSE 0 END), 0),
			COUNT(*)
		FROM essay_submissions
		WHERE submitted_at >= NOW() - ($1::int * INTERVAL '1 day')
	`, days).Scan(&failedCount, &totalCount); err == nil && totalCount > 0 {
		failedRate := (float64(failedCount) / float64(totalCount)) * 100
		if failedRate >= 10 {
			level := "warning"
			if failedRate >= 20 {
				level = "critical"
			}
			alerts = append(alerts, alert{
				ID:       "ai-failed-rate",
				Level:    level,
				Title:    "AI failed rate tinggi",
				Detail:   fmt.Sprintf("Gagal grading %.1f%% (%d/%d) dalam %d hari terakhir", failedRate, failedCount, totalCount, days),
				Value:    failedRate,
				Unit:     "percent",
				Observed: time.Now().Format(time.RFC3339),
			})
		}
	}

	var queuedCount int64
	if err := h.DB.QueryRow(`SELECT COUNT(*) FROM essay_submissions WHERE ai_grading_status = 'queued'`).Scan(&queuedCount); err == nil {
		var queueMax int64 = 1000
		if h.SettingService != nil {
			if raw, getErr := h.SettingService.GetSetting("queue_max_size"); getErr == nil {
				if parsed, parseErr := strconv.ParseInt(raw, 10, 64); parseErr == nil && parsed > 0 {
					queueMax = parsed
				}
			}
		}
		threshold := int64(float64(queueMax) * 0.8)
		if threshold < 10 {
			threshold = 10
		}
		if queuedCount >= threshold {
			level := "warning"
			if queuedCount >= queueMax {
				level = "critical"
			}
			alerts = append(alerts, alert{
				ID:       "queue-backlog",
				Level:    level,
				Title:    "Queue grading menumpuk",
				Detail:   fmt.Sprintf("Queue saat ini %d, threshold %d (max %d)", queuedCount, threshold, queueMax),
				Value:    float64(queuedCount),
				Unit:     "count",
				Observed: time.Now().Format(time.RFC3339),
			})
		}
	}

	type highActivity struct {
		UserID string
		Name   string
		Count  int64
	}
	var burst highActivity
	if err := h.DB.QueryRow(`
		SELECT u.id, u.nama_lengkap, COUNT(es.id) AS c
		FROM essay_submissions es
		JOIN users u ON u.id = es.siswa_id
		WHERE es.submitted_at >= NOW() - INTERVAL '1 hour'
		GROUP BY u.id, u.nama_lengkap
		HAVING COUNT(es.id) >= 15
		ORDER BY c DESC
		LIMIT 1
	`).Scan(&burst.UserID, &burst.Name, &burst.Count); err == nil {
		level := "warning"
		if burst.Count >= 30 {
			level = "critical"
		}
		alerts = append(alerts, alert{
			ID:       "submission-burst",
			Level:    level,
			Title:    "Lonjakan submission user",
			Detail:   fmt.Sprintf("%s mengirim %d submission dalam 1 jam", burst.Name, burst.Count),
			Value:    float64(burst.Count),
			Unit:     "count",
			Observed: time.Now().Format(time.RFC3339),
		})
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"items":      alerts,
		"window_day": days,
		"total":      len(alerts),
	})
}

func parseReportDate(raw string, isEnd bool) (*time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", raw)
	if err != nil {
		return nil, err
	}
	if isEnd {
		t = t.Add(24 * time.Hour)
	}
	return &t, nil
}

func (h *AdminOpsHandlers) AdminBuildReportHandler(w http.ResponseWriter, r *http.Request) {
	enabled, err := h.isFeatureEnabled("feature_enable_report_builder", true)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to validate feature flag")
		return
	}
	if !enabled {
		respondWithError(w, http.StatusForbidden, "Report builder feature is disabled")
		return
	}

	var payload struct {
		Type      string `json:"type"`
		DateFrom  string `json:"date_from"`
		DateTo    string `json:"date_to"`
		ClassID   string `json:"class_id"`
		TeacherID string `json:"teacher_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	payload.Type = strings.TrimSpace(payload.Type)
	from, err := parseReportDate(payload.DateFrom, false)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid date_from format, expected YYYY-MM-DD")
		return
	}
	to, err := parseReportDate(payload.DateTo, true)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid date_to format, expected YYYY-MM-DD")
		return
	}

	clauses := []string{}
	args := []interface{}{}
	argPos := 1
	if from != nil {
		clauses = append(clauses, fmt.Sprintf("es.submitted_at >= $%d", argPos))
		args = append(args, *from)
		argPos++
	}
	if to != nil {
		clauses = append(clauses, fmt.Sprintf("es.submitted_at < $%d", argPos))
		args = append(args, *to)
		argPos++
	}
	if strings.TrimSpace(payload.ClassID) != "" {
		clauses = append(clauses, fmt.Sprintf("c.id = $%d", argPos))
		args = append(args, strings.TrimSpace(payload.ClassID))
		argPos++
	}
	if strings.TrimSpace(payload.TeacherID) != "" {
		clauses = append(clauses, fmt.Sprintf("c.teacher_id = $%d", argPos))
		args = append(args, strings.TrimSpace(payload.TeacherID))
		argPos++
	}

	where := ""
	if len(clauses) > 0 {
		where = " WHERE " + strings.Join(clauses, " AND ")
	}

	type reportResponse struct {
		Columns []string                 `json:"columns"`
		Rows    []map[string]interface{} `json:"rows"`
	}
	response := reportResponse{
		Columns: []string{},
		Rows:    make([]map[string]interface{}, 0),
	}

	switch payload.Type {
	case "submission_status":
		response.Columns = []string{"status", "total", "avg_skor_ai", "avg_revised_score"}
		query := `
			SELECT
				COALESCE(es.ai_grading_status, 'unknown') AS status,
				COUNT(es.id) AS total,
				COALESCE(AVG(ar.skor_ai), 0) AS avg_skor_ai,
				COALESCE(AVG(tr.revised_score), 0) AS avg_revised_score
			FROM essay_submissions es
			LEFT JOIN ai_results ar ON ar.submission_id = es.id
			LEFT JOIN teacher_reviews tr ON tr.submission_id = es.id
			LEFT JOIN essay_questions eq ON eq.id = es.soal_id
			LEFT JOIN materials m ON m.id = eq.material_id
			LEFT JOIN classes c ON c.id = m.class_id
		` + where + `
			GROUP BY COALESCE(es.ai_grading_status, 'unknown')
			ORDER BY total DESC
		`
		rows, err := h.DB.Query(query, args...)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to build report")
			return
		}
		defer rows.Close()
		for rows.Next() {
			var status string
			var total int64
			var avgAI, avgRevised float64
			if scanErr := rows.Scan(&status, &total, &avgAI, &avgRevised); scanErr != nil {
				respondWithError(w, http.StatusInternalServerError, "Failed to parse report")
				return
			}
			response.Rows = append(response.Rows, map[string]interface{}{
				"status":            status,
				"total":             total,
				"avg_skor_ai":       avgAI,
				"avg_revised_score": avgRevised,
			})
		}
	case "top_students":
		response.Columns = []string{"student_id", "student_name", "total_submissions", "avg_score"}
		query := `
			SELECT
				u.id,
				u.nama_lengkap,
				COUNT(es.id) AS total_submissions,
				COALESCE(AVG(COALESCE(tr.revised_score, ar.skor_ai)), 0) AS avg_score
			FROM essay_submissions es
			JOIN users u ON u.id = es.siswa_id
			LEFT JOIN ai_results ar ON ar.submission_id = es.id
			LEFT JOIN teacher_reviews tr ON tr.submission_id = es.id
			LEFT JOIN essay_questions eq ON eq.id = es.soal_id
			LEFT JOIN materials m ON m.id = eq.material_id
			LEFT JOIN classes c ON c.id = m.class_id
		` + where + `
			GROUP BY u.id, u.nama_lengkap
			ORDER BY avg_score DESC, total_submissions DESC
			LIMIT 50
		`
		rows, err := h.DB.Query(query, args...)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to build report")
			return
		}
		defer rows.Close()
		for rows.Next() {
			var studentID, studentName string
			var totalSubmissions int64
			var avgScore float64
			if scanErr := rows.Scan(&studentID, &studentName, &totalSubmissions, &avgScore); scanErr != nil {
				respondWithError(w, http.StatusInternalServerError, "Failed to parse report")
				return
			}
			response.Rows = append(response.Rows, map[string]interface{}{
				"student_id":        studentID,
				"student_name":      studentName,
				"total_submissions": totalSubmissions,
				"avg_score":         avgScore,
			})
		}
	case "teacher_workload":
		response.Columns = []string{"teacher_id", "teacher_name", "classes_count", "materials_count", "submissions_count"}
		teacherWhereClauses := []string{"t.peran = 'teacher'"}
		teacherArgs := []interface{}{}
		teacherArgPos := 1
		if strings.TrimSpace(payload.TeacherID) != "" {
			teacherWhereClauses = append(teacherWhereClauses, fmt.Sprintf("t.id = $%d", teacherArgPos))
			teacherArgs = append(teacherArgs, strings.TrimSpace(payload.TeacherID))
			teacherArgPos++
		}
		if from != nil {
			teacherWhereClauses = append(teacherWhereClauses, fmt.Sprintf("es.submitted_at >= $%d", teacherArgPos))
			teacherArgs = append(teacherArgs, *from)
			teacherArgPos++
		}
		if to != nil {
			teacherWhereClauses = append(teacherWhereClauses, fmt.Sprintf("es.submitted_at < $%d", teacherArgPos))
			teacherArgs = append(teacherArgs, *to)
			teacherArgPos++
		}
		if strings.TrimSpace(payload.ClassID) != "" {
			teacherWhereClauses = append(teacherWhereClauses, fmt.Sprintf("c.id = $%d", teacherArgPos))
			teacherArgs = append(teacherArgs, strings.TrimSpace(payload.ClassID))
			teacherArgPos++
		}
		query := `
			SELECT
				t.id AS teacher_id,
				t.nama_lengkap AS teacher_name,
				COUNT(DISTINCT c.id) AS classes_count,
				COUNT(DISTINCT m.id) AS materials_count,
				COUNT(DISTINCT es.id) AS submissions_count
			FROM users t
			LEFT JOIN classes c ON c.teacher_id = t.id
			LEFT JOIN materials m ON m.class_id = c.id
			LEFT JOIN essay_questions eq ON eq.material_id = m.id
			LEFT JOIN essay_submissions es ON es.soal_id = eq.id
		`
		if len(teacherWhereClauses) > 0 {
			query += " WHERE " + strings.Join(teacherWhereClauses, " AND ")
		}
		query += `
			GROUP BY t.id, t.nama_lengkap
			ORDER BY submissions_count DESC, classes_count DESC
			LIMIT 50
		`
		rows, err := h.DB.Query(query, teacherArgs...)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to build report")
			return
		}
		defer rows.Close()
		for rows.Next() {
			var teacherID, teacherName string
			var classesCount, materialsCount, submissionsCount int64
			if scanErr := rows.Scan(&teacherID, &teacherName, &classesCount, &materialsCount, &submissionsCount); scanErr != nil {
				respondWithError(w, http.StatusInternalServerError, "Failed to parse report")
				return
			}
			response.Rows = append(response.Rows, map[string]interface{}{
				"teacher_id":        teacherID,
				"teacher_name":      teacherName,
				"classes_count":     classesCount,
				"materials_count":   materialsCount,
				"submissions_count": submissionsCount,
			})
		}
	default:
		respondWithError(w, http.StatusBadRequest, "Unsupported report type")
		return
	}

	actorID, _ := r.Context().Value("userID").(string)
	_ = h.AuditService.LogAction(actorID, "build_report", "report", nil, map[string]interface{}{
		"type":       payload.Type,
		"date_from":  payload.DateFrom,
		"date_to":    payload.DateTo,
		"class_id":   payload.ClassID,
		"teacher_id": payload.TeacherID,
		"row_count":  len(response.Rows),
	})

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"type":    payload.Type,
		"columns": response.Columns,
		"rows":    response.Rows,
		"total":   len(response.Rows),
	})
}
