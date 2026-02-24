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

// ClassHandlers holds dependencies for class-related handlers.
type ClassHandlers struct {
	Service *services.ClassService
}

// NewClassHandlers creates a new instance of ClassHandlers.
func NewClassHandlers(s *services.ClassService) *ClassHandlers {
	return &ClassHandlers{Service: s}
}

// CreateClassHandler handles the creation of a new class.
func (h *ClassHandlers) CreateClassHandler(w http.ResponseWriter, r *http.Request) {
	var req models.CreateClassRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.ClassName == "" {
		respondWithError(w, http.StatusBadRequest, "Class name cannot be empty")
		return
	}

	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || teacherID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	newClass, err := h.Service.CreateClass(req, teacherID)
	if err != nil {
		log.Printf("ERROR: Failed to create class: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create class")
		return
	}

	respondWithJSON(w, http.StatusCreated, newClass)
}

// GetClassesHandler retrieves all classes created by the authenticated teacher.
func (h *ClassHandlers) GetClassesHandler(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || teacherID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	classes, err := h.Service.GetClasses(teacherID)
	if err != nil {
		log.Printf("ERROR: Failed to get classes for teacher %s: %v", teacherID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve classes")
		return
	}

	respondWithJSON(w, http.StatusOK, classes)
}

// GetAllClassesHandler retrieves all classes (for public use).
func (h *ClassHandlers) GetAllClassesHandler(w http.ResponseWriter, r *http.Request) {
	classes, err := h.Service.GetAllClasses()
	if err != nil {
		log.Printf("ERROR: Failed to get all classes: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve classes")
		return
	}
	respondWithJSON(w, http.StatusOK, classes)
}

// GetClassByIDHandler retrieves a single class by its ID.
func (h *ClassHandlers) GetClassByIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing from URL")
		return
	}

	class, err := h.Service.GetClassByID(classID)
	if err != nil {
		log.Printf("ERROR: Failed to get class %s: %v", classID, err)
		if err.Error() == "class not found" {
			respondWithError(w, http.StatusNotFound, "Class not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve class")
		return
	}

	respondWithJSON(w, http.StatusOK, class)
}

// UpdateClassHandler handles updating class metadata by teacher owner.
func (h *ClassHandlers) UpdateClassHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing from URL")
		return
	}
	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || teacherID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	var req models.UpdateClassRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	updated, err := h.Service.UpdateClass(classID, teacherID, &req)
	if err != nil {
		log.Printf("ERROR: Failed to update class %s: %v", classID, err)
		if err.Error() == "class not found or unauthorized" {
			respondWithError(w, http.StatusForbidden, "Class not found or unauthorized")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to update class")
		return
	}
	respondWithJSON(w, http.StatusOK, updated)
}

