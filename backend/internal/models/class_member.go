package models

import "time" // Mengimpor package time untuk timestamp.

// ClassMember merepresentasikan keanggotaan seorang siswa dalam sebuah kelas.
// Struktur ini berkorespondensi dengan tabel `class_members` di database.
type ClassMember struct {
	ID              string     `json:"id"`                         // ID siswa.
	MemberID        string     `json:"member_id,omitempty"`        // ID record keanggotaan kelas.
	ClassID         string     `json:"class_id"`                   // ID kelas tempat siswa menjadi anggota (Foreign Key ke tabel classes).
	UserID          string     `json:"user_id"`                    // ID siswa yang menjadi anggota (Foreign Key ke tabel users).
	StudentName     string     `json:"student_name"`               // Nama siswa. Ini adalah field denormalized untuk kemudahan tampilan di layanan.
	StudentEmail    string     `json:"student_email"`              // Email siswa. Ini juga field denormalized untuk kemudahan tampilan di layanan.
	StudentUsername *string    `json:"student_username,omitempty"` // Username siswa.
	FotoProfilURL   *string    `json:"foto_profil_url,omitempty"`  // URL foto profil siswa.
	NomorIdentitas  *string    `json:"nomor_identitas,omitempty"`  // NIS/NISN/nomor identitas.
	KelasTingkat    *string    `json:"kelas_tingkat,omitempty"`    // Kelas siswa (contoh: 11 B).
	Institusi       *string    `json:"institusi,omitempty"`        // Asal institusi/sekolah.
	TanggalLahir    *time.Time `json:"tanggal_lahir,omitempty"`    // Tanggal lahir siswa.
	LastLoginAt     *time.Time `json:"last_login_at,omitempty"`    // Aktivitas login terakhir.
	Status          string     `json:"status,omitempty"`           // approved/pending/rejected.
	RequestedAt     time.Time  `json:"requested_at,omitempty"`     // Waktu request join.
	ApprovedAt      *time.Time `json:"approved_at,omitempty"`      // Waktu approval join.
	JoinedAt        time.Time  `json:"joined_at"`                  // Timestamp ketika siswa bergabung dengan kelas.
}
