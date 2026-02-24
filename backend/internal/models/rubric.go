package models

// Rubric merepresentasikan aspek rubrik penilaian untuk sebuah pertanyaan esai.
// Struktur ini berkorespondensi dengan tabel `rubrics` di database.
type Rubric struct {
	ID         string            `json:"id"`           // ID unik rubrik, biasanya UUID.
	QuestionID string            `json:"question_id"`  // ID pertanyaan esai yang terkait dengan rubrik ini (Foreign Key ke tabel essay_questions).
	NamaAspek  string            `json:"nama_aspek"`   // Nama aspek penilaian (misalnya, "Koherensi", "Tata Bahasa").
	Deskripsi  *string           `json:"deskripsi,omitempty"` // Deskripsi aspek penilaian (opsional).
	MaxScore   int               `json:"max_score"`    // Skor maksimum yang dapat dicapai untuk aspek ini.
	Descriptors map[int]string   `json:"descriptors"`  // Deskriptor skor, memetakan skor (int) ke deskripsi tekstual (string).
	Bobot      float64           `json:"bobot"`        // Bobot aspek ini dalam penilaian keseluruhan.
}

// CreateRubricRequest mendefinisikan struktur data untuk permintaan pembuatan rubrik baru.
type CreateRubricRequest struct {
	QuestionID  string            `json:"question_id"`  // ID pertanyaan esai terkait.
	NamaAspek   string            `json:"nama_aspek"`   // Nama aspek rubrik.
	Deskripsi   *string           `json:"deskripsi,omitempty"` // Deskripsi aspek (opsional).
	MaxScore    int               `json:"max_score"`    // Skor maksimum aspek.
	Descriptors map[int]string   `json:"descriptors"`  // Deskriptor skor.
	Bobot       float64           `json:"bobot"`        // Bobot aspek.
}

// UpdateRubricRequest mendefinisikan struktur data untuk permintaan pembaruan rubrik yang sudah ada.
// Semua field bersifat opsional (pointer dan omitempty) karena tidak semua field mungkin diperbarui.
type UpdateRubricRequest struct {
	NamaAspek   *string           `json:"nama_aspek,omitempty"`    // Pointer ke string untuk nama aspek (opsional).
	Deskripsi   *string           `json:"deskripsi,omitempty"`     // Pointer ke string untuk deskripsi (opsional).
	MaxScore    *int              `json:"max_score,omitempty"`     // Pointer ke int untuk skor maksimum (opsional).
	Descriptors *map[int]string   `json:"descriptors,omitempty"`   // Pointer ke map untuk deskriptor skor (opsional).
	Bobot       *float64          `json:"bobot,omitempty"`         // Pointer ke float64 untuk bobot (opsional).
}