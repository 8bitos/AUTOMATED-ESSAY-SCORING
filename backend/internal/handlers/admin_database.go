package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

var validDBIdentifier = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

type adminDatabaseColumn struct {
	Name         string  `json:"name"`
	DataType     string  `json:"data_type"`
	UdtName      string  `json:"udt_name"`
	IsNullable   bool    `json:"is_nullable"`
	DefaultValue *string `json:"default_value,omitempty"`
	IsPrimaryKey bool    `json:"is_primary_key"`
	IsEditable   bool    `json:"is_editable"`
}

type adminDatabaseTableSummary struct {
	Name              string                `json:"name"`
	RowCount          int64                 `json:"row_count"`
	ColumnCount       int                   `json:"column_count"`
	PrimaryKeyColumns []string              `json:"primary_key_columns"`
	SupportsCRUD      bool                  `json:"supports_crud"`
	Columns           []adminDatabaseColumn `json:"columns"`
}

func quoteAdminIdentifier(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

func normalizeDatabaseValue(value any) any {
	switch v := value.(type) {
	case nil:
		return nil
	case []byte:
		text := string(v)
		trimmed := strings.TrimSpace(text)
		if (strings.HasPrefix(trimmed, "{") && strings.HasSuffix(trimmed, "}")) || (strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]")) {
			var decoded any
			if err := json.Unmarshal(v, &decoded); err == nil {
				return decoded
			}
		}
		return text
	case time.Time:
		return v.Format(time.RFC3339)
	default:
		return v
	}
}

