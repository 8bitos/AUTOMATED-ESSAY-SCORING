package services

import (
	"api-backend/internal/models" // Mengimpor definisi model yang diperlukan (EssaySubmission, GradeEssayRequest, dll.).
	"context"                     // Mengimpor package context untuk mengelola batas waktu dan pembatalan operasi DB.
	"database/sql"                // Mengimpor package database/sql untuk interaksi dengan database.
	"encoding/json"               // Mengimpor package encoding/json untuk bekerja dengan JSON.
	"errors"
	"fmt" // Mengimpor package fmt untuk format string dan error.
	"log"
	"math"
	"os"
	"sort" // Mengimpor package sort untuk mengurutkan kriteria rubrik.
	"strconv"
	"strings" // Mengimpor package strings untuk manipulasi string (membangun query update).
	"sync"
	"time" // Mengimpor package time untuk timestamp.

	"github.com/lib/pq"
)

// EssaySubmissionService menyediakan metode untuk manajemen submission esai.
// Layanan ini juga mengintegrasikan AIService dan EssayQuestionService untuk
// penilaian otomatis dan pengambilan detail pertanyaan.
type EssaySubmissionService struct {
	db                   *sql.DB               // Koneksi database.
	aiService            *AIService            // Referensi ke AIService untuk penilaian AI.
	essayQuestionService *EssayQuestionService // Referensi ke EssayQuestionService untuk mengambil detail pertanyaan.
	settingService       *SystemSettingService
	jobQueue             chan essayGradingJob
	limiterMu            sync.Mutex
	lastAIRequestAt      time.Time
	aiMinInterval        time.Duration
	cancelMu             sync.RWMutex
	cancelledJobs        map[string]struct{}
}

type essayGradingJob struct {
	SubmissionID string
	QuestionID   string
	StudentID    string
	TeksJawaban  string
	ScoringMethod string
}

type groundingCandidate struct {
	Label string
	Text  string
	Score int
}

var ErrAttemptLimitReached = errors.New("attempt limit reached")

type AttemptCooldownError struct {
	Remaining time.Duration
}

func (e *AttemptCooldownError) Error() string {
	if e == nil {
		return "attempt cooldown is active"
	}
	if e.Remaining <= 0 {
		return "attempt cooldown is active"
	}
	seconds := int(math.Ceil(e.Remaining.Seconds()))
	if seconds < 1 {
		seconds = 1
	}
	return fmt.Sprintf("kamu harus menunggu %d detik sebelum mencoba lagi", seconds)
}

type quizAttemptConfig struct {
	AttemptLimit     int
	CooldownMinutes  int
	AttemptScoring   string
}

func defaultQuizAttemptConfig() quizAttemptConfig {
	return quizAttemptConfig{
		AttemptLimit:    1,
		CooldownMinutes: 0,
		AttemptScoring:  "last",
	}
}

func (s *EssaySubmissionService) isTaskQuestion(questionID string) (bool, error) {
	isTaskSubmission := false
	if err := s.db.QueryRowContext(
		context.Background(),
		`SELECT EXISTS(
			SELECT 1
			FROM essay_questions
			WHERE id = $1
			  AND keywords IS NOT NULL
			  AND 'tugas_submission' = ANY(keywords)
		)`,
		questionID,
	).Scan(&isTaskSubmission); err != nil {
		return false, fmt.Errorf("failed to determine question type: %w", err)
	}
	return isTaskSubmission, nil
}

func (s *EssaySubmissionService) isTaskSubmissionByID(submissionID string) (bool, error) {
	var submissionType string
	err := s.db.QueryRowContext(
		context.Background(),
		"SELECT submission_type FROM essay_submissions WHERE id = $1",
		submissionID,
	).Scan(&submissionType)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, fmt.Errorf("essay submission not found")
		}
		return false, fmt.Errorf("failed to load submission type: %w", err)
	}
	return submissionType == "task", nil
}

func readConfigInt(raw map[string]interface{}, key string, fallback int) int {
	value, ok := raw[key]
	if !ok || value == nil {
		return fallback
	}
	switch v := value.(type) {
	case float64:
		return int(math.Max(0, math.Round(v)))
	case float32:
		return int(math.Max(0, math.Round(float64(v))))
	case int:
		if v < 0 {
			return 0
		}
		return v
	case int64:
		if v < 0 {
			return 0
		}
		return int(v)
	default:
		return fallback
	}
}

