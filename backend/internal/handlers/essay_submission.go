package handlers

import (
	"api-backend/internal/models"
	"api-backend/internal/services"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
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
