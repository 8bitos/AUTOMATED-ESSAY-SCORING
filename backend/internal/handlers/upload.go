package handlers

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

// UploadHandler holds dependencies for upload handlers.
type UploadHandler struct{}

// NewUploadHandler creates a new instance of UploadHandler.
func NewUploadHandler() *UploadHandler {
	return &UploadHandler{}
}

// UploadFileHandler handles file uploads.
func (h *UploadHandler) UploadFileHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Parse input, with a 5MB max file size
	r.ParseMultipartForm(5 << 20) // 5 MB

	// 2. Retrieve file from posted form-data
	file, handler, err := r.FormFile("file") // "file" is the key in the form data
	if err != nil {
		log.Printf("Error Retrieving the File: %v", err)
		respondWithError(w, http.StatusBadRequest, "Error retrieving the file")
		return
	}
	defer file.Close()

	log.Printf("Uploaded File: %+v, File Size: %+v, MIME Header: %+v", handler.Filename, handler.Size, handler.Header)

	// 3. Create a new file in the uploads directory
	// Generate a random name for the file to avoid conflicts
	randBytes := make([]byte, 16)
	rand.Read(randBytes)
	newFileName := fmt.Sprintf("%x%s", randBytes, filepath.Ext(handler.Filename))

	dst, err := os.Create(filepath.Join("./uploads", newFileName))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// 4. Copy the uploaded file to the destination file
	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 5. Return the file path
	filePath := "/uploads/" + newFileName
	response := map[string]string{"filePath": filePath}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}