func (s *EssaySubmissionService) loadQuizAttemptConfig(questionID string) (quizAttemptConfig, error) {
	cfg := defaultQuizAttemptConfig()

	var isiMateri sql.NullString
	err := s.db.QueryRowContext(
		context.Background(),
		`SELECT m.isi_materi
		 FROM essay_questions eq
		 JOIN materials m ON m.id = eq.material_id
		 WHERE eq.id = $1`,
		questionID,
	).Scan(&isiMateri)
	if err != nil {
		if err == sql.ErrNoRows {
			return cfg, nil
		}
		return cfg, err
	}
	if !isiMateri.Valid || strings.TrimSpace(isiMateri.String) == "" {
		return cfg, nil
	}

	var parsed struct {
		Format string                   `json:"format"`
		Items  []map[string]interface{} `json:"items"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(isiMateri.String)), &parsed); err != nil {
		return cfg, nil
	}
	if parsed.Format != "sage_section_cards_v1" {
		return cfg, nil
	}

	for _, item := range parsed.Items {
		itemType, _ := item["type"].(string)
		if strings.TrimSpace(itemType) != "soal" {
			continue
		}
		meta, ok := item["meta"].(map[string]interface{})
		if !ok || meta == nil {
			continue
		}
		questionIDs, _ := meta["question_ids"].([]interface{})
		foundQuestion := false
		for _, rawID := range questionIDs {
			id, _ := rawID.(string)
			if strings.TrimSpace(id) == strings.TrimSpace(questionID) {
				foundQuestion = true
				break
			}
		}
		if !foundQuestion {
			continue
		}

		rawQuizSettings, _ := meta["quiz_settings"].(map[string]interface{})
		if rawQuizSettings == nil {
			return cfg, nil
		}
		cfg.AttemptLimit = readConfigInt(rawQuizSettings, "attempt_limit", cfg.AttemptLimit)
		cfg.CooldownMinutes = readConfigInt(rawQuizSettings, "attempt_cooldown_minutes", cfg.CooldownMinutes)
		if method, ok := rawQuizSettings["attempt_scoring_method"].(string); ok && strings.TrimSpace(method) == "best" {
			cfg.AttemptScoring = "best"
		}
		return cfg, nil
	}

	return cfg, nil
}

func roundToNearestStep(score float64, step float64) float64 {
	if step <= 0 {
		return score
	}
	return math.Round(score/step) * step
}

func (s *EssaySubmissionService) shouldRoundScore(questionID string) (bool, float64) {
	var enabled bool
	var step float64
	err := s.db.QueryRowContext(
		context.Background(),
		"SELECT COALESCE(round_score_to_5, FALSE), COALESCE(round_score_step, 5) FROM essay_questions WHERE id = $1",
		questionID,
	).Scan(&enabled, &step)
	if err != nil {
		return false, 5
	}
	if step <= 0 {
		step = 5
	}
	return enabled, step
}

// NewEssaySubmissionService membuat instance baru dari EssaySubmissionService.
// Menerima koneksi database dan referensi ke AIService serta EssayQuestionService.
func NewEssaySubmissionService(db *sql.DB, ai *AIService, eqs *EssayQuestionService, settings *SystemSettingService) *EssaySubmissionService {
	rpmLimit := 5
	if value := strings.TrimSpace(os.Getenv("GEMINI_LIMIT_RPM")); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			rpmLimit = parsed
		}
	}
	workers := 1
	if value := strings.TrimSpace(os.Getenv("AI_GRADING_WORKERS")); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			workers = parsed
		}
	}

	svc := &EssaySubmissionService{
		db:                   db,
		aiService:            ai,
		essayQuestionService: eqs,
		settingService:       settings,
		jobQueue:             make(chan essayGradingJob, 500),
		aiMinInterval:        time.Minute / time.Duration(rpmLimit),
		cancelledJobs:        make(map[string]struct{}),
	}
	for i := 0; i < workers; i++ {
		go svc.runGradingWorker()
	}
	go svc.recoverPendingQueue()
	return svc
}

func (s *EssaySubmissionService) recoverPendingQueue() {
	if s.aiService == nil {
		log.Printf("WARNING: skipping queue recovery because AI service is unavailable")
		return
	}

	rows, err := s.db.QueryContext(
		context.Background(),
		`SELECT id, soal_id, siswa_id, teks_jawaban, ai_grading_status
		 FROM essay_submissions
		 WHERE submission_type = 'essay'
		   AND ai_grading_status IN ('queued', 'processing')
		 ORDER BY submitted_at ASC`,
	)
	if err != nil {
		log.Printf("WARNING: failed to scan pending grading queue on startup: %v", err)
		return
	}
	defer rows.Close()

	recovered := 0
	failed := 0
	for rows.Next() {
		var (
			job    essayGradingJob
			status string
		)
		if err := rows.Scan(&job.SubmissionID, &job.QuestionID, &job.StudentID, &job.TeksJawaban, &status); err != nil {
			log.Printf("WARNING: failed to scan pending queue item during startup recovery: %v", err)
			failed++
			continue
		}

		config, cfgErr := s.loadQuizAttemptConfig(job.QuestionID)
		if cfgErr != nil {
			log.Printf("WARNING: failed to load attempt config for recovered submission %s: %v", job.SubmissionID, cfgErr)
			_ = s.updateSubmissionGradingStatus(job.SubmissionID, "failed", "Gagal memulihkan job AI saat startup.", nil)
			failed++
			continue
		}
		job.ScoringMethod = config.AttemptScoring

		if _, err := s.db.ExecContext(
			context.Background(),
			`UPDATE essay_submissions
			 SET ai_grading_status = 'queued',
			     ai_grading_error = NULL,
			     ai_graded_at = NULL
			 WHERE id = $1`,
			job.SubmissionID,
		); err != nil {
			log.Printf("WARNING: failed to reset recovered submission %s to queued: %v", job.SubmissionID, err)
			failed++
			continue
		}
		s.clearStopRequest(job.SubmissionID)

		if err := s.enqueueGradingJob(job); err != nil {
			log.Printf("WARNING: failed to requeue recovered submission %s: %v", job.SubmissionID, err)
			_ = s.updateSubmissionGradingStatus(job.SubmissionID, "failed", "Recovery queue penuh saat startup.", nil)
			failed++
			continue
		}

		recovered++
	}
	if err := rows.Err(); err != nil {
		log.Printf("WARNING: queue recovery iteration failed: %v", err)
	}
	if recovered > 0 || failed > 0 {
		log.Printf("Queue recovery completed: recovered=%d failed=%d", recovered, failed)
	}
}

// CreateEssaySubmission membuat submission esai baru di database dan secara otomatis
// memicu penilaian AI untuk esai tersebut.
// Mengembalikan objek EssaySubmission yang baru dibuat dan respons penilaian dari AI.
func (s *EssaySubmissionService) buildGradeRequest(questionID, teksJawaban string) (*models.GradeEssayRequest, error) {
	// Mengambil detail pertanyaan esai yang terkait untuk digunakan dalam penilaian AI.
	question, err := s.essayQuestionService.GetEssayQuestionByID(questionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get essay question for AI grading: %w", err)
	}

	// Mempersiapkan permintaan untuk AIService.
	var idealAnswer, keywords string
	if question.IdealAnswer != nil {
		idealAnswer = *question.IdealAnswer
	}
	// Perhatikan bahwa model EssayQuestion.Keywords adalah *string,
	// tetapi layanan AI mungkin mengharapkan string biasa atau format array.
	// Asumsi saat ini adalah *string perlu di-dereference.
	if question.Keywords != nil {
		keywords = *question.Keywords
	}

	gradeReq := &models.GradeEssayRequest{
		Essay:      teksJawaban,
		Question:   question.TeksSoal,
		IdealAnswer: idealAnswer,
		Keywords:   keywords,
		RubricMode: "effective_question_rubric",
	}

	groundingContext, groundingSource, groundingErr := s.buildQuestionGroundingContext(question, teksJawaban)
	if groundingErr != nil {
		log.Printf("WARNING: failed to build grounding context for question %s: %v", questionID, groundingErr)
	} else {
		gradeReq.GroundingContext = groundingContext
		gradeReq.GroundingSource = groundingSource
	}

	// Menangani rubrics (plural) dari question.Rubrics (json.RawMessage)
	// dan mengubahnya menjadi format yang diharapkan oleh AIService.
	if len(question.Rubrics) == 0 || string(question.Rubrics) == "null" {
		return nil, fmt.Errorf("rubrics are missing for question %s", questionID)
	}

	var rubricsFromQuestion []models.Rubric
	if err := json.Unmarshal(question.Rubrics, &rubricsFromQuestion); err != nil {
		return nil, fmt.Errorf("invalid rubrics format for question %s: %w", questionID, err)
	}
	if len(rubricsFromQuestion) == 0 {
		return nil, fmt.Errorf("rubrics are empty for question %s", questionID)
	}

	var transformedRubricAspects []models.RubricAspect
	for _, rubric := range rubricsFromQuestion {
		if rubric.NamaAspek == "" || len(rubric.Descriptors) == 0 {
			continue
		}

		aspect := models.RubricAspect{Aspek: rubric.NamaAspek}

		scores := make([]int, 0, len(rubric.Descriptors))
		for score := range rubric.Descriptors {
			scores = append(scores, score)
		}
		sort.Ints(scores)

		for _, score := range scores {
			aspect.Kriteria = append(aspect.Kriteria, models.RubricCriterion{
				Skor:      score,
				Deskripsi: rubric.Descriptors[score],
			})
		}
		transformedRubricAspects = append(transformedRubricAspects, aspect)
	}

	if len(transformedRubricAspects) == 0 {
		return nil, fmt.Errorf("rubrics have no usable descriptors for question %s", questionID)
	}

	transformedRubricJSON, err := json.Marshal(transformedRubricAspects)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal transformed rubric for question %s: %w", questionID, err)
	}
	gradeReq.Rubric = transformedRubricJSON
	return gradeReq, nil
}

func (s *EssaySubmissionService) buildQuestionGroundingContext(question *models.EssayQuestion, studentAnswer string) (string, string, error) {
	if question == nil || strings.TrimSpace(question.MaterialID) == "" {
		return "", "", nil
	}

	var (
		classID  string
		title    string
		body     sql.NullString
		outcomes sql.NullString
		keywords []string
	)
	if err := s.db.QueryRowContext(
		context.Background(),
		`SELECT class_id, judul, isi_materi, capaian_pembelajaran, kata_kunci
		 FROM materials
		 WHERE id = $1`,
		question.MaterialID,
	).Scan(&classID, &title, &body, &outcomes, pq.Array(&keywords)); err != nil {
		if err == sql.ErrNoRows {
			return "", "", nil
		}
		return "", "", err
	}

	queryText := strings.Join([]string{
		strings.TrimSpace(question.TeksSoal),
		strings.TrimSpace(studentAnswer),
		stringOrEmpty(question.IdealAnswer),
		stringOrEmpty(question.Keywords),
	}, " ")

	candidates := make([]groundingCandidate, 0, 8)
	if trimmed := strings.TrimSpace(title); trimmed != "" || (body.Valid && strings.TrimSpace(body.String) != "") {
		textParts := make([]string, 0, 4)
		if trimmed != "" {
			textParts = append(textParts, fmt.Sprintf("Judul materi: %s", trimmed))
		}
		if outcomes.Valid && strings.TrimSpace(outcomes.String) != "" {
			textParts = append(textParts, fmt.Sprintf("Capaian pembelajaran: %s", trimToWordLimit(outcomes.String, 60)))
		}
		if len(keywords) > 0 {
			cleanKeywords := make([]string, 0, len(keywords))
			for _, kw := range keywords {
				if item := strings.TrimSpace(kw); item != "" {
					cleanKeywords = append(cleanKeywords, item)
				}
			}
			if len(cleanKeywords) > 0 {
				textParts = append(textParts, fmt.Sprintf("Kata kunci materi: %s", strings.Join(cleanKeywords, ", ")))
			}
		}
		if body.Valid && strings.TrimSpace(body.String) != "" {
			textParts = append(textParts, fmt.Sprintf("Ringkasan materi umum: %s", trimToWordLimit(extractRelevantMaterialText(body.String), 180)))
		}
		text := strings.TrimSpace(strings.Join(textParts, "\n"))
		if text != "" {
			candidates = append(candidates, groundingCandidate{
				Label: "material_summary",
				Text:  text,
				Score: scoreGroundingCandidate(queryText, text) + 1,
			})
		}
	}

	for _, item := range extractSectionCardCandidates(body.String) {
		candidates = append(candidates, groundingCandidate{
			Label: item.Label,
			Text:  item.Text,
			Score: scoreGroundingCandidate(queryText, item.Text) + 2,
		})
	}

	_ = classID

	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].Score == candidates[j].Score {
			return len(candidates[i].Text) < len(candidates[j].Text)
		}
		return candidates[i].Score > candidates[j].Score
	})

	parts := make([]string, 0, 4)
	added := 0
	for _, candidate := range candidates {
		if strings.TrimSpace(candidate.Text) == "" {
			continue
		}
		if candidate.Score <= 0 && added >= 2 {
			continue
		}
		parts = append(parts, fmt.Sprintf("[%s]\n%s", candidate.Label, trimToWordLimit(candidate.Text, 180)))
		added++
		if added >= 4 {
			break
		}
	}

	if len(parts) == 0 {
		return "", "", nil
	}

	return strings.Join(parts, "\n\n"), "light_rag_material_and_module_context", nil
}

func stringOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func extractRelevantMaterialText(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	var parsed struct {
		Format string `json:"format"`
		Items  []struct {
			Type  string `json:"type"`
			Title string `json:"title"`
			Body  string `json:"body"`
			Meta  struct {
				MateriDescription string `json:"materi_description"`
				MateriMode        string `json:"materi_mode"`
			} `json:"meta"`
		} `json:"items"`
	}
	if err := json.Unmarshal([]byte(trimmed), &parsed); err == nil && parsed.Format == "sage_section_cards_v1" {
		lines := make([]string, 0, len(parsed.Items))
		for _, item := range parsed.Items {
			if strings.TrimSpace(item.Type) != "materi" {
				continue
			}
			text := compactGroundingSpaces(strings.Join([]string{
				strings.TrimSpace(item.Title),
				strings.TrimSpace(item.Body),
				strings.TrimSpace(item.Meta.MateriDescription),
			}, " "))
			if text != "" {
				lines = append(lines, text)
			}
		}
		return strings.Join(lines, "\n")
	}
	return compactGroundingSpaces(trimmed)
}

func extractSectionCardCandidates(raw string) []groundingCandidate {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}

	var parsed struct {
		Format string `json:"format"`
		Items  []struct {
			Type  string `json:"type"`
			Title string `json:"title"`
			Body  string `json:"body"`
			Meta  struct {
				MateriDescription string `json:"materi_description"`
				MateriMode        string `json:"materi_mode"`
			} `json:"meta"`
		} `json:"items"`
	}
	if err := json.Unmarshal([]byte(trimmed), &parsed); err != nil || parsed.Format != "sage_section_cards_v1" {
		return nil
	}

	out := make([]groundingCandidate, 0, len(parsed.Items))
	for idx, item := range parsed.Items {
		if strings.TrimSpace(item.Type) != "materi" {
			continue
		}
		text := compactGroundingSpaces(strings.Join([]string{
			strings.TrimSpace(item.Title),
			strings.TrimSpace(item.Body),
			strings.TrimSpace(item.Meta.MateriDescription),
		}, " "))
		if text == "" {
			continue
		}
		out = append(out, groundingCandidate{
			Label: fmt.Sprintf("section_card_%d", idx+1),
			Text:  text,
		})
	}
	return out
}

func splitGroundingChunks(value string, maxChars int, maxChunks int) []string {
	trimmed := compactGroundingSpaces(value)
	if trimmed == "" || maxChars <= 0 || maxChunks <= 0 {
		return nil
	}
	runes := []rune(trimmed)
	chunks := make([]string, 0, maxChunks)
	for start := 0; start < len(runes) && len(chunks) < maxChunks; start += maxChars {
		end := start + maxChars
		if end > len(runes) {
			end = len(runes)
		}
		chunk := strings.TrimSpace(string(runes[start:end]))
		if chunk != "" {
			chunks = append(chunks, chunk)
		}
	}
	return chunks
}

func compactGroundingSpaces(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func scoreGroundingCandidate(queryText, candidateText string) int {
	queryTokens := groundingTokens(queryText)
	if len(queryTokens) == 0 {
		return 0
	}
	candidateTokens := groundingTokens(candidateText)
	if len(candidateTokens) == 0 {
		return 0
	}

	score := 0
	for token := range queryTokens {
		if _, ok := candidateTokens[token]; ok {
			score++
			if len(token) >= 8 {
				score++
			}
		}
	}
	return score
}

func groundingTokens(value string) map[string]struct{} {
	parts := strings.Fields(strings.ToLower(value))
	out := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		token := strings.Trim(part, ".,:;!?()[]{}\"'`/\\|+-_=*&^%$#@~")
		if len(token) < 3 {
			continue
		}
		if _, isStop := groundingStopWords[token]; isStop {
			continue
		}
		out[token] = struct{}{}
	}
	return out
}

