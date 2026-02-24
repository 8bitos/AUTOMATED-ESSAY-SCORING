package handlers

import (
	"api-backend/internal/models"
	"api-backend/internal/services"
	"encoding/json"
	"github.com/gorilla/mux"
	"log"
	"net/http"
)

// ModuleHandlers holds dependencies for module-related handlers.
type ModuleHandlers struct {
	Service *services.ModuleService
}

// NewModuleHandlers creates a new instance of ModuleHandlers.
func NewModuleHandlers(s *services.ModuleService) *ModuleHandlers {
	return &ModuleHandlers{Service: s}
}

// CreateModuleHandler handles the creation of a new module.
func (h *ModuleHandlers) CreateModuleHandler(w http.ResponseWriter, r *http.Request) {
	var req models.CreateModuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.MaterialID == "" || req.NamaModul == "" || req.FileUrl == "" {
		respondWithError(w, http.StatusBadRequest, "MaterialID, NamaModul, and FileUrl cannot be empty")
		return
	}

	newModule, err := h.Service.CreateModule(req)
	if err != nil {
		log.Printf("ERROR: Failed to create module in service: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create module")
		return
	}

	respondWithJSON(w, http.StatusCreated, newModule)
}

// GetModulesByMaterialIDHandler handles fetching all modules for a specific material.
func (h *ModuleHandlers) GetModulesByMaterialIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	materialID, ok := vars["materialId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Material ID is missing from URL")
		return
	}

	modules, err := h.Service.GetModulesByMaterialID(materialID)
	if err != nil {
		log.Printf("ERROR: Failed to get modules for material %s: %v", materialID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve modules")
		return
	}

	respondWithJSON(w, http.StatusOK, modules)
}
