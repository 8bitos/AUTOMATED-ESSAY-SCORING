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

type QuestionBankHandlers struct {
	Service         *services.QuestionBankService
	MaterialService *services.MaterialService
}

func NewQuestionBankHandlers(s *services.QuestionBankService, materialService *services.MaterialService) *QuestionBankHandlers {
	return &QuestionBankHandlers{
		Service:         s,
		MaterialService: materialService,
	}
}

func (h *QuestionBankHandlers) CreateQuestionBankEntryHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	if strings.TrimSpace(userID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	var req models.CreateQuestionBankEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.MaterialID != nil {
		materialID := strings.TrimSpace(*req.MaterialID)
		req.MaterialID = &materialID
	}
	if req.ClassID != nil {
		classID := strings.TrimSpace(*req.ClassID)
		req.ClassID = &classID
	}
	req.Subject = strings.TrimSpace(req.Subject)
	req.TeksSoal = strings.TrimSpace(req.TeksSoal)
	if req.TeksSoal == "" {
		respondWithError(w, http.StatusBadRequest, "teks_soal wajib diisi")
		return
	}

	classID := ""
	if req.MaterialID != nil && *req.MaterialID != "" {
		material, err := h.MaterialService.GetMaterialByID(*req.MaterialID)
		if err != nil {
			if err.Error() == "material not found" {
				respondWithError(w, http.StatusNotFound, "Material not found")
				return
			}
			log.Printf("ERROR: Failed to get material %s for question bank: %v", *req.MaterialID, err)
			respondWithError(w, http.StatusInternalServerError, "Failed to validate source material")
			return
		}
		classID = material.ClassID
	} else if req.ClassID != nil && *req.ClassID != "" {
		classID = *req.ClassID
	} else {
		respondWithError(w, http.StatusBadRequest, "class_id wajib diisi jika material_id tidak diberikan")
		return
	}

	created, err := h.Service.CreateQuestionBankEntry(req, userID, classID)
	if err != nil {
		log.Printf("ERROR: Failed to create question bank entry: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create question bank entry")
		return
	}

	respondWithJSON(w, http.StatusCreated, created)
}

func (h *QuestionBankHandlers) ListQuestionBankEntriesHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	userRole, _ := r.Context().Value("userRole").(string)
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(userRole) == "" {
		respondWithError(w, http.StatusUnauthorized, "User context invalid")
		return
	}

	query := r.URL.Query()
	classID := strings.TrimSpace(query.Get("class_id"))
	materialID := strings.TrimSpace(query.Get("material_id"))
	search := strings.TrimSpace(query.Get("q"))

	var classIDPtr, materialIDPtr, searchPtr *string
	if classID != "" {
		classIDPtr = &classID
	}
	if materialID != "" {
		materialIDPtr = &materialID
	}
	if search != "" {
		searchPtr = &search
	}

	entries, err := h.Service.ListQuestionBankEntries(userID, userRole, classIDPtr, materialIDPtr, searchPtr)
	if err != nil {
		log.Printf("ERROR: Failed to list question bank entries: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve question bank entries")
		return
	}

	respondWithJSON(w, http.StatusOK, entries)
}

func (h *QuestionBankHandlers) UpdateQuestionBankEntryHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	userRole, _ := r.Context().Value("userRole").(string)
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(userRole) == "" {
		respondWithError(w, http.StatusUnauthorized, "User context invalid")
		return
	}

	vars := mux.Vars(r)
	entryID := strings.TrimSpace(vars["entryId"])
	if entryID == "" {
		respondWithError(w, http.StatusBadRequest, "Entry ID is missing from URL")
		return
	}

	var req models.UpdateQuestionBankEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.ClassID != nil {
		classID := strings.TrimSpace(*req.ClassID)
		req.ClassID = &classID
	}
	if req.Subject != nil {
		subject := strings.TrimSpace(*req.Subject)
		req.Subject = &subject
	}
	if req.MaterialID != nil {
		materialID := strings.TrimSpace(*req.MaterialID)
		req.MaterialID = &materialID
		if materialID != "" {
			material, err := h.MaterialService.GetMaterialByID(materialID)
			if err != nil {
				if err.Error() == "material not found" {
					respondWithError(w, http.StatusNotFound, "Material not found")
					return
				}
				log.Printf("ERROR: Failed validating material %s for question bank update: %v", materialID, err)
				respondWithError(w, http.StatusInternalServerError, "Failed to validate source material")
				return
			}
			req.ClassID = &material.ClassID
		}
	}
	if req.TeksSoal != nil {
		teks := strings.TrimSpace(*req.TeksSoal)
		req.TeksSoal = &teks
	}

	updated, err := h.Service.UpdateQuestionBankEntry(entryID, req, userID, userRole)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			respondWithError(w, http.StatusNotFound, "Question bank entry not found")
			return
		}
		if strings.Contains(err.Error(), "no fields to update") {
			respondWithError(w, http.StatusBadRequest, "No fields to update")
			return
		}
		log.Printf("ERROR: Failed to update question bank entry %s: %v", entryID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update question bank entry")
		return
	}
	respondWithJSON(w, http.StatusOK, updated)
}

func (h *QuestionBankHandlers) DeleteQuestionBankEntryHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value("userID").(string)
	userRole, _ := r.Context().Value("userRole").(string)
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(userRole) == "" {
		respondWithError(w, http.StatusUnauthorized, "User context invalid")
		return
	}

	vars := mux.Vars(r)
	entryID := strings.TrimSpace(vars["entryId"])
	if entryID == "" {
		respondWithError(w, http.StatusBadRequest, "Entry ID is missing from URL")
		return
	}

	if err := h.Service.DeleteQuestionBankEntry(entryID, userID, userRole); err != nil {
		if strings.Contains(err.Error(), "not found") {
			respondWithError(w, http.StatusNotFound, "Question bank entry not found")
			return
		}
		log.Printf("ERROR: Failed to delete question bank entry %s: %v", entryID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to delete question bank entry")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