var groundingStopWords = map[string]struct{}{
	"dan": {}, "yang": {}, "untuk": {}, "atau": {}, "dari": {}, "pada": {}, "dengan": {}, "dalam": {}, "karena": {}, "adalah": {},
	"the": {}, "and": {}, "for": {}, "with": {}, "this": {}, "that": {}, "are": {}, "was": {}, "were": {}, "from": {},
}

func (s *EssaySubmissionService) CreateEssaySubmission(questionID, studentID, teksJawaban string) (*models.EssaySubmission, *models.GradeEssayResponse, error) {
	isTaskSubmission, err := s.isTaskQuestion(questionID)
	if err != nil {
		return nil, nil, err
	}
	config, err := s.loadQuizAttemptConfig(questionID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to load quiz attempt config: %w", err)
	}

	now := time.Now()
	newSubmission := &models.EssaySubmission{
		QuestionID:      questionID,
		StudentID:       studentID,
		SubmissionType:  "essay",
		AttemptCount:    1,
		TeksJawaban:     teksJawaban,
		SubmittedAt:     now,
		AIGradingStatus: "queued",
	}
	if isTaskSubmission {
		newSubmission.SubmissionType = "task"
		newSubmission.AIGradingStatus = "completed"
	}

	var existing struct {
		ID           string
		AttemptCount int
		SubmittedAt  time.Time
	}
	getExistingErr := s.db.QueryRowContext(
		context.Background(),
		`SELECT id, COALESCE(attempt_count, 1), submitted_at
		 FROM essay_submissions
		 WHERE soal_id = $1 AND siswa_id = $2`,
		questionID,
		studentID,
	).Scan(&existing.ID, &existing.AttemptCount, &existing.SubmittedAt)

	switch {
	case getExistingErr == sql.ErrNoRows:
		err = s.db.QueryRowContext(
			context.Background(),
			`INSERT INTO essay_submissions (soal_id, siswa_id, submission_type, teks_jawaban, submitted_at, ai_grading_status, attempt_count)
			 VALUES ($1, $2, $3, $4, $5, $6, 1)
			 RETURNING id`,
			newSubmission.QuestionID,
			newSubmission.StudentID,
			newSubmission.SubmissionType,
			newSubmission.TeksJawaban,
			newSubmission.SubmittedAt,
			newSubmission.AIGradingStatus,
		).Scan(&newSubmission.ID)
		if err != nil {
			return nil, nil, fmt.Errorf("error inserting new essay submission: %w", err)
		}
	case getExistingErr != nil:
		return nil, nil, fmt.Errorf("error loading existing submission: %w", getExistingErr)
	default:
		if config.AttemptLimit > 0 && existing.AttemptCount >= config.AttemptLimit {
			return nil, nil, ErrAttemptLimitReached
		}
		if config.CooldownMinutes > 0 {
			nextAllowed := existing.SubmittedAt.Add(time.Duration(config.CooldownMinutes) * time.Minute)
			if now.Before(nextAllowed) {
				return nil, nil, &AttemptCooldownError{Remaining: nextAllowed.Sub(now)}
			}
		}

		newSubmission.ID = existing.ID
		newSubmission.AttemptCount = existing.AttemptCount + 1
		if _, err := s.db.ExecContext(
			context.Background(),
			`UPDATE essay_submissions
			 SET submission_type = $1,
			     teks_jawaban = $2,
			     submitted_at = $3,
			     ai_grading_status = $4,
			     ai_grading_error = NULL,
			     ai_graded_at = NULL,
			     attempt_count = COALESCE(attempt_count, 1) + 1
			 WHERE id = $5`,
			newSubmission.SubmissionType,
			newSubmission.TeksJawaban,
			newSubmission.SubmittedAt,
			newSubmission.AIGradingStatus,
			newSubmission.ID,
		); err != nil {
			return nil, nil, fmt.Errorf("error updating essay submission attempt: %w", err)
		}
		// Review guru wajib direset untuk attempt baru agar tidak membawa penilaian lama.
		if _, err := s.db.ExecContext(context.Background(), "DELETE FROM teacher_reviews WHERE submission_id = $1", newSubmission.ID); err != nil {
			return nil, nil, fmt.Errorf("error resetting teacher review for resubmission: %w", err)
		}
		// Untuk mode nilai terakhir, hasil AI lama dibersihkan agar diganti hasil terbaru.
		if !isTaskSubmission && config.AttemptScoring != "best" {
			if _, err := s.db.ExecContext(context.Background(), "DELETE FROM ai_results WHERE submission_id = $1", newSubmission.ID); err != nil {
				return nil, nil, fmt.Errorf("error resetting AI result for resubmission: %w", err)
			}
		}
	}
	if isTaskSubmission {
		return newSubmission, nil, nil
	}
	s.clearStopRequest(newSubmission.ID)

	if s.aiService == nil {
		return newSubmission, nil, fmt.Errorf("AI service is unavailable; submission queued without grading")
	}

	job := essayGradingJob{
		SubmissionID:  newSubmission.ID,
		QuestionID:    questionID,
		StudentID:     studentID,
		TeksJawaban:   teksJawaban,
		ScoringMethod: config.AttemptScoring,
	}
	if s.shouldUseInstantGrading() {
		if gradeResp, gradeErr := s.gradeJob(job); gradeErr != nil {
			log.Printf("WARNING: instant AI grading failed for submission %s: %v", newSubmission.ID, gradeErr)
			return newSubmission, nil, nil
		} else {
			return newSubmission, gradeResp, nil
		}
	}
	select {
	case s.jobQueue <- job:
	default:
		_ = s.updateSubmissionGradingStatus(newSubmission.ID, "failed", "Grading queue penuh. Coba lagi beberapa saat.", nil)
		return newSubmission, nil, fmt.Errorf("grading queue is full")
	}
	return newSubmission, nil, nil
}

