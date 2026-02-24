package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

type adminAnnouncementItem struct {
	ID          string     `json:"id"`
	Type        string     `json:"type"`
	Icon        string     `json:"icon"`
	Title       string     `json:"title"`
	Content     string     `json:"content"`
	TargetRole  string     `json:"target_role"`
	IsActive    bool       `json:"is_active"`
	StartsAt    *time.Time `json:"starts_at,omitempty"`
	EndsAt      *time.Time `json:"ends_at,omitempty"`
	CreatedBy   *string    `json:"created_by,omitempty"`
	CreatedName string     `json:"created_name,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

func isValidAnnouncementType(value string) bool {
	return value == "banner" || value == "running_text"
}

func isValidAnnouncementIcon(value string) bool {
	return value == "info" || value == "warning" || value == "danger" || value == "bell"
}

func isValidAnnouncementTargetRole(value string) bool {
	return value == "all" || value == "student" || value == "teacher"
}

func parseAnnouncementDateTime(raw string) (*time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return &t, nil
	}
	if t, err := time.Parse("2006-01-02 15:04", raw); err == nil {
		return &t, nil
	}
	if t, err := time.Parse("2006-01-02", raw); err == nil {
		return &t, nil
	}
	if t, err := time.Parse("02/01/2006 15:04", raw); err == nil {
		return &t, nil
	}
	if t, err := time.Parse("02/01/2006", raw); err == nil {
		return &t, nil
	}
	if t, err := time.Parse("02/01/06 15:04", raw); err == nil {
		return &t, nil
	}
	if t, err := time.Parse("02/01/06", raw); err == nil {
		return &t, nil
	}
	return nil, fmt.Errorf("invalid datetime format")
}

func (h *AdminOpsHandlers) AdminListAnnouncementsHandler(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	typeFilter := strings.TrimSpace(r.URL.Query().Get("type"))
	targetRole := strings.TrimSpace(r.URL.Query().Get("target_role"))

	clauses := []string{}
	args := []interface{}{}
	argPos := 1
	if q != "" {
		clauses = append(clauses, fmt.Sprintf("(a.title ILIKE $%d OR a.content ILIKE $%d)", argPos, argPos))
		args = append(args, "%"+q+"%")
		argPos++
	}
	if typeFilter != "" {
		clauses = append(clauses, fmt.Sprintf("a.type = $%d", argPos))
		args = append(args, typeFilter)
		argPos++
	}
	if targetRole != "" {
		clauses = append(clauses, fmt.Sprintf("a.target_role = $%d", argPos))
		args = append(args, targetRole)
		argPos++
	}

	query := `
		SELECT
			a.id::text, a.type, a.icon, a.title, a.content, a.target_role, a.is_active,
			a.starts_at, a.ends_at, a.created_by::text, COALESCE(u.nama_lengkap, '-'),
			a.created_at, a.updated_at
		FROM announcements a
		LEFT JOIN users u ON u.id = a.created_by
	`
	if len(clauses) > 0 {
		query += " WHERE " + strings.Join(clauses, " AND ")
	}
	query += " ORDER BY a.created_at DESC"

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load announcements")
		return
	}
	defer rows.Close()

	items := make([]adminAnnouncementItem, 0)
	for rows.Next() {
		var item adminAnnouncementItem
		var startsAt, endsAt sql.NullTime
		var createdBy sql.NullString
		if err := rows.Scan(
			&item.ID, &item.Type, &item.Icon, &item.Title, &item.Content, &item.TargetRole, &item.IsActive,
			&startsAt, &endsAt, &createdBy, &item.CreatedName, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to parse announcements")
			return
		}
		if startsAt.Valid {
			t := startsAt.Time
			item.StartsAt = &t
		}
		if endsAt.Valid {
			t := endsAt.Time
			item.EndsAt = &t
		}
		if createdBy.Valid {
			v := createdBy.String
			item.CreatedBy = &v
		}
		items = append(items, item)
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}

func (h *AdminOpsHandlers) AdminCreateAnnouncementHandler(w http.ResponseWriter, r *http.Request) {
	actorID, _ := r.Context().Value("userID").(string)
	var payload struct {
		Type       string `json:"type"`
		Icon       string `json:"icon"`
		Title      string `json:"title"`
		Content    string `json:"content"`
		TargetRole string `json:"target_role"`
		IsActive   *bool  `json:"is_active"`
		StartsAt   string `json:"starts_at"`
		EndsAt     string `json:"ends_at"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	payload.Type = strings.TrimSpace(strings.ToLower(payload.Type))
	payload.Icon = strings.TrimSpace(strings.ToLower(payload.Icon))
	payload.TargetRole = strings.TrimSpace(strings.ToLower(payload.TargetRole))
	payload.Title = strings.TrimSpace(payload.Title)
	payload.Content = strings.TrimSpace(payload.Content)

	if !isValidAnnouncementType(payload.Type) {
		respondWithError(w, http.StatusBadRequest, "type must be banner or running_text")
		return
	}
	if payload.Content == "" {
		respondWithError(w, http.StatusBadRequest, "content is required")
		return
	}
	if payload.Icon == "" {
		payload.Icon = "info"
	}
	if !isValidAnnouncementIcon(payload.Icon) {
		respondWithError(w, http.StatusBadRequest, "icon must be info, warning, danger, or bell")
		return
	}
	if payload.TargetRole == "" {
		payload.TargetRole = "all"
	}
	if !isValidAnnouncementTargetRole(payload.TargetRole) {
		respondWithError(w, http.StatusBadRequest, "target_role must be all, student, or teacher")
		return
	}
	startsAt, err := parseAnnouncementDateTime(payload.StartsAt)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "invalid starts_at format")
		return
	}
	endsAt, err := parseAnnouncementDateTime(payload.EndsAt)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "invalid ends_at format")
		return
	}
	if startsAt != nil && endsAt != nil && endsAt.Before(*startsAt) {
		respondWithError(w, http.StatusBadRequest, "ends_at must be after starts_at")
		return
	}
	isActive := true
	if payload.IsActive != nil {
		isActive = *payload.IsActive
	}

	var created adminAnnouncementItem
	var startsAtDB, endsAtDB sql.NullTime
	var createdByDB sql.NullString
	query := `
		INSERT INTO announcements (type, icon, title, content, target_role, is_active, starts_at, ends_at, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id::text, type, icon, title, content, target_role, is_active, starts_at, ends_at, created_by::text, created_at, updated_at
	`
	if err := h.DB.QueryRow(query,
		payload.Type, payload.Icon, payload.Title, payload.Content, payload.TargetRole, isActive, startsAt, endsAt, actorID,
	).Scan(
		&created.ID, &created.Type, &created.Icon, &created.Title, &created.Content, &created.TargetRole, &created.IsActive,
		&startsAtDB, &endsAtDB, &createdByDB, &created.CreatedAt, &created.UpdatedAt,
	); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create announcement")
		return
	}
	if startsAtDB.Valid {
		t := startsAtDB.Time
		created.StartsAt = &t
	}
	if endsAtDB.Valid {
		t := endsAtDB.Time
		created.EndsAt = &t
	}
	if createdByDB.Valid {
		v := createdByDB.String
		created.CreatedBy = &v
	}

	_ = h.AuditService.LogAction(actorID, "create_announcement", "announcement", &created.ID, map[string]interface{}{
		"type":        created.Type,
		"icon":        created.Icon,
		"target_role": created.TargetRole,
		"is_active":   created.IsActive,
	})
	respondWithJSON(w, http.StatusCreated, created)
}

