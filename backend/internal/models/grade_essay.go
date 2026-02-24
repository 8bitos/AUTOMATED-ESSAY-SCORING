package models

import "encoding/json" // Mengimpor package encoding/json untuk bekerja dengan JSON.

// GradeEssayRequest mendefinisikan struktur data untuk permintaan penilaian esai.
// Struktur ini kemungkinan besar digunakan untuk mengirimkan data esai ke model AI untuk dinilai.
type GradeEssayRequest struct {
	Question    string          `json:"question"`          // Pertanyaan esai yang diberikan.
	Keywords    string          `json:"keywords,omitempty"`// Kata kunci yang relevan untuk penilaian (opsional).
	IdealAnswer string          `json:"ideal_answer,omitempty"`// Jawaban ideal atau contoh (opsional).
	Rubric      json.RawMessage `json:"rubric"`            // Rubrik penilaian dalam format JSON mentah.
	Essay       string          `json:"essay"`             // Teks esai yang akan dinilai.
}

// GradeEssayResponse mendefinisikan struktur data untuk respons dari proses penilaian esai.
// Ini adalah hasil yang diharapkan dari model AI.
type GradeEssayResponse struct {
	Score        string                  `json:"score"`                    // Skor yang diberikan pada esai.
	Feedback     string                  `json:"feedback"`                 // Umpan balik tekstual tentang esai.
	AspectScores []GradeEssayAspectScore `json:"aspect_scores,omitempty"`  // Skor per aspek rubrik.
}

// GradeEssayAspectScore merepresentasikan skor AI untuk satu aspek rubrik.
type GradeEssayAspectScore struct {
	Aspek         string `json:"aspek"`
	SkorDiperoleh int    `json:"skor_diperoleh"`
}
