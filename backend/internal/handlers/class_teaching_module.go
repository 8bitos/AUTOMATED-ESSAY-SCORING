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

type ClassTeachingModuleHandlers struct {
	Service *services.ClassTeachingModuleService
}

func NewClassTeachingModuleHandlers(s *services.ClassTeachingModuleService) *ClassTeachingModuleHandlers {
	return &ClassTeachingModuleHandlers{Service: s}
}

func (h *ClassTeachingModuleHandlers) CreateClassTeachingModuleHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok || strings.TrimSpace(classID) == "" {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing from URL")
		return
	}

	var req models.CreateClassTeachingModuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.ClassID = classID
	req.NamaModul = strings.TrimSpace(req.NamaModul)
	req.FileURL = strings.TrimSpace(req.FileURL)
	if req.NamaModul == "" || req.FileURL == "" {
		respondWithError(w, http.StatusBadRequest, "Nama modul dan file URL wajib diisi")
		return
	}

	if userID, ok := r.Context().Value("userID").(string); ok && userID != "" {
		req.UploadedBy = userID
	}

	newModule, err := h.Service.CreateClassTeachingModule(req)
	if err != nil {
		log.Printf("ERROR: Failed to create class teaching module: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create class teaching module")
		return
	}

	respondWithJSON(w, http.StatusCreated, newModule)
}

func (h *ClassTeachingModuleHandlers) GetClassTeachingModulesByClassIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok || strings.TrimSpace(classID) == "" {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing from URL")
		return
	}

	modules, err := h.Service.GetClassTeachingModulesByClassID(classID)
	if err != nil {
		log.Printf("ERROR: Failed to get class teaching modules for class %s: %v", classID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve class teaching modules")
		return
	}

	respondWithJSON(w, http.StatusOK, modules)
}

func (h *ClassTeachingModuleHandlers) DeleteClassTeachingModuleHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	moduleID, ok := vars["moduleId"]
	if !ok || strings.TrimSpace(moduleID) == "" {
		respondWithError(w, http.StatusBadRequest, "Module ID is missing from URL")
		return
	}

	if err := h.Service.DeleteClassTeachingModule(moduleID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			respondWithError(w, http.StatusNotFound, "Class teaching module not found")
			return
		}
		log.Printf("ERROR: Failed to delete class teaching module %s: %v", moduleID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to delete class teaching module")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
