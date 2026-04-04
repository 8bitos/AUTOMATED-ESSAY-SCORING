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

type RubricTemplateHandlers struct {
	Service *services.RubricTemplateService
}

func NewRubricTemplateHandlers(service *services.RubricTemplateService) *RubricTemplateHandlers {
	return &RubricTemplateHandlers{Service: service}
}

func (h *RubricTemplateHandlers) ListRubricTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	if strings.TrimSpace(userID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}
	templates, err := h.Service.ListByUser(userID)
	if err != nil {
		log.Printf("ERROR: Failed to list rubric templates: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve rubric templates")
		return
	}
	respondWithJSON(w, http.StatusOK, templates)
}

func (h *RubricTemplateHandlers) CreateRubricTemplateHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	if strings.TrimSpace(userID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	var req models.CreateRubricTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	req.RubricType = strings.TrimSpace(req.RubricType)
	if req.Title == "" {
		respondWithError(w, http.StatusBadRequest, "title wajib diisi")
		return
	}
	if req.RubricType != "analitik" && req.RubricType != "holistik" {
		respondWithError(w, http.StatusBadRequest, "rubric_type tidak valid")
		return
	}

	created, err := h.Service.Create(userID, req)
	if err != nil {
		log.Printf("ERROR: Failed to create rubric template: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create rubric template")
		return
	}
	respondWithJSON(w, http.StatusCreated, created)
}

func (h *RubricTemplateHandlers) UpdateRubricTemplateHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	if strings.TrimSpace(userID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}
	templateID := strings.TrimSpace(mux.Vars(r)["templateId"])
	if templateID == "" {
		respondWithError(w, http.StatusBadRequest, "Template ID is required")
		return
	}

	var req models.UpdateRubricTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Title != nil {
		trimmed := strings.TrimSpace(*req.Title)
		req.Title = &trimmed
		if trimmed == "" {
			respondWithError(w, http.StatusBadRequest, "title wajib diisi")
			return
		}
	}
	if req.RubricType != nil {
		trimmed := strings.TrimSpace(*req.RubricType)
		req.RubricType = &trimmed
		if trimmed != "analitik" && trimmed != "holistik" {
			respondWithError(w, http.StatusBadRequest, "rubric_type tidak valid")
			return
		}
	}

	updated, err := h.Service.Update(userID, templateID, req)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			respondWithError(w, http.StatusNotFound, "Rubric template not found")
			return
		}
		if strings.Contains(err.Error(), "no fields to update") {
			respondWithError(w, http.StatusBadRequest, "No fields to update")
			return
		}
		log.Printf("ERROR: Failed to update rubric template %s: %v", templateID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update rubric template")
		return
	}
	respondWithJSON(w, http.StatusOK, updated)
}

func (h *RubricTemplateHandlers) DeleteRubricTemplateHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	if strings.TrimSpace(userID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}
	templateID := strings.TrimSpace(mux.Vars(r)["templateId"])
	if templateID == "" {
		respondWithError(w, http.StatusBadRequest, "Template ID is required")
		return
	}
	if err := h.Service.Delete(userID, templateID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			respondWithError(w, http.StatusNotFound, "Rubric template not found")
			return
		}
		log.Printf("ERROR: Failed to delete rubric template %s: %v", templateID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to delete rubric template")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