// DeleteClassHandler handles deleting class by teacher owner.
func (h *ClassHandlers) DeleteClassHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing from URL")
		return
	}
	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || teacherID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	if err := h.Service.DeleteClass(classID, teacherID); err != nil {
		log.Printf("ERROR: Failed to delete class %s: %v", classID, err)
		if err.Error() == "class not found or unauthorized" {
			respondWithError(w, http.StatusForbidden, "Class not found or unauthorized")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to delete class")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GetStudentsByClassIDHandler retrieves all students for a specific class.
func (h *ClassHandlers) GetStudentsByClassIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing from URL")
		return
	}

	students, err := h.Service.GetStudentsByClassID(classID)
	if err != nil {
		log.Printf("ERROR: Failed to get students for class %s: %v", classID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve students")
		return
	}

	respondWithJSON(w, http.StatusOK, students)
}

// JoinClassHandler handles the request for a student to join a class.
func (h *ClassHandlers) JoinClassHandler(w http.ResponseWriter, r *http.Request) {
	var req models.JoinClassRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.ClassCode == "" {
		respondWithError(w, http.StatusBadRequest, "Class code cannot be empty")
		return
	}

	studentID, ok := r.Context().Value("userID").(string)
	if !ok || studentID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	err := h.Service.JoinClass(req.ClassCode, studentID)
	if err != nil {
		log.Printf("ERROR: Failed to join class for student %s with code %s: %v", studentID, req.ClassCode, err)
		if err.Error() == "class not found" {
			respondWithError(w, http.StatusNotFound, "Class not found with the provided code")
			return
		}
		if err.Error() == "student is already a member of this class" {
			respondWithError(w, http.StatusConflict, "You are already a member of this class")
			return
		}
		if err.Error() == "join request already pending" {
			respondWithError(w, http.StatusConflict, "Permintaan bergabung sudah dikirim dan masih menunggu ACC guru")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to join class")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Permintaan bergabung berhasil dikirim. Menunggu ACC guru."})
}

// RemoveStudentFromClassHandler handles removing a student from a class.
func (h *ClassHandlers) RemoveStudentFromClassHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing from URL")
		return
	}
	studentID, ok := vars["studentId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Student ID is missing from URL")
		return
	}

	err := h.Service.RemoveStudentFromClass(classID, studentID)
	if err != nil {
		log.Printf("ERROR: Failed to remove student %s from class %s: %v", studentID, classID, err)
		if err.Error() == "class member not found" {
			respondWithError(w, http.StatusNotFound, "Student not found in class")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to remove student from class")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetStudentClassesHandler retrieves all classes a student is a member of.
func (h *ClassHandlers) GetStudentClassesHandler(w http.ResponseWriter, r *http.Request) {
	studentID, ok := r.Context().Value("userID").(string)
	if !ok || studentID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	classes, err := h.Service.GetStudentClasses(studentID)
	if err != nil {
		log.Printf("ERROR: Failed to get classes for student %s: %v", studentID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve student classes")
		return
	}

	respondWithJSON(w, http.StatusOK, classes)
}

// GetStudentPendingClassesHandler retrieves pending class join requests for a student.
func (h *ClassHandlers) GetStudentPendingClassesHandler(w http.ResponseWriter, r *http.Request) {
	studentID, ok := r.Context().Value("userID").(string)
	if !ok || studentID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	items, err := h.Service.GetStudentPendingClasses(studentID)
	if err != nil {
		log.Printf("ERROR: Failed to get pending classes for student %s: %v", studentID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve pending classes")
		return
	}

	respondWithJSON(w, http.StatusOK, items)
}

// GetStudentClassByIDHandler retrieves a single class with its materials and essay questions for a student.
func (h *ClassHandlers) GetStudentClassByIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing from URL")
		return
	}

	studentID, ok := r.Context().Value("userID").(string)
	if !ok || studentID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	class, err := h.Service.GetStudentClassDetails(classID, studentID)
	if err != nil {
		log.Printf("ERROR: Failed to get class %s for student %s: %v", classID, studentID, err)
		if err.Error() == "class not found or student not a member" {
			respondWithError(w, http.StatusNotFound, "Class not found or you are not a member.")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve class details")
		return
	}

	respondWithJSON(w, http.StatusOK, class)
}

// GetTeacherDashboardSummaryHandler returns one-shot dashboard summary for teacher.
func (h *ClassHandlers) GetTeacherDashboardSummaryHandler(w http.ResponseWriter, r *http.Request) {
	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || teacherID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	summary, err := h.Service.GetTeacherDashboardSummary(teacherID)
	if err != nil {
		log.Printf("ERROR: Failed to get dashboard summary for teacher %s: %v", teacherID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to load dashboard summary")
		return
	}

	respondWithJSON(w, http.StatusOK, summary)
}

// InviteStudentHandler handles guru invite siswa ke kelas.
func (h *ClassHandlers) InviteStudentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing from URL")
		return
	}
	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || teacherID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	var req models.InviteStudentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Identifier = strings.TrimSpace(req.Identifier)
	req.StudentID = strings.TrimSpace(req.StudentID)
	if req.Identifier == "" && req.StudentID == "" {
		respondWithError(w, http.StatusBadRequest, "Identifier or student_id cannot be empty")
		return
	}

	if err := h.Service.InviteStudent(classID, teacherID, req.Identifier, req.StudentID); err != nil {
		log.Printf("ERROR: Failed to invite student to class %s: %v", classID, err)
		switch err.Error() {
		case "class not found or unauthorized":
			respondWithError(w, http.StatusForbidden, "Class not found or unauthorized")
		case "student not found":
			respondWithError(w, http.StatusNotFound, "Student not found")
		case "target user is not a student":
			respondWithError(w, http.StatusBadRequest, "Target user is not a student")
		case "student is already a member of this class":
			respondWithError(w, http.StatusConflict, "Student is already a member of this class")
		default:
			respondWithError(w, http.StatusInternalServerError, "Failed to invite student")
		}
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Siswa berhasil diundang dan ditambahkan ke kelas"})
}

// GetInvitableStudentsHandler returns list siswa yang bisa diundang.
func (h *ClassHandlers) GetInvitableStudentsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing from URL")
		return
	}
	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || teacherID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	students, err := h.Service.GetInvitableStudents(classID, teacherID)
	if err != nil {
		log.Printf("ERROR: Failed to get invitable students for class %s: %v", classID, err)
		if err.Error() == "class not found or unauthorized" {
			respondWithError(w, http.StatusForbidden, "Class not found or unauthorized")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to load invitable students")
		return
	}

	respondWithJSON(w, http.StatusOK, students)
}

// GetPendingJoinRequestsHandler returns pending join requests for teacher approval.
func (h *ClassHandlers) GetPendingJoinRequestsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing from URL")
		return
	}
	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || teacherID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	requests, err := h.Service.GetPendingJoinRequests(classID, teacherID)
	if err != nil {
		log.Printf("ERROR: Failed to load pending join requests for class %s: %v", classID, err)
		if err.Error() == "class not found or unauthorized" {
			respondWithError(w, http.StatusForbidden, "Class not found or unauthorized")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to load pending join requests")
		return
	}
	respondWithJSON(w, http.StatusOK, requests)
}

// ReviewJoinRequestHandler approves/rejects a pending join request.
func (h *ClassHandlers) ReviewJoinRequestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing from URL")
		return
	}
	memberID, ok := vars["memberId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Member ID is missing from URL")
		return
	}
	teacherID, ok := r.Context().Value("userID").(string)
	if !ok || teacherID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	var req models.ReviewJoinRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.Service.ReviewJoinRequest(classID, memberID, teacherID, req.Action); err != nil {
		log.Printf("ERROR: Failed to review join request %s in class %s: %v", memberID, classID, err)
		switch err.Error() {
		case "class not found or unauthorized":
			respondWithError(w, http.StatusForbidden, "Class not found or unauthorized")
		case "join request not found":
			respondWithError(w, http.StatusNotFound, "Join request not found")
		case "invalid action":
			respondWithError(w, http.StatusBadRequest, "Invalid action")
		default:
			respondWithError(w, http.StatusInternalServerError, "Failed to review join request")
		}
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Join request reviewed successfully"})
}
