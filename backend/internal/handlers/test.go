package handlers

import (
	"log"
	"net/http"
)

// TestHandler is a simple handler for debugging purposes.
func TestHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("DEBUG: TestHandler reached successfully!")
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Hello from test handler!"})
}
