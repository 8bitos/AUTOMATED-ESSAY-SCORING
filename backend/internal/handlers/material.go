package handlers

import (
	"api-backend/internal/models"
	"api-backend/internal/services"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings" // Added strings import

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// MaterialHandlers holds dependencies for material-related handlers.
type MaterialHandlers struct {
	Service *services.MaterialService
}

// NewMaterialHandlers creates a new instance of MaterialHandlers.
func NewMaterialHandlers(s *services.MaterialService) *MaterialHandlers {
	return &MaterialHandlers{Service: s}
}

// CreateMaterialWithQuestionsHandler handles multipart/form-data request to create a material and its questions.
func (h *MaterialHandlers) CreateMaterialWithQuestionsHandler(w http.ResponseWriter, r *http.Request) {
	// 5MB limit
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		respondWithError(w, http.StatusBadRequest, "File size exceeds 5MB or invalid form data")
		return
	}

	materialName := r.FormValue("materialName")
	classID := r.FormValue("classId")
	materialType := r.FormValue("materialType")
	questionsJSON := r.FormValue("questions")

	if materialName == "" || classID == "" || questionsJSON == "" {
		respondWithError(w, http.StatusBadRequest, "Material name, class ID, and questions are required.")
		return
	}

	var questions []models.QuestionFromRequest
	if err := json.Unmarshal([]byte(questionsJSON), &questions); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid format for questions data.")
		return
	}

	req := models.CreateMaterialAndQuestionsRequest{
		MaterialName: materialName,
		ClassID:      classID,
		Questions:    questions,
	}

	var materialText *string
	var fileURL *string

	if materialType == "text" {
		text := r.FormValue("materialText")
		materialText = &text
	} else if materialType == "file" {
		file, handler, err := r.FormFile("materialFile")
		if err != nil {
			if err == http.ErrMissingFile {
				respondWithError(w, http.StatusBadRequest, "No file uploaded for material type 'file'")
				return
			}
			respondWithError(w, http.StatusInternalServerError, "Error retrieving the file")
			return
		}
		defer file.Close()

		// Generate a unique filename
		ext := filepath.Ext(handler.Filename)
		uniqueFilename := fmt.Sprintf("%s%s", uuid.New().String(), ext)

		// Create the file on the server
		dst, err := os.Create(filepath.Join("./uploads", uniqueFilename))
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Error creating the file on server")
			return
		}
		defer dst.Close()

		// Copy the uploaded file's content
		if _, err := io.Copy(dst, file); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Error saving the file")
			return
		}

		url := "/uploads/" + uniqueFilename
		fileURL = &url
	}

	uploaderID, ok := r.Context().Value("userID").(string)
	if !ok || uploaderID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	newMaterial, err := h.Service.CreateMaterialWithQuestions(req, uploaderID, materialText, fileURL)
	if err != nil {
		log.Printf("ERROR: Failed to create material with questions: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to save material and questions.")
		return
	}

	respondWithJSON(w, http.StatusCreated, newMaterial)
}

// CreateMaterialHandler handles the creation of a new material.
// It supports multipart/form-data for file uploads, or application/json for text-only materials.
func (h *MaterialHandlers) CreateMaterialHandler(w http.ResponseWriter, r *http.Request) {
	uploaderID, ok := r.Context().Value("userID").(string)
	if !ok || uploaderID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	var req models.CreateMaterialRequest

	// Check Content-Type to determine how to parse the request
	contentType := r.Header.Get("Content-Type")

	if strings.Contains(contentType, "multipart/form-data") {
		// Handle multipart/form-data (for file uploads or form-encoded text)
		if err := r.ParseMultipartForm(5 << 20); err != nil { // 5MB limit
			respondWithError(w, http.StatusBadRequest, "File size exceeds 5MB or invalid form data")
			return
		}

		// Extract fields from form values
		req.ClassID = r.FormValue("class_id") // Changed from classId
		req.Judul = r.FormValue("judul")      // Changed from materialName
		req.MaterialType = r.FormValue("material_type")
		materialType := r.FormValue("materialType")

		if materialType == "text" {
			isiMateri := r.FormValue("isiMateri") // Changed from materialText
			req.IsiMateri = &isiMateri
		} else if materialType == "file" {
			file, handler, err := r.FormFile("file") // Changed from materialFile to 'file'
			if err != nil {
				if err == http.ErrMissingFile {
					respondWithError(w, http.StatusBadRequest, "No file uploaded for material type 'file'")
					return
				}
				respondWithError(w, http.StatusInternalServerError, "Error retrieving the file")
				return
			}
			defer file.Close()

			// Generate a unique filename
			ext := filepath.Ext(handler.Filename)
			uniqueFilename := fmt.Sprintf("%s%s", uuid.New().String(), ext)

			// Create the file on the server
			dst, err := os.Create(filepath.Join("./uploads", uniqueFilename))
			if err != nil {
				respondWithError(w, http.StatusInternalServerError, "Error creating the file on server")
				return
			}
			defer dst.Close()

			// Copy the uploaded file's content
			if _, err := io.Copy(dst, file); err != nil {
				respondWithError(w, http.StatusInternalServerError, "Error saving the file")
				return
			}

			url := "/uploads/" + uniqueFilename
			req.FileUrl = &url
		}
	} else if strings.Contains(contentType, "application/json") {
		// Handle application/json (for text-only materials, if frontend sends JSON)
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondWithError(w, http.StatusBadRequest, "Invalid JSON request body")
			return
		}
	} else {
		respondWithError(w, http.StatusUnsupportedMediaType, "Unsupported Content-Type")
		return
	}

	// Basic validation
	if req.ClassID == "" || req.Judul == "" {
		respondWithError(w, http.StatusBadRequest, "Class ID and Material Name (Judul) cannot be empty")
		return
	}

	newMaterial, err := h.Service.CreateMaterial(req, uploaderID)
	if err != nil {
		log.Printf("ERROR: Failed to create material in service: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create material")
		return
	}
	respondWithJSON(w, http.StatusCreated, newMaterial)
}

