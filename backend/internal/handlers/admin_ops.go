package handlers

import (
	"api-backend/internal/services"
	"bufio"
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gorilla/mux"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type AdminOpsHandlers struct {
	DB                     *sql.DB
	AuthService            *services.AuthService
	EssaySubmissionService *services.EssaySubmissionService
	AIService              *services.AIService
	SettingService         *services.SystemSettingService
	AuditService           *services.AdminAuditService
	QuestionBankService    *services.QuestionBankService
}

func NewAdminOpsHandlers(db *sql.DB, authService *services.AuthService, essaySubmissionService *services.EssaySubmissionService, aiService *services.AIService, settingService *services.SystemSettingService, auditService *services.AdminAuditService, questionBankService *services.QuestionBankService) *AdminOpsHandlers {
	return &AdminOpsHandlers{
		DB:                     db,
		AuthService:            authService,
		EssaySubmissionService: essaySubmissionService,
		AIService:              aiService,
		SettingService:         settingService,
		AuditService:           auditService,
		QuestionBankService:    questionBankService,
	}
}

func (h *AdminOpsHandlers) AdminAPIHealthHandler(w http.ResponseWriter, r *http.Request) {
	health, err := h.AuthService.GetAdminAPIHealth()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load API health")
		return
	}
	respondWithJSON(w, http.StatusOK, health)
}

func (h *AdminOpsHandlers) AdminQueueSummaryHandler(w http.ResponseWriter, r *http.Request) {
	summary, err := h.EssaySubmissionService.GetAdminQueueSummary()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load grading queue summary")
		return
	}
	respondWithJSON(w, http.StatusOK, summary)
}

func parseAdminQueueDate(raw string, isEnd bool) (*time.Time, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	if parsed, err := time.Parse(time.RFC3339, trimmed); err == nil {
		return &parsed, nil
	}
	if parsed, err := time.Parse("2006-01-02", trimmed); err == nil {
		if isEnd {
			parsed = parsed.Add(24 * time.Hour)
		}
		return &parsed, nil
	}
	return nil, errInvalidDateFormat
}

var errInvalidDateFormat = errors.New("invalid date format")

func (h *AdminOpsHandlers) AdminQueueJobsHandler(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	classID := r.URL.Query().Get("class_id")

	from, err := parseAdminQueueDate(r.URL.Query().Get("from"), false)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid from date format. Use YYYY-MM-DD or RFC3339.")
		return
	}
	to, err := parseAdminQueueDate(r.URL.Query().Get("to"), true)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid to date format. Use YYYY-MM-DD or RFC3339.")
		return
	}

	page := 1
	if raw := r.URL.Query().Get("page"); strings.TrimSpace(raw) != "" {
		parsed, parseErr := strconv.Atoi(raw)
		if parseErr != nil || parsed < 1 {
			respondWithError(w, http.StatusBadRequest, "Invalid page")
			return
		}
		page = parsed
	}
	size := 20
	if raw := r.URL.Query().Get("size"); strings.TrimSpace(raw) != "" {
		parsed, parseErr := strconv.Atoi(raw)
		if parseErr != nil || parsed < 1 {
			respondWithError(w, http.StatusBadRequest, "Invalid size")
			return
		}
		size = parsed
	}

	result, listErr := h.EssaySubmissionService.ListAdminQueueJobs(status, classID, from, to, page, size)
	if listErr != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load grading queue jobs")
		return
	}
	respondWithJSON(w, http.StatusOK, result)
}