func decodeAdminDatabaseRequestBody(r *http.Request) (map[string]any, error) {
	defer r.Body.Close()
	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func isAdminDatabaseTableAllowed(name string) bool {
	return validDBIdentifier.MatchString(name) && name != "schema_migrations"
}

func (h *AdminOpsHandlers) adminDatabaseListTables() ([]string, error) {
	rows, err := h.DB.Query(`
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
		ORDER BY table_name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]string, 0)
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			return nil, err
		}
		if isAdminDatabaseTableAllowed(tableName) {
			items = append(items, tableName)
		}
	}
	return items, rows.Err()
}

func (h *AdminOpsHandlers) adminDatabaseGetColumns(tableName string) ([]adminDatabaseColumn, error) {
	rows, err := h.DB.Query(`
		SELECT
			c.column_name,
			c.data_type,
			c.udt_name,
			(c.is_nullable = 'YES') AS is_nullable,
			c.column_default,
			EXISTS (
				SELECT 1
				FROM information_schema.table_constraints tc
				JOIN information_schema.key_column_usage kcu
				  ON tc.constraint_name = kcu.constraint_name
				 AND tc.table_schema = kcu.table_schema
				 AND tc.table_name = kcu.table_name
				WHERE tc.table_schema = c.table_schema
				  AND tc.table_name = c.table_name
				  AND tc.constraint_type = 'PRIMARY KEY'
				  AND kcu.column_name = c.column_name
			) AS is_primary_key
		FROM information_schema.columns c
		WHERE c.table_schema = 'public' AND c.table_name = $1
		ORDER BY c.ordinal_position ASC
	`, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := make([]adminDatabaseColumn, 0)
	for rows.Next() {
		var col adminDatabaseColumn
		var defaultValue sql.NullString
		if err := rows.Scan(&col.Name, &col.DataType, &col.UdtName, &col.IsNullable, &defaultValue, &col.IsPrimaryKey); err != nil {
			return nil, err
		}
		if defaultValue.Valid {
			col.DefaultValue = &defaultValue.String
		}
		col.IsEditable = true
		if strings.EqualFold(col.Name, "created_at") || strings.EqualFold(col.Name, "updated_at") {
			col.IsEditable = false
		}
		columns = append(columns, col)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(columns) == 0 {
		return nil, fmt.Errorf("table not found")
	}
	return columns, nil
}

func adminDatabasePrimaryKeys(columns []adminDatabaseColumn) []string {
	keys := make([]string, 0)
	for _, col := range columns {
		if col.IsPrimaryKey {
			keys = append(keys, col.Name)
		}
	}
	return keys
}

func (h *AdminOpsHandlers) adminDatabaseEnsureTable(tableName string) ([]adminDatabaseColumn, error) {
	if !isAdminDatabaseTableAllowed(tableName) {
		return nil, fmt.Errorf("table is not allowed")
	}
	allowedTables, err := h.adminDatabaseListTables()
	if err != nil {
		return nil, err
	}
	for _, allowed := range allowedTables {
		if allowed == tableName {
			return h.adminDatabaseGetColumns(tableName)
		}
	}
	return nil, fmt.Errorf("table not found")
}

func adminDatabaseColumnMap(columns []adminDatabaseColumn) map[string]adminDatabaseColumn {
	result := make(map[string]adminDatabaseColumn, len(columns))
	for _, col := range columns {
		result[col.Name] = col
	}
	return result
}

func adminDatabaseParseValue(col adminDatabaseColumn, raw any) (any, error) {
	if raw == nil {
		return nil, nil
	}

	switch col.DataType {
	case "smallint", "integer", "bigint":
		switch v := raw.(type) {
		case float64:
			return int64(v), nil
		case string:
			if strings.TrimSpace(v) == "" && col.IsNullable {
				return nil, nil
			}
			parsed, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
			if err != nil {
				return nil, fmt.Errorf("%s harus berupa angka bulat", col.Name)
			}
			return parsed, nil
		default:
			return nil, fmt.Errorf("%s memiliki tipe data tidak valid", col.Name)
		}
	case "numeric", "decimal", "real", "double precision":
		switch v := raw.(type) {
		case float64:
			return v, nil
		case string:
			if strings.TrimSpace(v) == "" && col.IsNullable {
				return nil, nil
			}
			parsed, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
			if err != nil {
				return nil, fmt.Errorf("%s harus berupa angka", col.Name)
			}
			return parsed, nil
		default:
			return nil, fmt.Errorf("%s memiliki tipe data tidak valid", col.Name)
		}
	case "boolean":
		switch v := raw.(type) {
		case bool:
			return v, nil
		case string:
			if strings.TrimSpace(v) == "" && col.IsNullable {
				return nil, nil
			}
			parsed, err := strconv.ParseBool(strings.ToLower(strings.TrimSpace(v)))
			if err != nil {
				return nil, fmt.Errorf("%s harus true/false", col.Name)
			}
			return parsed, nil
		default:
			return nil, fmt.Errorf("%s memiliki tipe data tidak valid", col.Name)
		}
	case "json", "jsonb":
		switch v := raw.(type) {
		case string:
			if strings.TrimSpace(v) == "" && col.IsNullable {
				return nil, nil
			}
			var js any
			if err := json.Unmarshal([]byte(v), &js); err != nil {
				return nil, fmt.Errorf("%s harus berupa JSON valid", col.Name)
			}
			return []byte(v), nil
		default:
			encoded, err := json.Marshal(v)
			if err != nil {
				return nil, fmt.Errorf("%s tidak bisa dikonversi ke JSON", col.Name)
			}
			return encoded, nil
		}
	default:
		switch v := raw.(type) {
		case string:
			if strings.TrimSpace(v) == "" && col.IsNullable && col.DataType != "text" && col.DataType != "character varying" && col.DataType != "character" {
				return nil, nil
			}
			return v, nil
		default:
			return fmt.Sprint(v), nil
		}
	}
}

func (h *AdminOpsHandlers) AdminDatabaseTablesHandler(w http.ResponseWriter, r *http.Request) {
	tableNames, err := h.adminDatabaseListTables()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load database tables")
		return
	}

	items := make([]adminDatabaseTableSummary, 0, len(tableNames))
	for _, tableName := range tableNames {
		columns, err := h.adminDatabaseGetColumns(tableName)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to load database schema")
			return
		}
		var count int64
		query := fmt.Sprintf("SELECT COUNT(*) FROM %s", quoteAdminIdentifier(tableName))
		if err := h.DB.QueryRow(query).Scan(&count); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to count database rows")
			return
		}
		items = append(items, adminDatabaseTableSummary{
			Name:              tableName,
			RowCount:          count,
			ColumnCount:       len(columns),
			PrimaryKeyColumns: adminDatabasePrimaryKeys(columns),
			SupportsCRUD:      len(adminDatabasePrimaryKeys(columns)) > 0,
			Columns:           columns,
		})
	}
	respondWithJSON(w, http.StatusOK, map[string]any{"tables": items})
}

func (h *AdminOpsHandlers) AdminDatabaseRowsHandler(w http.ResponseWriter, r *http.Request) {
	tableName := mux.Vars(r)["table"]
	columns, err := h.adminDatabaseEnsureTable(tableName)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Table not found")
		return
	}

	page := 1
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		parsed, parseErr := strconv.Atoi(raw)
		if parseErr != nil || parsed < 1 {
			respondWithError(w, http.StatusBadRequest, "Invalid page")
			return
		}
		page = parsed
	}
	size := 20
	if raw := strings.TrimSpace(r.URL.Query().Get("size")); raw != "" {
		parsed, parseErr := strconv.Atoi(raw)
		if parseErr != nil || parsed < 1 || parsed > 200 {
			respondWithError(w, http.StatusBadRequest, "Invalid size")
			return
		}
		size = parsed
	}
	search := strings.TrimSpace(r.URL.Query().Get("q"))

	columnNames := make([]string, 0, len(columns))
	for _, col := range columns {
		columnNames = append(columnNames, quoteAdminIdentifier(col.Name))
	}

	whereParts := make([]string, 0)
	args := make([]any, 0)
	if search != "" {
		searchParts := make([]string, 0, len(columns))
		for _, col := range columns {
			args = append(args, "%"+search+"%")
			searchParts = append(searchParts, fmt.Sprintf("CAST(%s AS TEXT) ILIKE $%d", quoteAdminIdentifier(col.Name), len(args)))
		}
		if len(searchParts) > 0 {
			whereParts = append(whereParts, "("+strings.Join(searchParts, " OR ")+")")
		}
	}
	whereSQL := ""
	if len(whereParts) > 0 {
		whereSQL = " WHERE " + strings.Join(whereParts, " AND ")
	}

	var total int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s%s", quoteAdminIdentifier(tableName), whereSQL)
	if err := h.DB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to count table rows")
		return
	}

	orderBy := adminDatabasePrimaryKeys(columns)
	if len(orderBy) == 0 && len(columns) > 0 {
		orderBy = []string{columns[0].Name}
	}
	orderParts := make([]string, 0, len(orderBy))
	for _, col := range orderBy {
		orderParts = append(orderParts, quoteAdminIdentifier(col)+" ASC")
	}

	args = append(args, size, (page-1)*size)
	dataQuery := fmt.Sprintf(
		"SELECT %s FROM %s%s ORDER BY %s LIMIT $%d OFFSET $%d",
		strings.Join(columnNames, ", "),
		quoteAdminIdentifier(tableName),
		whereSQL,
		strings.Join(orderParts, ", "),
		len(args)-1,
		len(args),
	)
	rows, err := h.DB.Query(dataQuery, args...)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load table rows")
		return
	}
	defer rows.Close()

	resultRows := make([]map[string]any, 0)
	rawColumns, err := rows.Columns()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to read table columns")
		return
	}
	for rows.Next() {
		dest := make([]any, len(rawColumns))
		destPtrs := make([]any, len(rawColumns))
		for i := range dest {
			destPtrs[i] = &dest[i]
		}
		if err := rows.Scan(destPtrs...); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to parse table row")
			return
		}
		item := make(map[string]any, len(rawColumns))
		for i, colName := range rawColumns {
			item[colName] = normalizeDatabaseValue(dest[i])
		}
		resultRows = append(resultRows, item)
	}
	if err := rows.Err(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to iterate table rows")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]any{
		"table":               tableName,
		"page":                page,
		"size":                size,
		"total":               total,
		"columns":             columns,
		"primary_key_columns": adminDatabasePrimaryKeys(columns),
		"rows":                resultRows,
	})
}

func (h *AdminOpsHandlers) AdminDatabaseCreateRowHandler(w http.ResponseWriter, r *http.Request) {
	tableName := mux.Vars(r)["table"]
	columns, err := h.adminDatabaseEnsureTable(tableName)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Table not found")
		return
	}

	payload, err := decodeAdminDatabaseRequestBody(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	rawValues, _ := payload["values"].(map[string]any)
	if len(rawValues) == 0 {
		respondWithError(w, http.StatusBadRequest, "values is required")
		return
	}

	columnMap := adminDatabaseColumnMap(columns)
	names := make([]string, 0)
	holders := make([]string, 0)
	args := make([]any, 0)
	for name, raw := range rawValues {
		col, ok := columnMap[name]
		if !ok {
			respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Unknown column: %s", name))
			return
		}
		value, parseErr := adminDatabaseParseValue(col, raw)
		if parseErr != nil {
			respondWithError(w, http.StatusBadRequest, parseErr.Error())
			return
		}
		names = append(names, quoteAdminIdentifier(name))
		args = append(args, value)
		holders = append(holders, fmt.Sprintf("$%d", len(args)))
	}
	sort.Strings(names)
	// Keep holder order aligned to sorted names.
	sortedArgs := make([]any, 0, len(names))
	sortedHolders := make([]string, 0, len(names))
	for idx, quotedName := range names {
		plainName := strings.Trim(quotedName, `"`)
		col := columnMap[plainName]
		value, parseErr := adminDatabaseParseValue(col, rawValues[plainName])
		if parseErr != nil {
			respondWithError(w, http.StatusBadRequest, parseErr.Error())
			return
		}
		sortedArgs = append(sortedArgs, value)
		sortedHolders = append(sortedHolders, fmt.Sprintf("$%d", idx+1))
	}

	insertSQL := fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES (%s)",
		quoteAdminIdentifier(tableName),
		strings.Join(names, ", "),
		strings.Join(sortedHolders, ", "),
	)
	if _, err := h.DB.Exec(insertSQL, sortedArgs...); err != nil {
		respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Failed to create row: %v", err))
		return
	}

	actorID, _ := r.Context().Value("userID").(string)
	_ = h.AuditService.LogAction(actorID, "database_create_row", tableName, nil, map[string]any{
		"table":   tableName,
		"columns": names,
	})
	respondWithJSON(w, http.StatusCreated, map[string]string{"message": "Row created"})
}

