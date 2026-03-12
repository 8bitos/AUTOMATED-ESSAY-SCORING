package handlers

import (
	"api-backend/internal/models"
	"api-backend/internal/services"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/xuri/excelize/v2"
)

// EssaySubmissionHandlers holds dependencies for essay submission-related handlers.
type EssaySubmissionHandlers struct {
	Service         *services.EssaySubmissionService
	AIResultService *services.AIResultService
}

// NewEssaySubmissionHandlers creates a new instance of EssaySubmissionHandlers.
func NewEssaySubmissionHandlers(s *services.EssaySubmissionService, ars *services.AIResultService) *EssaySubmissionHandlers {
	return &EssaySubmissionHandlers{Service: s, AIResultService: ars}
}

func parseSubmissionReportDate(raw string, isEnd bool) (*time.Time, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	layouts := []string{"2006-01-02", "2006-01-02T15:04", time.RFC3339}
	var parsed time.Time
	var err error
	for _, layout := range layouts {
		parsed, err = time.Parse(layout, trimmed)
		if err == nil {
			break
		}
	}
	if err != nil {
		return nil, fmt.Errorf("invalid date format")
	}
	if isEnd && len(trimmed) == 10 {
		parsed = parsed.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	}
	return &parsed, nil
}

// ----------------------------
// Create
// ----------------------------
func (h *EssaySubmissionHandlers) CreateEssaySubmissionHandler(w http.ResponseWriter, r *http.Request) {
	var req models.CreateEssaySubmissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.QuestionID == "" || req.TeksJawaban == "" {
		respondWithError(w, http.StatusBadRequest, "Question ID and Teks Jawaban cannot be empty")
		return
	}

	studentID, ok := r.Context().Value("userID").(string)
	if !ok || studentID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	newSubmission, gradeResp, err := h.Service.CreateEssaySubmission(req.QuestionID, studentID, req.TeksJawaban)
	if err != nil {
		if errors.Is(err, services.ErrAttemptLimitReached) {
			respondWithError(w, http.StatusBadRequest, "Batas attempt sudah tercapai.")
			return
		}
		var cooldownErr *services.AttemptCooldownError
		if errors.As(err, &cooldownErr) {
			respondWithError(w, http.StatusTooManyRequests, cooldownErr.Error())
			return
		}
		if newSubmission == nil {
			log.Printf("ERROR: Failed to create essay submission: %v", err)
			respondWithError(w, http.StatusInternalServerError, "Failed to create essay submission")
			return
		}
		log.Printf("WARNING: Submission created but AI grading failed: %v", err)
	}

	var createdAIResult *models.AIResult
	if gradeResp != nil {
		if result, fetchErr := h.AIResultService.GetAIResultBySubmissionID(newSubmission.ID); fetchErr == nil {
			createdAIResult = result
		} else {
			log.Printf("WARNING: Failed to fetch AI result for submission %s: %v", newSubmission.ID, fetchErr)
		}
	}

	response := map[string]interface{}{
		"submission":     newSubmission,
		"ai_result":      createdAIResult,
		"grading_status": newSubmission.AIGradingStatus,
		"grading_message": func() string {
			// Jika status completed tapi tanpa ai_result, anggap sebagai tugas manual.
			if newSubmission.AIGradingStatus == "completed" && createdAIResult == nil {
				return "Tugas berhasil dikirim ke guru untuk direview."
			}
			switch newSubmission.AIGradingStatus {
			case "completed":
				return "Jawaban berhasil dinilai AI."
			case "failed":
				return "Jawaban diterima, tetapi gagal masuk antrian penilaian AI. Coba lagi beberapa saat."
			default:
				return "Jawaban diterima dan masuk antrian penilaian AI."
			}
		}(),
	}

	respondWithJSON(w, http.StatusCreated, response)
}

// ----------------------------
// Read
// ----------------------------
func (h *EssaySubmissionHandlers) GetEssaySubmissionByIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	submissionID, ok := vars["submissionId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Submission ID is missing")
		return
	}

	submission, err := h.Service.GetEssaySubmissionByID(submissionID)
	if err != nil {
		if err.Error() == "essay submission not found" {
			respondWithError(w, http.StatusNotFound, "Essay submission not found")
			return
		}
		log.Printf("ERROR: Failed to get submission %s: %v", submissionID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve submission")
		return
	}

	respondWithJSON(w, http.StatusOK, submission)
}

