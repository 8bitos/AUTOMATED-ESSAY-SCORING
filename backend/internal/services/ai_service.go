package services

import (
	"api-backend/internal/models" // Mengimpor definisi model yang diperlukan (misalnya, GradeEssayRequest, GradeEssayResponse).
	"bytes"                       // Mengimpor package bytes untuk membangun string prompt secara efisien.
	"context"                     // Mengimpor package context untuk mengelola batas waktu dan pembatalan.
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json" // Mengimpor package encoding/json untuk bekerja dengan JSON.
	"fmt"           // Mengimpor package fmt untuk format string dan error.
	"log"           // Mengimpor package log untuk logging.
	"os"            // Mengimpor package os untuk berinteraksi dengan sistem operasi (variabel lingkungan).
	"strconv"
	"strings" // Mengimpor package strings untuk normalisasi aspek.
	"sync"
	"time"

	"github.com/google/generative-ai-go/genai" // Mengimpor klien Google Generative AI.
	"google.golang.org/api/option"             // Mengimpor package option untuk konfigurasi klien Google API.
)

// AIService menangani logika untuk berinteraksi dengan model AI Gemini.
type AIService struct {
	client          *genai.GenerativeModel // Klien model Gemini yang akan digunakan untuk generate konten.
	db              *sql.DB
	modelName       string
	dailyTokenLimit int64
	aiLimiterMu     sync.Mutex
	modelMu         sync.RWMutex
	lastRequestAt   time.Time
	aiMinInterval   time.Duration
}

// NewAIService membuat instance baru dari AIService, menginisialisasi klien Gemini.
// Ini membaca GEMINI_API_KEY dari variabel lingkungan.
func NewAIService(db *sql.DB) (*AIService, error) {
	// Mendapatkan GEMINI_API_KEY dari variabel lingkungan.
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY environment variable not set")
	}

	modelName := "gemini-2.5-flash"
	model, err := buildGeminiModel(apiKey, modelName)
	if err != nil {
		return nil, err
	}

	dailyLimit := int64(0)
	if value := strings.TrimSpace(os.Getenv("GEMINI_DAILY_TOKEN_LIMIT")); value != "" {
		if parsed, parseErr := strconv.ParseInt(value, 10, 64); parseErr == nil && parsed > 0 {
			dailyLimit = parsed
		}
	}
	rpmLimit := int64(5)
	if value := strings.TrimSpace(os.Getenv("GEMINI_LIMIT_RPM")); value != "" {
		if parsed, parseErr := strconv.ParseInt(value, 10, 64); parseErr == nil && parsed > 0 {
			rpmLimit = parsed
		}
	}
	minInterval := time.Minute / time.Duration(rpmLimit)

	return &AIService{client: model, db: db, modelName: modelName, dailyTokenLimit: dailyLimit, aiMinInterval: minInterval}, nil
}

func buildGeminiModel(apiKey, modelName string) (*genai.GenerativeModel, error) {
	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return nil, fmt.Errorf("failed to create new genai client: %w", err)
	}
	model := client.GenerativeModel(modelName)
	model.GenerationConfig.ResponseMIMEType = "application/json"
	return model, nil
}

func (s *AIService) UpdateAPIKey(apiKey string) error {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return fmt.Errorf("api key cannot be empty")
	}
	model, err := buildGeminiModel(apiKey, s.modelName)
	if err != nil {
		return err
	}

	s.modelMu.Lock()
	s.client = model
	s.modelMu.Unlock()
	return nil
}

func detectAIErrorType(err error) string {
	if err == nil {
		return ""
	}
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "connection lost"), strings.Contains(msg, "connection reset"):
		return "connection"
	case strings.Contains(msg, "deadline exceeded"), strings.Contains(msg, "timeout"):
		return "timeout"
	case strings.Contains(msg, "429"), strings.Contains(msg, "rate"):
		return "rate_limit"
	case strings.Contains(msg, "permission"), strings.Contains(msg, "unauthorized"), strings.Contains(msg, "forbidden"):
		return "auth"
	default:
		return "unknown"
	}
}

