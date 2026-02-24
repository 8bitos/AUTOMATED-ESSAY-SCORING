package handlers

import (
	"api-backend/internal/models"
	"api-backend/internal/services"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"github.com/gorilla/mux"
)

// AIResultHandlers holds dependencies for AI result-related handlers.
type AIResultHandlers struct {
	Service *services.AIResultService
}

// NewAIResultHandlers creates a new instance of AIResultHandlers.
func NewAIResultHandlers(s *services.AIResultService) *AIResultHandlers {
	return &AIResultHandlers{Service: s}
}

// CreateAIResultHandler handles the creation of a new AI result.
func (h *AIResultHandlers) CreateAIResultHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("DEBUG: Entered CreateAIResultHandler")

	var req models.CreateAIResultRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.SubmissionID == "" || req.SkorAI == 0 { // SkorAI cannot be 0 for creation
		respondWithError(w, http.StatusBadRequest, "Submission ID and Skor AI cannot be empty")
		return
	}

	newResult, err := h.Service.CreateAIResult(req.SubmissionID, req.SkorAI, req.UmpanBalikAI, req.LogsRAG)
	if err != nil {
		log.Printf("ERROR: Failed to create AI result in service: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create AI result")
		return
	}

	log.Println("DEBUG: Successfully created AI result, responding with JSON.")
	respondWithJSON(w, http.StatusCreated, newResult)
}

// GetAIResultByIDHandler handles fetching a single AI result by its ID.
func (h *AIResultHandlers) GetAIResultByIDHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("DEBUG: Entered GetAIResultByIDHandler")

	vars := mux.Vars(r)
	resultID, ok := vars["resultId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "AI Result ID is missing from URL")
		return
	}

	result, err := h.Service.GetAIResultByID(resultID)
	if err != nil {
		log.Printf("ERROR: Failed to get AI result %s: %v", resultID, err)
		if err.Error() == "AI result not found" {
			respondWithError(w, http.StatusNotFound, "AI result not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve AI result")
		return
	}

	log.Printf("DEBUG: Successfully fetched AI result %s.", resultID)
	respondWithJSON(w, http.StatusOK, result)
}

// GetAIResultBySubmissionIDHandler handles fetching the AI result for a specific submission.
func (h *AIResultHandlers) GetAIResultBySubmissionIDHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("DEBUG: Entered GetAIResultBySubmissionIDHandler")

	vars := mux.Vars(r)
	submissionID, ok := vars["submissionId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Submission ID is missing from URL")
		return
	}

	result, err := h.Service.GetAIResultBySubmissionID(submissionID)
	if err != nil {
		log.Printf("ERROR: Failed to get AI result for submission %s: %v", submissionID, err)
		if err.Error() == fmt.Sprintf("AI result for submission %s not found", submissionID) {
			respondWithError(w, http.StatusNotFound, "AI result for submission not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve AI result for submission")
		return
	}

	log.Printf("DEBUG: Successfully fetched AI result for submission %s.", submissionID)
	respondWithJSON(w, http.StatusOK, result)
}

// UpdateAIResultHandler handles updating an existing AI result.
func (h *AIResultHandlers) UpdateAIResultHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("DEBUG: Entered UpdateAIResultHandler")

	vars := mux.Vars(r)
	resultID, ok := vars["resultId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "AI Result ID is missing from URL")
		return
	}

	var req models.UpdateAIResultRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	updatedResult, err := h.Service.UpdateAIResult(resultID, &req)
	if err != nil {
		log.Printf("ERROR: Failed to update AI result %s: %v", resultID, err)
		if err.Error() == "AI result not found for update" {
			respondWithError(w, http.StatusNotFound, "AI result not found")
			return
		} else if err.Error() == "no fields to update" {
			respondWithError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to update AI result")
		return
	}

	log.Printf("DEBUG: Successfully updated AI result %s.", resultID)
	respondWithJSON(w, http.StatusOK, updatedResult)
}

// DeleteAIResultHandler handles deleting an AI result by its ID.
func (h *AIResultHandlers) DeleteAIResultHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("DEBUG: Entered DeleteAIResultHandler")

	vars := mux.Vars(r)
	resultID, ok := vars["resultId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "AI Result ID is missing from URL")
		return
	}

	err := h.Service.DeleteAIResult(resultID)
	if err != nil {
		log.Printf("ERROR: Failed to delete AI result %s: %v", resultID, err)
		if err.Error() == "AI result not found with ID " + resultID {
			respondWithError(w, http.StatusNotFound, "AI result not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to delete AI result")
		return
	}

	log.Printf("DEBUG: Successfully deleted AI result %s.", resultID)
	w.WriteHeader(http.StatusNoContent) // 204 No Content for successful deletion
}
