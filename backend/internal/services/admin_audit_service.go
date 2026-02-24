package services

import (
	"api-backend/internal/models"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
)

type AdminAuditService struct {
	db *sql.DB
}

func NewAdminAuditService(db *sql.DB) *AdminAuditService {
	return &AdminAuditService{db: db}
}

func (s *AdminAuditService) LogAction(actorID, action, targetType string, targetID *string, metadata interface{}) error {
	if s == nil || s.db == nil {
		return nil
	}
	actorID = strings.TrimSpace(actorID)
	action = strings.TrimSpace(action)
	targetType = strings.TrimSpace(targetType)
	if actorID == "" || action == "" || targetType == "" {
		return nil
	}

	var metadataJSON []byte
	if metadata != nil {
		raw, err := json.Marshal(metadata)
		if err != nil {
			return fmt.Errorf("failed to marshal audit metadata: %w", err)
		}
		metadataJSON = raw
	}

	_, err := s.db.Exec(`
		INSERT INTO admin_audit_logs (actor_id, action, target_type, target_id, metadata)
		VALUES ($1, $2, $3, $4, $5)
	`, actorID, action, targetType, targetID, metadataJSON)
	if err != nil {
		return fmt.Errorf("failed to insert admin audit log: %w", err)
	}
	return nil
}

func (s *AdminAuditService) ListLogs(actorID, action, q string, page, size int) (*models.AdminAuditLogListResponse, error) {
	if page < 1 {
		page = 1
	}
	if size < 1 {
		size = 20
	}
	if size > 100 {
		size = 100
	}

	clauses := []string{}
	args := []interface{}{}
	argPos := 1

	if trimmed := strings.TrimSpace(actorID); trimmed != "" {
		clauses = append(clauses, fmt.Sprintf("l.actor_id = $%d", argPos))
		args = append(args, trimmed)
		argPos++
	}
	if trimmed := strings.TrimSpace(action); trimmed != "" {
		clauses = append(clauses, fmt.Sprintf("l.action = $%d", argPos))
		args = append(args, trimmed)
		argPos++
	}
	if trimmed := strings.TrimSpace(q); trimmed != "" {
		clauses = append(clauses, fmt.Sprintf("(l.target_type ILIKE $%d OR COALESCE(l.target_id, '') ILIKE $%d OR COALESCE(u.nama_lengkap, '') ILIKE $%d)", argPos, argPos, argPos))
		args = append(args, "%"+trimmed+"%")
		argPos++
	}

	baseFrom := `
		FROM admin_audit_logs l
		LEFT JOIN users u ON u.id = l.actor_id
	`
	whereSQL := ""
	if len(clauses) > 0 {
		whereSQL = " WHERE " + strings.Join(clauses, " AND ")
	}

	var total int64
	if err := s.db.QueryRow("SELECT COUNT(*) "+baseFrom+whereSQL, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("failed to count audit logs: %w", err)
	}

	offset := (page - 1) * size
	query := `
		SELECT
			l.id,
			l.actor_id::text,
			COALESCE(u.nama_lengkap, '-'),
			l.action,
			l.target_type,
			l.target_id,
			COALESCE(l.metadata, '{}'::jsonb)::text,
			l.created_at
	` + baseFrom + whereSQL + fmt.Sprintf(`
		ORDER BY l.created_at DESC
		LIMIT $%d OFFSET $%d
	`, argPos, argPos+1)

	rows, err := s.db.Query(query, append(args, size, offset)...)
	if err != nil {
		return nil, fmt.Errorf("failed to list audit logs: %w", err)
	}
	defer rows.Close()

	resp := &models.AdminAuditLogListResponse{
		Items: []models.AdminAuditLogItem{},
		Total: total,
		Page:  page,
		Size:  size,
	}

	for rows.Next() {
		var item models.AdminAuditLogItem
		var targetID sql.NullString
		var metadataRaw string
		if err := rows.Scan(
			&item.ID,
			&item.ActorID,
			&item.ActorName,
			&item.Action,
			&item.TargetType,
			&targetID,
			&metadataRaw,
			&item.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan audit log row: %w", err)
		}
		if targetID.Valid {
			target := targetID.String
			item.TargetID = &target
		}
		item.Metadata = json.RawMessage(metadataRaw)
		resp.Items = append(resp.Items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed iterating audit logs: %w", err)
	}

	return resp, nil
}
