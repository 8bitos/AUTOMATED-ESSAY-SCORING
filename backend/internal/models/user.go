package models

import (
	"encoding/json"
	"github.com/golang-jwt/jwt/v5" // Mengimpor package JWT untuk definisi klaim.
	"time"                         // Mengimpor package time untuk timestamp.
)

// Claims merepresentasikan data yang disimpan dalam token JWT (JSON Web Token).
// Data ini digunakan untuk otentikasi dan otorisasi pengguna.
type Claims struct {
	UserID               string `json:"user_id"`   // ID unik pengguna.
	UserName             string `json:"user_name"` // Nama pengguna.
	UserRole             string `json:"user_role"` // Peran pengguna (misalnya, student, teacher, superadmin).
	IsTeacherVerified    bool   `json:"is_teacher_verified"`
	jwt.RegisteredClaims        // Klaim standar JWT seperti Issuer, Subject, Audience, Expiration, dll.
}

// User merepresentasikan sebuah entitas pengguna dalam sistem,
// yang berkorespondensi langsung dengan tabel 'users' di database.
type User struct {
	ID                    string     `json:"id"`                                // ID unik pengguna, biasanya UUID.
	NamaLengkap           string     `json:"nama_lengkap"`                      // Nama lengkap pengguna.
	Email                 string     `json:"email"`                             // Alamat email pengguna, harus unik.
	Password              string     `json:"-"`                                 // Password pengguna (hashed). Tag "-" mengecualikannya dari output JSON.
	Peran                 string     `json:"peran"`                             // Peran pengguna (misalnya: teacher, student, superadmin).
	NomorIdentitas        *string    `json:"nomor_identitas,omitempty"`         // Nomor identitas pengguna (opsional, bisa NULL di DB). "omitempty" berarti tidak disertakan jika nilainya kosong.
	Username              *string    `json:"username"`                          // Username pengguna (opsional, bisa NULL di DB).
	FotoProfilURL         *string    `json:"foto_profil_url,omitempty"`         // URL foto profil (opsional).
	MataPelajaran         *string    `json:"mata_pelajaran,omitempty"`          // Mata pelajaran (opsional, guru).
	MataPelajaranTambahan *string    `json:"mata_pelajaran_tambahan,omitempty"` // Mata pelajaran tambahan (opsional, guru).
	PengalamanMengajar    *int       `json:"pengalaman_mengajar,omitempty"`     // Pengalaman mengajar dalam tahun (opsional, guru).
	TingkatAjar           *string    `json:"tingkat_ajar,omitempty"`            // Tingkat yang diajar: contoh "10,11,12" (opsional).
	RombelAktif           *string    `json:"rombel_aktif,omitempty"`            // Rombel aktif: contoh "10A,10B" (opsional).
	IsWaliKelas           *bool      `json:"is_wali_kelas,omitempty"`           // Status wali kelas (opsional).
	NoWhatsapp            *string    `json:"no_whatsapp,omitempty"`             // Nomor WhatsApp (opsional).
	BioSingkat            *string    `json:"bio_singkat,omitempty"`             // Bio singkat guru (opsional).
	KelasTingkat          *string    `json:"kelas_tingkat,omitempty"`           // Kelas/tingkat (opsional, siswa).
	Institusi             *string    `json:"institusi,omitempty"`               // Institusi/sekolah (opsional).
	TanggalLahir          *time.Time `json:"tanggal_lahir,omitempty"`           // Tanggal lahir (opsional).
	Bahasa                *string    `json:"bahasa,omitempty"`                  // Preferensi bahasa (opsional).
	NotifEmail            *bool      `json:"notif_email,omitempty"`             // Preferensi notifikasi email.
	NotifInApp            *bool      `json:"notif_inapp,omitempty"`             // Preferensi notifikasi in-app.
	IsTeacherVerified     bool       `json:"is_teacher_verified"`
	LastLoginAt           *time.Time `json:"last_login_at,omitempty"` // Waktu login terakhir.
	CreatedAt             time.Time  `json:"created_at"`              // Timestamp ketika akun pengguna dibuat.
}

// UserRegisterRequest mendefinisikan struktur data untuk permintaan registrasi pengguna baru.
// Ini adalah data yang diharapkan diterima dari client saat pendaftaran.
type UserRegisterRequest struct {
	NamaLengkap    string `json:"nama_lengkap"`
	Email          string `json:"email"`
	Password       string `json:"password"`
	Peran          string `json:"peran"`
	NomorIdentitas string `json:"nomor_identitas,omitempty"` // Field opsional.
	Username       string `json:"username"`                  // Field opsional.
}

// UserLoginRequest mendefinisikan struktur data untuk permintaan login pengguna.
// Field 'identifier' dapat berupa username atau email pengguna.
type UserLoginRequest struct {
	Identifier string `json:"identifier"` // Username atau email pengguna.
	Password   string `json:"password"`   // Password pengguna.
}

// UserLoginResponse adalah struktur respons untuk permintaan login.
// Catatan: Struktur ini disebut sebagai "deprecated" dalam kode asli,
// yang menunjukkan bahwa sistem mungkin sekarang mengelola otentikasi melalui cookie HttpOnly
// dan mengembalikan objek User secara langsung daripada token di body respons.
type UserLoginResponse struct {
	Token string `json:"token"` // Token JWT yang dihasilkan setelah login berhasil.
}

