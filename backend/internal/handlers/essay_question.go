package handlers

import (
	"api-backend/internal/models"
	"api-backend/internal/services"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"

	"github.com/gorilla/mux"
)

// EssayQuestionHandlers holds dependencies for essay question-related handlers.
type EssayQuestionHandlers struct {
	Service                    *services.EssayQuestionService
	MaterialService            *services.MaterialService
	ClassTeachingModuleService *services.ClassTeachingModuleService
	AIService                  *services.AIService
}

// NewEssayQuestionHandlers creates a new instance of EssayQuestionHandlers.
func NewEssayQuestionHandlers(
	s *services.EssayQuestionService,
	ms *services.MaterialService,
	ctm *services.ClassTeachingModuleService,
	ai *services.AIService,
) *EssayQuestionHandlers {
	return &EssayQuestionHandlers{
		Service:                    s,
		MaterialService:            ms,
		ClassTeachingModuleService: ctm,
		AIService:                  ai,
	}
}

// CreateEssayQuestionHandler handles the creation of a new essay question.
func (h *EssayQuestionHandlers) CreateEssayQuestionHandler(w http.ResponseWriter, r *http.Request) {
	var req models.CreateEssayQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Optional: Add validation for req fields here if needed

	createdQuestion, err := h.Service.CreateEssayQuestion(&req)
	if err != nil {
		log.Printf("ERROR: Failed to create essay question: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create essay question")
		return
	}

	respondWithJSON(w, http.StatusCreated, createdQuestion)
	services.PublishNotificationInvalidation("essay_question_created", []string{"teacher", "student"}, nil)
}

// GetEssayQuestionsByMaterialIDHandler handles fetching all essay questions for a given material.
func (h *EssayQuestionHandlers) GetEssayQuestionsByMaterialIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	materialID, ok := vars["materialId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Material ID is missing from URL")
		return
	}

	questions, err := h.Service.GetEssayQuestionsByMaterialID(materialID)
	if err != nil {
		log.Printf("ERROR: Failed to get essay questions for material %s: %v", materialID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve essay questions")
		return
	}

	respondWithJSON(w, http.StatusOK, questions)
}

// UpdateEssayQuestionHandler handles updating an existing essay question.
func (h *EssayQuestionHandlers) UpdateEssayQuestionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	questionID, ok := vars["questionId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Question ID is missing from URL")
		return
	}

	var req models.UpdateEssayQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	updatedQuestion, err := h.Service.UpdateEssayQuestion(questionID, &req)
	if err != nil {
		log.Printf("ERROR: Failed to update essay question %s: %v", questionID, err)
		if err.Error() == "essay question not found" {
			respondWithError(w, http.StatusNotFound, "Essay question not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to update essay question")
		return
	}

	respondWithJSON(w, http.StatusOK, updatedQuestion)
	services.PublishNotificationInvalidation("essay_question_updated", []string{"teacher", "student"}, nil)
}

// DeleteEssayQuestionHandler handles deleting an essay question by its ID.
func (h *EssayQuestionHandlers) DeleteEssayQuestionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	questionID, ok := vars["questionId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Question ID is missing from URL")
		return
	}

	err := h.Service.DeleteEssayQuestion(questionID)
	if err != nil {
		log.Printf("ERROR: Failed to delete essay question %s: %v", questionID, err)
		// Check for a specific "not found" error from the service
		if err.Error() == "essay question not found with ID "+questionID {
			respondWithError(w, http.StatusNotFound, "Essay question not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to delete essay question")
		return
	}

	w.WriteHeader(http.StatusNoContent) // 204 No Content for successful deletion
}

// GetEssayQuestionByIDHandler handles fetching a single essay question by its ID.
func (h *EssayQuestionHandlers) GetEssayQuestionByIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	questionID, ok := vars["questionId"]
	if !ok {
		respondWithError(w, http.StatusBadRequest, "Question ID is missing from URL")
		return
	}

	question, err := h.Service.GetEssayQuestionByID(questionID)
	if err != nil {
		log.Printf("ERROR: Failed to get essay question %s: %v", questionID, err)
		if err.Error() == "essay question not found" {
			respondWithError(w, http.StatusNotFound, "Essay question not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve essay question")
		return
	}

	respondWithJSON(w, http.StatusOK, question)
}