func (s *EssaySubmissionService) markStopRequested(submissionID string) {
	if strings.TrimSpace(submissionID) == "" {
		return
	}
	s.cancelMu.Lock()
	defer s.cancelMu.Unlock()
	s.cancelledJobs[submissionID] = struct{}{}
}

func (s *EssaySubmissionService) clearStopRequest(submissionID string) {
	if strings.TrimSpace(submissionID) == "" {
		return
	}
	s.cancelMu.Lock()
	defer s.cancelMu.Unlock()
	delete(s.cancelledJobs, submissionID)
}

func (s *EssaySubmissionService) isStopRequested(submissionID string) bool {
	if strings.TrimSpace(submissionID) == "" {
		return false
	}
	s.cancelMu.RLock()
	defer s.cancelMu.RUnlock()
	_, ok := s.cancelledJobs[submissionID]
	return ok
}

func (s *EssaySubmissionService) waitRateSlot() {
	s.limiterMu.Lock()
	defer s.limiterMu.Unlock()
	if s.aiMinInterval <= 0 {
		return
	}
	now := time.Now()
	nextAllowed := s.lastAIRequestAt.Add(s.aiMinInterval)
	if now.Before(nextAllowed) {
		time.Sleep(nextAllowed.Sub(now))
	}
	s.lastAIRequestAt = time.Now()
}

func (s *EssaySubmissionService) shouldUseInstantGrading() bool {
	if s.settingService == nil {
		return false
	}
	mode, err := s.settingService.GetGradingMode()
	if err != nil {
		log.Printf("WARNING: failed to read grading mode: %v", err)
		return false
	}
	return mode == "instant"
}

func (s *EssaySubmissionService) gradeJob(job essayGradingJob) (*models.GradeEssayResponse, error) {
	if s.isStopRequested(job.SubmissionID) {
		_ = s.updateSubmissionGradingStatus(job.SubmissionID, "failed", "Dihentikan admin sebelum grading dimulai.", nil)
		return nil, errors.New("grading stopped by admin")
	}
	if err := s.updateSubmissionGradingStatus(job.SubmissionID, "processing", "", nil); err != nil {
		log.Printf("WARNING: failed to set processing status for %s: %v", job.SubmissionID, err)
	}

	gradeReq, err := s.buildGradeRequest(job.QuestionID, job.TeksJawaban)
	if err != nil {
		_ = s.updateSubmissionGradingStatus(job.SubmissionID, "failed", err.Error(), nil)
		return nil, err
	}

	if s.aiService == nil {
		msg := "AI service is unavailable"
		_ = s.updateSubmissionGradingStatus(job.SubmissionID, "failed", msg, nil)
		return nil, errors.New(msg)
	}

	var gradeResp *models.GradeEssayResponse
	var lastErr error
	backoffs := []time.Duration{0, 2 * time.Second, 5 * time.Second}
	for _, delay := range backoffs {
		if s.isStopRequested(job.SubmissionID) {
			_ = s.updateSubmissionGradingStatus(job.SubmissionID, "failed", "Dihentikan admin saat menunggu proses AI.", nil)
			return nil, errors.New("grading stopped by admin")
		}
		if delay > 0 {
			time.Sleep(delay)
		}
		s.waitRateSlot()
		gradeResp, lastErr = s.aiService.GradeEssay(*gradeReq)
		if lastErr == nil {
			break
		}
	}
	if s.isStopRequested(job.SubmissionID) {
		_ = s.updateSubmissionGradingStatus(job.SubmissionID, "failed", "Dihentikan admin saat proses grading berjalan.", nil)
		return nil, errors.New("grading stopped by admin")
	}

	if lastErr != nil || gradeResp == nil {
		errMsg := "AI grading failed"
		if lastErr != nil {
			errMsg = lastErr.Error()
		}
		_ = s.updateSubmissionGradingStatus(job.SubmissionID, "failed", errMsg, nil)
		return nil, errors.New(errMsg)
	}

	skorAI, parseErr := strconv.ParseFloat(gradeResp.Score, 64)
	if parseErr != nil {
		skorAI = 0.0
	}
	if shouldRound, roundStep := s.shouldRoundScore(job.QuestionID); shouldRound {
		skorAI = roundToNearestStep(skorAI, roundStep)
		gradeResp.Score = strconv.FormatFloat(skorAI, 'f', -1, 64)
	}
	feedbackAI := gradeResp.Feedback
	var logsRAG *string
	if len(gradeResp.AspectScores) > 0 {
		if aspectJSON, marshalErr := json.Marshal(gradeResp.AspectScores); marshalErr == nil {
			text := string(aspectJSON)
			logsRAG = &text
		}
	}

	if strings.TrimSpace(job.ScoringMethod) == "best" {
		var prevScore sql.NullFloat64
		if err := s.db.QueryRowContext(
			context.Background(),
			"SELECT skor_ai FROM ai_results WHERE submission_id = $1",
			job.SubmissionID,
		).Scan(&prevScore); err != nil && err != sql.ErrNoRows {
			_ = s.updateSubmissionGradingStatus(job.SubmissionID, "failed", err.Error(), nil)
			return gradeResp, err
		}
		if prevScore.Valid && prevScore.Float64 >= skorAI {
			gradedAt := time.Now()
			_ = s.updateSubmissionGradingStatus(job.SubmissionID, "completed", "", &gradedAt)
			return gradeResp, nil
		}
	}

	if _, insertErr := s.db.ExecContext(
		context.Background(),
		`INSERT INTO ai_results (submission_id, skor_ai, umpan_balik_ai, logs_rag, generated_at)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (submission_id) DO UPDATE
			 SET skor_ai = EXCLUDED.skor_ai,
			     umpan_balik_ai = EXCLUDED.umpan_balik_ai,
			     logs_rag = EXCLUDED.logs_rag,
			     generated_at = EXCLUDED.generated_at`,
		job.SubmissionID,
		skorAI,
		feedbackAI,
		logsRAG,
		time.Now(),
	); insertErr != nil {
		_ = s.updateSubmissionGradingStatus(job.SubmissionID, "failed", insertErr.Error(), nil)
		return gradeResp, insertErr
	}

	gradedAt := time.Now()
	_ = s.updateSubmissionGradingStatus(job.SubmissionID, "completed", "", &gradedAt)
	s.clearStopRequest(job.SubmissionID)

	return gradeResp, nil
}