func (h *AdminOpsHandlers) AdminUpdateAnnouncementHandler(w http.ResponseWriter, r *http.Request) {
	actorID, _ := r.Context().Value("userID").(string)
	announcementID := strings.TrimSpace(mux.Vars(r)["announcementId"])
	if announcementID == "" {
		respondWithError(w, http.StatusBadRequest, "announcementId is required")
		return
	}

	var payload struct {
		Type       *string `json:"type"`
		Icon       *string `json:"icon"`
		Title      *string `json:"title"`
		Content    *string `json:"content"`
		TargetRole *string `json:"target_role"`
		IsActive   *bool   `json:"is_active"`
		StartsAt   *string `json:"starts_at"`
		EndsAt     *string `json:"ends_at"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	sets := []string{}
	args := []interface{}{}
	argPos := 1

	if payload.Type != nil {
		v := strings.TrimSpace(strings.ToLower(*payload.Type))
		if !isValidAnnouncementType(v) {
			respondWithError(w, http.StatusBadRequest, "type must be banner or running_text")
			return
		}
		sets = append(sets, fmt.Sprintf("type = $%d", argPos))
		args = append(args, v)
		argPos++
	}
	if payload.Icon != nil {
		v := strings.TrimSpace(strings.ToLower(*payload.Icon))
		if !isValidAnnouncementIcon(v) {
			respondWithError(w, http.StatusBadRequest, "icon must be info, warning, danger, or bell")
			return
		}
		sets = append(sets, fmt.Sprintf("icon = $%d", argPos))
		args = append(args, v)
		argPos++
	}
	if payload.Title != nil {
		sets = append(sets, fmt.Sprintf("title = $%d", argPos))
		args = append(args, strings.TrimSpace(*payload.Title))
		argPos++
	}
	if payload.Content != nil {
		v := strings.TrimSpace(*payload.Content)
		if v == "" {
			respondWithError(w, http.StatusBadRequest, "content cannot be empty")
			return
		}
		sets = append(sets, fmt.Sprintf("content = $%d", argPos))
		args = append(args, v)
		argPos++
	}
	if payload.TargetRole != nil {
		v := strings.TrimSpace(strings.ToLower(*payload.TargetRole))
		if !isValidAnnouncementTargetRole(v) {
			respondWithError(w, http.StatusBadRequest, "target_role must be all, student, or teacher")
			return
		}
		sets = append(sets, fmt.Sprintf("target_role = $%d", argPos))
		args = append(args, v)
		argPos++
	}
	if payload.IsActive != nil {
		sets = append(sets, fmt.Sprintf("is_active = $%d", argPos))
		args = append(args, *payload.IsActive)
		argPos++
	}
	if payload.StartsAt != nil {
		startsAt, err := parseAnnouncementDateTime(*payload.StartsAt)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "invalid starts_at format")
			return
		}
		sets = append(sets, fmt.Sprintf("starts_at = $%d", argPos))
		args = append(args, startsAt)
		argPos++
	}
	if payload.EndsAt != nil {
		endsAt, err := parseAnnouncementDateTime(*payload.EndsAt)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "invalid ends_at format")
			return
		}
		sets = append(sets, fmt.Sprintf("ends_at = $%d", argPos))
		args = append(args, endsAt)
		argPos++
	}
	if len(sets) == 0 {
		respondWithError(w, http.StatusBadRequest, "No fields to update")
		return
	}

	sets = append(sets, fmt.Sprintf("updated_at = $%d", argPos))
	args = append(args, time.Now())
	argPos++
	args = append(args, announcementID)

	query := fmt.Sprintf("UPDATE announcements SET %s WHERE id = $%d", strings.Join(sets, ", "), argPos)
	res, err := h.DB.Exec(query, args...)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update announcement")
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		respondWithError(w, http.StatusNotFound, "Announcement not found")
		return
	}

	_ = h.AuditService.LogAction(actorID, "update_announcement", "announcement", &announcementID, nil)
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Announcement updated"})
}

func (h *AdminOpsHandlers) AdminDeleteAnnouncementHandler(w http.ResponseWriter, r *http.Request) {
	actorID, _ := r.Context().Value("userID").(string)
	announcementID := strings.TrimSpace(mux.Vars(r)["announcementId"])
	if announcementID == "" {
		respondWithError(w, http.StatusBadRequest, "announcementId is required")
		return
	}

	res, err := h.DB.Exec("DELETE FROM announcements WHERE id = $1", announcementID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete announcement")
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		respondWithError(w, http.StatusNotFound, "Announcement not found")
		return
	}

	_ = h.AuditService.LogAction(actorID, "delete_announcement", "announcement", &announcementID, nil)
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Announcement deleted"})
}

func (h *AdminOpsHandlers) ListActiveAnnouncementsHandler(w http.ResponseWriter, r *http.Request) {
	userRole, _ := r.Context().Value("userRole").(string)
	role := strings.TrimSpace(strings.ToLower(userRole))
	if role == "" {
		role = "student"
	}

	rows, err := h.DB.Query(`
		SELECT id::text, type, icon, title, content, target_role, is_active, starts_at, ends_at, created_at, updated_at
		FROM announcements
		WHERE is_active = true
			AND (target_role = 'all' OR target_role = $1)
			AND (starts_at IS NULL OR starts_at <= NOW())
			AND (ends_at IS NULL OR ends_at >= NOW())
		ORDER BY created_at DESC
		LIMIT 20
	`, role)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load announcements")
		return
	}
	defer rows.Close()

	items := make([]adminAnnouncementItem, 0)
	for rows.Next() {
		var item adminAnnouncementItem
		var startsAt, endsAt sql.NullTime
		if err := rows.Scan(
			&item.ID, &item.Type, &item.Icon, &item.Title, &item.Content, &item.TargetRole, &item.IsActive,
			&startsAt, &endsAt, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to parse announcements")
			return
		}
		if startsAt.Valid {
			t := startsAt.Time
			item.StartsAt = &t
		}
		if endsAt.Valid {
			t := endsAt.Time
			item.EndsAt = &t
		}
		items = append(items, item)
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}
