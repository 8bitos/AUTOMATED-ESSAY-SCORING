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

func normalizeAIStatus(raw string) (string, error) {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	if trimmed == "" {
		return "", nil
	}
	switch trimmed {
	case "queued", "processing", "completed", "failed":
		return trimmed, nil
	default:
		return "", fmt.Errorf("invalid aiStatus")
	}
}

func normalizeReviewStatus(raw string) (string, error) {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	if trimmed == "" {
		return "", nil
	}
	switch trimmed {
	case "reviewed", "pending":
		return trimmed, nil
	default:
		return "", fmt.Errorf("invalid reviewStatus")
	}
}

func stringOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func filterQuestionIDsBySection(sectionIndex map[string]services.SectionCardInfo, sectionCardID string) []string {
	sectionCardID = strings.TrimSpace(sectionCardID)
	if sectionCardID == "" || len(sectionIndex) == 0 {
		return nil
	}
	out := make([]string, 0)
	for qid, info := range sectionIndex {
		if strings.TrimSpace(info.ID) == sectionCardID {
			out = append(out, qid)
		}
	}
	return out
}

func buildRubricWorkbook(items []models.RubricTemplateRow, scoreMap map[string]map[string]map[string]int) *excelize.File {
	file := excelize.NewFile()
	type studentInfo struct {
		ID   string
		Name string
	}
	type aspectInfo struct {
		Name     string
		MaxScore int
	}

	studentOrder := make([]studentInfo, 0)
	studentSeen := map[string]bool{}
	questionOrder := make([]string, 0)
	questionSeen := map[string]bool{}
	questionText := map[string]string{}
	questionAspects := map[string][]aspectInfo{}
	questionAspectSeen := map[string]map[string]bool{}
	questionMaxSum := map[string]int{}
	questionWeight := map[string]float64{}

	for _, item := range items {
		if !studentSeen[item.StudentID] {
			studentSeen[item.StudentID] = true
			studentOrder = append(studentOrder, studentInfo{ID: item.StudentID, Name: item.StudentName})
		}
		if !questionSeen[item.QuestionID] {
			questionSeen[item.QuestionID] = true
			questionOrder = append(questionOrder, item.QuestionID)
			questionText[item.QuestionID] = item.QuestionText
			questionAspectSeen[item.QuestionID] = map[string]bool{}
			if item.QuestionWeight != nil {
				questionWeight[item.QuestionID] = *item.QuestionWeight
			}
		}
		if _, ok := questionAspectSeen[item.QuestionID]; !ok {
			questionAspectSeen[item.QuestionID] = map[string]bool{}
		}
		if !questionAspectSeen[item.QuestionID][item.AspectName] {
			questionAspectSeen[item.QuestionID][item.AspectName] = true
			questionAspects[item.QuestionID] = append(questionAspects[item.QuestionID], aspectInfo{
				Name:     item.AspectName,
				MaxScore: item.AspectMaxScore,
			})
			if item.AspectMaxScore > 0 {
				questionMaxSum[item.QuestionID] += item.AspectMaxScore
			}
		}
	}

	studentAnswerMap := map[string]map[string]string{}
	for _, item := range items {
		if _, ok := studentAnswerMap[item.StudentID]; !ok {
			studentAnswerMap[item.StudentID] = map[string]string{}
		}
		if _, exists := studentAnswerMap[item.StudentID][item.QuestionID]; !exists {
			studentAnswerMap[item.StudentID][item.QuestionID] = item.StudentAnswer
		}
	}

	if len(questionOrder) == 0 {
		sheet := file.GetSheetName(0)
		headers := []string{"Nama", "Jawaban", "Nilai final"}
		for idx, header := range headers {
			cell, _ := excelize.CoordinatesToCellName(idx+1, 1)
			_ = file.SetCellValue(sheet, cell, header)
		}
		_ = file.SetColWidth(sheet, "A", "A", 20)
		_ = file.SetColWidth(sheet, "B", "B", 50)
		_ = file.SetColWidth(sheet, "C", "C", 15)
		styleID, _ := file.NewStyle(&excelize.Style{
			Alignment: &excelize.Alignment{WrapText: true, Vertical: "top"},
		})
		endCell, _ := excelize.CoordinatesToCellName(len(headers), 1)
		_ = file.SetCellStyle(sheet, "A1", endCell, styleID)
		return file
	}

	defaultSheet := file.GetSheetName(0)
	for qIdx, qid := range questionOrder {
		sheetName := fmt.Sprintf("Soal %d", qIdx+1)
		if qIdx == 0 {
			_ = file.SetSheetName(defaultSheet, sheetName)
		} else {
			_, _ = file.NewSheet(sheetName)
		}

		aspects := questionAspects[qid]
		maxSum := questionMaxSum[qid]
		weight := questionWeight[qid]
		if weight <= 0 {
			weight = 1
		}
		headers := []string{"Nama", "Jawaban"}
		for _, aspect := range aspects {
			headers = append(headers, fmt.Sprintf("Skor %s", aspect.Name))
		}
		headers = append(headers, "Nilai final")

		_ = file.SetCellValue(sheetName, "A1", "Bobot Soal")
		_ = file.SetCellValue(sheetName, "B1", weight)
		_ = file.SetCellValue(sheetName, "C1", "Max Total Skor Rubrik")
		_ = file.SetCellValue(sheetName, "D1", maxSum)
		_ = file.SetCellValue(sheetName, "E1", "Soal")
		_ = file.SetCellValue(sheetName, "F1", questionText[qid])

		blueStyle, _ := file.NewStyle(&excelize.Style{
			Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
			Fill:      excelize.Fill{Type: "pattern", Color: []string{"#6B7FA1"}, Pattern: 1},
			Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		})
		greenStyle, _ := file.NewStyle(&excelize.Style{
			Font:      &excelize.Font{Bold: true},
			Fill:      excelize.Fill{Type: "pattern", Color: []string{"#B7D7A8"}, Pattern: 1},
			Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		})
		yellowStyle, _ := file.NewStyle(&excelize.Style{
			Font:      &excelize.Font{Bold: true},
			Fill:      excelize.Fill{Type: "pattern", Color: []string{"#FFF2CC"}, Pattern: 1},
			Alignment: &excelize.Alignment{Horizontal: "left", Vertical: "center"},
		})
		soalWrapStyle, _ := file.NewStyle(&excelize.Style{
			Font:      &excelize.Font{Bold: true},
			Fill:      excelize.Fill{Type: "pattern", Color: []string{"#FFF2CC"}, Pattern: 1},
			Alignment: &excelize.Alignment{Horizontal: "left", Vertical: "center", WrapText: true},
		})
		_ = file.SetCellStyle(sheetName, "A1", "B1", blueStyle)
		_ = file.SetCellStyle(sheetName, "C1", "D1", greenStyle)
		_ = file.SetCellStyle(sheetName, "E1", "E1", yellowStyle)
		_ = file.SetCellStyle(sheetName, "F1", "F1", soalWrapStyle)

		for idx, header := range headers {
			cell, _ := excelize.CoordinatesToCellName(idx+1, 2)
			_ = file.SetCellValue(sheetName, cell, header)
		}

		_ = file.SetColWidth(sheetName, "A", "A", 20)
		_ = file.SetColWidth(sheetName, "B", "B", 50)
		if len(aspects) > 0 {
			startAspectCol, _ := excelize.ColumnNumberToName(3)
			endAspectCol, _ := excelize.ColumnNumberToName(2 + len(aspects))
			_ = file.SetColWidth(sheetName, startAspectCol, endAspectCol, 30)
		}
		endAspectIdx := 2 + len(aspects)
		if endAspectIdx < 5 {
			_ = file.SetColWidth(sheetName, "E", "E", 12)
		}
		if endAspectIdx < 6 {
			_ = file.SetColWidth(sheetName, "F", "F", 80)
		}
		lastCol, _ := excelize.ColumnNumberToName(len(headers))
		_ = file.SetColWidth(sheetName, lastCol, lastCol, 15)

		for rowIdx, student := range studentOrder {
			row := rowIdx + 3
			studentAnswer := ""
			if byStudent, ok := studentAnswerMap[student.ID]; ok {
				if answer, ok := byStudent[qid]; ok {
					studentAnswer = answer
				}
			}
			values := []interface{}{student.Name, studentAnswer}
			for _, aspect := range aspects {
				var scoreValue interface{} = ""
				if scoreMap != nil {
					if byStudent, ok := scoreMap[student.ID]; ok {
						if byQuestion, ok := byStudent[qid]; ok {
							if score, ok := byQuestion[aspect.Name]; ok {
								scoreValue = score
							}
						}
					}
				}
				values = append(values, scoreValue)
			}
			values = append(values, "")
			for colIdx, value := range values {
				cell, _ := excelize.CoordinatesToCellName(colIdx+1, row)
				_ = file.SetCellValue(sheetName, cell, value)
			}

			if len(aspects) > 0 && maxSum > 0 {
				startCol, _ := excelize.ColumnNumberToName(3)
				endCol, _ := excelize.ColumnNumberToName(2 + len(aspects))
				finalCol, _ := excelize.ColumnNumberToName(3 + len(aspects))
				formula := fmt.Sprintf("=IF(OR($D$1<=0,COUNT(%s%d:%s%d)=0),\"\",ROUND((SUM(%s%d:%s%d)/$D$1)*100,0))",
					startCol, row, endCol, row,
					startCol, row, endCol, row,
				)
				_ = file.SetCellFormula(sheetName, fmt.Sprintf("%s%d", finalCol, row), formula)
			}
		}

		if len(aspects) > 0 && len(studentOrder) > 0 {
			startRow := 3
			endRow := len(studentOrder) + 2
			for idx, aspect := range aspects {
				if aspect.MaxScore <= 0 {
					continue
				}
				colName, _ := excelize.ColumnNumberToName(3 + idx)
				sqref := fmt.Sprintf("%s%d:%s%d", colName, startRow, colName, endRow)
				dv := excelize.NewDataValidation(true)
				dv.Sqref = sqref
				dv.Type = "whole"
				dv.Operator = "between"
				dv.Formula1 = "0"
				dv.Formula2 = strconv.Itoa(aspect.MaxScore)
				errorStyle := "stop"
				errorTitle := "Nilai Tidak Valid"
				errorMsg := fmt.Sprintf("Skor maksimal untuk aspek ini adalah %d. Masukkan nilai 0–%d.", aspect.MaxScore, aspect.MaxScore)
				dv.ErrorStyle = &errorStyle
				dv.ErrorTitle = &errorTitle
				dv.Error = &errorMsg
				dv.ShowErrorMessage = true
				dv.AllowBlank = true
				_ = file.AddDataValidation(sheetName, dv)
			}
		}

		styleID, _ := file.NewStyle(&excelize.Style{
			Alignment: &excelize.Alignment{WrapText: true, Vertical: "top"},
		})
		endCell, _ := excelize.CoordinatesToCellName(len(headers), len(studentOrder)+2)
		// Apply wrap style to data/header row (row 2+) so colored header row stays intact.
		_ = file.SetCellStyle(sheetName, "A2", endCell, styleID)
	}

	summarySheet := "Rekap Nilai"
	_, _ = file.NewSheet(summarySheet)
	summaryHeaders := []string{"Nama"}
	for idx := range questionOrder {
		summaryHeaders = append(summaryHeaders, fmt.Sprintf("Nilai Soal %d", idx+1))
	}
	summaryHeaders = append(summaryHeaders, "Nilai Akhir")

	_ = file.SetCellValue(summarySheet, "A1", "Bobot Soal")
	for qIdx := range questionOrder {
		col, _ := excelize.ColumnNumberToName(qIdx + 2)
		_ = file.SetCellFormula(summarySheet, fmt.Sprintf("%s1", col), fmt.Sprintf("='Soal %d'!$B$1", qIdx+1))
	}

	for idx, header := range summaryHeaders {
		cell, _ := excelize.CoordinatesToCellName(idx+1, 2)
		_ = file.SetCellValue(summarySheet, cell, header)
	}

	_ = file.SetColWidth(summarySheet, "A", "A", 20)
	if len(questionOrder) > 0 {
		startQCol, _ := excelize.ColumnNumberToName(2)
		endQCol, _ := excelize.ColumnNumberToName(1 + len(questionOrder))
		_ = file.SetColWidth(summarySheet, startQCol, endQCol, 18)
	}
	lastSumCol, _ := excelize.ColumnNumberToName(len(summaryHeaders))
	_ = file.SetColWidth(summarySheet, lastSumCol, lastSumCol, 18)

	for rowIdx, student := range studentOrder {
		row := rowIdx + 3
		_ = file.SetCellValue(summarySheet, fmt.Sprintf("A%d", row), student.Name)
		for qIdx := range questionOrder {
			finalCol, _ := excelize.ColumnNumberToName(3 + len(questionAspects[questionOrder[qIdx]]))
			scoreCell := fmt.Sprintf("'Soal %d'!%s%d", qIdx+1, finalCol, row)
			col, _ := excelize.ColumnNumberToName(qIdx + 2)
			_ = file.SetCellFormula(summarySheet, fmt.Sprintf("%s%d", col, row), fmt.Sprintf("=IF(%s=\"\",\"\",ROUND(%s,0))", scoreCell, scoreCell))
		}

		if len(questionOrder) > 0 {
			startCol, _ := excelize.ColumnNumberToName(2)
			endCol, _ := excelize.ColumnNumberToName(1 + len(questionOrder))
			totalQuestions := len(questionOrder)
			formula := fmt.Sprintf("=IFERROR(IF(OR(COUNT(%s%d:%s%d)=0,SUM(%s1:%s1)=0),\"\",ROUND((SUMPRODUCT(%s%d:%s%d,%s1:%s1)/SUM(%s1:%s1))*(COUNT(%s%d:%s%d)/%d),0)),\"\")",
				startCol, row, endCol, row,
				startCol, endCol,
				startCol, row, endCol, row,
				startCol, endCol,
				startCol, endCol,
				startCol, row, endCol, row,
				totalQuestions,
			)
			_ = file.SetCellFormula(summarySheet, fmt.Sprintf("%s%d", lastSumCol, row), formula)
		}
	}

	styleID, _ := file.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{WrapText: true, Vertical: "top"},
	})
	endCell, _ := excelize.CoordinatesToCellName(len(summaryHeaders), len(studentOrder)+2)
	_ = file.SetCellStyle(summarySheet, "A1", endCell, styleID)
	return file
}

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

