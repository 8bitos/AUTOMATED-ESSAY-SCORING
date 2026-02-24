package handlers

import (
	"api-backend/internal/models"
	"api-backend/internal/services"
	"encoding/json"
	"log"
	"net/http"
	"github.com/gorilla/mux"
)

// RubricHandlers holds dependencies for rubric-related handlers.
type RubricHandlers struct {
	Service *services.RubricService
}

// NewRubricHandlers creates a new instance of RubricHandlers.
func NewRubricHandlers(s *services.RubricService) *RubricHandlers {
	return &RubricHandlers{Service: s}
}

// CreateRubricHandler handles the creation of a new rubric.
func (h *RubricHandlers) CreateRubricHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("DEBUG: Entered CreateRubricHandler")

	var req models.CreateRubricRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.QuestionID == "" || req.NamaAspek == "" || req.Bobot == 0 { // Assuming Bobot cannot be 0 for creation
		respondWithError(w, http.StatusBadRequest, "Question ID, Nama Aspek, and Bobot cannot be empty")
		return
	}

	newRubric, err := h.Service.CreateRubric(req.QuestionID, req.NamaAspek, req.Deskripsi, req.Bobot)
	if err != nil {
		log.Printf("ERROR: Failed to create rubric in service: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create rubric")
		return
	}

	log.Println("DEBUG: Successfully created rubric, responding with JSON.")
	respondWithJSON(w, http.StatusCreated, newRubric)
}

// GetRubricByIDHandler handles fetching a single rubric by its ID.
func (h *RubricHandlers) GetRubricByIDHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("DEBUG: Entered GetRubricByIDHandler")

	vars := mux.Vars(r)
	rubricID, ok := vars["rubricId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Rubric ID is missing from URL")
		return
	}

	rubric, err := h.Service.GetRubricByID(rubricID)
	if err != nil {
		log.Printf("ERROR: Failed to get rubric %s: %v", rubricID, err)
		if err.Error() == "rubric not found" {
			respondWithError(w, http.StatusNotFound, "Rubric not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve rubric")
		return
	}

	log.Printf("DEBUG: Successfully fetched rubric %s.", rubricID)
	respondWithJSON(w, http.StatusOK, rubric)
}

// GetRubricsByQuestionIDHandler handles fetching all rubrics for a specific essay question.
func (h *RubricHandlers) GetRubricsByQuestionIDHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("DEBUG: Entered GetRubricsByQuestionIDHandler")

	vars := mux.Vars(r)
	questionID, ok := vars["questionId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Question ID is missing from URL")
		return
	}

	rubrics, err := h.Service.GetRubricsByQuestionID(questionID)
	if err != nil {
		log.Printf("ERROR: Failed to get rubrics for question %s: %v", questionID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve rubrics")
		return
	}

	log.Printf("DEBUG: Successfully fetched %d rubrics for question %s.", len(rubrics), questionID)
	respondWithJSON(w, http.StatusOK, rubrics)
}

// UpdateRubricHandler handles updating an existing rubric.
func (h *RubricHandlers) UpdateRubricHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("DEBUG: Entered UpdateRubricHandler")

	vars := mux.Vars(r)
	rubricID, ok := vars["rubricId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Rubric ID is missing from URL")
		return
	}

	var req models.UpdateRubricRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	updatedRubric, err := h.Service.UpdateRubric(rubricID, &req)
	if err != nil {
		log.Printf("ERROR: Failed to update rubric %s: %v", rubricID, err)
		if err.Error() == "rubric not found for update" {
			respondWithError(w, http.StatusNotFound, "Rubric not found")
			return
		} else if err.Error() == "no fields to update" {
			respondWithError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to update rubric")
		return
	}

	log.Printf("DEBUG: Successfully updated rubric %s.", rubricID)
	respondWithJSON(w, http.StatusOK, updatedRubric)
}

// DeleteRubricHandler handles deleting a rubric by its ID.
func (h *RubricHandlers) DeleteRubricHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("DEBUG: Entered DeleteRubricHandler")

	vars := mux.Vars(r)
	rubricID, ok := vars["rubricId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Rubric ID is missing from URL")
		return
	}

	err := h.Service.DeleteRubric(rubricID)
	if err != nil {
		log.Printf("ERROR: Failed to delete rubric %s: %v", rubricID, err)
		if err.Error() == "rubric not found with ID " + rubricID {
			respondWithError(w, http.StatusNotFound, "Rubric not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to delete rubric")
		return
	}

	log.Printf("DEBUG: Successfully deleted rubric %s.", rubricID)
	w.WriteHeader(http.StatusNoContent) // 204 No Content for successful deletion
}