// GetMaterialByIDHandler handles fetching a single material by its ID.
func (h *MaterialHandlers) GetMaterialByIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	materialID, ok := vars["materialId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Material ID is missing from URL")
		return
	}

	material, err := h.Service.GetMaterialByID(materialID)
	if err != nil {
		log.Printf("ERROR: Failed to get material %s: %v", materialID, err)
		if err.Error() == "material not found" {
			respondWithError(w, http.StatusNotFound, "Material not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve material")
		return
	}
	respondWithJSON(w, http.StatusOK, material)
}

// GetMaterialsByClassIDHandler handles fetching all materials for a specific class.
func (h *MaterialHandlers) GetMaterialsByClassIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	classID, ok := vars["classId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Class ID is missing from URL")
		return
	}

	materials, err := h.Service.GetMaterialsByClassID(classID)
	if err != nil {
		log.Printf("ERROR: Failed to get materials for class %s: %v", classID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve materials")
		return
	}
	respondWithJSON(w, http.StatusOK, materials)
}

// UpdateMaterialHandler handles updating an existing material.
func (h *MaterialHandlers) UpdateMaterialHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	materialID, ok := vars["materialId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Material ID is missing from URL")
		return
	}

	// For UpdateMaterial, we also need to handle multipart/form-data if a file might be updated
	if err := r.ParseMultipartForm(5 << 20); err != nil && err != http.ErrNotMultipart { // Allow non-multipart forms for text-only updates
		respondWithError(w, http.StatusBadRequest, "File size exceeds 5MB or invalid form data")
		return
	}

	var req models.UpdateMaterialRequest
	if r.Header.Get("Content-Type") == "application/json" { // Handle JSON if no file update
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondWithError(w, http.StatusBadRequest, "Invalid request body")
			return
		}
	} else { // Handle multipart/form-data
		// Dynamically populate update request from form values
		// The service method expects pointers, so we need helper functions or direct assignment
		judul := r.FormValue("judul")
		if judul != "" {
			req.Judul = &judul
		}

		materialTypeValue := strings.TrimSpace(r.FormValue("material_type"))
		if materialTypeValue != "" {
			req.MaterialType = &materialTypeValue
		}

		isiMateri := r.FormValue("isiMateri") // Note: this is different from materialText in creation
		if isiMateri != "" {
			req.IsiMateri = &isiMateri
		}

		clearFile := r.FormValue("clearFile")
		if clearFile == "true" {
			empty := ""
			req.FileUrl = &empty
		}

		// Handle file update if present
		file, handler, err := r.FormFile("file") // "file" is the expected field name
		if err == nil {                          // File was uploaded
			defer file.Close()
			ext := filepath.Ext(handler.Filename)
			uniqueFilename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
			dst, err := os.Create(filepath.Join("./uploads", uniqueFilename))
			if err != nil {
				respondWithError(w, http.StatusInternalServerError, "Error creating file on server for update")
				return
			}
			defer dst.Close()
			if _, err := io.Copy(dst, file); err != nil {
				respondWithError(w, http.StatusInternalServerError, "Error saving file for update")
				return
			}
			url := "/uploads/" + uniqueFilename
			req.FileUrl = &url
			req.IsiMateri = nil // Clear text content if file is uploaded
		} else if err != http.ErrMissingFile && err != http.ErrNotMultipart { // Other errors than just missing file
			respondWithError(w, http.StatusInternalServerError, "Error processing file upload for update")
			return
		}

		capaianPembelajaran := r.FormValue("capaianPembelajaran")
		if capaianPembelajaran != "" {
			req.CapaianPembelajaran = &capaianPembelajaran
		}

		keywordsStr := r.FormValue("keywords")
		if keywordsStr != "" {
			keywordsSlice := strings.Split(keywordsStr, ",")
			for i, kw := range keywordsSlice {
				keywordsSlice[i] = strings.TrimSpace(kw)
			}
			req.KataKunci = keywordsSlice
		}
	}

	updatedMaterial, err := h.Service.UpdateMaterial(materialID, &req)
	if err != nil {
		log.Printf("ERROR: Failed to update material %s: %v", materialID, err)
		if err.Error() == "material not found for update" {
			respondWithError(w, http.StatusNotFound, "Material not found")
			return
		} else if err.Error() == "no fields to update" {
			respondWithError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to update material")
		return
	}

	respondWithJSON(w, http.StatusOK, updatedMaterial)
}

// DeleteMaterialHandler handles deleting a material by its ID.
func (h *MaterialHandlers) DeleteMaterialHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	materialID, ok := vars["materialId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Material ID is missing from URL")
		return
	}

	err := h.Service.DeleteMaterial(materialID)
	if err != nil {
		log.Printf("ERROR: Failed to delete material %s: %v", materialID, err)
		if err.Error() == "material not found with ID "+materialID {
			respondWithError(w, http.StatusNotFound, "Material not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to delete material")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
