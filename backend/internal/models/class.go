package models

import (
	"math/rand" // Mengimpor package rand untuk menghasilkan angka acak.
	"time"      // Mengimpor package time untuk fungsi terkait waktu (digunakan untuk seeding rand).
)

// Class merepresentasikan sebuah kelas atau kursus dalam sistem.
// Struktur ini berkorespondensi dengan tabel `classes` di database.
type Class struct {
	ID          string     `json:"id"`                     // ID unik kelas, biasanya UUID.
	TeacherID   string     `json:"pengajar_id"`            // ID pengguna yang mengajar kelas ini (Foreign Key ke tabel users).
	TeacherName string     `json:"teacher_name,omitempty"` // Nama guru pengampu/pembuat kelas.
	ClassName   string     `json:"class_name"`             // Nama kelas (misalnya, "Matematika Dasar").
	Description string     `json:"deskripsi"`              // Deskripsi singkat tentang kelas.
	ClassCode   string     `json:"class_code"`             // Kode unik kelas untuk bergabung.
	IsArchived  bool       `json:"is_archived"`            // Status arsip kelas.
	CreatedAt   time.Time  `json:"created_at"`             // Timestamp ketika kelas dibuat.
	UpdatedAt   time.Time  `json:"updated_at"`             // Timestamp terakhir kali kelas diperbarui.
	Materials   []Material `json:"materials,omitempty"`    // Daftar materi yang terkait dengan kelas ini (opsional untuk output JSON).
}

// CreateClassRequest mendefinisikan struktur data untuk permintaan pembuatan kelas baru.
// Ini adalah data yang diharapkan diterima dari client saat membuat kelas.
type CreateClassRequest struct {
	ClassName   string `json:"nama_kelas"` // Nama kelas yang akan dibuat.
	Description string `json:"deskripsi"`  // Deskripsi kelas.
}

// JoinClassRequest mendefinisikan struktur data untuk permintaan bergabung ke kelas.
// Pengguna perlu menyediakan kode kelas untuk bergabung.
type JoinClassRequest struct {
	ClassCode string `json:"class_code"` // Kode kelas yang ingin diikuti.
}

// InviteStudentRequest untuk guru mengundang siswa (by email/username).
type InviteStudentRequest struct {
	Identifier string `json:"identifier"`           // email atau username siswa.
	StudentID  string `json:"student_id,omitempty"` // id siswa (untuk UI popup list).
}

// ReviewJoinRequest untuk approve/reject permintaan join kelas.
type ReviewJoinRequest struct {
	Action string `json:"action"` // "approve" atau "reject"
}

// UpdateClassRequest untuk update metadata kelas oleh guru.
type UpdateClassRequest struct {
	ClassName   *string `json:"nama_kelas,omitempty"`
	Description *string `json:"deskripsi,omitempty"`
	IsArchived  *bool   `json:"is_archived,omitempty"`
}

// StudentOption untuk daftar kandidat siswa pada popup invite.
type StudentOption struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// TeacherDashboardSummary untuk ringkasan cepat dashboard guru.
type TeacherDashboardSummary struct {
	TotalClasses       int        `json:"total_classes"`
	TotalStudents      int        `json:"total_students"`
	TotalMaterials     int        `json:"total_materials"`
	MaterialsThisWeek  int        `json:"materials_this_week"`
	PendingJoinCount   int        `json:"pending_join_count"`
	LatestClassID      *string    `json:"latest_class_id,omitempty"`
	LatestClassName    *string    `json:"latest_class_name,omitempty"`
	LatestClassAt      *time.Time `json:"latest_class_at,omitempty"`
	LatestMaterialID   *string    `json:"latest_material_id,omitempty"`
	LatestMaterialName *string    `json:"latest_material_name,omitempty"`
	LatestMaterialAt   *time.Time `json:"latest_material_at,omitempty"`
}

// PendingClassJoin merepresentasikan kelas yang sedang menunggu approval join siswa.
type PendingClassJoin struct {
	ClassID     string    `json:"class_id"`
	ClassName   string    `json:"class_name"`
	ClassCode   string    `json:"class_code"`
	TeacherID   string    `json:"teacher_id"`
	TeacherName string    `json:"teacher_name"`
	Status      string    `json:"status"`
	RequestedAt time.Time `json:"requested_at"`
}

// GenerateClassCode menghasilkan kode kelas alfanumerik unik dengan panjang 6 karakter.
// Kode ini digunakan agar siswa dapat bergabung ke kelas.
func GenerateClassCode() string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" // Karakter yang diizinkan untuk kode kelas.
	// Menginisialisasi generator angka acak dengan seed berdasarkan waktu saat ini
	// untuk memastikan kode yang dihasilkan unik setiap kali.
	seededRand := rand.New(rand.NewSource(time.Now().UnixNano()))
	b := make([]byte, 6) // Membuat slice byte sepanjang 6 untuk menampung kode.
	for i := range b {
		// Mengisi setiap posisi dengan karakter acak dari charset.
		b[i] = charset[seededRand.Intn(len(charset))]
	}
	return string(b) // Mengembalikan kode kelas sebagai string.
}