func (s *EssaySubmissionService) runGradingWorker() {
	for job := range s.jobQueue {
		if s.isStopRequested(job.SubmissionID) {
			_ = s.updateSubmissionGradingStatus(job.SubmissionID, "failed", "Dihentikan admin sebelum diproses worker.", nil)
			continue
		}
		if _, err := s.gradeJob(job); err != nil {
			log.Printf("WARNING: AI grading worker failed for submission %s: %v", job.SubmissionID, err)
		}
	}
}

func (s *EssaySubmissionService) enqueueGradingJob(job essayGradingJob) error {
	select {
	case s.jobQueue <- job:
		return nil
	default:
		return errors.New("grading queue is full")
	}
}

func (s *EssaySubmissionService) updateSubmissionGradingStatus(submissionID, status, errMsg string, gradedAt *time.Time) error {
	_, err := s.db.ExecContext(
		context.Background(),
		`UPDATE essay_submissions
		 SET ai_grading_status = $1,
		     ai_grading_error = NULLIF($2, ''),
		     ai_graded_at = $3
		 WHERE id = $4`,
		status,
		errMsg,
		gradedAt,
		submissionID,
	)
	return err
}

// GetEssaySubmissionByID mengambil satu submission esai berdasarkan ID-nya.
func (s *EssaySubmissionService) GetEssaySubmissionByID(submissionID string) (*models.EssaySubmission, error) {
	query := `
		SELECT id, soal_id, siswa_id, submission_type, COALESCE(attempt_count, 1), teks_jawaban, submitted_at, ai_grading_status, ai_grading_error, ai_graded_at
		FROM essay_submissions
		WHERE id = $1
	`

	var es models.EssaySubmission
	err := s.db.QueryRow(query, submissionID).Scan(
		&es.ID, &es.QuestionID, &es.StudentID, &es.SubmissionType, &es.AttemptCount, &es.TeksJawaban, &es.SubmittedAt, &es.AIGradingStatus, &es.AIGradingError, &es.AIGradedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("essay submission not found")
		}
		return nil, fmt.Errorf("error querying essay submission %s: %w", submissionID, err)
	}

	return &es, nil
}

// GetEssaySubmissionsByQuestionID mengambil semua submission esai untuk pertanyaan tertentu.
func (s *EssaySubmissionService) GetEssaySubmissionsByQuestionID(questionID string) ([]models.EssaySubmission, error) {
	query := `
		SELECT 
            es.id, es.soal_id, es.siswa_id, es.submission_type, COALESCE(es.attempt_count, 1), es.teks_jawaban, es.submitted_at, es.ai_grading_status, es.ai_grading_error, es.ai_graded_at,
            u.nama_lengkap AS student_name, u.email AS student_email,
            ar.skor_ai, ar.umpan_balik_ai,
            tr.id AS review_id, tr.revised_score, tr.teacher_feedback,
			ar.logs_rag
		FROM essay_submissions es
        JOIN users u ON u.id = es.siswa_id
        LEFT JOIN ai_results ar ON es.id = ar.submission_id
        LEFT JOIN teacher_reviews tr ON es.id = tr.submission_id
		WHERE es.soal_id = $1
		ORDER BY es.submitted_at DESC
	`

	rows, err := s.db.Query(query, questionID)
	if err != nil {
		return nil, fmt.Errorf("error querying essay submissions for question %s: %w", questionID, err)
	}
	defer rows.Close()

	var submissions []models.EssaySubmission
	for rows.Next() {
		var es models.EssaySubmission
		var skorAI sql.NullFloat64
		var umpanBalikAI sql.NullString
		var reviewID sql.NullString
		var revisedScoreDB sql.NullFloat64   // Use a distinct name for scanning
		var teacherFeedbackDB sql.NullString // Use a distinct name for scanning
		var logsRAG sql.NullString
		if err := rows.Scan(
			&es.ID, &es.QuestionID, &es.StudentID, &es.SubmissionType, &es.AttemptCount, &es.TeksJawaban, &es.SubmittedAt,
			&es.AIGradingStatus, &es.AIGradingError, &es.AIGradedAt,
			&es.StudentName, &es.StudentEmail,
			&skorAI, &umpanBalikAI,
			&reviewID, &revisedScoreDB, &teacherFeedbackDB, &logsRAG,
		); err != nil {
			return nil, fmt.Errorf("error scanning essay submission row: %w", err)
		}

		if skorAI.Valid {
			es.SkorAI = &skorAI.Float64
		}
		if umpanBalikAI.Valid {
			es.UmpanBalikAI = &umpanBalikAI.String
		}
		if reviewID.Valid {
			es.ReviewID = &reviewID.String
		}
		if revisedScoreDB.Valid {
			es.RevisedScore = &revisedScoreDB.Float64
		}
		if teacherFeedbackDB.Valid {
			es.TeacherFeedback = &teacherFeedbackDB.String
		}
		if logsRAG.Valid && strings.TrimSpace(logsRAG.String) != "" {
			var parsedScores []models.GradeEssayAspectScore
			if unmarshalErr := json.Unmarshal([]byte(logsRAG.String), &parsedScores); unmarshalErr == nil {
				es.RubricScores = parsedScores
			}
		}
		submissions = append(submissions, es)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}

	if submissions == nil {
		submissions = []models.EssaySubmission{}
	}

	return submissions, nil
}

