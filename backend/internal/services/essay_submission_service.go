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
}

type essayGradingJob struct {
	SubmissionID string
	QuestionID   string
	StudentID    string
	TeksJawaban  string
}

func roundToNearestFive(score float64) float64 {
	return math.Round(score/5.0) * 5.0
}

func (s *EssaySubmissionService) shouldRoundScore(questionID string) bool {
	var enabled bool
	err := s.db.QueryRowContext(
		context.Background(),
		"SELECT COALESCE(round_score_to_5, FALSE) FROM essay_questions WHERE id = $1",
		questionID,
	).Scan(&enabled)
	if err != nil {
		return false
	}
	return enabled
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
	}
	for i := 0; i < workers; i++ {
		go svc.runGradingWorker()
	}
	return svc
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
		Essay:       teksJawaban,
		Question:    question.TeksSoal,
		IdealAnswer: idealAnswer,
		Keywords:    keywords,
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

func (s *EssaySubmissionService) CreateEssaySubmission(questionID, studentID, teksJawaban string) (*models.EssaySubmission, *models.GradeEssayResponse, error) {
	// Membuat objek EssaySubmission baru.
	newSubmission := &models.EssaySubmission{
		QuestionID:      questionID,
		StudentID:       studentID,
		TeksJawaban:     teksJawaban,
		SubmittedAt:     time.Now(),
		AIGradingStatus: "queued",
	}

	// Query INSERT untuk menambahkan submission esai baru.
	query := `
		INSERT INTO essay_submissions (soal_id, siswa_id, teks_jawaban, submitted_at, ai_grading_status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`

	// Menjalankan query dan memindai ID yang dikembalikan ke newSubmission.ID.
	err := s.db.QueryRow(
		query,
		newSubmission.QuestionID,
		newSubmission.StudentID,
		newSubmission.TeksJawaban,
		newSubmission.SubmittedAt,
		newSubmission.AIGradingStatus,
	).Scan(&newSubmission.ID)

	if err != nil {
		return nil, nil, fmt.Errorf("error inserting new essay submission: %w", err)
	}

	if s.aiService == nil {
		return newSubmission, nil, fmt.Errorf("AI service is unavailable; submission queued without grading")
	}

	job := essayGradingJob{
		SubmissionID: newSubmission.ID,
		QuestionID:   questionID,
		StudentID:    studentID,
		TeksJawaban:  teksJawaban,
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
		if delay > 0 {
			time.Sleep(delay)
		}
		s.waitRateSlot()
		gradeResp, lastErr = s.aiService.GradeEssay(*gradeReq)
		if lastErr == nil {
			break
		}
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
	if s.shouldRoundScore(job.QuestionID) {
		skorAI = roundToNearestFive(skorAI)
		gradeResp.Score = strconv.FormatFloat(skorAI, 'f', 0, 64)
	}
	feedbackAI := gradeResp.Feedback
	var logsRAG *string
	if len(gradeResp.AspectScores) > 0 {
		if aspectJSON, marshalErr := json.Marshal(gradeResp.AspectScores); marshalErr == nil {
			text := string(aspectJSON)
			logsRAG = &text
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

	return gradeResp, nil
}

func (s *EssaySubmissionService) runGradingWorker() {
	for job := range s.jobQueue {
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
		SELECT id, soal_id, siswa_id, teks_jawaban, submitted_at, ai_grading_status, ai_grading_error, ai_graded_at
		FROM essay_submissions
		WHERE id = $1
	`

	var es models.EssaySubmission
	err := s.db.QueryRow(query, submissionID).Scan(
		&es.ID, &es.QuestionID, &es.StudentID, &es.TeksJawaban, &es.SubmittedAt, &es.AIGradingStatus, &es.AIGradingError, &es.AIGradedAt,
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
            es.id, es.soal_id, es.siswa_id, es.teks_jawaban, es.submitted_at, es.ai_grading_status, es.ai_grading_error, es.ai_graded_at,
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
			&es.ID, &es.QuestionID, &es.StudentID, &es.TeksJawaban, &es.SubmittedAt,
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

// GetEssaySubmissionsByStudentID mengambil semua submission esai oleh siswa tertentu.
func (s *EssaySubmissionService) GetEssaySubmissionsByStudentID(studentID string) ([]models.EssaySubmission, error) {
	query := `
		SELECT id, soal_id, siswa_id, teks_jawaban, submitted_at, ai_grading_status, ai_grading_error, ai_graded_at
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
		if err := rows.Scan(&es.ID, &es.QuestionID, &es.StudentID, &es.TeksJawaban, &es.SubmittedAt, &es.AIGradingStatus, &es.AIGradingError, &es.AIGradedAt); err != nil {
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

	query := fmt.Sprintf("UPDATE essay_submissions SET %s WHERE id = $%d RETURNING id, soal_id, siswa_id, teks_jawaban, submitted_at, ai_grading_status, ai_grading_error, ai_graded_at",
		strings.Join(setClauses, ", "), i)
	args = append(args, submissionID)

	var es models.EssaySubmission
	err := s.db.QueryRow(query, args...).Scan(
		&es.ID, &es.QuestionID, &es.StudentID, &es.TeksJawaban, &es.SubmittedAt, &es.AIGradingStatus, &es.AIGradingError, &es.AIGradedAt,
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
			job    essayGradingJob
			status string
		)
		err := s.db.QueryRow(`
			SELECT id, soal_id, siswa_id, teks_jawaban, ai_grading_status
			FROM essay_submissions
			WHERE id = $1
		`, submissionID).Scan(&job.SubmissionID, &job.QuestionID, &job.StudentID, &job.TeksJawaban, &status)
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

		if _, err := s.db.Exec(`
			UPDATE essay_submissions
			SET ai_grading_status = 'queued',
			    ai_grading_error = NULL,
			    ai_graded_at = NULL
			WHERE id = $1
		`, submissionID); err != nil {
			return nil, fmt.Errorf("failed to reset submission %s: %w", submissionID, err)
		}

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