func parseDateRange(rawFrom, rawTo string) (*time.Time, *time.Time, error) {
	from, err := parseSubmissionReportDate(rawFrom, false)
	if err != nil {
		return nil, nil, err
	}
	to, err := parseSubmissionReportDate(rawTo, true)
	if err != nil {
		return nil, nil, err
	}
	return from, to, nil
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
		if errors.Is(err, services.ErrSectionCardUnread) {
			respondWithError(w, http.StatusForbidden, "Selesaikan membaca materi terlebih dahulu sebelum menjawab soal.")
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
	studentID := strings.TrimSpace(r.URL.Query().Get("studentId"))
	sectionCardID := strings.TrimSpace(r.URL.Query().Get("sectionCardId"))
	sortBy := strings.TrimSpace(r.URL.Query().Get("sort"))
	aiStatus, err := normalizeAIStatus(r.URL.Query().Get("aiStatus"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid aiStatus")
		return
	}
	reviewStatus, err := normalizeReviewStatus(r.URL.Query().Get("reviewStatus"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid reviewStatus")
		return
	}
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

	var questionIDs []string
	if sectionCardID != "" {
		sectionIndex, err := h.Service.BuildSectionCardIndexForClass(classID, teacherID, materialID)
		if err != nil {
			log.Printf("ERROR: Failed to build section card index for class %s: %v", classID, err)
			respondWithError(w, http.StatusInternalServerError, "Failed to resolve section card filter")
			return
		}
		questionIDs = filterQuestionIDsBySection(sectionIndex, sectionCardID)
		if len(questionIDs) == 0 {
			respondWithJSON(w, http.StatusOK, models.ClassStudentSubmissionSummaryListResponse{
				Items:            []models.ClassStudentSubmissionSummary{},
				Total:            0,
				Page:             page,
				Size:             size,
				TotalSubmissions: 0,
			})
			return
		}
	}

	result, err := h.Service.ListClassStudentSubmissionSummaries(classID, teacherID, materialID, questionIDs, studentID, aiStatus, reviewStatus, dateFrom, dateTo, q, sortBy, page, size)
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
	studentID := strings.TrimSpace(r.URL.Query().Get("studentId"))
	sectionCardID := strings.TrimSpace(r.URL.Query().Get("sectionCardId"))
	aiStatus, err := normalizeAIStatus(r.URL.Query().Get("aiStatus"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid aiStatus")
		return
	}
	reviewStatus, err := normalizeReviewStatus(r.URL.Query().Get("reviewStatus"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid reviewStatus")
		return
	}
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

	var questionIDs []string
	if sectionCardID != "" {
		sectionIndex, err := h.Service.BuildSectionCardIndexForClass(classID, teacherID, materialID)
		if err != nil {
			log.Printf("ERROR: Failed to build section card index for class %s: %v", classID, err)
			respondWithError(w, http.StatusInternalServerError, "Failed to resolve section card filter")
			return
		}
		questionIDs = filterQuestionIDsBySection(sectionIndex, sectionCardID)
		if len(questionIDs) == 0 {
			respondWithJSON(w, http.StatusOK, models.ClassScoreDistributionResponse{
				Buckets: []models.ClassScoreDistributionBucket{
					{Label: "< 60", Min: 0, Max: 59, Count: 0},
					{Label: "60-69", Min: 60, Max: 69, Count: 0},
					{Label: "70-79", Min: 70, Max: 79, Count: 0},
					{Label: "80-89", Min: 80, Max: 89, Count: 0},
					{Label: ">= 90", Min: 90, Max: 100, Count: 0},
				},
				Total:            0,
				Reviewed:         0,
				Pending:          0,
				TotalSubmissions: 0,
			})
			return
		}
	}

	result, err := h.Service.GetClassScoreDistribution(classID, teacherID, materialID, questionIDs, studentID, aiStatus, reviewStatus, dateFrom, dateTo)
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
	studentID := strings.TrimSpace(r.URL.Query().Get("studentId"))
	sectionCardID := strings.TrimSpace(r.URL.Query().Get("sectionCardId"))
	sortBy := strings.TrimSpace(r.URL.Query().Get("sort"))
	format := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("format")))
	aiStatus, err := normalizeAIStatus(r.URL.Query().Get("aiStatus"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid aiStatus")
		return
	}
	reviewStatus, err := normalizeReviewStatus(r.URL.Query().Get("reviewStatus"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid reviewStatus")
		return
	}
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

	var (
		items       []models.ClassStudentSubmissionSummary
		questionIDs []string
	)
	if sectionCardID != "" {
		sectionIndex, err := h.Service.BuildSectionCardIndexForClass(classID, teacherID, materialID)
		if err != nil {
			log.Printf("ERROR: Failed to build section card index for class %s: %v", classID, err)
			respondWithError(w, http.StatusInternalServerError, "Failed to resolve section card filter")
			return
		}
		questionIDs = filterQuestionIDsBySection(sectionIndex, sectionCardID)
		if len(questionIDs) == 0 {
			items = []models.ClassStudentSubmissionSummary{}
		}
	}

	if items == nil {
		items, err = h.Service.ListClassStudentSubmissionSummariesAll(classID, teacherID, materialID, questionIDs, studentID, aiStatus, reviewStatus, dateFrom, dateTo, q, sortBy)
		if err != nil {
			log.Printf("ERROR: Failed to export student submission summaries for class %s: %v", classID, err)
			respondWithError(w, http.StatusInternalServerError, "Failed to export student submission summaries")
			return
		}
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

// ExportClassQWKHandler exports per-submission AI vs teacher scores for QWK analysis.
func (h *EssaySubmissionHandlers) ExportClassQWKHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok || strings.TrimSpace(classID) == "" {
		respondWithError(w, http.StatusBadRequest, "Class ID is required")
		return
	}

	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || teacherID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	query := r.URL.Query()
	materialID := strings.TrimSpace(query.Get("materialId"))
	studentID := strings.TrimSpace(query.Get("studentId"))
	sectionCardID := strings.TrimSpace(query.Get("sectionCardId"))
	format := strings.ToLower(strings.TrimSpace(query.Get("format")))
	includeRubricScores := strings.TrimSpace(query.Get("includeRubricScores")) == "1"
	aiStatus, err := normalizeAIStatus(query.Get("aiStatus"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid aiStatus")
		return
	}
	reviewStatus, err := normalizeReviewStatus(query.Get("reviewStatus"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid reviewStatus")
		return
	}
	dateFrom, dateTo, err := parseDateRange(query.Get("dateFrom"), query.Get("dateTo"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid date range")
		return
	}
	q := strings.TrimSpace(query.Get("q"))

	sectionIndex, err := h.Service.BuildSectionCardIndexForClass(classID, teacherID, materialID)
	if err != nil {
		log.Printf("ERROR: Failed to build section card index for class %s: %v", classID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to resolve section card data")
		return
	}

	var questionIDs []string
	if sectionCardID != "" {
		questionIDs = filterQuestionIDsBySection(sectionIndex, sectionCardID)
	}

	var items []models.QWKExportRow
	if sectionCardID == "" || len(questionIDs) > 0 {
		items, err = h.Service.ListClassQWKExportRows(classID, teacherID, materialID, questionIDs, studentID, aiStatus, reviewStatus, dateFrom, dateTo, q, sectionIndex, includeRubricScores)
		if err != nil {
			log.Printf("ERROR: Failed to export QWK rows for class %s: %v", classID, err)
			respondWithError(w, http.StatusInternalServerError, "Failed to export QWK data")
			return
		}
	}

	headers := []string{
		"class_id",
		"class_name",
		"material_id",
		"material_title",
		"section_card_id",
		"section_title",
		"question_id",
		"question_text",
		"student_id",
		"student_name",
		"student_email",
		"submission_id",
		"submitted_at",
		"ai_status",
		"ai_score",
		"revised_score",
	}
	if includeRubricScores {
		headers = append(headers, "rubric_scores")
	}

	if format == "xlsx" {
		file := excelize.NewFile()
		sheet := file.GetSheetName(0)
		for idx, header := range headers {
			cell, _ := excelize.CoordinatesToCellName(idx+1, 1)
			_ = file.SetCellValue(sheet, cell, header)
		}
		for rowIdx, item := range items {
			row := rowIdx + 2
			aiScore := ""
			if item.AIScore != nil {
				aiScore = fmt.Sprintf("%.2f", *item.AIScore)
			}
			revisedScore := ""
			if item.RevisedScore != nil {
				revisedScore = fmt.Sprintf("%.2f", *item.RevisedScore)
			}
			values := []interface{}{
				item.ClassID,
				item.ClassName,
				item.MaterialID,
				item.MaterialTitle,
				item.SectionCardID,
				item.SectionTitle,
				item.QuestionID,
				item.QuestionText,
				item.StudentID,
				item.StudentName,
				item.StudentEmail,
				item.SubmissionID,
				item.SubmittedAt.Format("2006-01-02 15:04:05"),
				item.AIStatus,
				aiScore,
				revisedScore,
			}
			if includeRubricScores {
				values = append(values, stringOrEmpty(item.RubricScores))
			}
			for colIdx, value := range values {
				cell, _ := excelize.CoordinatesToCellName(colIdx+1, row)
				_ = file.SetCellValue(sheet, cell, value)
			}
		}
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"qwk-export-%s.xlsx\"", classID))
		_ = file.Write(w)
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"qwk-export-%s.csv\"", classID))
	writer := csv.NewWriter(w)
	_ = writer.Write(headers)
	for _, item := range items {
		aiScore := ""
		if item.AIScore != nil {
			aiScore = fmt.Sprintf("%.2f", *item.AIScore)
		}
		revisedScore := ""
		if item.RevisedScore != nil {
			revisedScore = fmt.Sprintf("%.2f", *item.RevisedScore)
		}
		row := []string{
			item.ClassID,
			item.ClassName,
			item.MaterialID,
			item.MaterialTitle,
			item.SectionCardID,
			item.SectionTitle,
			item.QuestionID,
			item.QuestionText,
			item.StudentID,
			item.StudentName,
			item.StudentEmail,
			item.SubmissionID,
			item.SubmittedAt.Format("2006-01-02 15:04:05"),
			item.AIStatus,
			aiScore,
			revisedScore,
		}
		if includeRubricScores {
			row = append(row, stringOrEmpty(item.RubricScores))
		}
		_ = writer.Write(row)
	}
	writer.Flush()
}

// ExportClassQuestionSummaryHandler exports per-question summary rows for analysis.
func (h *EssaySubmissionHandlers) ExportClassQuestionSummaryHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok || strings.TrimSpace(classID) == "" {
		respondWithError(w, http.StatusBadRequest, "Class ID is required")
		return
	}

	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || teacherID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	query := r.URL.Query()
	materialID := strings.TrimSpace(query.Get("materialId"))
	studentID := strings.TrimSpace(query.Get("studentId"))
	sectionCardID := strings.TrimSpace(query.Get("sectionCardId"))
	format := strings.ToLower(strings.TrimSpace(query.Get("format")))
	aiStatus, err := normalizeAIStatus(query.Get("aiStatus"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid aiStatus")
		return
	}
	reviewStatus, err := normalizeReviewStatus(query.Get("reviewStatus"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid reviewStatus")
		return
	}
	dateFrom, dateTo, err := parseDateRange(query.Get("dateFrom"), query.Get("dateTo"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid date range")
		return
	}

	sectionIndex, err := h.Service.BuildSectionCardIndexForClass(classID, teacherID, materialID)
	if err != nil {
		log.Printf("ERROR: Failed to build section card index for class %s: %v", classID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to resolve section card data")
		return
	}

	var questionIDs []string
	if sectionCardID != "" {
		questionIDs = filterQuestionIDsBySection(sectionIndex, sectionCardID)
	}

	var items []models.QuestionExportRow
	if sectionCardID == "" || len(questionIDs) > 0 {
		items, err = h.Service.ListClassQuestionExportRows(classID, teacherID, materialID, questionIDs, studentID, aiStatus, reviewStatus, dateFrom, dateTo)
		if err != nil {
			log.Printf("ERROR: Failed to export question rows for class %s: %v", classID, err)
			respondWithError(w, http.StatusInternalServerError, "Failed to export question data")
			return
		}
	}
	for idx := range items {
		if info, ok := sectionIndex[items[idx].QuestionID]; ok {
			items[idx].SectionCardID = info.ID
			items[idx].SectionTitle = info.Title
		}
	}

	headers := []string{
		"class_id",
		"class_name",
		"material_id",
		"material_title",
		"section_card_id",
		"section_title",
		"question_id",
		"question_text",
		"total_submissions",
		"reviewed_submissions",
		"avg_ai_score",
		"avg_revised_score",
		"avg_final_score",
	}

	if format == "xlsx" {
		file := excelize.NewFile()
		sheet := file.GetSheetName(0)
		for idx, header := range headers {
			cell, _ := excelize.CoordinatesToCellName(idx+1, 1)
			_ = file.SetCellValue(sheet, cell, header)
		}
		for rowIdx, item := range items {
			row := rowIdx + 2
			avgAI := ""
			if item.AvgAIScore != nil {
				avgAI = fmt.Sprintf("%.2f", *item.AvgAIScore)
			}
			avgRevised := ""
			if item.AvgRevisedScore != nil {
				avgRevised = fmt.Sprintf("%.2f", *item.AvgRevisedScore)
			}
			avgFinal := ""
			if item.AvgFinalScore != nil {
				avgFinal = fmt.Sprintf("%.2f", *item.AvgFinalScore)
			}
			values := []interface{}{
				item.ClassID,
				item.ClassName,
				item.MaterialID,
				item.MaterialTitle,
				item.SectionCardID,
				item.SectionTitle,
				item.QuestionID,
				item.QuestionText,
				item.TotalSubmissions,
				item.ReviewedSubmissions,
				avgAI,
				avgRevised,
				avgFinal,
			}
			for colIdx, value := range values {
				cell, _ := excelize.CoordinatesToCellName(colIdx+1, row)
				_ = file.SetCellValue(sheet, cell, value)
			}
		}
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"question-export-%s.xlsx\"", classID))
		_ = file.Write(w)
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"question-export-%s.csv\"", classID))
	writer := csv.NewWriter(w)
	_ = writer.Write(headers)
	for _, item := range items {
		avgAI := ""
		if item.AvgAIScore != nil {
			avgAI = fmt.Sprintf("%.2f", *item.AvgAIScore)
		}
		avgRevised := ""
		if item.AvgRevisedScore != nil {
			avgRevised = fmt.Sprintf("%.2f", *item.AvgRevisedScore)
		}
		avgFinal := ""
		if item.AvgFinalScore != nil {
			avgFinal = fmt.Sprintf("%.2f", *item.AvgFinalScore)
		}
		_ = writer.Write([]string{
			item.ClassID,
			item.ClassName,
			item.MaterialID,
			item.MaterialTitle,
			item.SectionCardID,
			item.SectionTitle,
			item.QuestionID,
			item.QuestionText,
			strconv.Itoa(item.TotalSubmissions),
			strconv.Itoa(item.ReviewedSubmissions),
			avgAI,
			avgRevised,
			avgFinal,
		})
	}
	writer.Flush()
}

// ExportClassRubricTemplateHandler exports a blank rubric scoring template for teachers.
func (h *EssaySubmissionHandlers) ExportClassRubricTemplateHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok || strings.TrimSpace(classID) == "" {
		respondWithError(w, http.StatusBadRequest, "Class ID is required")
		return
	}

	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || teacherID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	query := r.URL.Query()
	materialID := strings.TrimSpace(query.Get("materialId"))
	studentID := strings.TrimSpace(query.Get("studentId"))
	sectionCardID := strings.TrimSpace(query.Get("sectionCardId"))
	format := strings.ToLower(strings.TrimSpace(query.Get("format")))

	var questionIDs []string
	if sectionCardID != "" {
		sectionIndex, err := h.Service.BuildSectionCardIndexForClass(classID, teacherID, materialID)
		if err != nil {
			log.Printf("ERROR: Failed to build section card index for class %s: %v", classID, err)
			respondWithError(w, http.StatusInternalServerError, "Failed to resolve section card filter")
			return
		}
		questionIDs = filterQuestionIDsBySection(sectionIndex, sectionCardID)
	}

	items, err := h.Service.ListClassRubricTemplateRows(classID, teacherID, materialID, questionIDs, studentID)
	if err != nil {
		log.Printf("ERROR: Failed to export rubric template for class %s: %v", classID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to export rubric template")
		return
	}

	headers := []string{
		"nama",
		"soal",
		"aspek",
		"skor_aspek",
		"nilai_final",
	}

	if format == "xlsx" {
		file := buildRubricWorkbook(items, nil)
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"template-penilaian-%s.xlsx\"", classID))
		_ = file.Write(w)
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"template-penilaian-%s.csv\"", classID))
	writer := csv.NewWriter(w)
	_ = writer.Write(headers)
	for _, item := range items {
		_ = writer.Write([]string{
			item.StudentName,
			item.QuestionText,
			item.AspectName,
			"",
			"",
		})
	}
	writer.Flush()
}

// ExportClassRubricScoresHandler exports rubric scores in the same template format.
func (h *EssaySubmissionHandlers) ExportClassRubricScoresHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok || strings.TrimSpace(classID) == "" {
		respondWithError(w, http.StatusBadRequest, "Class ID is required")
		return
	}

	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || teacherID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	query := r.URL.Query()
	materialID := strings.TrimSpace(query.Get("materialId"))
	studentID := strings.TrimSpace(query.Get("studentId"))
	sectionCardID := strings.TrimSpace(query.Get("sectionCardId"))
	format := strings.ToLower(strings.TrimSpace(query.Get("format")))

	var questionIDs []string
	if sectionCardID != "" {
		sectionIndex, err := h.Service.BuildSectionCardIndexForClass(classID, teacherID, materialID)
		if err != nil {
			log.Printf("ERROR: Failed to build section card index for class %s: %v", classID, err)
			respondWithError(w, http.StatusInternalServerError, "Failed to resolve section card filter")
			return
		}
		questionIDs = filterQuestionIDsBySection(sectionIndex, sectionCardID)
	}

	items, err := h.Service.ListClassRubricTemplateRows(classID, teacherID, materialID, questionIDs, studentID)
	if err != nil {
		log.Printf("ERROR: Failed to export rubric scores for class %s: %v", classID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to export rubric scores")
		return
	}

	scoreMap, err := h.Service.ListClassRubricScoreMap(classID, teacherID, materialID, questionIDs, studentID)
	if err != nil {
		log.Printf("ERROR: Failed to load rubric scores for class %s: %v", classID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to load rubric scores")
		return
	}

	headers := []string{
		"nama",
		"soal",
		"aspek",
		"skor_aspek",
		"nilai_final",
	}

	if format == "xlsx" {
		file := buildRubricWorkbook(items, scoreMap)
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"penilaian-%s.xlsx\"", classID))
		_ = file.Write(w)
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"penilaian-%s.csv\"", classID))
	writer := csv.NewWriter(w)
	_ = writer.Write(headers)
	for _, item := range items {
		score := ""
		if byStudent, ok := scoreMap[item.StudentID]; ok {
			if byQuestion, ok := byStudent[item.QuestionID]; ok {
				if value, ok := byQuestion[item.AspectName]; ok {
					score = strconv.Itoa(value)
				}
			}
		}
		_ = writer.Write([]string{
			item.StudentName,
			item.QuestionText,
			item.AspectName,
			score,
			"",
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