func (s *EssaySubmissionService) ListMaterialStudentSubmissionSummaries(materialID, teacherID, query, sortBy string, page, size int) (*models.MaterialStudentSubmissionSummaryListResponse, error) {
	if page < 1 {
		page = 1
	}
	if size < 1 {
		size = 10
	}
	if size > 20 {
		size = 20
	}

	whereClauses := []string{"m.id = $1", "c.teacher_id = $2"}
	args := []interface{}{materialID, teacherID}
	argPos := 3

	if trimmed := strings.TrimSpace(query); trimmed != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("LOWER(u.nama_lengkap) LIKE LOWER($%d)", argPos))
		args = append(args, "%"+trimmed+"%")
		argPos++
	}

	baseCTE := `
		WITH grouped AS (
			SELECT
				es.siswa_id AS student_id,
				u.nama_lengkap AS student_name,
				u.email AS student_email,
				COUNT(es.id)::int AS total_submissions,
				SUM(CASE WHEN tr.revised_score IS NOT NULL OR COALESCE(TRIM(tr.teacher_feedback), '') <> '' THEN 1 ELSE 0 END)::int AS reviewed_submissions,
				MAX(es.submitted_at) AS latest_submitted_at,
				AVG(COALESCE(tr.revised_score, ar.skor_ai)) AS average_final_score
			FROM essay_submissions es
			JOIN essay_questions eq ON eq.id = es.soal_id
			JOIN materials m ON m.id = eq.material_id
			JOIN classes c ON c.id = m.class_id
			JOIN users u ON u.id = es.siswa_id
			LEFT JOIN teacher_reviews tr ON tr.submission_id = es.id
			LEFT JOIN ai_results ar ON ar.submission_id = es.id
			WHERE ` + strings.Join(whereClauses, " AND ") + `
			GROUP BY es.siswa_id, u.nama_lengkap, u.email
		)
	`

	countQuery := baseCTE + `SELECT COUNT(*) FROM grouped`
	var total int64
	if err := s.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("failed to count material student summaries: %w", err)
	}

	totalSubmissionsQuery := baseCTE + `SELECT COALESCE(SUM(total_submissions), 0) FROM grouped`
	var totalSubmissions int64
	if err := s.db.QueryRow(totalSubmissionsQuery, args...).Scan(&totalSubmissions); err != nil {
		return nil, fmt.Errorf("failed to sum material submissions: %w", err)
	}

	orderBy := "latest_submitted_at DESC, student_name ASC"
	switch strings.TrimSpace(sortBy) {
	case "alpha":
		orderBy = "student_name ASC"
	case "pending_desc":
		orderBy = "(total_submissions - reviewed_submissions) DESC, latest_submitted_at DESC"
	case "pending_asc":
		orderBy = "(total_submissions - reviewed_submissions) ASC, latest_submitted_at DESC"
	}

	offset := (page - 1) * size
	dataQuery := baseCTE + fmt.Sprintf(`
		SELECT
			student_id,
			student_name,
			student_email,
			total_submissions,
			reviewed_submissions,
			(total_submissions - reviewed_submissions) AS pending_submissions,
			average_final_score,
			latest_submitted_at
		FROM grouped
		ORDER BY %s
		LIMIT $%d OFFSET $%d
	`, orderBy, argPos, argPos+1)

	queryArgs := append(args, size, offset)
	rows, err := s.db.Query(dataQuery, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("failed to query material student summaries: %w", err)
	}
	defer rows.Close()

	result := &models.MaterialStudentSubmissionSummaryListResponse{
		Items:            []models.MaterialStudentSubmissionSummary{},
		Total:            total,
		Page:             page,
		Size:             size,
		TotalSubmissions: totalSubmissions,
	}
	for rows.Next() {
		var item models.MaterialStudentSubmissionSummary
		var avgScore sql.NullFloat64
		var latestSubmitted sql.NullTime
		if err := rows.Scan(
			&item.StudentID,
			&item.StudentName,
			&item.StudentEmail,
			&item.TotalSubmissions,
			&item.ReviewedSubmissions,
			&item.PendingSubmissions,
			&avgScore,
			&latestSubmitted,
		); err != nil {
			return nil, fmt.Errorf("failed to scan material student summary: %w", err)
		}
		if avgScore.Valid {
			item.AverageFinalScore = &avgScore.Float64
		}
		if latestSubmitted.Valid {
			ts := latestSubmitted.Time
			item.LatestSubmittedAt = &ts
		}
		result.Items = append(result.Items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed during material student summaries iteration: %w", err)
	}
	return result, nil
}

func (s *EssaySubmissionService) GetMaterialSubmissionsByStudent(materialID, teacherID, studentID string) ([]models.EssaySubmission, error) {
	query := `
		SELECT
			es.id, es.soal_id, es.siswa_id, es.submission_type, COALESCE(es.attempt_count, 1), es.teks_jawaban, es.submitted_at, es.ai_grading_status, es.ai_grading_error, es.ai_graded_at,
			u.nama_lengkap AS student_name, u.email AS student_email,
			ar.skor_ai, ar.umpan_balik_ai,
			tr.id AS review_id, tr.revised_score, tr.teacher_feedback,
			ar.logs_rag
		FROM essay_submissions es
		JOIN essay_questions eq ON eq.id = es.soal_id
		JOIN materials m ON m.id = eq.material_id
		JOIN classes c ON c.id = m.class_id
		JOIN users u ON u.id = es.siswa_id
		LEFT JOIN ai_results ar ON ar.submission_id = es.id
		LEFT JOIN teacher_reviews tr ON tr.submission_id = es.id
		WHERE m.id = $1 AND c.teacher_id = $2 AND es.siswa_id = $3
		ORDER BY es.submitted_at DESC
	`
	rows, err := s.db.Query(query, materialID, teacherID, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to query student submissions by material: %w", err)
	}
	defer rows.Close()

	result := []models.EssaySubmission{}
	for rows.Next() {
		var es models.EssaySubmission
		var skorAI sql.NullFloat64
		var umpanBalikAI sql.NullString
		var reviewID sql.NullString
		var revisedScoreDB sql.NullFloat64
		var teacherFeedbackDB sql.NullString
		var logsRAG sql.NullString
		if err := rows.Scan(
			&es.ID, &es.QuestionID, &es.StudentID, &es.SubmissionType, &es.AttemptCount, &es.TeksJawaban, &es.SubmittedAt,
			&es.AIGradingStatus, &es.AIGradingError, &es.AIGradedAt,
			&es.StudentName, &es.StudentEmail,
			&skorAI, &umpanBalikAI,
			&reviewID, &revisedScoreDB, &teacherFeedbackDB, &logsRAG,
		); err != nil {
			return nil, fmt.Errorf("failed to scan student material submission: %w", err)
		}
		if skorAI.Valid {
			es.SkorAI = &skorAI.Float64
		}
		if umpanBalikAI.Valid {
			es.UmpanBalikAI = &umpanBalikAI.String
		}
		if reviewID.Valid {
			es.ReviewID = &reviewID.String
		}
		if revisedScoreDB.Valid {
			es.RevisedScore = &revisedScoreDB.Float64
		}
		if teacherFeedbackDB.Valid {
			es.TeacherFeedback = &teacherFeedbackDB.String
		}
		if logsRAG.Valid && strings.TrimSpace(logsRAG.String) != "" {
			var parsedScores []models.GradeEssayAspectScore
			if unmarshalErr := json.Unmarshal([]byte(logsRAG.String), &parsedScores); unmarshalErr == nil {
				es.RubricScores = parsedScores
			}
		}
		result = append(result, es)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed during student material submissions iteration: %w", err)
	}
	return result, nil
}

// GetEssaySubmissionsByStudentID mengambil semua submission esai oleh siswa tertentu.
func (s *EssaySubmissionService) GetEssaySubmissionsByStudentID(studentID string) ([]models.EssaySubmission, error) {
	query := `
		SELECT id, soal_id, siswa_id, submission_type, COALESCE(attempt_count, 1), teks_jawaban, submitted_at, ai_grading_status, ai_grading_error, ai_graded_at
		FROM essay_submissions
		WHERE siswa_id = $1
		ORDER BY submitted_at DESC
	`

	rows, err := s.db.Query(query, studentID)
	if err != nil {
		return nil, fmt.Errorf("error querying essay submissions by student %s: %w", studentID, err)
	}
	defer rows.Close()

	var submissions []models.EssaySubmission
	for rows.Next() {
		var es models.EssaySubmission
		if err := rows.Scan(&es.ID, &es.QuestionID, &es.StudentID, &es.SubmissionType, &es.AttemptCount, &es.TeksJawaban, &es.SubmittedAt, &es.AIGradingStatus, &es.AIGradingError, &es.AIGradedAt); err != nil {
			return nil, fmt.Errorf("error scanning essay submission row: %w", err)
		}
		submissions = append(submissions, es)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}

	if submissions == nil {
		submissions = []models.EssaySubmission{}
	}

	return submissions, nil
}