type materialBlocksPayload struct {
	Format string `json:"format"`
	Blocks []struct {
		Type  string `json:"type"`
		Value string `json:"value"`
	} `json:"blocks"`
}

type sectionCardsPayload struct {
	Format string `json:"format"`
	Items  []struct {
		ID    string `json:"id"`
		Type  string `json:"type"`
		Title string `json:"title"`
		Body  string `json:"body"`
		Meta  struct {
			MateriMode        string `json:"materi_mode"`
			MateriDescription string `json:"materi_description"`
		} `json:"meta"`
	} `json:"items"`
}

func extractSectionMaterialCardText(raw *string, cardID string) (string, string, bool) {
	if raw == nil || strings.TrimSpace(*raw) == "" || strings.TrimSpace(cardID) == "" {
		return "", "", false
	}
	var parsed sectionCardsPayload
	if err := json.Unmarshal([]byte(strings.TrimSpace(*raw)), &parsed); err != nil {
		return "", "", false
	}
	if parsed.Format != "sage_section_cards_v1" {
		return "", "", false
	}
	for _, item := range parsed.Items {
		if strings.TrimSpace(item.ID) != strings.TrimSpace(cardID) {
			continue
		}
		if strings.TrimSpace(item.Type) != "materi" {
			return strings.TrimSpace(item.Title), "", false
		}
		bodyText := compactSpaces(htmlTagRegex.ReplaceAllString(strings.TrimSpace(item.Body), " "))
		descText := compactSpaces(htmlTagRegex.ReplaceAllString(strings.TrimSpace(item.Meta.MateriDescription), " "))
		text := bodyText
		if strings.TrimSpace(item.Meta.MateriMode) == "lengkap" {
			// Mode lengkap sering memiliki ringkasan pendek pada materi_description.
			// Gunakan teks yang lebih kaya agar konteks AI tidak terlalu minim.
			if len([]rune(descText)) > len([]rune(text)) {
				text = descText
			}
		}
		return strings.TrimSpace(item.Title), text, strings.TrimSpace(text) != ""
	}
	return "", "", false
}

const (
	maxSingleMaterialChars = 12000
	maxClassMaterialsChars = 18000
	maxTeachingModuleChars = 9000
)

var htmlTagRegex = regexp.MustCompile(`<[^>]+>`)

func clampTextForAIPrompt(value string, maxChars int) string {
	if maxChars <= 0 {
		return strings.TrimSpace(value)
	}
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	runes := []rune(trimmed)
	if len(runes) <= maxChars {
		return trimmed
	}
	return strings.TrimSpace(string(runes[:maxChars])) + "..."
}

func normalizeMaterialToPlainText(raw *string) string {
	if raw == nil {
		return ""
	}
	trimmed := strings.TrimSpace(*raw)
	if trimmed == "" {
		return ""
	}

	var sectionParsed sectionCardsPayload
	if err := json.Unmarshal([]byte(trimmed), &sectionParsed); err == nil && sectionParsed.Format == "sage_section_cards_v1" {
		var b strings.Builder
		for _, item := range sectionParsed.Items {
			if strings.TrimSpace(item.Type) != "materi" {
				continue
			}
			bodyText := compactSpaces(htmlTagRegex.ReplaceAllString(strings.TrimSpace(item.Body), " "))
			descText := compactSpaces(htmlTagRegex.ReplaceAllString(strings.TrimSpace(item.Meta.MateriDescription), " "))
			text := bodyText
			if strings.TrimSpace(item.Meta.MateriMode) == "lengkap" && len([]rune(descText)) > len([]rune(bodyText)) {
				text = descText
			}
			if text == "" {
				continue
			}
			b.WriteString(text)
			b.WriteString("\n")
		}
		return strings.TrimSpace(b.String())
	}

	var parsed materialBlocksPayload
	if err := json.Unmarshal([]byte(trimmed), &parsed); err != nil {
		text := htmlTagRegex.ReplaceAllString(trimmed, " ")
		return compactSpaces(text)
	}
	if parsed.Format != "sage_blocks" || len(parsed.Blocks) == 0 {
		text := htmlTagRegex.ReplaceAllString(trimmed, " ")
		return compactSpaces(text)
	}

	var b strings.Builder
	for _, block := range parsed.Blocks {
		text := strings.TrimSpace(block.Value)
		if text == "" {
			continue
		}
		switch block.Type {
		case "paragraph", "heading", "bullet_list", "number_list":
			b.WriteString(text)
			b.WriteString("\n")
		}
	}
	return strings.TrimSpace(b.String())
}