func (h *EssaySubmissionHandlers) GetEssaySubmissionsByQuestionIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	questionID, ok := vars["questionId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Question ID is missing")
		return
	}

	submissions, err := h.Service.GetEssaySubmissionsByQuestionID(questionID)
	if err != nil {
		log.Printf("ERROR: Failed to get submissions for question %s: %v", questionID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve submissions")
		return
	}

	respondWithJSON(w, http.StatusOK, submissions)
}

func (h *EssaySubmissionHandlers) GetEssaySubmissionsByStudentIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	studentID, ok := vars["studentId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Student ID is missing")
		return
	}

	submissions, err := h.Service.GetEssaySubmissionsByStudentID(studentID)
	if err != nil {
		log.Printf("ERROR: Failed to get submissions by student %s: %v", studentID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve submissions")
		return
	}

	respondWithJSON(w, http.StatusOK, submissions)
}

func (h *EssaySubmissionHandlers) GetMaterialStudentSubmissionSummariesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	materialID, ok := vars["materialId"]
	if !ok || strings.TrimSpace(materialID) == "" {
		respondWithError(w, http.StatusBadRequest, "Material ID is missing")
		return
	}
	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || strings.TrimSpace(teacherID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	sortBy := strings.TrimSpace(r.URL.Query().Get("sort"))
	page := 1
	size := 10
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			page = parsed
		}
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			size = parsed
		}
	}

	result, err := h.Service.ListMaterialStudentSubmissionSummaries(materialID, teacherID, q, sortBy, page, size)
	if err != nil {
		log.Printf("ERROR: Failed to list student submission summaries for material %s: %v", materialID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve student submission summaries")
		return
	}
	respondWithJSON(w, http.StatusOK, result)
}

func (h *EssaySubmissionHandlers) GetMaterialSubmissionsByStudentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	materialID, ok := vars["materialId"]
	if !ok || strings.TrimSpace(materialID) == "" {
		respondWithError(w, http.StatusBadRequest, "Material ID is missing")
		return
	}
	studentID, ok := vars["studentId"]
	if !ok || strings.TrimSpace(studentID) == "" {
		respondWithError(w, http.StatusBadRequest, "Student ID is missing")
		return
	}
	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || strings.TrimSpace(teacherID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	submissions, err := h.Service.GetMaterialSubmissionsByStudent(materialID, teacherID, studentID)
	if err != nil {
		log.Printf("ERROR: Failed to get submissions for material %s student %s: %v", materialID, studentID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve student submissions")
		return
	}
	respondWithJSON(w, http.StatusOK, submissions)
}

func (h *EssaySubmissionHandlers) GetClassStudentSubmissionSummariesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok || strings.TrimSpace(classID) == "" {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing")
		return
	}
	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || strings.TrimSpace(teacherID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	materialID := strings.TrimSpace(r.URL.Query().Get("materialId"))
	sortBy := strings.TrimSpace(r.URL.Query().Get("sort"))
	dateFrom, err := parseSubmissionReportDate(r.URL.Query().Get("dateFrom"), false)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid dateFrom format")
		return
	}
	dateTo, err := parseSubmissionReportDate(r.URL.Query().Get("dateTo"), true)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid dateTo format")
		return
	}
	page := 1
	size := 10
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			page = parsed
		}
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			size = parsed
		}
	}

	result, err := h.Service.ListClassStudentSubmissionSummaries(classID, teacherID, materialID, dateFrom, dateTo, q, sortBy, page, size)
	if err != nil {
		log.Printf("ERROR: Failed to list student submission summaries for class %s: %v", classID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve student submission summaries")
		return
	}
	respondWithJSON(w, http.StatusOK, result)
}

func (h *EssaySubmissionHandlers) GetClassScoreDistributionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok || strings.TrimSpace(classID) == "" {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing")
		return
	}
	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || strings.TrimSpace(teacherID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	materialID := strings.TrimSpace(r.URL.Query().Get("materialId"))
	dateFrom, err := parseSubmissionReportDate(r.URL.Query().Get("dateFrom"), false)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid dateFrom format")
		return
	}
	dateTo, err := parseSubmissionReportDate(r.URL.Query().Get("dateTo"), true)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid dateTo format")
		return
	}

	result, err := h.Service.GetClassScoreDistribution(classID, teacherID, materialID, dateFrom, dateTo)
	if err != nil {
		log.Printf("ERROR: Failed to load score distribution for class %s: %v", classID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to load score distribution")
		return
	}
	respondWithJSON(w, http.StatusOK, result)
}