// UpdateEssaySubmission memperbarui field-field submission esai secara dinamis.
func (s *EssaySubmissionService) UpdateEssaySubmission(submissionID string, updateReq *models.UpdateEssaySubmissionRequest) (*models.EssaySubmission, error) {
	updates := make(map[string]interface{})
	if updateReq.TeksJawaban != nil {
		updates["teks_jawaban"] = *updateReq.TeksJawaban
	}

	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for k, v := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, i))
		args = append(args, v)
		i++
	}

	query := fmt.Sprintf("UPDATE essay_submissions SET %s WHERE id = $%d RETURNING id, soal_id, siswa_id, submission_type, teks_jawaban, submitted_at, ai_grading_status, ai_grading_error, ai_graded_at",
		strings.Join(setClauses, ", "), i)
	args = append(args, submissionID)

	var es models.EssaySubmission
	err := s.db.QueryRow(query, args...).Scan(
		&es.ID, &es.QuestionID, &es.StudentID, &es.SubmissionType, &es.TeksJawaban, &es.SubmittedAt, &es.AIGradingStatus, &es.AIGradingError, &es.AIGradedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("essay submission not found for update")
		}
		return nil, fmt.Errorf("error updating essay submission %s: %w", submissionID, err)
	}

	return &es, nil
}

func (s *EssaySubmissionService) GetAdminQueueSummary() (*models.AdminQueueSummary, error) {
	summary := &models.AdminQueueSummary{}
	if err := s.db.QueryRow(`
		SELECT
			COALESCE(SUM(CASE WHEN ai_grading_status = 'queued' THEN 1 ELSE 0 END), 0) AS queued,
			COALESCE(SUM(CASE WHEN ai_grading_status = 'processing' THEN 1 ELSE 0 END), 0) AS processing,
			COALESCE(SUM(CASE WHEN ai_grading_status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
			COALESCE(SUM(CASE WHEN ai_grading_status = 'failed' THEN 1 ELSE 0 END), 0) AS failed,
			COUNT(*) AS total
		FROM essay_submissions
		WHERE submission_type = 'essay'
	`).Scan(&summary.Queued, &summary.Processing, &summary.Completed, &summary.Failed, &summary.Total); err != nil {
		return nil, fmt.Errorf("failed to load queue summary: %w", err)
	}
	return summary, nil
}

func (s *EssaySubmissionService) ListAdminQueueJobs(status, classID string, from, to *time.Time, page, size int) (*models.AdminQueueJobListResponse, error) {
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

	if trimmed := strings.TrimSpace(status); trimmed != "" {
		clauses = append(clauses, fmt.Sprintf("es.ai_grading_status = $%d", argPos))
		args = append(args, trimmed)
		argPos++
	}
	if trimmed := strings.TrimSpace(classID); trimmed != "" {
		clauses = append(clauses, fmt.Sprintf("c.id = $%d", argPos))
		args = append(args, trimmed)
		argPos++
	}
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

	baseFrom := `
		FROM essay_submissions es
		JOIN essay_questions eq ON eq.id = es.soal_id
		JOIN materials m ON m.id = eq.material_id
		JOIN classes c ON c.id = m.class_id
		JOIN users u ON u.id = es.siswa_id
		LEFT JOIN ai_results ar ON ar.submission_id = es.id
	`
	clauses = append(clauses, "es.submission_type = 'essay'")
	whereSQL := ""
	if len(clauses) > 0 {
		whereSQL = " WHERE " + strings.Join(clauses, " AND ")
	}

	var total int64
	countQuery := "SELECT COUNT(*) " + baseFrom + whereSQL
	if err := s.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("failed to count queue jobs: %w", err)
	}

	offset := (page - 1) * size
	dataQuery := `
		SELECT
			es.id,
			es.soal_id,
			eq.teks_soal,
			es.siswa_id,
			u.nama_lengkap,
			c.id,
			c.class_name,
			m.id,
			m.judul,
			es.ai_grading_status,
			es.ai_grading_error,
			es.submitted_at,
			es.ai_graded_at,
			ar.skor_ai,
			ar.umpan_balik_ai
	` + baseFrom + whereSQL + fmt.Sprintf(`
		ORDER BY es.submitted_at DESC
		LIMIT $%d OFFSET $%d
	`, argPos, argPos+1)

	queryArgs := append(args, size, offset)
	rows, err := s.db.Query(dataQuery, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("failed to list queue jobs: %w", err)
	}
	defer rows.Close()

	result := &models.AdminQueueJobListResponse{
		Items: []models.AdminQueueJob{},
		Total: total,
		Page:  page,
		Size:  size,
	}

	for rows.Next() {
		var item models.AdminQueueJob
		var score sql.NullFloat64
		var feedback sql.NullString
		var gradingErr sql.NullString
		if err := rows.Scan(
			&item.SubmissionID,
			&item.QuestionID,
			&item.QuestionText,
			&item.StudentID,
			&item.StudentName,
			&item.ClassID,
			&item.ClassName,
			&item.MaterialID,
			&item.MaterialTitle,
			&item.Status,
			&gradingErr,
			&item.SubmittedAt,
			&item.AIGradedAt,
			&score,
			&feedback,
		); err != nil {
			return nil, fmt.Errorf("failed to scan queue job row: %w", err)
		}
		if score.Valid {
			item.Score = &score.Float64
		}
		if gradingErr.Valid {
			errText := gradingErr.String
			item.GradingError = &errText
		}
		if feedback.Valid {
			trimmed := strings.TrimSpace(feedback.String)
			if len(trimmed) > 180 {
				trimmed = trimmed[:180] + "..."
			}
			preview := trimmed
			item.FeedbackPreview = &preview
		}
		result.Items = append(result.Items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error while iterating queue jobs: %w", err)
	}

	return result, nil
}

func (s *EssaySubmissionService) RetryQueueSubmissions(submissionIDs []string) (*models.RetryQueueResponse, error) {
	resp := &models.RetryQueueResponse{
		Details: []models.RetryQueueItemResult{},
	}

	if s.aiService == nil {
		return nil, fmt.Errorf("AI service is unavailable")
	}

	seen := map[string]struct{}{}
	for _, submissionID := range submissionIDs {
		submissionID = strings.TrimSpace(submissionID)
		if submissionID == "" {
			continue
		}
		if _, exists := seen[submissionID]; exists {
			continue
		}
		seen[submissionID] = struct{}{}

		var (
			job            essayGradingJob
			status         string
			submissionType string
		)
		err := s.db.QueryRow(`
			SELECT id, soal_id, siswa_id, submission_type, teks_jawaban, ai_grading_status
			FROM essay_submissions
			WHERE id = $1
		`, submissionID).Scan(&job.SubmissionID, &job.QuestionID, &job.StudentID, &submissionType, &job.TeksJawaban, &status)
		if err != nil {
			if err == sql.ErrNoRows {
				resp.Skipped++
				resp.Details = append(resp.Details, models.RetryQueueItemResult{
					SubmissionID: submissionID,
					Status:       "skipped",
					Message:      "Submission tidak ditemukan",
				})
				continue
			}
			return nil, fmt.Errorf("failed to load submission %s: %w", submissionID, err)
		}

		if status == "processing" {
			resp.Skipped++
			resp.Details = append(resp.Details, models.RetryQueueItemResult{
				SubmissionID: submissionID,
				Status:       "skipped",
				Message:      "Submission sedang diproses",
			})
			continue
		}
		if submissionType != "essay" {
			resp.Skipped++
			resp.Details = append(resp.Details, models.RetryQueueItemResult{
				SubmissionID: submissionID,
				Status:       "skipped",
				Message:      "Submission tugas tidak diproses AI queue",
			})
			continue
		}

		if _, err := s.db.Exec(`
			UPDATE essay_submissions
			SET ai_grading_status = 'queued',
			    ai_grading_error = NULL,
			    ai_graded_at = NULL
			WHERE id = $1
		`, submissionID); err != nil {
			return nil, fmt.Errorf("failed to reset submission %s: %w", submissionID, err)
		}
		s.clearStopRequest(submissionID)

		if err := s.enqueueGradingJob(job); err != nil {
			_ = s.updateSubmissionGradingStatus(submissionID, "failed", "Grading queue penuh. Coba lagi beberapa saat.", nil)
			resp.Skipped++
			resp.Details = append(resp.Details, models.RetryQueueItemResult{
				SubmissionID: submissionID,
				Status:       "skipped",
				Message:      "Queue penuh",
			})
			continue
		}

		resp.Accepted++
		resp.Details = append(resp.Details, models.RetryQueueItemResult{
			SubmissionID: submissionID,
			Status:       "queued",
		})
	}

	return resp, nil
}