func (h *AdminOpsHandlers) AdminDatabaseUpdateRowHandler(w http.ResponseWriter, r *http.Request) {
	tableName := mux.Vars(r)["table"]
	columns, err := h.adminDatabaseEnsureTable(tableName)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Table not found")
		return
	}

	payload, err := decodeAdminDatabaseRequestBody(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	rawValues, _ := payload["values"].(map[string]any)
	rawKeys, _ := payload["keys"].(map[string]any)
	if len(rawValues) == 0 || len(rawKeys) == 0 {
		respondWithError(w, http.StatusBadRequest, "keys and values are required")
		return
	}

	columnMap := adminDatabaseColumnMap(columns)
	setParts := make([]string, 0)
	whereParts := make([]string, 0)
	args := make([]any, 0)

	for name, raw := range rawValues {
		col, ok := columnMap[name]
		if !ok {
			respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Unknown column: %s", name))
			return
		}
		value, parseErr := adminDatabaseParseValue(col, raw)
		if parseErr != nil {
			respondWithError(w, http.StatusBadRequest, parseErr.Error())
			return
		}
		args = append(args, value)
		setParts = append(setParts, fmt.Sprintf("%s = $%d", quoteAdminIdentifier(name), len(args)))
	}
	for name, raw := range rawKeys {
		col, ok := columnMap[name]
		if !ok {
			respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Unknown key column: %s", name))
			return
		}
		value, parseErr := adminDatabaseParseValue(col, raw)
		if parseErr != nil {
			respondWithError(w, http.StatusBadRequest, parseErr.Error())
			return
		}
		args = append(args, value)
		whereParts = append(whereParts, fmt.Sprintf("%s = $%d", quoteAdminIdentifier(name), len(args)))
	}
	if len(setParts) == 0 || len(whereParts) == 0 {
		respondWithError(w, http.StatusBadRequest, "No valid changes to save")
		return
	}

	updateSQL := fmt.Sprintf(
		"UPDATE %s SET %s WHERE %s",
		quoteAdminIdentifier(tableName),
		strings.Join(setParts, ", "),
		strings.Join(whereParts, " AND "),
	)
	result, err := h.DB.Exec(updateSQL, args...)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Failed to update row: %v", err))
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		respondWithError(w, http.StatusNotFound, "Row not found")
		return
	}

	actorID, _ := r.Context().Value("userID").(string)
	_ = h.AuditService.LogAction(actorID, "database_update_row", tableName, nil, map[string]any{
		"table":           tableName,
		"keys":            rawKeys,
		"updated_columns": mapsKeys(rawValues),
	})
	respondWithJSON(w, http.StatusOK, map[string]any{"message": "Row updated", "affected": affected})
}

