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

func (h *AdminOpsHandlers) AdminQueueStopHandler(w http.ResponseWriter, r *http.Request) {
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

	result, err := h.EssaySubmissionService.StopQueueSubmissions(payload.SubmissionIDs)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	actorID, _ := r.Context().Value("userID").(string)
	_ = h.AuditService.LogAction(actorID, "stop_grading_queue", "essay_submission", nil, map[string]interface{}{
		"submission_ids": payload.SubmissionIDs,
		"accepted":       result.Accepted,
		"skipped":        result.Skipped,
	})
	respondWithJSON(w, http.StatusOK, result)
}

func getEnvPaths() []string {
	paths := []string{
		filepath.Join(".", ".env"),
		filepath.Join(".", "backend", ".env"),
	}
	seen := map[string]struct{}{}
	out := make([]string, 0, len(paths))
	for _, p := range paths {
		abs, err := filepath.Abs(p)
		if err != nil {
			continue
		}
		if _, ok := seen[abs]; ok {
			continue
		}
		seen[abs] = struct{}{}
		out = append(out, abs)
	}
	return out
}

func readEnvVarFromEnvFile(key string) (string, error) {
	paths := getEnvPaths()
	for _, path := range paths {
		content, err := os.ReadFile(path)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return "", err
		}

		scanner := bufio.NewScanner(bytes.NewReader(content))
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if strings.HasPrefix(line, key+"=") {
				return strings.TrimSpace(strings.TrimPrefix(line, key+"=")), nil
			}
		}
		if err := scanner.Err(); err != nil {
			return "", err
		}
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

func writeEnvVarToEnvFile(key, newValue string) error {
	newValue = strings.TrimSpace(newValue)
	if newValue == "" {
		return fmt.Errorf("value cannot be empty")
	}

	paths := getEnvPaths()
	for _, path := range paths {
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
			if strings.HasPrefix(trimmed, key+"=") {
				lines[i] = key + "=" + newValue
				updated = true
				break
			}
		}
		if !updated {
			lines = append(lines, key+"="+newValue)
		}

		output := strings.Join(lines, "\n")
		if !strings.HasSuffix(output, "\n") {
			output += "\n"
		}
		if writeErr := os.WriteFile(path, []byte(output), 0o600); writeErr != nil {
			return writeErr
		}
	}
	return nil
}

func (h *AdminOpsHandlers) AdminGetGeminiKeyMaskedHandler(w http.ResponseWriter, r *http.Request) {
	key, err := readEnvVarFromEnvFile("GEMINI_API_KEY")
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

	key, err := readEnvVarFromEnvFile("GEMINI_API_KEY")
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
	if err := writeEnvVarToEnvFile("GEMINI_API_KEY", payload.APIKey); err != nil {
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

func (h *AdminOpsHandlers) AdminGetLiteLLMConfigHandler(w http.ResponseWriter, r *http.Request) {
	key, err := readEnvVarFromEnvFile("LITELLM_API_KEY")
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to read LITELLM_API_KEY")
		return
	}
	baseURL, err := readEnvVarFromEnvFile("LITELLM_BASE_URL")
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to read LITELLM_BASE_URL")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{
		"masked_key": maskAPIKey(key),
		"base_url":   baseURL,
	})
}

func (h *AdminOpsHandlers) AdminRevealLiteLLMKeyHandler(w http.ResponseWriter, r *http.Request) {
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

	key, err := readEnvVarFromEnvFile("LITELLM_API_KEY")
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to read LITELLM_API_KEY")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{
		"api_key": key,
	})
}