func (h *AdminOpsHandlers) AdminQueueRetryHandler(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		SubmissionIDs []string `json:"submission_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if len(payload.SubmissionIDs) == 0 {
		respondWithError(w, http.StatusBadRequest, "submission_ids is required")
		return
	}

	if len(payload.SubmissionIDs) > 100 {
		respondWithError(w, http.StatusBadRequest, "Maximum 100 submission_ids per request")
		return
	}

	result, err := h.EssaySubmissionService.RetryQueueSubmissions(payload.SubmissionIDs)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	actorID, _ := r.Context().Value("userID").(string)
	_ = h.AuditService.LogAction(actorID, "retry_grading_queue", "essay_submission", nil, map[string]interface{}{
		"submission_ids": payload.SubmissionIDs,
		"accepted":       result.Accepted,
		"skipped":        result.Skipped,
	})
	respondWithJSON(w, http.StatusOK, result)
}

func getBackendEnvPath() string {
	return filepath.Join(".", ".env")
}

func readGeminiKeyFromEnvFile() (string, error) {
	path := getBackendEnvPath()
	content, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}

	scanner := bufio.NewScanner(bytes.NewReader(content))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "GEMINI_API_KEY=") {
			return strings.TrimSpace(strings.TrimPrefix(line, "GEMINI_API_KEY=")), nil
		}
	}
	if err := scanner.Err(); err != nil {
		return "", err
	}
	return "", nil
}

func maskAPIKey(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if len(value) <= 8 {
		return strings.Repeat("*", len(value))
	}
	return value[:4] + strings.Repeat("*", len(value)-8) + value[len(value)-4:]
}

func writeGeminiKeyToEnvFile(newKey string) error {
	path := getBackendEnvPath()
	newKey = strings.TrimSpace(newKey)
	if newKey == "" {
		return fmt.Errorf("api key cannot be empty")
	}

	content, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}

	lines := []string{}
	if len(content) > 0 {
		lines = strings.Split(string(content), "\n")
	}

	updated := false
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "GEMINI_API_KEY=") {
			lines[i] = "GEMINI_API_KEY=" + newKey
			updated = true
			break
		}
	}
	if !updated {
		lines = append(lines, "GEMINI_API_KEY="+newKey)
	}

	output := strings.Join(lines, "\n")
	if !strings.HasSuffix(output, "\n") {
		output += "\n"
	}
	return os.WriteFile(path, []byte(output), 0o600)
}

func (h *AdminOpsHandlers) AdminGetGeminiKeyMaskedHandler(w http.ResponseWriter, r *http.Request) {
	key, err := readGeminiKeyFromEnvFile()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to read GEMINI_API_KEY")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{
		"masked_key": maskAPIKey(key),
	})
}

func (h *AdminOpsHandlers) AdminRevealGeminiKeyHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	if strings.TrimSpace(userID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	var payload struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.AuthService.VerifyPassword(userID, payload.Password); err != nil {
		respondWithError(w, http.StatusUnauthorized, "Password admin tidak valid")
		return
	}

	key, err := readGeminiKeyFromEnvFile()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to read GEMINI_API_KEY")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{
		"api_key": key,
	})
}

func (h *AdminOpsHandlers) AdminUpdateGeminiKeyHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	if strings.TrimSpace(userID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	var payload struct {
		Password string `json:"password"`
		APIKey   string `json:"api_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if strings.TrimSpace(payload.APIKey) == "" {
		respondWithError(w, http.StatusBadRequest, "api_key is required")
		return
	}
	if err := h.AuthService.VerifyPassword(userID, payload.Password); err != nil {
		respondWithError(w, http.StatusUnauthorized, "Password admin tidak valid")
		return
	}
	if err := writeGeminiKeyToEnvFile(payload.APIKey); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update .env GEMINI_API_KEY")
		return
	}
	if setErr := os.Setenv("GEMINI_API_KEY", strings.TrimSpace(payload.APIKey)); setErr != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to refresh GEMINI_API_KEY")
		return
	}
	if h.AIService != nil {
		if err := h.AIService.UpdateAPIKey(payload.APIKey); err != nil {
			respondWithError(w, http.StatusBadRequest, "Gagal validasi API key baru")
			return
		}
	}
	_ = h.AuditService.LogAction(userID, "update_gemini_api_key", "ai_config", nil, nil)

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message":    "GEMINI_API_KEY berhasil diperbarui",
		"masked_key": maskAPIKey(payload.APIKey),
	})
}

type adminSettingMeta struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description"`
	Type        string `json:"type"`
}

var adminSettingWhitelist = map[string]adminSettingMeta{
	"grading_mode": {
		Key:         "grading_mode",
		Description: "Mode penilaian AI: instant atau queued",
		Type:        "enum",
	},
	"ai_retry_enabled": {
		Key:         "ai_retry_enabled",
		Description: "Aktif/nonaktif retry grading AI",
		Type:        "boolean",
	},
	"ai_retry_max_attempts": {
		Key:         "ai_retry_max_attempts",
		Description: "Jumlah maksimum retry grading AI",
		Type:        "integer",
	},
	"queue_max_size": {
		Key:         "queue_max_size",
		Description: "Batas maksimum antrean grading",
		Type:        "integer",
	},
	"superadmin_allow_override_grade": {
		Key:         "superadmin_allow_override_grade",
		Description: "Izinkan superadmin edit/hapus nilai",
		Type:        "boolean",
	},
	"superadmin_allow_override_question_bank": {
		Key:         "superadmin_allow_override_question_bank",
		Description: "Izinkan superadmin edit/hapus bank soal",
		Type:        "boolean",
	},
	"superadmin_allow_delete_class": {
		Key:         "superadmin_allow_delete_class",
		Description: "Izinkan superadmin menghapus kelas",
		Type:        "boolean",
	},
	"superadmin_allow_delete_material": {
		Key:         "superadmin_allow_delete_material",
		Description: "Izinkan superadmin menghapus materi",
		Type:        "boolean",
	},
	"notification_poll_interval_seconds": {
		Key:         "notification_poll_interval_seconds",
		Description: "Interval auto-refresh notifikasi realtime (detik)",
		Type:        "integer",
	},
}