func (h *AdminOpsHandlers) AdminDatabaseDeleteRowHandler(w http.ResponseWriter, r *http.Request) {
	tableName := mux.Vars(r)["table"]
	columns, err := h.adminDatabaseEnsureTable(tableName)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Table not found")
		return
	}

	payload, err := decodeAdminDatabaseRequestBody(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	rawKeys, _ := payload["keys"].(map[string]any)
	if len(rawKeys) == 0 {
		respondWithError(w, http.StatusBadRequest, "keys is required")
		return
	}

	columnMap := adminDatabaseColumnMap(columns)
	whereParts := make([]string, 0)
	args := make([]any, 0)
	for name, raw := range rawKeys {
		col, ok := columnMap[name]
		if !ok {
			respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Unknown key column: %s", name))
			return
		}
		value, parseErr := adminDatabaseParseValue(col, raw)
		if parseErr != nil {
			respondWithError(w, http.StatusBadRequest, parseErr.Error())
			return
		}
		args = append(args, value)
		whereParts = append(whereParts, fmt.Sprintf("%s = $%d", quoteAdminIdentifier(name), len(args)))
	}

	deleteSQL := fmt.Sprintf(
		"DELETE FROM %s WHERE %s",
		quoteAdminIdentifier(tableName),
		strings.Join(whereParts, " AND "),
	)
	result, err := h.DB.Exec(deleteSQL, args...)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Failed to delete row: %v", err))
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		respondWithError(w, http.StatusNotFound, "Row not found")
		return
	}

	actorID, _ := r.Context().Value("userID").(string)
	_ = h.AuditService.LogAction(actorID, "database_delete_row", tableName, nil, map[string]any{
		"table": tableName,
		"keys":  rawKeys,
	})
	respondWithJSON(w, http.StatusOK, map[string]any{"message": "Row deleted", "affected": affected})
}

func mapsKeys(values map[string]any) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
