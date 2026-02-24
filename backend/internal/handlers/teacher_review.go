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

// TeacherReviewHandlers holds dependencies for teacher review-related handlers.
type TeacherReviewHandlers struct {
	Service *services.TeacherReviewService
}

// NewTeacherReviewHandlers creates a new instance of TeacherReviewHandlers.
func NewTeacherReviewHandlers(s *services.TeacherReviewService) *TeacherReviewHandlers {
	return &TeacherReviewHandlers{Service: s}
}

// CreateTeacherReviewHandler handles the creation of a new teacher review.
func (h *TeacherReviewHandlers) CreateTeacherReviewHandler(w http.ResponseWriter, r *http.Request) {
	var req models.CreateTeacherReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || teacherID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	newReview, err := h.Service.CreateTeacherReview(&req, teacherID)
	if err != nil {
		log.Printf("ERROR: Failed to create teacher review: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create teacher review")
		return
	}

	respondWithJSON(w, http.StatusCreated, newReview)
}

// UpdateTeacherReviewHandler handles updating an existing teacher review.
func (h *TeacherReviewHandlers) UpdateTeacherReviewHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	reviewID, ok := vars["reviewId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Review ID is missing from URL")
		return
	}

	var req models.UpdateTeacherReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	updatedReview, err := h.Service.UpdateTeacherReview(reviewID, &req)
	if err != nil {
		log.Printf("ERROR: Failed to update teacher review %s: %v", reviewID, err)
		if err.Error() == "teacher review not found" {
			respondWithError(w, http.StatusNotFound, "Teacher review not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to update teacher review")
		return
	}

	respondWithJSON(w, http.StatusOK, updatedReview)
}

// GetTeacherReviewBySubmissionIDHandler handles fetching a teacher review by its submission ID.
func (h *TeacherReviewHandlers) GetTeacherReviewBySubmissionIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	submissionID, ok := vars["submissionId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Submission ID is missing from URL")
		return
	}

	review, err := h.Service.GetTeacherReviewBySubmissionID(submissionID)
	if err != nil {
		log.Printf("ERROR: Failed to get teacher review for submission %s: %v", submissionID, err)
		if err.Error() == fmt.Sprintf("teacher review not found for submission %s", submissionID) {
			respondWithError(w, http.StatusNotFound, "Teacher review not found for this submission")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve teacher review")
		return
	}

	respondWithJSON(w, http.StatusOK, review)
}