func (h *EssaySubmissionHandlers) ExportClassStudentSummariesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok || strings.TrimSpace(classID) == "" {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing")
		return
	}
	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || strings.TrimSpace(teacherID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	q := strings.TrimSpace(r.URL.Query().Get("q"))
	materialID := strings.TrimSpace(r.URL.Query().Get("materialId"))
	sortBy := strings.TrimSpace(r.URL.Query().Get("sort"))
	format := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("format")))
	dateFrom, err := parseSubmissionReportDate(r.URL.Query().Get("dateFrom"), false)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid dateFrom format")
		return
	}
	dateTo, err := parseSubmissionReportDate(r.URL.Query().Get("dateTo"), true)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid dateTo format")
		return
	}

	items, err := h.Service.ListClassStudentSubmissionSummariesAll(classID, teacherID, materialID, dateFrom, dateTo, q, sortBy)
	if err != nil {
		log.Printf("ERROR: Failed to export student submission summaries for class %s: %v", classID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to export student submission summaries")
		return
	}

	if format == "xlsx" {
		file := excelize.NewFile()
		sheet := file.GetSheetName(0)
		headers := []string{
			"student_id",
			"student_name",
			"student_email",
			"total_submissions",
			"reviewed_submissions",
			"pending_submissions",
			"average_final_score",
			"latest_submitted_at",
		}
		for idx, header := range headers {
			cell, _ := excelize.CoordinatesToCellName(idx+1, 1)
			_ = file.SetCellValue(sheet, cell, header)
		}
		for rowIdx, item := range items {
			row := rowIdx + 2
			avg := ""
			if item.AverageFinalScore != nil {
				avg = fmt.Sprintf("%.2f", *item.AverageFinalScore)
			}
			latest := ""
			if item.LatestSubmittedAt != nil {
				latest = item.LatestSubmittedAt.Format("2006-01-02 15:04:05")
			}
			values := []interface{}{
				item.StudentID,
				item.StudentName,
				item.StudentEmail,
				item.TotalSubmissions,
				item.ReviewedSubmissions,
				item.PendingSubmissions,
				avg,
				latest,
			}
			for colIdx, value := range values {
				cell, _ := excelize.CoordinatesToCellName(colIdx+1, row)
				_ = file.SetCellValue(sheet, cell, value)
			}
		}
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"laporan-nilai-%s.xlsx\"", classID))
		_ = file.Write(w)
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"laporan-nilai-%s.csv\"", classID))

	writer := csv.NewWriter(w)
	_ = writer.Write([]string{
		"student_id",
		"student_name",
		"student_email",
		"total_submissions",
		"reviewed_submissions",
		"pending_submissions",
		"average_final_score",
		"latest_submitted_at",
	})

	for _, item := range items {
		avg := ""
		if item.AverageFinalScore != nil {
			avg = fmt.Sprintf("%.2f", *item.AverageFinalScore)
		}
		latest := ""
		if item.LatestSubmittedAt != nil {
			latest = item.LatestSubmittedAt.Format("2006-01-02 15:04:05")
		}
		_ = writer.Write([]string{
			item.StudentID,
			item.StudentName,
			item.StudentEmail,
			strconv.Itoa(item.TotalSubmissions),
			strconv.Itoa(item.ReviewedSubmissions),
			strconv.Itoa(item.PendingSubmissions),
			avg,
			latest,
		})
	}
	writer.Flush()
}

// ----------------------------
// Update
// ----------------------------
func (h *EssaySubmissionHandlers) UpdateEssaySubmissionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	submissionID, ok := vars["submissionId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Submission ID is missing")
		return
	}

	var req models.UpdateEssaySubmissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	updated, err := h.Service.UpdateEssaySubmission(submissionID, &req)
	if err != nil {
		if err.Error() == "essay submission not found for update" {
			respondWithError(w, http.StatusNotFound, "Essay submission not found")
			return
		} else if err.Error() == "no fields to update" {
			respondWithError(w, http.StatusBadRequest, err.Error())
			return
		}
		log.Printf("ERROR: Failed to update submission %s: %v", submissionID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update submission")
		return
	}

	respondWithJSON(w, http.StatusOK, updated)
}

// ----------------------------
// Delete
// ----------------------------
func (h *EssaySubmissionHandlers) DeleteEssaySubmissionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	submissionID, ok := vars["submissionId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Submission ID is missing")
		return
	}

	err := h.Service.DeleteEssaySubmissionWithDependencies(submissionID)
	if err != nil {
		if strings.Contains(err.Error(), "essay submission not found") {
			respondWithError(w, http.StatusNotFound, "Essay submission not found")
			return
		}
		log.Printf("ERROR: Failed to delete submission %s: %v", submissionID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to delete submission")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
