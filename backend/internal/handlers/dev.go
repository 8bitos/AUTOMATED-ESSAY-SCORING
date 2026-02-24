package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
)

// DevHandler handles development-related requests.
type DevHandler struct {
	DB *sql.DB
}

// NewDevHandler creates a new DevHandler.
func NewDevHandler(db *sql.DB) *DevHandler {
	return &DevHandler{DB: db}
}

// GetTables retrieves and returns a list of all tables in the public schema.
func (h *DevHandler) GetTables(w http.ResponseWriter, r *http.Request) {
	query := `
		SELECT table_name 
		FROM information_schema.tables 
		WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
		ORDER BY table_name;
	`

	rows, err := h.DB.Query(query)
	if err != nil {
		log.Printf("Error querying for tables: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			log.Printf("Error scanning table name: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		tables = append(tables, tableName)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Error iterating table rows: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(tables); err != nil {
		log.Printf("Error encoding tables to JSON: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}
}