func (s *AIService) logAPIUsage(feature, status, errorType, errorMessage string, promptTokens, candidateTokens, totalTokens, responseTimeMs int64) {
	if s.db == nil {
		return
	}
	_, err := s.db.ExecContext(
		context.Background(),
		`INSERT INTO ai_api_usage_logs
		 (feature, model_name, status, error_type, error_message, prompt_tokens, candidates_tokens, total_tokens, response_time_ms, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		feature,
		s.modelName,
		status,
		nullIfEmpty(errorType),
		nullIfEmpty(errorMessage),
		promptTokens,
		candidateTokens,
		totalTokens,
		responseTimeMs,
		time.Now(),
	)
	if err != nil {
		log.Printf("WARNING: Failed to log AI API usage: %v", err)
	}
}

func nullIfEmpty(value string) interface{} {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func (s *AIService) waitForAIRateSlot() {
	s.aiLimiterMu.Lock()
	defer s.aiLimiterMu.Unlock()
	if s.aiMinInterval <= 0 {
		return
	}
	now := time.Now()
	nextAllowed := s.lastRequestAt.Add(s.aiMinInterval)
	if now.Before(nextAllowed) {
		time.Sleep(nextAllowed.Sub(now))
	}
	s.lastRequestAt = time.Now()
}

func (s *AIService) generateContentWithRetry(prompt string) (*genai.GenerateContentResponse, error) {
	ctx := context.Background()
	backoffs := []time.Duration{0, 2 * time.Second, 5 * time.Second}
	var lastErr error
	for _, delay := range backoffs {
		if delay > 0 {
			time.Sleep(delay)
		}
		s.waitForAIRateSlot()
		s.modelMu.RLock()
		model := s.client
		s.modelMu.RUnlock()
		if model == nil {
			return nil, fmt.Errorf("AI model is unavailable")
		}
		resp, err := model.GenerateContent(ctx, genai.Text(prompt))
		if err == nil {
			return resp, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

// --- Struktur Internal untuk Parsing Rubrik dan Respons AI ---

// AIAspectScore merepresentasikan skor yang diberikan oleh AI untuk satu aspek.
type AIAspectScore struct {
	Aspek         string `json:"aspek"`          // Nama aspek yang dinilai.
	SkorDiperoleh int    `json:"skor_diperoleh"` // Skor numerik yang diberikan AI untuk aspek ini.
}

// AIResponse merepresentasikan struktur respons JSON yang diharapkan dari model AI.
type AIResponse struct {
	SkorAspek           []AIAspectScore `json:"skor_aspek"`           // Daftar skor untuk setiap aspek.
	FeedbackKeseluruhan string          `json:"feedback_keseluruhan"` // Umpan balik keseluruhan dari AI.
}

type gradeEssayCacheKey struct {
	Question    string                `json:"question"`
	Keywords    string                `json:"keywords"`
	IdealAnswer string                `json:"ideal_answer"`
	Essay       string                `json:"essay"`
	Rubric      []models.RubricAspect `json:"rubric"`
}

// formatRubricForPrompt mengubah struktur rubrik menjadi format string yang mudah dibaca
// dan digunakan sebagai bagian dari prompt yang dikirim ke AI.
func formatRubricForPrompt(structuredRubric []models.RubricAspect) string {
	var rubricBuilder bytes.Buffer // Menggunakan Buffer untuk membangun string secara efisien.
	for _, aspect := range structuredRubric {
		rubricBuilder.WriteString(fmt.Sprintf("Aspek: %s\n", aspect.Aspek))
		for _, criterion := range aspect.Kriteria {
			rubricBuilder.WriteString(fmt.Sprintf("- Skor %d: %s\n", criterion.Skor, criterion.Deskripsi))
		}
		rubricBuilder.WriteString("\n")
	}
	return rubricBuilder.String()
}

func buildGradeEssayRequestHash(req models.GradeEssayRequest, rubric []models.RubricAspect) (string, error) {
	normalized := make([]models.RubricAspect, 0, len(rubric))
	for _, aspect := range rubric {
		item := models.RubricAspect{
			Aspek:    strings.TrimSpace(aspect.Aspek),
			Kriteria: make([]models.RubricCriterion, 0, len(aspect.Kriteria)),
		}
		for _, criterion := range aspect.Kriteria {
			item.Kriteria = append(item.Kriteria, models.RubricCriterion{
				Skor:      criterion.Skor,
				Deskripsi: strings.TrimSpace(criterion.Deskripsi),
			})
		}
		normalized = append(normalized, item)
	}

	key := gradeEssayCacheKey{
		Question:    strings.TrimSpace(req.Question),
		Keywords:    strings.TrimSpace(req.Keywords),
		IdealAnswer: strings.TrimSpace(req.IdealAnswer),
		Essay:       strings.TrimSpace(req.Essay),
		Rubric:      normalized,
	}

	payload, err := json.Marshal(key)
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256(payload)
	return hex.EncodeToString(hash[:]), nil
}

func (s *AIService) getGradeEssayCache(requestHash string) (*models.GradeEssayResponse, bool, error) {
	if s.db == nil || strings.TrimSpace(requestHash) == "" {
		return nil, false, nil
	}

	var (
		score           string
		feedback        string
		aspectScoresRaw []byte
	)
	err := s.db.QueryRowContext(
		context.Background(),
		`SELECT score, feedback, aspect_scores
		 FROM ai_grading_cache
		 WHERE request_hash = $1`,
		requestHash,
	).Scan(&score, &feedback, &aspectScoresRaw)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, false, nil
		}
		return nil, false, err
	}

	aspectScores := make([]models.GradeEssayAspectScore, 0)
	if len(aspectScoresRaw) > 0 {
		if err := json.Unmarshal(aspectScoresRaw, &aspectScores); err != nil {
			return nil, false, err
		}
	}

	_, updateErr := s.db.ExecContext(
		context.Background(),
		`UPDATE ai_grading_cache
		 SET last_used_at = NOW(),
		     hit_count = hit_count + 1
		 WHERE request_hash = $1`,
		requestHash,
	)
	if updateErr != nil {
		log.Printf("WARNING: failed to update ai_grading_cache hit counter: %v", updateErr)
	}

	return &models.GradeEssayResponse{
		Score:        score,
		Feedback:     feedback,
		AspectScores: aspectScores,
	}, true, nil
}

func (s *AIService) upsertGradeEssayCache(requestHash string, response *models.GradeEssayResponse) error {
	if s.db == nil || strings.TrimSpace(requestHash) == "" || response == nil {
		return nil
	}

	aspectScoresJSON, err := json.Marshal(response.AspectScores)
	if err != nil {
		return err
	}

	_, err = s.db.ExecContext(
		context.Background(),
		`INSERT INTO ai_grading_cache (request_hash, score, feedback, aspect_scores, created_at, last_used_at, hit_count)
		 VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW(), 1)
		 ON CONFLICT (request_hash) DO UPDATE
		 SET score = EXCLUDED.score,
		     feedback = EXCLUDED.feedback,
		     aspect_scores = EXCLUDED.aspect_scores,
		     last_used_at = NOW(),
		     hit_count = ai_grading_cache.hit_count + 1`,
		requestHash,
		response.Score,
		response.Feedback,
		string(aspectScoresJSON),
	)
	return err
}

// GradeEssay membangun prompt, memanggil API Gemini, menghitung skor akhir, dan mem-parsing respons.
// Ini adalah metode utama untuk penilaian esai menggunakan AI.
func (s *AIService) GradeEssay(req models.GradeEssayRequest) (*models.GradeEssayResponse, error) {
	startedAt := time.Now()
	var structuredRubric []models.RubricAspect
	// Mengubah JSON rubrik mentah dari request menjadi struktur data Go.
	if err := json.Unmarshal(req.Rubric, &structuredRubric); err != nil {
		return nil, fmt.Errorf("invalid rubric JSON format: %w", err)
	}
	formattedRubric := formatRubricForPrompt(structuredRubric) // Memformat rubrik untuk prompt.

	requestHash, hashErr := buildGradeEssayRequestHash(req, structuredRubric)
	if hashErr != nil {
		log.Printf("WARNING: failed to build grade essay cache hash: %v", hashErr)
	}
	if requestHash != "" {
		if cached, hit, cacheErr := s.getGradeEssayCache(requestHash); cacheErr != nil {
			log.Printf("WARNING: failed to read grade essay cache: %v", cacheErr)
		} else if hit {
			log.Println("INFO: grade_essay cache hit")
			return cached, nil
		}
	}

	prompt := buildPrompt(req, formattedRubric) // Membangun prompt lengkap.
	log.Println("--- SENDING PROMPT TO GEMINI API ---")

	log.Println("DEBUG: Calling s.client.GenerateContent now...")
	// Memanggil Gemini API untuk generate konten berdasarkan prompt.
	resp, err := s.generateContentWithRetry(prompt)

	// Logging tambahan untuk membantu debug jika ada kegagalan.
	if err != nil {
		log.Printf("DEBUG: GenerateContent returned an error: %v", err)
	} else {
		log.Println("DEBUG: GenerateContent call successful, no error returned.")
	}

	if err != nil {
		log.Printf("ERROR: Gemini API call failed: %v", err)
		s.logAPIUsage("grade_essay", "error", detectAIErrorType(err), err.Error(), 0, 0, 0, time.Since(startedAt).Milliseconds())
		return nil, fmt.Errorf("failed to generate content from AI service")
	}

	aiResponse, err := parseAIResponse(resp) // Mem-parsing respons mentah dari AI.
	if err != nil {
		promptTokens, candidateTokens, totalTokens := extractUsageMetadata(resp)
		s.logAPIUsage("grade_essay", "error", "parse", err.Error(), promptTokens, candidateTokens, totalTokens, time.Since(startedAt).Milliseconds())
		return nil, err
	}

	// Menghitung skor akhir berdasarkan rubrik dan skor aspek dari AI.
	finalScore, err := calculateFinalScore(structuredRubric, aiResponse.SkorAspek)
	if err != nil {
		return nil, err
	}

	// Membentuk respons akhir untuk client.
	aspectScores := make([]models.GradeEssayAspectScore, 0, len(aiResponse.SkorAspek))
	for _, item := range aiResponse.SkorAspek {
		aspectScores = append(aspectScores, models.GradeEssayAspectScore{
			Aspek:         item.Aspek,
			SkorDiperoleh: item.SkorDiperoleh,
		})
	}

	finalResponse := &models.GradeEssayResponse{
		Score:        fmt.Sprintf("%.0f", finalScore), // Skor dibulatkan dan diformat sebagai string.
		Feedback:     aiResponse.FeedbackKeseluruhan,
		AspectScores: aspectScores,
	}
	if requestHash != "" {
		if cacheErr := s.upsertGradeEssayCache(requestHash, finalResponse); cacheErr != nil {
			log.Printf("WARNING: failed to upsert grade essay cache: %v", cacheErr)
		}
	}
	promptTokens, candidateTokens, totalTokens := extractUsageMetadata(resp)
	s.logAPIUsage("grade_essay", "success", "", "", promptTokens, candidateTokens, totalTokens, time.Since(startedAt).Milliseconds())

	return finalResponse, nil
}

func extractUsageMetadata(resp *genai.GenerateContentResponse) (int64, int64, int64) {
	if resp == nil || resp.UsageMetadata == nil {
		return 0, 0, 0
	}
	return int64(resp.UsageMetadata.PromptTokenCount), int64(resp.UsageMetadata.CandidatesTokenCount), int64(resp.UsageMetadata.TotalTokenCount)
}

func trimToWordLimit(value string, maxWords int) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || maxWords <= 0 {
		return trimmed
	}
	words := strings.Fields(trimmed)
	if len(words) <= maxWords {
		return trimmed
	}
	return strings.Join(words[:maxWords], " ") + "..."
}

// buildPrompt menyusun prompt lengkap yang akan dikirim ke model AI Gemini.
// Prompt ini mencakup pertanyaan esai, rubrik, jawaban ideal (jika ada), dan esai siswa.
func buildPrompt(req models.GradeEssayRequest, formattedRubric string) string {
	var promptBuilder bytes.Buffer

	// Prompt deterministik + evidence-based untuk mengurangi variasi skor antarsesi.
	promptBuilder.WriteString("You are a strict, deterministic academic grader.\n")
	promptBuilder.WriteString("Grade ONLY using the provided rubric and the student's essay text.\n")
	promptBuilder.WriteString("Do not infer facts that are not explicitly present in the student's essay.\n")
	promptBuilder.WriteString("If evidence is insufficient for an aspect, assign the lower score.\n\n")

	promptBuilder.WriteString(fmt.Sprintf("ESSAY QUESTION:\n\"%s\"\n\n", req.Question))

	promptBuilder.WriteString(fmt.Sprintf("GRADING RUBRIC:\n%s\n", formattedRubric))

	if req.IdealAnswer != "" {
		promptBuilder.WriteString(fmt.Sprintf("IDEAL ANSWER (Reference for reasoning):\n\"%s\"\n\n", req.IdealAnswer))
	}

	promptBuilder.WriteString(fmt.Sprintf("STUDENT'S ESSAY TO GRADE:\n\"%s\"\n\n", req.Essay))

	// Keyword hanya untuk validasi sesuai Hal. 53 PDF
	if req.Keywords != "" {
		promptBuilder.WriteString(fmt.Sprintf("KEYWORDS (Use ONLY for concept validation, NOT for scoring):\n\"%s\"\n\n", req.Keywords))
	}

	promptBuilder.WriteString("DETERMINISTIC SCORING PROCEDURE (MUST FOLLOW):\n")
	promptBuilder.WriteString("1. Read the rubric aspects in order.\n")
	promptBuilder.WriteString("2. For each aspect, choose exactly one integer score that exists in that aspect's rubric scale.\n")
	promptBuilder.WriteString("3. Use the SAME aspect names as rubric; do not rename, merge, or split aspects.\n")
	promptBuilder.WriteString("4. Score must be evidence-based from the student's essay text; if unclear, choose the lower plausible score.\n")
	promptBuilder.WriteString("5. Keep grading conservative and stable. For identical input, produce identical scores.\n")
	promptBuilder.WriteString("6. KEYWORDS are for validation only and MUST NOT directly increase/decrease score.\n")
	promptBuilder.WriteString("7. Feedback must be concise, specific, and tied to rubric weaknesses/strengths.\n\n")

	promptBuilder.WriteString("OUTPUT RULES:\n")
	promptBuilder.WriteString("1. Return ONLY one valid JSON object, no markdown, no extra text.\n")
	promptBuilder.WriteString("2. JSON schema:\n")
	promptBuilder.WriteString("{ \"skor_aspek\": [{\"aspek\": \"<exact_rubric_aspect_name>\", \"skor_diperoleh\": <int>}], \"feedback_keseluruhan\": \"...\" }\n")
	promptBuilder.WriteString("3. skor_aspek must contain all rubric aspects exactly once.\n")
	promptBuilder.WriteString("4. skor_diperoleh must be integer and within allowed score range of each aspect.\n")
	promptBuilder.WriteString("5. feedback_keseluruhan max 120 words. and the target is a highschool student (siswa, not mahasiswa)\n")

	return promptBuilder.String()

}

// parseAIResponse mem-parsing respons dari model AI Gemini.
// Ia mengekstrak bagian teks dari respons dan mencoba mendekode JSON-nya.
func parseAIResponse(resp *genai.GenerateContentResponse) (*AIResponse, error) {
	// Memeriksa apakah respons tidak kosong.
	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("received an empty response from AI service")
	}

	// Mengambil bagian konten dari respons AI.
	aiResponsePart := resp.Candidates[0].Content.Parts[0]
	// Memastikan bagian konten adalah teks.
	aiResponseJSON, ok := aiResponsePart.(genai.Text)
	if !ok {
		return nil, fmt.Errorf("unexpected response type from AI service")
	}

	var parsedResponse AIResponse
	// Mendekode respons JSON dari AI ke dalam struktur AIResponse.
	if err := json.Unmarshal([]byte(aiResponseJSON), &parsedResponse); err != nil {
		log.Printf("ERROR: Failed to unmarshal AI JSON response: %v. Raw response: %s", err, aiResponseJSON)
		return nil, fmt.Errorf("failed to parse JSON response from AI")
	}

	return &parsedResponse, nil
}

// GenerateEssayQuestionFromMaterial membuat draft soal essay lengkap dari isi materi.
func (s *AIService) GenerateEssayQuestionFromMaterial(
	materialTitle string,
	materialContent string,
	rubricType string,
	teachingModuleContext string,
) (*models.AutoGeneratedEssayQuestion, error) {
	startedAt := time.Now()
	if strings.TrimSpace(materialContent) == "" {
		return nil, fmt.Errorf("material content is empty")
	}
	if rubricType != "holistik" && rubricType != "analitik" {
		rubricType = "analitik"
	}

	var promptBuilder bytes.Buffer
	promptBuilder.WriteString("You are an expert instructional designer for LMS essay assessments.\n")
	promptBuilder.WriteString("Domain constraint: This system is ONLY for Sejarah (History), especially Indonesian history context.\n")
	promptBuilder.WriteString("Target audience: Sekolah menengah kelas 10. Use very simple vocabulary, avoid multi-step reasoning, and keep questions short and straightforward.\n")
	promptBuilder.WriteString("Difficulty level: easy. Question should target C1-C3 only, and never require deep analysis or synthesis.\n")
	promptBuilder.WriteString("Generate exactly one essay question draft based only on the material.\n")
	promptBuilder.WriteString("Return ONLY JSON. No markdown.\n\n")
	promptBuilder.WriteString(fmt.Sprintf("MATERIAL TITLE:\n%s\n\n", materialTitle))
	promptBuilder.WriteString(fmt.Sprintf("MATERIAL CONTENT:\n%s\n\n", materialContent))
	if strings.TrimSpace(teachingModuleContext) != "" {
		promptBuilder.WriteString("CLASS TEACHING MODULE CONTEXT (PDF extract; prioritize factual consistency):\n")
		promptBuilder.WriteString(teachingModuleContext)
		promptBuilder.WriteString("\n\n")
	}
	promptBuilder.WriteString(fmt.Sprintf("RUBRIC TYPE REQUESTED: %s\n\n", rubricType))
	promptBuilder.WriteString("Return this exact JSON schema:\n")
	promptBuilder.WriteString("{\"teks_soal\":\"...\",\"keywords\":[\"...\"],\"ideal_answer\":\"...\",\"weight\":10,\"rubric_type\":\"analitik|holistik\",\"rubrics\":[{\"nama_aspek\":\"...\",\"descriptors\":[{\"score\":0,\"description\":\"...\"},{\"score\":1,\"description\":\"...\"},{\"score\":2,\"description\":\"...\"},{\"score\":3,\"description\":\"...\"}]}]}\n")
	promptBuilder.WriteString("Rules:\n")
	promptBuilder.WriteString("1) Question must be answerable from material only.\n")
	promptBuilder.WriteString("1a) If teaching module context exists, align terms/timeline with it, but never contradict material content.\n")
	promptBuilder.WriteString("2) The question MUST be history subject, and must not switch to non-history domains.\n")
	promptBuilder.WriteString("3) Cognitive level target MUST be only C1-C3 (remember/understand/apply). Avoid C4-C6 complexity.\n")
	promptBuilder.WriteString("3a) Aim for vocabulary and structure that a tenth-grader can understand on first read. No compound conditions.\n")
	promptBuilder.WriteString("4) Keep question short and simple: single prompt, max 30 words, no multi-part questions. ended with ? or ! mark\n")
	promptBuilder.WriteString("4a) Assign weights according to cognitive level: 5 points for C1, 10 for C2, 15 for C3.\n")
	promptBuilder.WriteString("5) ideal_answer must be concise: 5-50 words, easy to understand, no long essay answer required.\n")
	promptBuilder.WriteString("6) keywords must be concise and relevant (3-6 items).\n")
	promptBuilder.WriteString("7) weight must be positive number.\n")
	promptBuilder.WriteString("8) For holistik, rubrics must contain exactly 1 aspect.\n")
	promptBuilder.WriteString("9) For analitik, rubrics should contain 2 - 5 aspects with clear simple names.\n")
	promptBuilder.WriteString("10) Each descriptor description must be plain string, no object.\n")
	promptBuilder.WriteString("11) If the material is not history-related, return an error JSON: {\"error\":\"MATERI_BUKAN_SEJARAH\"}\n")

	resp, err := s.generateContentWithRetry(promptBuilder.String())
	if err != nil {
		s.logAPIUsage("auto_generate_question", "error", detectAIErrorType(err), err.Error(), 0, 0, 0, time.Since(startedAt).Milliseconds())
		return nil, fmt.Errorf("failed to generate essay question draft: %w", err)
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("received an empty response from AI service")
	}
	aiResponsePart := resp.Candidates[0].Content.Parts[0]
	aiResponseJSON, ok := aiResponsePart.(genai.Text)
	if !ok {
		promptTokens, candidateTokens, totalTokens := extractUsageMetadata(resp)
		s.logAPIUsage("auto_generate_question", "error", "response_type", "unexpected response type from AI service", promptTokens, candidateTokens, totalTokens, time.Since(startedAt).Milliseconds())
		return nil, fmt.Errorf("unexpected response type from AI service")
	}

	var draft models.AutoGeneratedEssayQuestion
	if err := json.Unmarshal([]byte(aiResponseJSON), &draft); err != nil {
		log.Printf("ERROR: Failed to unmarshal generated question JSON: %v. Raw response: %s", err, aiResponseJSON)
		promptTokens, candidateTokens, totalTokens := extractUsageMetadata(resp)
		s.logAPIUsage("auto_generate_question", "error", "parse", err.Error(), promptTokens, candidateTokens, totalTokens, time.Since(startedAt).Milliseconds())
		return nil, fmt.Errorf("failed to parse generated question from AI")
	}
	if strings.TrimSpace(draft.TeksSoal) == "" && strings.Contains(strings.ToUpper(string(aiResponseJSON)), "MATERI_BUKAN_SEJARAH") {
		return nil, fmt.Errorf("material is not history-related")
	}

	// Normalisasi minimal agar frontend konsisten.
	if draft.RubricType != "holistik" && draft.RubricType != "analitik" {
		draft.RubricType = rubricType
	}
	if len(draft.Rubrics) == 0 {
		draft.Rubrics = []models.GeneratedRubricAspect{
			{
				NamaAspek: func() string {
					if draft.RubricType == "holistik" {
						return "Penilaian Holistik"
					}
					return "Relevansi"
				}(),
				Descriptors: []models.GeneratedDescriptor{
					{Score: 0, Description: "Belum memenuhi kriteria."},
					{Score: 1, Description: "Sebagian kecil kriteria terpenuhi."},
					{Score: 2, Description: "Sebagian besar kriteria terpenuhi."},
					{Score: 3, Description: "Seluruh kriteria terpenuhi dengan baik."},
				},
			},
		}
	}
	for i := range draft.Rubrics {
		draft.Rubrics[i].NamaAspek = strings.TrimSpace(draft.Rubrics[i].NamaAspek)
		if draft.Rubrics[i].NamaAspek == "" {
			if draft.RubricType == "holistik" {
				draft.Rubrics[i].NamaAspek = "Penilaian Holistik"
			} else {
				draft.Rubrics[i].NamaAspek = fmt.Sprintf("Aspek %d", i+1)
			}
		}
	}

	if draft.RubricType == "holistik" && len(draft.Rubrics) > 1 {
		draft.Rubrics = draft.Rubrics[:1]
	}
	if draft.RubricType == "analitik" && len(draft.Rubrics) > 2 {
		draft.Rubrics = draft.Rubrics[:2]
	}
	draft.TeksSoal = trimToWordLimit(draft.TeksSoal, 30)
	draft.IdealAnswer = trimToWordLimit(draft.IdealAnswer, 90)
	if len(draft.Keywords) > 6 {
		draft.Keywords = draft.Keywords[:6]
	}
	if len(draft.Keywords) == 0 {
		draft.Keywords = []string{"konsep utama", "fakta sejarah", "konteks waktu"}
	}
	promptTokens, candidateTokens, totalTokens := extractUsageMetadata(resp)
	s.logAPIUsage("auto_generate_question", "success", "", "", promptTokens, candidateTokens, totalTokens, time.Since(startedAt).Milliseconds())

	return &draft, nil
}

// calculateFinalScore menghitung skor akhir esai berdasarkan rubrik terstruktur
// dan skor aspek yang diberikan oleh AI.
func calculateFinalScore(rubric []models.RubricAspect, aspectScores []AIAspectScore) (float64, error) {
	var totalScoreObtained float64 = 0
	var totalMaxScore float64 = 0

	obtainedScoresMap := make(map[string]int)
	for _, as := range aspectScores {
		key := strings.ToLower(strings.TrimSpace(as.Aspek))
		if key == "" {
			continue
		}
		obtainedScoresMap[key] = as.SkorDiperoleh
	}

	for i, aspect := range rubric {
		// M = Skor Maksimal Rubrik (Hal. 55 PDF)
		maxScoreInAspect := 0
		for _, criterion := range aspect.Kriteria {
			if criterion.Skor > maxScoreInAspect {
				maxScoreInAspect = criterion.Skor
			}
		}
		totalMaxScore += float64(maxScoreInAspect)

		// S = Total skor yang diperoleh (Hal. 55 PDF)
		normalizedAspect := strings.ToLower(strings.TrimSpace(aspect.Aspek))
		obtainedScore, ok := obtainedScoresMap[normalizedAspect]
		if !ok && len(aspectScores) == len(rubric) {
			// Fallback to positional match if AI returns aspect labels that don't match.
			obtainedScore = aspectScores[i].SkorDiperoleh
			ok = true
		}
		if !ok {
			continue
		}

		if obtainedScore < 0 {
			obtainedScore = 0
		} else if maxScoreInAspect > 0 && obtainedScore > maxScoreInAspect {
			obtainedScore = maxScoreInAspect
		}
		totalScoreObtained += float64(obtainedScore)
	}

	if totalMaxScore == 0 {
		return 0, fmt.Errorf("maximum possible score is zero")
	}

	// Rumus sesuai Hal. 55: (S / M) * 100
	// Kita hilangkan pembulatan kelipatan 5 agar presisi sesuai dokumen (e.g., 66.6)
	finalScore := (totalScoreObtained / totalMaxScore) * 100

	return finalScore, nil
}