// UpdateProfileRequest mendefinisikan field yang dapat diperbarui oleh pengguna.
type UpdateProfileRequest struct {
	NamaLengkap           *string `json:"nama_lengkap,omitempty"`
	Email                 *string `json:"email,omitempty"`
	Username              *string `json:"username,omitempty"`
	NomorIdentitas        *string `json:"nomor_identitas,omitempty"`
	FotoProfilURL         *string `json:"foto_profil_url,omitempty"`
	MataPelajaran         *string `json:"mata_pelajaran,omitempty"`
	MataPelajaranTambahan *string `json:"mata_pelajaran_tambahan,omitempty"`
	PengalamanMengajar    *int    `json:"pengalaman_mengajar,omitempty"`
	TingkatAjar           *string `json:"tingkat_ajar,omitempty"`
	RombelAktif           *string `json:"rombel_aktif,omitempty"`
	IsWaliKelas           *bool   `json:"is_wali_kelas,omitempty"`
	NoWhatsapp            *string `json:"no_whatsapp,omitempty"`
	BioSingkat            *string `json:"bio_singkat,omitempty"`
	KelasTingkat          *string `json:"kelas_tingkat,omitempty"`
	Institusi             *string `json:"institusi,omitempty"`
	TanggalLahir          *string `json:"tanggal_lahir,omitempty"` // YYYY-MM-DD
	Bahasa                *string `json:"bahasa,omitempty"`
	NotifEmail            *bool   `json:"notif_email,omitempty"`
	NotifInApp            *bool   `json:"notif_inapp,omitempty"`
}

// ChangePasswordRequest mendefinisikan struktur data untuk perubahan password.
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// ProfileChangeRequest represents a pending profile change request.
type ProfileChangeRequest struct {
	ID               string          `json:"id"`
	UserID           string          `json:"user_id"`
	RequestType      string          `json:"request_type"`
	UserName         *string         `json:"user_name,omitempty"`
	UserEmail        *string         `json:"user_email,omitempty"`
	UserRole         *string         `json:"user_role,omitempty"`
	RequestedChanges json.RawMessage `json:"requested_changes"`
	Status           string          `json:"status"`
	Reason           *string         `json:"reason,omitempty"`
	ReviewerID       *string         `json:"reviewer_id,omitempty"`
	ReviewerName     *string         `json:"reviewer_name,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	ReviewedAt       *time.Time      `json:"reviewed_at,omitempty"`
}

type AdminDashboardSummary struct {
	TotalStudents         int `json:"total_students"`
	TotalTeachers         int `json:"total_teachers"`
	TotalClassesActive    int `json:"total_classes_active"`
	TotalMaterials        int `json:"total_materials"`
	SubmissionsToday      int `json:"submissions_today"`
	PendingProfileRequest int `json:"pending_profile_requests"`
}

type AdminUserItem struct {
	ID                string     `json:"id"`
	NamaLengkap       string     `json:"nama_lengkap"`
	Email             string     `json:"email"`
	Peran             string     `json:"peran"`
	IsTeacherVerified bool       `json:"is_teacher_verified"`
	Username          *string    `json:"username,omitempty"`
	NomorIdentitas    *string    `json:"nomor_identitas,omitempty"`
	FotoProfilURL     *string    `json:"foto_profil_url,omitempty"`
	KelasTingkat      *string    `json:"kelas_tingkat,omitempty"`
	MataPelajaran     *string    `json:"mata_pelajaran,omitempty"`
	Institusi         *string    `json:"institusi,omitempty"`
	LastLoginAt       *time.Time `json:"last_login_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

type AdminUpdateUserRequest struct {
	NamaLengkap       *string `json:"nama_lengkap,omitempty"`
	Email             *string `json:"email,omitempty"`
	Peran             *string `json:"peran,omitempty"`
	Username          *string `json:"username,omitempty"`
	NomorIdentitas    *string `json:"nomor_identitas,omitempty"`
	FotoProfilURL     *string `json:"foto_profil_url,omitempty"`
	MataPelajaran     *string `json:"mata_pelajaran,omitempty"`
	KelasTingkat      *string `json:"kelas_tingkat,omitempty"`
	Institusi         *string `json:"institusi,omitempty"`
	BioSingkat        *string `json:"bio_singkat,omitempty"`
	NoWhatsapp        *string `json:"no_whatsapp,omitempty"`
	TanggalLahir      *string `json:"tanggal_lahir,omitempty"` // YYYY-MM-DD
	IsTeacherVerified *bool   `json:"is_teacher_verified,omitempty"`
}

type AdminUserDetail struct {
	User                *User    `json:"user"`
	TotalSubmissions    int      `json:"total_submissions"`
	AverageScore        *float64 `json:"average_score,omitempty"`
	ReviewedSubmissions int      `json:"reviewed_submissions"`
	ClassesCount        int      `json:"classes_count"`
}

type PublicTeacherProfile struct {
	ID                    string  `json:"id"`
	NamaLengkap           string  `json:"nama_lengkap"`
	FotoProfilURL         *string `json:"foto_profil_url,omitempty"`
	MataPelajaran         *string `json:"mata_pelajaran,omitempty"`
	MataPelajaranTambahan *string `json:"mata_pelajaran_tambahan,omitempty"`
	PengalamanMengajar    *int    `json:"pengalaman_mengajar,omitempty"`
	TingkatAjar           *string `json:"tingkat_ajar,omitempty"`
	RombelAktif           *string `json:"rombel_aktif,omitempty"`
	IsWaliKelas           *bool   `json:"is_wali_kelas,omitempty"`
	Institusi             *string `json:"institusi,omitempty"`
	BioSingkat            *string `json:"bio_singkat,omitempty"`
}
