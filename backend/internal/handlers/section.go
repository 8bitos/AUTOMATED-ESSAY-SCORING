package handlers

import (
	"api-backend/internal/models"
	"api-backend/internal/services"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

type SectionHandlers struct {
	Service *services.SectionService
}

func NewSectionHandlers(s *services.SectionService) *SectionHandlers {
	return &SectionHandlers{Service: s}
}

func (h *SectionHandlers) GetSectionsByClassIDHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	classID := mux.Vars(r)["classId"]
	if classID == "" {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing from URL")
		return
	}

	sections, err := h.Service.ListSectionsByClassID(classID, userID)
	if err != nil {
		log.Printf("ERROR: Failed to list sections for class %s: %v", classID, err)
		if err.Error() == "class not found or access denied" {
			respondWithError(w, http.StatusForbidden, err.Error())
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve sections")
		return
	}
	respondWithJSON(w, http.StatusOK, sections)
}

func (h *SectionHandlers) CreateSectionHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	classID := mux.Vars(r)["classId"]
	if classID == "" {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing from URL")
		return
	}

	var req models.CreateSectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	created, err := h.Service.CreateSection(classID, userID, req)
	if err != nil {
		log.Printf("ERROR: Failed to create section in class %s: %v", classID, err)
		switch err.Error() {
		case "section title is required":
			respondWithError(w, http.StatusBadRequest, err.Error())
			return
		case "class not found or access denied":
			respondWithError(w, http.StatusForbidden, err.Error())
			return
		default:
			respondWithError(w, http.StatusInternalServerError, "Failed to create section")
			return
		}
	}
	respondWithJSON(w, http.StatusCreated, created)
}

func (h *SectionHandlers) CreateSectionContentHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	sectionID := mux.Vars(r)["sectionId"]
	if sectionID == "" {
		respondWithError(w, http.StatusBadRequest, "Section ID is missing from URL")
		return
	}

	var req models.CreateSectionContentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	created, err := h.Service.CreateSectionContent(sectionID, userID, req)
	if err != nil {
		log.Printf("ERROR: Failed to create section content in section %s: %v", sectionID, err)
		switch err.Error() {
		case "content title is required":
			respondWithError(w, http.StatusBadRequest, err.Error())
			return
		case "section not found or access denied":
			respondWithError(w, http.StatusForbidden, err.Error())
			return
		default:
			respondWithError(w, http.StatusInternalServerError, "Failed to create section content")
			return
		}
	}
	respondWithJSON(w, http.StatusCreated, created)
}