func compactSpaces(s string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(s)), " ")
}

func normalizeQuestionKeywords(raw *string) []string {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return nil
	}
	parts := strings.Split(*raw, ",")
	keywords := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.ToLower(strings.TrimSpace(part))
		if trimmed == "" {
			continue
		}
		keywords = append(keywords, trimmed)
	}
	return keywords
}

func isTaskSupportQuestion(q models.EssayQuestion) bool {
	for _, keyword := range normalizeQuestionKeywords(q.Keywords) {
		if keyword == "tugas_submission" {
			return true
		}
	}
	return false
}

func buildTeachingModuleContext(modules []models.ClassTeachingModule) string {
	if len(modules) == 0 {
		return ""
	}

	var b strings.Builder
	added := 0
	for i, m := range modules {
		if strings.TrimSpace(m.NamaModul) == "" {
			continue
		}
		b.WriteString(fmt.Sprintf("Modul %d: %s\n", i+1, strings.TrimSpace(m.NamaModul)))
		extracted, err := services.ExtractTextFromUploadedPDF(m.FileURL)
		if err != nil {
			b.WriteString("(Teks PDF belum bisa diekstrak, gunakan metadata modul saja)\n\n")
			continue
		}

		extracted = clampTextForAIPrompt(extracted, 1800)
		b.WriteString(extracted)
		b.WriteString("\n\n")
		added++
		if added >= 3 {
			break
		}
	}
	return clampTextForAIPrompt(strings.TrimSpace(b.String()), maxTeachingModuleChars)
}

func buildClassMaterialsContext(materials []models.Material) (string, int) {
	if len(materials) == 0 {
		return "", 0
	}

	var b strings.Builder
	added := 0
	for _, m := range materials {
		text := normalizeMaterialToPlainText(m.IsiMateri)
		text = strings.TrimSpace(text)
		if text == "" {
			continue
		}
		text = clampTextForAIPrompt(text, 2500)
		b.WriteString(fmt.Sprintf("[MATERI: %s]\n%s\n\n", strings.TrimSpace(m.Judul), text))
		added++
		if len([]rune(b.String())) >= maxClassMaterialsChars {
			break
		}
	}

	return clampTextForAIPrompt(strings.TrimSpace(b.String()), maxClassMaterialsChars), added
}

