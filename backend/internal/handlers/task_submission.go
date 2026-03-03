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

type TaskSubmissionHandlers struct {
	Service *services.EssaySubmissionService
}

func NewTaskSubmissionHandlers(s *services.EssaySubmissionService) *TaskSubmissionHandlers {
	return &TaskSubmissionHandlers{Service: s}
}

func (h *TaskSubmissionHandlers) CreateTaskSubmissionHandler(w http.ResponseWriter, r *http.Request) {
	var req models.CreateEssaySubmissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if strings.TrimSpace(req.QuestionID) == "" || strings.TrimSpace(req.TeksJawaban) == "" {
		respondWithError(w, http.StatusBadRequest, "Question ID and Teks Jawaban cannot be empty")
		return
	}

	studentID, ok := r.Context().Value("userID").(string)
	if !ok || strings.TrimSpace(studentID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	submission, err := h.Service.CreateTaskSubmission(req.QuestionID, studentID, req.TeksJawaban)
	if err != nil {
		if strings.Contains(err.Error(), "not a task submission") {
			respondWithError(w, http.StatusBadRequest, "Question is not a task submission")
			return
		}
		log.Printf("ERROR: Failed to create task submission: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create task submission")
		return
	}

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"submission":      submission,
		"grading_status":  submission.AIGradingStatus,
		"grading_message": "Tugas berhasil dikirim ke guru untuk direview.",
	})
}

func (h *TaskSubmissionHandlers) GetTaskSubmissionByIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	submissionID, ok := vars["submissionId"]
	if !ok || strings.TrimSpace(submissionID) == "" {
		respondWithError(w, http.StatusBadRequest, "Submission ID is missing")
		return
	}

	submission, err := h.Service.GetTaskSubmissionByID(submissionID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			respondWithError(w, http.StatusNotFound, "Task submission not found")
			return
		}
		log.Printf("ERROR: Failed to get task submission %s: %v", submissionID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve task submission")
		return
	}

	respondWithJSON(w, http.StatusOK, submission)
}

func (h *TaskSubmissionHandlers) UpdateTaskSubmissionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	submissionID, ok := vars["submissionId"]
	if !ok || strings.TrimSpace(submissionID) == "" {
		respondWithError(w, http.StatusBadRequest, "Submission ID is missing")
		return
	}

	var req models.UpdateEssaySubmissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	updated, err := h.Service.UpdateTaskSubmission(submissionID, &req)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			respondWithError(w, http.StatusNotFound, "Task submission not found")
			return
		}
		if strings.Contains(err.Error(), "no fields to update") {
			respondWithError(w, http.StatusBadRequest, err.Error())
			return
		}
		log.Printf("ERROR: Failed to update task submission %s: %v", submissionID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update task submission")
		return
	}

	respondWithJSON(w, http.StatusOK, updated)
}

func (h *TaskSubmissionHandlers) DeleteTaskSubmissionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	submissionID, ok := vars["submissionId"]
	if !ok || strings.TrimSpace(submissionID) == "" {
		respondWithError(w, http.StatusBadRequest, "Submission ID is missing")
		return
	}

	err := h.Service.DeleteTaskSubmissionWithDependencies(submissionID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			respondWithError(w, http.StatusNotFound, "Task submission not found")
			return
		}
		log.Printf("ERROR: Failed to delete task submission %s: %v", submissionID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to delete task submission")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *TaskSubmissionHandlers) GetTaskSubmissionsByStudentIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	studentID, ok := vars["studentId"]
	if !ok || strings.TrimSpace(studentID) == "" {
		respondWithError(w, http.StatusBadRequest, "Student ID is missing")
		return
	}

	submissions, err := h.Service.GetTaskSubmissionsByStudentID(studentID)
	if err != nil {
		log.Printf("ERROR: Failed to get task submissions by student %s: %v", studentID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve task submissions")
		return
	}

	respondWithJSON(w, http.StatusOK, submissions)
}