func (s *EssaySubmissionService) StopQueueSubmissions(submissionIDs []string) (*models.StopQueueResponse, error) {
	resp := &models.StopQueueResponse{
		Details: []models.StopQueueItemResult{},
	}

	seen := map[string]struct{}{}
	for _, submissionID := range submissionIDs {
		submissionID = strings.TrimSpace(submissionID)
		if submissionID == "" {
			continue
		}
		if _, exists := seen[submissionID]; exists {
			continue
		}
		seen[submissionID] = struct{}{}

		var (
			status         string
			submissionType string
		)
		err := s.db.QueryRowContext(
			context.Background(),
			`SELECT submission_type, ai_grading_status
			 FROM essay_submissions
			 WHERE id = $1`,
			submissionID,
		).Scan(&submissionType, &status)
		if err != nil {
			if err == sql.ErrNoRows {
				resp.Skipped++
				resp.Details = append(resp.Details, models.StopQueueItemResult{
					SubmissionID: submissionID,
					Status:       "skipped",
					Message:      "Submission tidak ditemukan",
				})
				continue
			}
			return nil, fmt.Errorf("failed to load submission %s: %w", submissionID, err)
		}
		if submissionType != "essay" {
			resp.Skipped++
			resp.Details = append(resp.Details, models.StopQueueItemResult{
				SubmissionID: submissionID,
				Status:       "skipped",
				Message:      "Submission tugas tidak memakai AI queue",
			})
			continue
		}
		if status != "queued" && status != "processing" {
			resp.Skipped++
			resp.Details = append(resp.Details, models.StopQueueItemResult{
				SubmissionID: submissionID,
				Status:       "skipped",
				Message:      fmt.Sprintf("Status saat ini %s tidak bisa dihentikan", status),
			})
			continue
		}

		s.markStopRequested(submissionID)
		if _, err := s.db.ExecContext(
			context.Background(),
			`UPDATE essay_submissions
			 SET ai_grading_status = 'failed',
			     ai_grading_error = 'Dihentikan admin.',
			     ai_graded_at = NOW()
			 WHERE id = $1`,
			submissionID,
		); err != nil {
			return nil, fmt.Errorf("failed to stop submission %s: %w", submissionID, err)
		}

		resp.Accepted++
		resp.Details = append(resp.Details, models.StopQueueItemResult{
			SubmissionID: submissionID,
			Status:       "stopped",
			Message:      "Job AI dihentikan admin",
		})
	}

	return resp, nil
}

// DeleteEssaySubmissionWithDependencies menghapus submission esai beserta hasil AI dan review guru yang terkait.
// Ini dilakukan dalam transaksi untuk memastikan konsistensi data.
func (s *EssaySubmissionService) DeleteEssaySubmissionWithDependencies(submissionID string) error {
	tx, err := s.db.BeginTx(context.Background(), nil)
	if err != nil {
		return fmt.Errorf("could not begin transaction: %w", err)
	}
	defer tx.Rollback() // Pastikan rollback jika terjadi error.

	// 1. Hapus review guru yang terkait (jika ada).
	_, err = tx.Exec("DELETE FROM teacher_reviews WHERE submission_id = $1", submissionID)
	if err != nil {
		return fmt.Errorf("error deleting teacher reviews for submission %s: %w", submissionID, err)
	}

	// 2. Hapus hasil AI yang terkait (jika ada).
	_, err = tx.Exec("DELETE FROM ai_results WHERE submission_id = $1", submissionID)
	if err != nil {
		return fmt.Errorf("error deleting AI results for submission %s: %w", submissionID, err)
	}

	// 3. Hapus submission esai itu sendiri.
	result, err := tx.Exec("DELETE FROM essay_submissions WHERE id = $1", submissionID)
	if err != nil {
		return fmt.Errorf("error deleting essay submission %s: %w", submissionID, err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("essay submission not found with ID %s", submissionID)
	}

	return tx.Commit() // Commit transaksi jika semua berhasil.
}

func (s *EssaySubmissionService) CreateTaskSubmission(questionID, studentID, teksJawaban string) (*models.EssaySubmission, error) {
	newSubmission := &models.EssaySubmission{
		QuestionID:      questionID,
		StudentID:       studentID,
		SubmissionType:  "task",
		TeksJawaban:     teksJawaban,
		SubmittedAt:     time.Now(),
		AIGradingStatus: "completed",
	}
	err := s.db.QueryRowContext(
		context.Background(),
		`INSERT INTO essay_submissions (soal_id, siswa_id, submission_type, teks_jawaban, submitted_at, ai_grading_status)
		 VALUES ($1, $2, 'task', $3, $4, 'completed')
		 ON CONFLICT (soal_id, siswa_id) DO UPDATE
		 SET submission_type = 'task',
		     teks_jawaban = EXCLUDED.teks_jawaban,
		     submitted_at = EXCLUDED.submitted_at,
		     ai_grading_status = 'completed',
		     ai_grading_error = NULL,
		     ai_graded_at = NULL
		 RETURNING id`,
		newSubmission.QuestionID,
		newSubmission.StudentID,
		newSubmission.TeksJawaban,
		newSubmission.SubmittedAt,
	).Scan(&newSubmission.ID)
	if err != nil {
		return nil, fmt.Errorf("error creating task submission: %w", err)
	}

	// Pastikan submission tugas bersih dari jejak AI jika sebelumnya pernah dinilai sebagai essay.
	if _, cleanupErr := s.db.ExecContext(context.Background(), "DELETE FROM ai_results WHERE submission_id = $1", newSubmission.ID); cleanupErr != nil {
		return nil, fmt.Errorf("error cleaning AI result for task submission: %w", cleanupErr)
	}

	return newSubmission, nil
}

func (s *EssaySubmissionService) GetTaskSubmissionByID(submissionID string) (*models.EssaySubmission, error) {
	isTask, err := s.isTaskSubmissionByID(submissionID)
	if err != nil {
		return nil, err
	}
	if !isTask {
		return nil, fmt.Errorf("task submission not found")
	}
	return s.GetEssaySubmissionByID(submissionID)
}

func (s *EssaySubmissionService) UpdateTaskSubmission(submissionID string, updateReq *models.UpdateEssaySubmissionRequest) (*models.EssaySubmission, error) {
	isTask, err := s.isTaskSubmissionByID(submissionID)
	if err != nil {
		return nil, err
	}
	if !isTask {
		return nil, fmt.Errorf("task submission not found")
	}
	return s.UpdateEssaySubmission(submissionID, updateReq)
}

func (s *EssaySubmissionService) DeleteTaskSubmissionWithDependencies(submissionID string) error {
	isTask, err := s.isTaskSubmissionByID(submissionID)
	if err != nil {
		return err
	}
	if !isTask {
		return fmt.Errorf("task submission not found")
	}
	return s.DeleteEssaySubmissionWithDependencies(submissionID)
}

func (s *EssaySubmissionService) GetTaskSubmissionsByStudentID(studentID string) ([]models.EssaySubmission, error) {
	query := `
		SELECT id, soal_id, siswa_id, submission_type, teks_jawaban, submitted_at, ai_grading_status, ai_grading_error, ai_graded_at
		FROM essay_submissions
		WHERE siswa_id = $1 AND submission_type = 'task'
		ORDER BY submitted_at DESC
	`

	rows, err := s.db.Query(query, studentID)
	if err != nil {
		return nil, fmt.Errorf("error querying task submissions by student %s: %w", studentID, err)
	}
	defer rows.Close()

	var submissions []models.EssaySubmission
	for rows.Next() {
		var es models.EssaySubmission
		if err := rows.Scan(&es.ID, &es.QuestionID, &es.StudentID, &es.SubmissionType, &es.TeksJawaban, &es.SubmittedAt, &es.AIGradingStatus, &es.AIGradingError, &es.AIGradedAt); err != nil {
			return nil, fmt.Errorf("error scanning task submission row: %w", err)
		}
		submissions = append(submissions, es)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during task rows iteration: %w", err)
	}
	if submissions == nil {
		submissions = []models.EssaySubmission{}
	}
	return submissions, nil
}