// AutoGenerateEssayQuestionHandler membuat draft soal essay otomatis dari isi materi.
func (h *EssayQuestionHandlers) AutoGenerateEssayQuestionHandler(w http.ResponseWriter, r *http.Request) {
	if h.AIService == nil {
		respondWithError(w, http.StatusServiceUnavailable, "AI service is unavailable")
		return
	}
	if h.MaterialService == nil {
		respondWithError(w, http.StatusInternalServerError, "Material service is unavailable")
		return
	}

	vars := mux.Vars(r)
	materialID, ok := vars["materialId"]
	if !ok || materialID == "" {
		respondWithError(w, http.StatusBadRequest, "Material ID is missing from URL")
		return
	}

	var req models.AutoGenerateEssayQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	material, err := h.MaterialService.GetMaterialByID(materialID)
	if err != nil {
		log.Printf("ERROR: Failed to get material %s for auto-generate question: %v", materialID, err)
		if err.Error() == "material not found" {
			respondWithError(w, http.StatusNotFound, "Material not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve material")
		return
	}

	plainContent := normalizeMaterialToPlainText(material.IsiMateri)
	materialTitle := material.Judul
	sourceLabel := fmt.Sprintf("SECTION: %s", strings.TrimSpace(material.Judul))

	if req.ReferenceSectionCardID != nil && strings.TrimSpace(*req.ReferenceSectionCardID) != "" {
		cardTitle, cardText, ok := extractSectionMaterialCardText(material.IsiMateri, strings.TrimSpace(*req.ReferenceSectionCardID))
		if !ok {
			respondWithError(w, http.StatusBadRequest, "Card materi acuan tidak ditemukan atau tidak memiliki konten teks")
			return
		}
		cardChars := len([]rune(strings.TrimSpace(cardText)))
		// Jika konten card terlalu pendek, fallback ke teks section agar AI punya konteks cukup.
		if cardChars < 80 {
			plainContent = normalizeMaterialToPlainText(material.IsiMateri)
			log.Printf("INFO: Card source too short, fallback to section text. material_id=%s card_id=%s card_chars=%d section_chars=%d", materialID, strings.TrimSpace(*req.ReferenceSectionCardID), cardChars, len([]rune(strings.TrimSpace(plainContent))))
		} else {
			plainContent = cardText
			log.Printf("INFO: Card source selected. material_id=%s card_id=%s card_chars=%d", materialID, strings.TrimSpace(*req.ReferenceSectionCardID), cardChars)
		}
		plainContent = clampTextForAIPrompt(plainContent, maxSingleMaterialChars)
		if strings.TrimSpace(cardTitle) != "" {
			materialTitle = fmt.Sprintf("%s - %s", strings.TrimSpace(material.Judul), strings.TrimSpace(cardTitle))
			sourceLabel = fmt.Sprintf("CARD: %s", strings.TrimSpace(cardTitle))
		} else {
			sourceLabel = "CARD: Materi"
		}
	} else if req.ReferenceMaterialID != nil && strings.TrimSpace(*req.ReferenceMaterialID) != "" {
		refID := strings.TrimSpace(*req.ReferenceMaterialID)
		if refID != material.ID {
			refMaterial, refErr := h.MaterialService.GetMaterialByID(refID)
			if refErr != nil {
				log.Printf("ERROR: Failed to get reference material %s for auto-generate: %v", refID, refErr)
				if refErr.Error() == "material not found" {
					respondWithError(w, http.StatusNotFound, "Reference material not found")
					return
				}
				respondWithError(w, http.StatusInternalServerError, "Failed to retrieve reference material")
				return
			}
			if refMaterial.ClassID != material.ClassID {
				respondWithError(w, http.StatusBadRequest, "Reference material must be from the same class")
				return
			}
			materialTitle = refMaterial.Judul
			plainContent = normalizeMaterialToPlainText(refMaterial.IsiMateri)
			sourceLabel = fmt.Sprintf("SECTION: %s", strings.TrimSpace(refMaterial.Judul))
		}
		if strings.TrimSpace(plainContent) == "" {
			respondWithError(w, http.StatusBadRequest, "Materi acuan terpilih belum memiliki isi materi")
			return
		}
		plainContent = clampTextForAIPrompt(plainContent, maxSingleMaterialChars)
	} else {
		if strings.TrimSpace(plainContent) == "" {
			respondWithError(w, http.StatusBadRequest, "Materi ini belum memiliki isi yang bisa dijadikan acuan")
			return
		}
		plainContent = clampTextForAIPrompt(plainContent, maxSingleMaterialChars)
	}

	rubricType := strings.ToLower(strings.TrimSpace(req.RubricType))
	if rubricType != "holistik" && rubricType != "analitik" {
		rubricType = "analitik"
	}
	targetLevel := strings.ToUpper(strings.TrimSpace(func() string {
		if req.LevelKognitif == nil {
			return ""
		}
		return *req.LevelKognitif
	}()))
	if targetLevel != "" && targetLevel != "C1" && targetLevel != "C2" && targetLevel != "C3" && targetLevel != "C4" {
		respondWithError(w, http.StatusBadRequest, "level_kognitif harus C1, C2, C3, atau C4")
		return
	}

	// RAG source dibatasi hanya dari teks materi.
	// Konten non-teks seperti media/embed/pdf, termasuk modul PDF kelas, diabaikan.
	teachingModuleContext := ""
	log.Printf("INFO: Auto-generate source resolved. material_id=%s title=%q chars=%d level=%q", materialID, materialTitle, len([]rune(strings.TrimSpace(plainContent))), targetLevel)
	if len([]rune(strings.TrimSpace(plainContent))) < 20 {
		respondWithError(w, http.StatusBadRequest, "Konten materi acuan terlalu pendek. Tambahkan isi materi lebih lengkap sebelum generate.")
		return
	}

	existingQuestions, err := h.Service.GetEssayQuestionsByMaterialID(materialID)
	if err != nil {
		log.Printf("ERROR: Failed to load existing essay questions for material %s: %v", materialID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve existing essay questions")
		return
	}
	existingQuestionTexts := make([]string, 0, len(existingQuestions))
	for _, q := range existingQuestions {
		if isTaskSupportQuestion(q) {
			continue
		}
		text := strings.TrimSpace(q.TeksSoal)
		if text == "" {
			continue
		}
		existingQuestionTexts = append(existingQuestionTexts, text)
	}

	draft, err := h.AIService.GenerateEssayQuestionFromMaterial(materialTitle, plainContent, rubricType, targetLevel, teachingModuleContext, existingQuestionTexts)
	if err != nil {
		log.Printf("ERROR: Failed generating essay question draft for material %s: %v", materialID, err)
		respondWithError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to auto-generate question: %v", err))
		return
	}
	draft.SourceLabel = sourceLabel
	draft.SourceChars = len([]rune(strings.TrimSpace(plainContent)))
	draft.SourcePreview = clampTextForAIPrompt(strings.TrimSpace(plainContent), 280)

	respondWithJSON(w, http.StatusOK, draft)
}

// AutoGenerateEssayMetadataHandler membuat rubrik/jawaban ideal dari soal yang sudah ditulis guru.
func (h *EssayQuestionHandlers) AutoGenerateEssayMetadataHandler(w http.ResponseWriter, r *http.Request) {
	if h.AIService == nil {
		respondWithError(w, http.StatusServiceUnavailable, "AI service is unavailable")
		return
	}
	if h.MaterialService == nil {
		respondWithError(w, http.StatusInternalServerError, "Material service is unavailable")
		return
	}

	vars := mux.Vars(r)
	materialID, ok := vars["materialId"]
	if !ok || materialID == "" {
		respondWithError(w, http.StatusBadRequest, "Material ID is missing from URL")
		return
	}

	var req models.AutoGenerateEssayMetadataRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if strings.TrimSpace(req.TeksSoal) == "" {
		respondWithError(w, http.StatusBadRequest, "teks_soal is required")
		return
	}

	material, err := h.MaterialService.GetMaterialByID(materialID)
	if err != nil {
		log.Printf("ERROR: Failed to get material %s for auto-generate metadata: %v", materialID, err)
		if err.Error() == "material not found" {
			respondWithError(w, http.StatusNotFound, "Material not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve material")
		return
	}

	plainContent := normalizeMaterialToPlainText(material.IsiMateri)
	materialTitle := material.Judul
	sourceLabel := fmt.Sprintf("SECTION: %s", strings.TrimSpace(material.Judul))

	if req.ReferenceSectionCardID != nil && strings.TrimSpace(*req.ReferenceSectionCardID) != "" {
		cardTitle, cardText, ok := extractSectionMaterialCardText(material.IsiMateri, strings.TrimSpace(*req.ReferenceSectionCardID))
		if !ok {
			respondWithError(w, http.StatusBadRequest, "Card materi acuan tidak ditemukan atau tidak memiliki konten teks")
			return
		}
		cardChars := len([]rune(strings.TrimSpace(cardText)))
		if cardChars < 80 {
			plainContent = normalizeMaterialToPlainText(material.IsiMateri)
			log.Printf("INFO: Card source too short, fallback to section text. material_id=%s card_id=%s card_chars=%d section_chars=%d", materialID, strings.TrimSpace(*req.ReferenceSectionCardID), cardChars, len([]rune(strings.TrimSpace(plainContent))))
		} else {
			plainContent = cardText
			log.Printf("INFO: Card source selected. material_id=%s card_id=%s card_chars=%d", materialID, strings.TrimSpace(*req.ReferenceSectionCardID), cardChars)
		}
		plainContent = clampTextForAIPrompt(plainContent, maxSingleMaterialChars)
		if strings.TrimSpace(cardTitle) != "" {
			materialTitle = fmt.Sprintf("%s - %s", strings.TrimSpace(material.Judul), strings.TrimSpace(cardTitle))
			sourceLabel = fmt.Sprintf("CARD: %s", strings.TrimSpace(cardTitle))
		} else {
			sourceLabel = "CARD: Materi"
		}
	} else if req.ReferenceMaterialID != nil && strings.TrimSpace(*req.ReferenceMaterialID) != "" {
		refID := strings.TrimSpace(*req.ReferenceMaterialID)
		if refID != material.ID {
			refMaterial, refErr := h.MaterialService.GetMaterialByID(refID)
			if refErr != nil {
				log.Printf("ERROR: Failed to get reference material %s for auto-generate metadata: %v", refID, refErr)
				if refErr.Error() == "material not found" {
					respondWithError(w, http.StatusNotFound, "Reference material not found")
					return
				}
				respondWithError(w, http.StatusInternalServerError, "Failed to retrieve reference material")
				return
			}
			if refMaterial.ClassID != material.ClassID {
				respondWithError(w, http.StatusBadRequest, "Reference material must be from the same class")
				return
			}
			materialTitle = refMaterial.Judul
			plainContent = normalizeMaterialToPlainText(refMaterial.IsiMateri)
			sourceLabel = fmt.Sprintf("SECTION: %s", strings.TrimSpace(refMaterial.Judul))
		}
		if strings.TrimSpace(plainContent) == "" {
			respondWithError(w, http.StatusBadRequest, "Materi acuan terpilih belum memiliki isi materi")
			return
		}
		plainContent = clampTextForAIPrompt(plainContent, maxSingleMaterialChars)
	} else {
		if strings.TrimSpace(plainContent) == "" {
			respondWithError(w, http.StatusBadRequest, "Materi ini belum memiliki isi yang bisa dijadikan acuan")
			return
		}
		plainContent = clampTextForAIPrompt(plainContent, maxSingleMaterialChars)
	}

	rubricType := strings.ToLower(strings.TrimSpace(req.RubricType))
	if rubricType != "holistik" && rubricType != "analitik" {
		rubricType = "analitik"
	}
	targetLevel := strings.ToUpper(strings.TrimSpace(func() string {
		if req.LevelKognitif == nil {
			return ""
		}
		return *req.LevelKognitif
	}()))
	if targetLevel != "" && targetLevel != "C1" && targetLevel != "C2" && targetLevel != "C3" && targetLevel != "C4" {
		respondWithError(w, http.StatusBadRequest, "level_kognitif harus C1, C2, C3, atau C4")
		return
	}

	teachingModuleContext := ""
	log.Printf("INFO: Auto-generate metadata source resolved. material_id=%s title=%q chars=%d level=%q", materialID, materialTitle, len([]rune(strings.TrimSpace(plainContent))), targetLevel)
	if len([]rune(strings.TrimSpace(plainContent))) < 20 {
		respondWithError(w, http.StatusBadRequest, "Konten materi acuan terlalu pendek. Tambahkan isi materi lebih lengkap sebelum generate.")
		return
	}

	draft, err := h.AIService.GenerateEssayQuestionMetadataFromMaterial(materialTitle, plainContent, req.TeksSoal, rubricType, targetLevel, teachingModuleContext)
	if err != nil {
		log.Printf("ERROR: Failed generating essay metadata for material %s: %v", materialID, err)
		respondWithError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to auto-generate metadata: %v", err))
		return
	}
	draft.TeksSoal = strings.TrimSpace(req.TeksSoal)
	draft.SourceLabel = sourceLabel
	draft.SourceChars = len([]rune(strings.TrimSpace(plainContent)))
	draft.SourcePreview = clampTextForAIPrompt(strings.TrimSpace(plainContent), 280)

	respondWithJSON(w, http.StatusOK, draft)
}
