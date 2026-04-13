package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
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

type adminDatabaseForeignKey struct {
	ConstraintName string   `json:"constraint_name"`
	SourceTable    string   `json:"source_table"`
	SourceColumns  []string `json:"source_columns"`
	TargetTable    string   `json:"target_table"`
	TargetColumns  []string `json:"target_columns"`
	DeleteRule     string   `json:"delete_rule"`
	UpdateRule     string   `json:"update_rule"`
}

type adminDatabaseResetAnalysis struct {
	SelectedTables     []string                  `json:"selected_tables"`
	RecommendedTables  []string                  `json:"recommended_tables"`
	DeleteOrder        []string                  `json:"delete_order"`
	BlockingReferences []adminDatabaseForeignKey `json:"blocking_references"`
	RelatedReferences  []adminDatabaseForeignKey `json:"related_references"`
	PotentialErrors    []string                  `json:"potential_errors"`
	Recommendations    []string                  `json:"recommendations"`
	Cycles             [][]string                `json:"cycles,omitempty"`
}

type adminMediaItem struct {
	Name       string `json:"name"`
	Path       string `json:"path"`
	Category   string `json:"category"`
	Extension  string `json:"extension"`
	Size       int64  `json:"size"`
	ModifiedAt string `json:"modified_at"`
	MimeType   string `json:"mime_type"`
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

func uniqueSortedStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func mapsKeysSet(values map[string]struct{}) []string {
	result := make([]string, 0, len(values))
	for key := range values {
		result = append(result, key)
	}
	sort.Strings(result)
	return result
}

func slicesEqualString(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func normalizeCycle(cycle []string) []string {
	if len(cycle) == 0 {
		return cycle
	}
	minIdx := 0
	for i := 1; i < len(cycle); i++ {
		if cycle[i] < cycle[minIdx] {
			minIdx = i
		}
	}
	rotated := append(append([]string{}, cycle[minIdx:]...), cycle[:minIdx]...)
	reversed := make([]string, len(rotated))
	for i := range rotated {
		reversed[i] = rotated[len(rotated)-1-i]
	}
	if strings.Join(reversed, "|") < strings.Join(rotated, "|") {
		return reversed
	}
	return rotated
}

func uniqueCycles(cycles [][]string) [][]string {
	seen := map[string]struct{}{}
	result := make([][]string, 0, len(cycles))
	for _, cycle := range cycles {
		normalized := normalizeCycle(cycle)
		key := strings.Join(normalized, "|")
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, normalized)
	}
	sort.Slice(result, func(i, j int) bool {
		return strings.Join(result[i], "|") < strings.Join(result[j], "|")
	})
	return result
}

func adminMediaCategory(fileName string) (string, string) {
	ext := strings.ToLower(filepath.Ext(fileName))
	mimeType := mime.TypeByExtension(ext)
	switch ext {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp":
		return "gambar", mimeType
	case ".mp4", ".mov", ".avi", ".mkv", ".webm":
		return "video", mimeType
	case ".mp3", ".wav", ".ogg", ".m4a", ".flac":
		return "audio", mimeType
	case ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv":
		return "dokumen", mimeType
	case ".zip", ".rar", ".7z", ".tar", ".gz":
		return "arsip", mimeType
	default:
		return "lainnya", mimeType
	}
}

func (h *AdminOpsHandlers) adminDatabaseListForeignKeys() ([]adminDatabaseForeignKey, error) {
	rows, err := h.DB.Query(`
		SELECT
			tc.constraint_name,
			tc.table_name AS source_table,
			kcu.column_name AS source_column,
			ccu.table_name AS target_table,
			ccu.column_name AS target_column,
			rc.delete_rule,
			rc.update_rule,
			kcu.ordinal_position
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
		  ON tc.constraint_name = kcu.constraint_name
		 AND tc.constraint_schema = kcu.constraint_schema
		JOIN information_schema.constraint_column_usage ccu
		  ON tc.constraint_name = ccu.constraint_name
		 AND tc.constraint_schema = ccu.constraint_schema
		JOIN information_schema.referential_constraints rc
		  ON tc.constraint_name = rc.constraint_name
		 AND tc.constraint_schema = rc.constraint_schema
		WHERE tc.constraint_type = 'FOREIGN KEY'
		  AND tc.constraint_schema = 'public'
		ORDER BY tc.constraint_name, kcu.ordinal_position
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	grouped := map[string]*adminDatabaseForeignKey{}
	order := make([]string, 0)
	for rows.Next() {
		var constraintName, sourceTable, sourceColumn, targetTable, targetColumn, deleteRule, updateRule string
		var ordinalPosition int
		if err := rows.Scan(&constraintName, &sourceTable, &sourceColumn, &targetTable, &targetColumn, &deleteRule, &updateRule, &ordinalPosition); err != nil {
			return nil, err
		}
		item, ok := grouped[constraintName]
		if !ok {
			item = &adminDatabaseForeignKey{
				ConstraintName: constraintName,
				SourceTable:    sourceTable,
				TargetTable:    targetTable,
				DeleteRule:     deleteRule,
				UpdateRule:     updateRule,
			}
			grouped[constraintName] = item
			order = append(order, constraintName)
		}
		item.SourceColumns = append(item.SourceColumns, sourceColumn)
		item.TargetColumns = append(item.TargetColumns, targetColumn)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	result := make([]adminDatabaseForeignKey, 0, len(order))
	for _, key := range order {
		result = append(result, *grouped[key])
	}
	return result, nil
}

func (h *AdminOpsHandlers) adminDatabaseAnalyzeReset(selected []string) (*adminDatabaseResetAnalysis, error) {
	selected = uniqueSortedStrings(selected)
	if len(selected) == 0 {
		return nil, fmt.Errorf("tables is required")
	}
	allowedTables, err := h.adminDatabaseListTables()
	if err != nil {
		return nil, err
	}
	allowedSet := make(map[string]struct{}, len(allowedTables))
	for _, table := range allowedTables {
		allowedSet[table] = struct{}{}
	}
	for _, table := range selected {
		if _, ok := allowedSet[table]; !ok {
			return nil, fmt.Errorf("table not found: %s", table)
		}
	}

	foreignKeys, err := h.adminDatabaseListForeignKeys()
	if err != nil {
		return nil, err
	}

	required := make(map[string]struct{}, len(selected))
	for _, table := range selected {
		required[table] = struct{}{}
	}
	blockers := make([]adminDatabaseForeignKey, 0)
	related := make([]adminDatabaseForeignKey, 0)
	potentialErrors := make([]string, 0)

	changed := true
	for changed {
		changed = false
		for _, fk := range foreignKeys {
			_, targetSelected := required[fk.TargetTable]
			if !targetSelected {
				continue
			}
			related = append(related, fk)
			if fk.DeleteRule != "NO ACTION" && fk.DeleteRule != "RESTRICT" {
				continue
			}
			if _, ok := required[fk.SourceTable]; ok {
				continue
			}
			required[fk.SourceTable] = struct{}{}
			blockers = append(blockers, fk)
			potentialErrors = append(potentialErrors,
				fmt.Sprintf("Menghapus isi tabel %s akan gagal karena constraint %s dari tabel %s (%s -> %s).",
					fk.TargetTable,
					fk.ConstraintName,
					fk.SourceTable,
					strings.Join(fk.SourceColumns, ", "),
					strings.Join(fk.TargetColumns, ", "),
				),
			)
			changed = true
		}
	}

	recommended := mapsKeysSet(required)
	graph := make(map[string][]string, len(recommended))
	indegree := make(map[string]int, len(recommended))
	for _, table := range recommended {
		graph[table] = []string{}
		indegree[table] = 0
	}
	for _, fk := range foreignKeys {
		if _, sourceOk := required[fk.SourceTable]; !sourceOk {
			continue
		}
		if _, targetOk := required[fk.TargetTable]; !targetOk {
			continue
		}
		graph[fk.TargetTable] = append(graph[fk.TargetTable], fk.SourceTable)
		indegree[fk.SourceTable]++
	}

	queue := make([]string, 0)
	for _, table := range recommended {
		if indegree[table] == 0 {
			queue = append(queue, table)
		}
	}
	sort.Strings(queue)
	topo := make([]string, 0, len(recommended))
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		topo = append(topo, current)
		children := append([]string{}, graph[current]...)
		sort.Strings(children)
		for _, child := range children {
			indegree[child]--
			if indegree[child] == 0 {
				queue = append(queue, child)
				sort.Strings(queue)
			}
		}
	}

	cycles := make([][]string, 0)
	if len(topo) != len(recommended) {
		visited := map[string]int{}
		stack := make([]string, 0)
		var dfs func(string)
		dfs = func(node string) {
			visited[node] = 1
			stack = append(stack, node)
			for _, child := range graph[node] {
				if visited[child] == 0 {
					dfs(child)
					continue
				}
				if visited[child] == 1 {
					idx := -1
					for i := len(stack) - 1; i >= 0; i-- {
						if stack[i] == child {
							idx = i
							break
						}
					}
					if idx >= 0 {
						cycles = append(cycles, append([]string{}, stack[idx:]...))
					}
				}
			}
			stack = stack[:len(stack)-1]
			visited[node] = 2
		}
		for _, table := range recommended {
			if visited[table] == 0 {
				dfs(table)
			}
		}
		cycles = uniqueCycles(cycles)
		potentialErrors = append(potentialErrors, "Ada siklus dependency antar tabel terpilih/rekomendasi, sehingga urutan reset otomatis bisa gagal.")
	}

	deleteOrder := make([]string, 0, len(topo))
	for i := len(topo) - 1; i >= 0; i-- {
		deleteOrder = append(deleteOrder, topo[i])
	}

	recommendations := make([]string, 0)
	if len(blockers) > 0 {
		extras := make([]string, 0)
		selectedSet := make(map[string]struct{}, len(selected))
		for _, table := range selected {
			selectedSet[table] = struct{}{}
		}
		for _, table := range recommended {
			if _, ok := selectedSet[table]; ok {
				continue
			}
			extras = append(extras, table)
		}
		if len(extras) > 0 {
			recommendations = append(recommendations, fmt.Sprintf("Tambahkan tabel berikut ke reset agar tidak bentrok foreign key: %s.", strings.Join(extras, ", ")))
		}
	}
	if len(cycles) > 0 {
		recommendations = append(recommendations, "Periksa siklus dependency dan reset tabel terkait secara bertahap atau kosongkan data child lebih dulu.")
	}
	if len(recommendations) == 0 {
		recommendations = append(recommendations, "Reset dapat dijalankan dengan urutan hapus yang direkomendasikan.")
	}

	return &adminDatabaseResetAnalysis{
		SelectedTables:     selected,
		RecommendedTables:  recommended,
		DeleteOrder:        deleteOrder,
		BlockingReferences: blockers,
		RelatedReferences:  related,
		PotentialErrors:    uniqueSortedStrings(potentialErrors),
		Recommendations:    recommendations,
		Cycles:             cycles,
	}, nil
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
	loadAll := false
	if raw := strings.TrimSpace(r.URL.Query().Get("size")); raw != "" {
		if strings.EqualFold(raw, "all") {
			loadAll = true
		} else {
			parsed, parseErr := strconv.Atoi(raw)
			if parseErr != nil || parsed < 1 || parsed > 200 {
				respondWithError(w, http.StatusBadRequest, "Invalid size")
				return
			}
			size = parsed
		}
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

	dataQuery := fmt.Sprintf(
		"SELECT %s FROM %s%s ORDER BY %s",
		strings.Join(columnNames, ", "),
		quoteAdminIdentifier(tableName),
		whereSQL,
		strings.Join(orderParts, ", "),
	)
	if loadAll {
		size = int(total)
		if size < 1 {
			size = 1
		}
		page = 1
	} else {
		args = append(args, size, (page-1)*size)
		dataQuery = fmt.Sprintf("%s LIMIT $%d OFFSET $%d", dataQuery, len(args)-1, len(args))
	}
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

func (h *AdminOpsHandlers) AdminMediaListHandler(w http.ResponseWriter, r *http.Request) {
	category := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("category")))
	query := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))

	entries, err := os.ReadDir("./uploads")
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load uploads")
		return
	}

	items := make([]adminMediaItem, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, infoErr := entry.Info()
		if infoErr != nil {
			continue
		}
		itemCategory, mimeType := adminMediaCategory(entry.Name())
		if category != "" && category != "semua" && category != itemCategory {
			continue
		}
		if query != "" && !strings.Contains(strings.ToLower(entry.Name()), query) {
			continue
		}
		items = append(items, adminMediaItem{
			Name:       entry.Name(),
			Path:       "/uploads/" + entry.Name(),
			Category:   itemCategory,
			Extension:  strings.TrimPrefix(strings.ToLower(filepath.Ext(entry.Name())), "."),
			Size:       info.Size(),
			ModifiedAt: info.ModTime().Format(time.RFC3339),
			MimeType:   mimeType,
		})
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].ModifiedAt > items[j].ModifiedAt
	})

	respondWithJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *AdminOpsHandlers) AdminMediaDeleteHandler(w http.ResponseWriter, r *http.Request) {
	payload, err := decodeAdminDatabaseRequestBody(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	name, _ := payload["name"].(string)
	name = strings.TrimSpace(filepath.Base(name))
	if name == "" || name == "." || name == "/" {
		respondWithError(w, http.StatusBadRequest, "Nama file tidak valid")
		return
	}

	uploadsAbs, err := filepath.Abs("./uploads")
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to resolve uploads directory")
		return
	}
	targetAbs, err := filepath.Abs(filepath.Join("./uploads", name))
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to resolve upload file")
		return
	}
	if targetAbs != uploadsAbs && !strings.HasPrefix(targetAbs, uploadsAbs+string(os.PathSeparator)) {
		respondWithError(w, http.StatusBadRequest, "Invalid media path")
		return
	}
	if err := os.Remove(targetAbs); err != nil {
		if os.IsNotExist(err) {
			respondWithError(w, http.StatusNotFound, "File tidak ditemukan")
			return
		}
		respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Gagal menghapus file: %v", err))
		return
	}

	actorID, _ := r.Context().Value("userID").(string)
	_ = h.AuditService.LogAction(actorID, "database_delete_media", name, nil, map[string]any{
		"file_name": name,
		"path":      "/uploads/" + name,
	})
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "File berhasil dihapus"})
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

	if tableName == "users" {
		var role string
		checkSQL := fmt.Sprintf(
			"SELECT peran FROM %s WHERE %s",
			quoteAdminIdentifier(tableName),
			strings.Join(whereParts, " AND "),
		)
		if err := h.DB.QueryRow(checkSQL, args...).Scan(&role); err == nil && strings.EqualFold(strings.TrimSpace(role), "superadmin") {
			respondWithError(w, http.StatusForbidden, "Role superadmin tidak boleh dihapus")
			return
		}
	}

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

func (h *AdminOpsHandlers) AdminDatabaseResetAnalysisHandler(w http.ResponseWriter, r *http.Request) {
	payload, err := decodeAdminDatabaseRequestBody(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	rawTables, _ := payload["tables"].([]any)
	tables := make([]string, 0, len(rawTables))
	for _, raw := range rawTables {
		if name, ok := raw.(string); ok && strings.TrimSpace(name) != "" {
			tables = append(tables, strings.TrimSpace(name))
		}
	}
	analysis, err := h.adminDatabaseAnalyzeReset(tables)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondWithJSON(w, http.StatusOK, analysis)
}

func (h *AdminOpsHandlers) AdminDatabaseResetHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	if strings.TrimSpace(userID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	payload, err := decodeAdminDatabaseRequestBody(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	rawTables, _ := payload["tables"].([]any)
	tables := make([]string, 0, len(rawTables))
	for _, raw := range rawTables {
		if name, ok := raw.(string); ok && strings.TrimSpace(name) != "" {
			tables = append(tables, strings.TrimSpace(name))
		}
	}
	password, _ := payload["password"].(string)
	if err := h.AuthService.VerifyPassword(userID, password); err != nil {
		respondWithError(w, http.StatusUnauthorized, "Password admin tidak valid")
		return
	}
	analysis, err := h.adminDatabaseAnalyzeReset(tables)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	if !slicesEqualString(analysis.SelectedTables, analysis.RecommendedTables) {
		respondWithJSON(w, http.StatusBadRequest, map[string]any{
			"message":  "Reset diblokir karena masih ada dependency foreign key di tabel lain.",
			"analysis": analysis,
		})
		return
	}
	if len(analysis.Cycles) > 0 {
		respondWithJSON(w, http.StatusBadRequest, map[string]any{
			"message":  "Reset diblokir karena ada siklus dependency antar tabel.",
			"analysis": analysis,
		})
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to start reset transaction")
		return
	}
	defer tx.Rollback()

	affectedTables := make([]map[string]any, 0, len(analysis.DeleteOrder))
	for _, tableName := range analysis.DeleteOrder {
		query := fmt.Sprintf("DELETE FROM %s", quoteAdminIdentifier(tableName))
		result, execErr := tx.Exec(query)
		if execErr != nil {
			respondWithJSON(w, http.StatusBadRequest, map[string]any{
				"message":  fmt.Sprintf("Reset gagal saat mengosongkan tabel %s", tableName),
				"analysis": analysis,
				"error":    execErr.Error(),
			})
			return
		}
		affected, _ := result.RowsAffected()
		affectedTables = append(affectedTables, map[string]any{
			"table":        tableName,
			"deleted_rows": affected,
		})
	}

	if err := tx.Commit(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to commit reset transaction")
		return
	}

	actorID, _ := r.Context().Value("userID").(string)
	_ = h.AuditService.LogAction(actorID, "database_reset_tables", "database", nil, map[string]any{
		"tables":       analysis.SelectedTables,
		"delete_order": analysis.DeleteOrder,
	})
	respondWithJSON(w, http.StatusOK, map[string]any{
		"message":  "Reset tabel berhasil dijalankan",
		"tables":   affectedTables,
		"analysis": analysis,
	})
}

func (h *AdminOpsHandlers) AdminDatabaseExportHandler(w http.ResponseWriter, r *http.Request) {
	tableNames, err := h.adminDatabaseListTables()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load database tables")
		return
	}

	var sqlContent strings.Builder
	sqlContent.WriteString("-- Database Export\n")
	sqlContent.WriteString(fmt.Sprintf("-- Exported at: %s\n", time.Now().Format(time.RFC3339)))
	sqlContent.WriteString("-- Excludes: uploads/media files\n")
	sqlContent.WriteString("\n")

	for _, tableName := range tableNames {
		columns, err := h.adminDatabaseGetColumns(tableName)
		if err != nil {
			continue
		}

		columnNames := make([]string, 0, len(columns))
		columnQuoted := make([]string, 0, len(columns))
		for _, col := range columns {
			columnNames = append(columnNames, col.Name)
			columnQuoted = append(columnQuoted, quoteAdminIdentifier(col.Name))
		}

		query := fmt.Sprintf(
			"SELECT %s FROM %s ORDER BY %s",
			strings.Join(columnQuoted, ", "),
			quoteAdminIdentifier(tableName),
			quoteAdminIdentifier(columnNames[0]),
		)
		rows, err := h.DB.Query(query)
		if err != nil {
			continue
		}
		defer rows.Close()

		sqlContent.WriteString(fmt.Sprintf("\n-- Table: %s\n", tableName))

		hasRows := false
		for rows.Next() {
			hasRows = true
			dest := make([]any, len(columnNames))
			destPtrs := make([]any, len(columnNames))
			for i := range dest {
				destPtrs[i] = &dest[i]
			}
			if err := rows.Scan(destPtrs...); err != nil {
				continue
			}

			values := make([]string, 0, len(dest))
			for i, val := range dest {
				absVal := normalizeDatabaseValue(val)
				if absVal == nil {
					values = append(values, "NULL")
				} else if b, ok := absVal.([]byte); ok {
					values = append(values, "'"+strings.ReplaceAll(string(b), "'", "''")+"'")
				} else if s, ok := absVal.(string); ok {
					values = append(values, "'"+strings.ReplaceAll(s, "'", "''")+"'")
				} else {
					values = append(values, fmt.Sprintf("%v", absVal))
				}
			}

			insertStmt := fmt.Sprintf(
				"INSERT INTO %s (%s) VALUES (%s);\n",
				quoteAdminIdentifier(tableName),
				strings.Join(columnQuoted, ", "),
				strings.Join(values, ", "),
			)
			sqlContent.WriteString(insertStmt)
		}

		if !hasRows {
			sqlContent.WriteString(fmt.Sprintf("-- (No data in table %s)\n", tableName))
		}
	}

	w.Header().Set("Content-Type", "application/sql")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=database_export_%s.sql", time.Now().Format("2006-01-02_15-04-05")))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(sqlContent.String())))
	if _, err := w.Write([]byte(sqlContent.String())); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to write export file")
		return
	}

	actorID, _ := r.Context().Value("userID").(string)
	_ = h.AuditService.LogAction(actorID, "database_export", "database", nil, map[string]any{
		"tables_count": len(tableNames),
	})
}

func mapsKeys(values map[string]any) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