func (h *AdminOpsHandlers) AdminUpdateLiteLLMConfigHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	if strings.TrimSpace(userID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	var payload struct {
		Password string `json:"password"`
		APIKey   string `json:"api_key"`
		BaseURL  string `json:"base_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if strings.TrimSpace(payload.APIKey) == "" && strings.TrimSpace(payload.BaseURL) == "" {
		respondWithError(w, http.StatusBadRequest, "api_key or base_url is required")
		return
	}
	if err := h.AuthService.VerifyPassword(userID, payload.Password); err != nil {
		respondWithError(w, http.StatusUnauthorized, "Password admin tidak valid")
		return
	}

	if strings.TrimSpace(payload.APIKey) != "" {
		if err := writeEnvVarToEnvFile("LITELLM_API_KEY", payload.APIKey); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to update .env LITELLM_API_KEY")
			return
		}
		if setErr := os.Setenv("LITELLM_API_KEY", strings.TrimSpace(payload.APIKey)); setErr != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to refresh LITELLM_API_KEY")
			return
		}
	}
	if strings.TrimSpace(payload.BaseURL) != "" {
		if err := writeEnvVarToEnvFile("LITELLM_BASE_URL", payload.BaseURL); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to update .env LITELLM_BASE_URL")
			return
		}
		if setErr := os.Setenv("LITELLM_BASE_URL", strings.TrimSpace(payload.BaseURL)); setErr != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to refresh LITELLM_BASE_URL")
			return
		}
	}
	if h.AIService != nil {
		if err := h.AIService.RefreshFromEnv(); err != nil {
			respondWithError(w, http.StatusBadRequest, "Gagal validasi konfigurasi LiteLLM")
			return
		}
	}

	_ = h.AuditService.LogAction(userID, "update_litellm_config", "ai_config", nil, nil)
	respondWithJSON(w, http.StatusOK, map[string]string{
		"message":    "Konfigurasi LiteLLM berhasil diperbarui",
		"masked_key": maskAPIKey(payload.APIKey),
	})
}

func (h *AdminOpsHandlers) AdminGetAIProviderHandler(w http.ResponseWriter, r *http.Request) {
	provider := strings.TrimSpace(os.Getenv("AI_PROVIDER"))
	if provider == "" {
		provider = "gemini"
	}
	model := strings.TrimSpace(os.Getenv("AI_MODEL"))
	if model == "" {
		model = "gemini-2.5-flash"
	}
	respondWithJSON(w, http.StatusOK, map[string]string{
		"provider": provider,
		"model":    model,
	})
}

func (h *AdminOpsHandlers) AdminUpdateAIProviderHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	if strings.TrimSpace(userID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	var payload struct {
		Provider string `json:"provider"`
		Model    string `json:"model"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	provider := strings.ToLower(strings.TrimSpace(payload.Provider))
	if provider != "gemini" && provider != "litellm" {
		respondWithError(w, http.StatusBadRequest, "provider harus gemini atau litellm")
		return
	}
	model := strings.TrimSpace(payload.Model)
	if model == "" {
		respondWithError(w, http.StatusBadRequest, "model is required")
		return
	}
	if provider == "gemini" {
		key := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
		if key == "" {
			key, _ = readEnvVarFromEnvFile("GEMINI_API_KEY")
		}
		if key == "" {
			respondWithError(w, http.StatusBadRequest, "GEMINI_API_KEY belum diatur")
			return
		}
	}
	if provider == "litellm" {
		baseURL := strings.TrimSpace(os.Getenv("LITELLM_BASE_URL"))
		if baseURL == "" {
			baseURL, _ = readEnvVarFromEnvFile("LITELLM_BASE_URL")
		}
		apiKey := strings.TrimSpace(os.Getenv("LITELLM_API_KEY"))
		if apiKey == "" {
			apiKey, _ = readEnvVarFromEnvFile("LITELLM_API_KEY")
		}
		if baseURL == "" || apiKey == "" {
			respondWithError(w, http.StatusBadRequest, "LITELLM_BASE_URL atau LITELLM_API_KEY belum diatur")
			return
		}
	}

	if err := writeEnvVarToEnvFile("AI_PROVIDER", provider); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update .env AI_PROVIDER")
		return
	}
	if err := writeEnvVarToEnvFile("AI_MODEL", model); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update .env AI_MODEL")
		return
	}
	if setErr := os.Setenv("AI_PROVIDER", provider); setErr != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to refresh AI_PROVIDER")
		return
	}
	if setErr := os.Setenv("AI_MODEL", model); setErr != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to refresh AI_MODEL")
		return
	}
	if h.AIService != nil {
		if err := h.AIService.RefreshFromEnv(); err != nil {
			respondWithError(w, http.StatusBadRequest, "Gagal validasi konfigurasi AI")
			return
		}
	}

	_ = h.AuditService.LogAction(userID, "update_ai_provider", "ai_config", nil, map[string]interface{}{
		"provider": provider,
		"model":    model,
	})
	respondWithJSON(w, http.StatusOK, map[string]string{
		"message":  "Konfigurasi AI berhasil diperbarui",
		"provider": provider,
		"model":    model,
	})
}

func (h *AdminOpsHandlers) AdminTestAIConnectionHandler(w http.ResponseWriter, r *http.Request) {
	if h.AIService == nil {
		respondWithError(w, http.StatusServiceUnavailable, "AI service is unavailable")
		return
	}
	latencyMs, err := h.AIService.TestConnection()
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":      "ok",
		"latency_ms":  latencyMs,
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
	"profile_change_auto_approve": {
		Key:         "profile_change_auto_approve",
		Description: "Setujui otomatis perubahan profil yang biasanya masuk approval",
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
		fallthrough
	case "profile_change_auto_approve":
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
