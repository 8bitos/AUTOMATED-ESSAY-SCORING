package handlers

import (
	"api-backend/internal/models"
	"api-backend/internal/services"
	"encoding/json"
	"net/http"
)

// GradeEssayHandlers holds dependencies for the essay grading handler.
type GradeEssayHandlers struct {
	AIService *services.AIService
}

// NewGradeEssayHandlers creates a new instance of GradeEssayHandlers.
func NewGradeEssayHandlers(aiService *services.AIService) *GradeEssayHandlers {
	return &GradeEssayHandlers{AIService: aiService}
}

// GradeEssayHandler is now a method that calls the AIService.
func (h *GradeEssayHandlers) GradeEssayHandler(w http.ResponseWriter, r *http.Request) {
	if h.AIService == nil {
		respondWithError(w, http.StatusServiceUnavailable, "AI service is unavailable")
		return
	}
	var req models.GradeEssayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body format")
		return
	}

	if req.Question == "" || len(req.Rubric) == 0 || req.Essay == "" {
		respondWithError(w, http.StatusBadRequest, "All fields (question, rubric, essay) are required")
		return
	}

	// Call the service to perform the grading logic
	response, err := h.AIService.GradeEssay(req)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "An error occurred while grading the essay.")
		return
	}

	// Send the successful response from the service back to the client
	respondWithJSON(w, http.StatusOK, response)
}