func validateSettingValue(key, value string) (string, error) {
	value = strings.TrimSpace(value)
	switch key {
	case "grading_mode":
		v := strings.ToLower(value)
		if v != "instant" && v != "queued" {
			return "", fmt.Errorf("grading_mode must be instant or queued")
		}
		return v, nil
	case "ai_retry_enabled":
		fallthrough
	case "superadmin_allow_override_grade":
		fallthrough
	case "superadmin_allow_override_question_bank":
		fallthrough
	case "superadmin_allow_delete_class":
		fallthrough
	case "superadmin_allow_delete_material":
		v := strings.ToLower(value)
		if v != "true" && v != "false" {
			return "", fmt.Errorf("%s must be true or false", key)
		}
		return v, nil
	case "ai_retry_max_attempts":
		n, err := strconv.Atoi(value)
		if err != nil || n < 0 || n > 10 {
			return "", fmt.Errorf("ai_retry_max_attempts must be between 0 and 10")
		}
		return strconv.Itoa(n), nil
	case "queue_max_size":
		n, err := strconv.Atoi(value)
		if err != nil || n < 10 || n > 5000 {
			return "", fmt.Errorf("queue_max_size must be between 10 and 5000")
		}
		return strconv.Itoa(n), nil
	case "notification_poll_interval_seconds":
		n, err := strconv.Atoi(value)
		if err != nil || n < 5 || n > 300 {
			return "", fmt.Errorf("notification_poll_interval_seconds must be between 5 and 300")
		}
		return strconv.Itoa(n), nil
	default:
		return "", fmt.Errorf("setting is not allowed")
	}
}

func (h *AdminOpsHandlers) AdminListSettingsHandler(w http.ResponseWriter, r *http.Request) {
	if h.SettingService == nil {
		respondWithError(w, http.StatusInternalServerError, "Settings service is unavailable")
		return
	}

	items := make([]adminSettingMeta, 0, len(adminSettingWhitelist))
	for key, meta := range adminSettingWhitelist {
		value, err := h.SettingService.GetSetting(key)
		if err != nil {
			if key == "grading_mode" {
				mode, modeErr := h.SettingService.GetGradingMode()
				if modeErr != nil {
					respondWithError(w, http.StatusInternalServerError, "Failed to load settings")
					return
				}
				meta.Value = mode
			} else if key == "notification_poll_interval_seconds" {
				meta.Value = "30"
			} else {
				meta.Value = ""
			}
		} else {
			meta.Value = value
		}
		items = append(items, meta)
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}

func (h *AdminOpsHandlers) AdminUpdateSettingHandler(w http.ResponseWriter, r *http.Request) {
	if h.SettingService == nil {
		respondWithError(w, http.StatusInternalServerError, "Settings service is unavailable")
		return
	}
	key := mux.Vars(r)["key"]
	if _, ok := adminSettingWhitelist[key]; !ok {
		respondWithError(w, http.StatusBadRequest, "Setting key is not allowed")
		return
	}

	var payload struct {
		Value string `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	value, err := validateSettingValue(key, payload.Value)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	if key == "grading_mode" {
		if err := h.SettingService.SetGradingMode(value); err != nil {
			respondWithError(w, http.StatusBadRequest, err.Error())
			return
		}
	} else {
		if err := h.SettingService.SetSetting(key, value); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to save setting")
			return
		}
	}
	actorID, _ := r.Context().Value("userID").(string)
	_ = h.AuditService.LogAction(actorID, "update_system_setting", "system_setting", &key, map[string]interface{}{
		"value": value,
	})

	respondWithJSON(w, http.StatusOK, map[string]string{
		"key":   key,
		"value": value,
	})
}

func (h *AdminOpsHandlers) NotificationConfigHandler(w http.ResponseWriter, r *http.Request) {
	interval := 30
	if h.SettingService != nil {
		raw, err := h.SettingService.GetSetting("notification_poll_interval_seconds")
		if err == nil {
			if n, parseErr := strconv.Atoi(strings.TrimSpace(raw)); parseErr == nil && n >= 5 && n <= 300 {
				interval = n
			}
		}
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"poll_interval_seconds": interval,
	})
}

func (h *AdminOpsHandlers) isOverrideAllowed(key string) (bool, error) {
	if h.SettingService == nil {
		return true, nil
	}
	raw, err := h.SettingService.GetSetting(key)
	if err != nil {
		if err == sql.ErrNoRows {
			return true, nil
		}
		return false, err
	}
	v := strings.ToLower(strings.TrimSpace(raw))
	if v == "" {
		return true, nil
	}
	return v == "true", nil
}

func (h *AdminOpsHandlers) AdminAuditLogsHandler(w http.ResponseWriter, r *http.Request) {
	if h.AuditService == nil {
		respondWithError(w, http.StatusInternalServerError, "Audit service is unavailable")
		return
	}
	actorID := r.URL.Query().Get("actor_id")
	action := r.URL.Query().Get("action")
	q := r.URL.Query().Get("q")

	page := 1
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 {
			respondWithError(w, http.StatusBadRequest, "Invalid page")
			return
		}
		page = parsed
	}
	size := 20
	if raw := strings.TrimSpace(r.URL.Query().Get("size")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 {
			respondWithError(w, http.StatusBadRequest, "Invalid size")
			return
		}
		size = parsed
	}

	resp, err := h.AuditService.ListLogs(actorID, action, q, page, size)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load audit logs")
		return
	}
	respondWithJSON(w, http.StatusOK, resp)
}
