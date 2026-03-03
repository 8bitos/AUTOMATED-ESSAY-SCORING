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

type GradeAppealHandlers struct {
	Service *services.GradeAppealService
}

func NewGradeAppealHandlers(s *services.GradeAppealService) *GradeAppealHandlers {
	return &GradeAppealHandlers{Service: s}
}

func (h *GradeAppealHandlers) CreateGradeAppealHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || strings.TrimSpace(userID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}
	userRole, _ := r.Context().Value("userRole").(string)
	if userRole != "student" {
		respondWithError(w, http.StatusForbidden, "Hanya siswa yang dapat mengajukan banding")
		return
	}

	var req models.CreateGradeAppealRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	appeal, err := h.Service.CreateAppeal(&req, userID)
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "already") || strings.Contains(msg, "sudah punya banding aktif") {
			respondWithError(w, http.StatusConflict, msg)
			return
		}
		if strings.Contains(msg, "required") || strings.Contains(msg, "not found") {
			respondWithError(w, http.StatusBadRequest, msg)
			return
		}
		log.Printf("ERROR: failed to create grade appeal: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Gagal membuat banding nilai")
		return
	}
	respondWithJSON(w, http.StatusCreated, appeal)
}

func (h *GradeAppealHandlers) GetMyGradeAppealsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || strings.TrimSpace(userID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}
	classID := strings.TrimSpace(r.URL.Query().Get("class_id"))
	rows, err := h.Service.ListStudentAppeals(userID, classID)
	if err != nil {
		log.Printf("ERROR: failed to list my grade appeals: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Gagal memuat banding nilai")
		return
	}
	respondWithJSON(w, http.StatusOK, rows)
}

func (h *GradeAppealHandlers) ListTeacherGradeAppealsHandler(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || strings.TrimSpace(teacherID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}
	classID := strings.TrimSpace(r.URL.Query().Get("class_id"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	rows, err := h.Service.ListTeacherAppeals(teacherID, classID, status)
	if err != nil {
		log.Printf("ERROR: failed to list teacher grade appeals: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Gagal memuat daftar banding nilai")
		return
	}
	respondWithJSON(w, http.StatusOK, rows)
}

func (h *GradeAppealHandlers) ReviewGradeAppealHandler(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || strings.TrimSpace(teacherID) == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}
	appealID := strings.TrimSpace(mux.Vars(r)["appealId"])
	if appealID == "" {
		respondWithError(w, http.StatusBadRequest, "Appeal ID is missing")
		return
	}
	var req models.ReviewGradeAppealRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	updated, err := h.Service.ReviewAppeal(appealID, teacherID, &req)
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "invalid") || strings.Contains(msg, "not found") {
			respondWithError(w, http.StatusBadRequest, msg)
			return
		}
		log.Printf("ERROR: failed to review appeal %s: %v", appealID, err)
		respondWithError(w, http.StatusInternalServerError, "Gagal memproses banding nilai")
		return
	}
	respondWithJSON(w, http.StatusOK, updated)
}
