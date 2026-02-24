package services

import (
	"api-backend/internal/models" // Mengimpor definisi model pengguna.
	"database/sql"                // Mengimpor package database/sql untuk interaksi DB.
	"encoding/json"
	"fmt" // Mengimpor package fmt untuk format string dan error.
	"log" // Mengimpor package log untuk logging.
	"os"
	"strconv"
	"strings" // Mengimpor package strings untuk membangun query dinamis.
	"time"    // Mengimpor package time untuk timestamp.

	"golang.org/x/crypto/bcrypt" // Mengimpor bcrypt untuk hashing password.
)

// AuthService menyediakan metode untuk otentikasi dan registrasi pengguna.
type AuthService struct {
	db *sql.DB // Koneksi database yang digunakan oleh layanan ini.
}

// NewAuthService membuat instance baru dari AuthService.
// Ini adalah constructor untuk AuthService, menerima koneksi *sql.DB.
func NewAuthService(db *sql.DB) *AuthService {
	return &AuthService{db: db}
}

// AuthenticateUser memverifikasi kredensial pengguna (email/username dan password).
// Mengembalikan objek User jika kredensial valid, atau error jika tidak.
func (s *AuthService) AuthenticateUser(identifier, password string) (*models.User, error) {
	user := &models.User{} // Inisialisasi objek User untuk menampung hasil query.
	// Query untuk mengambil data pengguna berdasarkan email atau username.
	query := `
		SELECT id, nama_lengkap, email, password, peran, username, nomor_identitas,
		       foto_profil_url, mata_pelajaran, mata_pelajaran_tambahan, pengalaman_mengajar, tingkat_ajar, rombel_aktif, is_wali_kelas, no_whatsapp, bio_singkat, kelas_tingkat, institusi, tanggal_lahir,
		       bahasa, notif_email, notif_inapp, is_teacher_verified, last_login_at, created_at
		FROM users
		WHERE email = $1 OR username = $1
	`

	// Variabel sql.NullString digunakan untuk menangani kolom database yang bisa NULL.
	var username sql.NullString
	var nomorIdentitas sql.NullString
	var fotoProfilURL sql.NullString
	var mataPelajaran sql.NullString
	var mataPelajaranTambahan sql.NullString
	var pengalamanMengajar sql.NullInt64
	var tingkatAjar sql.NullString
	var rombelAktif sql.NullString
	var isWaliKelas sql.NullBool
	var noWhatsapp sql.NullString
	var bioSingkat sql.NullString
	var kelasTingkat sql.NullString
	var institusi sql.NullString
	var tanggalLahir sql.NullTime
	var bahasa sql.NullString
	var notifEmail sql.NullBool
	var notifInApp sql.NullBool
	var lastLoginAt sql.NullTime

	// Menjalankan query dan memindai hasilnya ke dalam field-field objek user.
	err := s.db.QueryRow(query, identifier).Scan(
		&user.ID,
		&user.NamaLengkap,
		&user.Email,
		&user.Password, // Password yang sudah di-hash dari DB.
		&user.Peran,
		&username,       // Hasil scan untuk username yang bisa NULL.
		&nomorIdentitas, // Hasil scan untuk nomor_identitas yang bisa NULL.
		&fotoProfilURL,
		&mataPelajaran,
		&mataPelajaranTambahan,
		&pengalamanMengajar,
		&tingkatAjar,
		&rombelAktif,
		&isWaliKelas,
		&noWhatsapp,
		&bioSingkat,
		&kelasTingkat,
		&institusi,
		&tanggalLahir,
		&bahasa,
		&notifEmail,
		&notifInApp,
		&user.IsTeacherVerified,
		&lastLoginAt,
		&user.CreatedAt,
	)

	// Menangani kasus jika pengguna tidak ditemukan.
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("invalid credentials")
	}
	// Menangani error lain saat query database.
	if err != nil {
		return nil, fmt.Errorf("error querying user: %w", err)
	}

	// Mengonversi sql.NullString ke tipe *string untuk model pengguna.
	if username.Valid {
		user.Username = &username.String
	}
	if nomorIdentitas.Valid {
		user.NomorIdentitas = &nomorIdentitas.String
	}
	if fotoProfilURL.Valid {
		user.FotoProfilURL = &fotoProfilURL.String
	}
	if mataPelajaran.Valid {
		user.MataPelajaran = &mataPelajaran.String
	}
	if mataPelajaranTambahan.Valid {
		user.MataPelajaranTambahan = &mataPelajaranTambahan.String
	}
	if pengalamanMengajar.Valid {
		v := int(pengalamanMengajar.Int64)
		user.PengalamanMengajar = &v
	}
	if tingkatAjar.Valid {
		user.TingkatAjar = &tingkatAjar.String
	}
	if rombelAktif.Valid {
		user.RombelAktif = &rombelAktif.String
	}
	if isWaliKelas.Valid {
		user.IsWaliKelas = &isWaliKelas.Bool
	}
	if noWhatsapp.Valid {
		user.NoWhatsapp = &noWhatsapp.String
	}
	if bioSingkat.Valid {
		user.BioSingkat = &bioSingkat.String
	}
	if kelasTingkat.Valid {
		user.KelasTingkat = &kelasTingkat.String
	}
	if institusi.Valid {
		user.Institusi = &institusi.String
	}
	if tanggalLahir.Valid {
		user.TanggalLahir = &tanggalLahir.Time
	}
	if bahasa.Valid {
		user.Bahasa = &bahasa.String
	}
	if notifEmail.Valid {
		user.NotifEmail = &notifEmail.Bool
	}
	if notifInApp.Valid {
		user.NotifInApp = &notifInApp.Bool
	}
	if lastLoginAt.Valid {
		user.LastLoginAt = &lastLoginAt.Time
	}

	// Membandingkan password yang diberikan pengguna dengan password yang di-hash di database.
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return nil, fmt.Errorf("invalid credentials") // Password tidak cocok.
	}

	// Update last_login_at setelah login berhasil.
	if _, err := s.db.Exec("UPDATE users SET last_login_at = $1 WHERE id = $2", time.Now(), user.ID); err != nil {
		log.Printf("WARNING: Failed to update last_login_at for user %s: %v", user.ID, err)
	}

	// Kosongkan password dari objek user sebelum dikembalikan untuk keamanan.
	user.Password = ""
	return user, nil
}

// RegisterUser membuat pengguna baru di database dari data permintaan registrasi.
// Mengembalikan objek User yang baru dibuat, atau error jika ada masalah (misalnya, email/username sudah ada).
func (s *AuthService) RegisterUser(req models.UserRegisterRequest) (*models.User, error) {
	// Memeriksa apakah email atau username sudah terdaftar.
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM users WHERE email = $1 OR username = $2", req.Email, req.Username).Scan(&count)
	if err != nil {
		log.Printf("ERROR: Failed to check for existing user: %v", err)
		return nil, fmt.Errorf("error checking for existing user: %w", err)
	}
	if count > 0 {
		return nil, fmt.Errorf("email or username already exists") // Jika sudah ada, kembalikan error.
	}

	// Meng-hash password yang diberikan pengguna.
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("ERROR: Failed to hash password: %v", err)
		return nil, fmt.Errorf("error hashing password: %w", err)
	}

	// Membuat objek User baru dengan data dari permintaan.
	newUser := &models.User{
		NamaLengkap:       req.NamaLengkap,
		Email:             req.Email,
		Password:          string(hashedPassword), // Simpan password yang sudah di-hash.
		Peran:             req.Peran,
		IsTeacherVerified: req.Peran != "teacher",
		CreatedAt:         time.Now(),
	}

	// Menangani field username dan nomor_identitas yang bersifat nullable.
	if req.Username != "" {
		newUser.Username = &req.Username
	}
	if req.NomorIdentitas != "" {
		newUser.NomorIdentitas = &req.NomorIdentitas
	}

	// Query INSERT untuk menambahkan pengguna baru ke tabel 'users'.
	query := `
		INSERT INTO users (nama_lengkap, email, password, peran, username, nomor_identitas, is_teacher_verified, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at
	`
	// Menjalankan query dan mengembalikan ID serta CreatedAt dari pengguna yang baru dibuat.
	err = s.db.QueryRow(query,
		newUser.NamaLengkap,
		newUser.Email,
		newUser.Password,
		newUser.Peran,
		newUser.Username,
		newUser.NomorIdentitas,
		newUser.IsTeacherVerified,
		newUser.CreatedAt,
	).Scan(&newUser.ID, &newUser.CreatedAt)

	if err != nil {
		log.Printf("ERROR: Failed to insert new user: %v", err)
		return nil, fmt.Errorf("error inserting new user: %w", err)
	}

	// Kosongkan password dari objek user sebelum dikembalikan untuk keamanan.
	newUser.Password = ""

	if newUser.Peran == "teacher" {
		requestPayload, _ := json.Marshal(map[string]interface{}{
			"is_teacher_verified": true,
		})
		if err := s.createApprovalRequest(newUser.ID, "teacher_verification", requestPayload); err != nil {
			log.Printf("WARNING: failed to create teacher verification request for user %s: %v", newUser.ID, err)
		}
	}

	return newUser, nil
}

// GetUserByID mengambil detail pengguna berdasarkan ID mereka.
// Mengembalikan objek User atau error jika pengguna tidak ditemukan atau ada error DB.
func (s *AuthService) GetUserByID(userID string) (*models.User, error) {
	user := &models.User{} // Inisialisasi objek User.
	// Query untuk mengambil data pengguna berdasarkan ID.
	query := `
		SELECT id, nama_lengkap, email, peran, nomor_identitas, username,
		       foto_profil_url, mata_pelajaran, mata_pelajaran_tambahan, pengalaman_mengajar, tingkat_ajar, rombel_aktif, is_wali_kelas, no_whatsapp, bio_singkat, kelas_tingkat, institusi, tanggal_lahir,
		       bahasa, notif_email, notif_inapp, is_teacher_verified, last_login_at, created_at
		FROM users
		WHERE id = $1
	`

	// Variabel sql.NullString untuk menangani kolom yang bisa NULL.
	var username sql.NullString
	var nomorIdentitas sql.NullString
	var fotoProfilURL sql.NullString
	var mataPelajaran sql.NullString
	var mataPelajaranTambahan sql.NullString
	var pengalamanMengajar sql.NullInt64
	var tingkatAjar sql.NullString
	var rombelAktif sql.NullString
	var isWaliKelas sql.NullBool
	var noWhatsapp sql.NullString
	var bioSingkat sql.NullString
	var kelasTingkat sql.NullString
	var institusi sql.NullString
	var tanggalLahir sql.NullTime
	var bahasa sql.NullString
	var notifEmail sql.NullBool
	var notifInApp sql.NullBool
	var lastLoginAt sql.NullTime

	// Menjalankan query dan memindai hasilnya.
	err := s.db.QueryRow(query, userID).Scan(
		&user.ID,
		&user.NamaLengkap,
		&user.Email,
		&user.Peran,
		&nomorIdentitas,
		&username,
		&fotoProfilURL,
		&mataPelajaran,
		&mataPelajaranTambahan,
		&pengalamanMengajar,
		&tingkatAjar,
		&rombelAktif,
		&isWaliKelas,
		&noWhatsapp,
		&bioSingkat,
		&kelasTingkat,
		&institusi,
		&tanggalLahir,
		&bahasa,
		&notifEmail,
		&notifInApp,
		&user.IsTeacherVerified,
		&lastLoginAt,
		&user.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found") // Pengguna tidak ditemukan.
		}
		return nil, fmt.Errorf("error querying user by id: %w", err) // Error query lainnya.
	}

	// Mengonversi sql.NullString ke tipe *string untuk model pengguna.
	if username.Valid {
		user.Username = &username.String
	}
	if nomorIdentitas.Valid {
		user.NomorIdentitas = &nomorIdentitas.String
	}
	if fotoProfilURL.Valid {
		user.FotoProfilURL = &fotoProfilURL.String
	}
	if mataPelajaran.Valid {
		user.MataPelajaran = &mataPelajaran.String
	}
	if mataPelajaranTambahan.Valid {
		user.MataPelajaranTambahan = &mataPelajaranTambahan.String
	}
	if pengalamanMengajar.Valid {
		v := int(pengalamanMengajar.Int64)
		user.PengalamanMengajar = &v
	}
	if tingkatAjar.Valid {
		user.TingkatAjar = &tingkatAjar.String
	}
	if rombelAktif.Valid {
		user.RombelAktif = &rombelAktif.String
	}
	if isWaliKelas.Valid {
		user.IsWaliKelas = &isWaliKelas.Bool
	}
	if noWhatsapp.Valid {
		user.NoWhatsapp = &noWhatsapp.String
	}
	if bioSingkat.Valid {
		user.BioSingkat = &bioSingkat.String
	}
	if kelasTingkat.Valid {
		user.KelasTingkat = &kelasTingkat.String
	}
	if institusi.Valid {
		user.Institusi = &institusi.String
	}
	if tanggalLahir.Valid {
		user.TanggalLahir = &tanggalLahir.Time
	}
	if bahasa.Valid {
		user.Bahasa = &bahasa.String
	}
	if notifEmail.Valid {
		user.NotifEmail = &notifEmail.Bool
	}
	if notifInApp.Valid {
		user.NotifInApp = &notifInApp.Bool
	}
	if lastLoginAt.Valid {
		user.LastLoginAt = &lastLoginAt.Time
	}

	return user, nil
}

// UpdateProfile memperbarui data profil pengguna.
func (s *AuthService) UpdateProfile(userID string, req *models.UpdateProfileRequest) (*models.User, []string, error) {
	currentUser, err := s.GetUserByID(userID)
	if err != nil {
		return nil, nil, err
	}

	updates := []string{}
	args := []interface{}{}
	argID := 1
	pendingChanges := map[string]interface{}{}

	if req.NamaLengkap != nil {
		updates = append(updates, fmt.Sprintf("nama_lengkap = $%d", argID))
		args = append(args, *req.NamaLengkap)
		argID++
	}
	if req.Email != nil {
		email := strings.TrimSpace(*req.Email)
		if email == "" {
			return nil, nil, fmt.Errorf("email cannot be empty")
		}
		var count int
		if err := s.db.QueryRow("SELECT COUNT(*) FROM users WHERE email = $1 AND id <> $2", email, userID).Scan(&count); err != nil {
			return nil, nil, fmt.Errorf("error checking email uniqueness: %w", err)
		}
		if count > 0 {
			return nil, nil, fmt.Errorf("email already exists")
		}
		updates = append(updates, fmt.Sprintf("email = $%d", argID))
		args = append(args, email)
		argID++
	}
	if req.Username != nil {
		username := strings.TrimSpace(*req.Username)
		if username != "" {
			var count int
			if err := s.db.QueryRow("SELECT COUNT(*) FROM users WHERE username = $1 AND id <> $2", username, userID).Scan(&count); err != nil {
				return nil, nil, fmt.Errorf("error checking username uniqueness: %w", err)
			}
			if count > 0 {
				return nil, nil, fmt.Errorf("username already exists")
			}
		}
		updates = append(updates, fmt.Sprintf("username = $%d", argID))
		if username == "" {
			args = append(args, nil)
		} else {
			args = append(args, username)
		}
		argID++
	}
	if req.NomorIdentitas != nil {
		val := strings.TrimSpace(*req.NomorIdentitas)
		if requiresApproval(currentUser.Peran, "nomor_identitas") {
			if val == "" {
				pendingChanges["nomor_identitas"] = nil
			} else {
				pendingChanges["nomor_identitas"] = val
			}
		} else {
			updates = append(updates, fmt.Sprintf("nomor_identitas = $%d", argID))
			if val == "" {
				args = append(args, nil)
			} else {
				args = append(args, val)
			}
			argID++
		}
	}
	if req.FotoProfilURL != nil {
		val := strings.TrimSpace(*req.FotoProfilURL)
		if requiresApproval(currentUser.Peran, "foto_profil_url") {
			if val == "" {
				pendingChanges["foto_profil_url"] = nil
			} else {
				pendingChanges["foto_profil_url"] = val
			}
		} else {
			updates = append(updates, fmt.Sprintf("foto_profil_url = $%d", argID))
			if val == "" {
				args = append(args, nil)
			} else {
				args = append(args, val)
			}
			argID++
		}
	}
	if req.MataPelajaran != nil {
		val := strings.TrimSpace(*req.MataPelajaran)
		if requiresApproval(currentUser.Peran, "mata_pelajaran") {
			if val == "" {
				pendingChanges["mata_pelajaran"] = nil
			} else {
				pendingChanges["mata_pelajaran"] = val
			}
		} else {
			updates = append(updates, fmt.Sprintf("mata_pelajaran = $%d", argID))
			if val == "" {
				args = append(args, nil)
			} else {
				args = append(args, val)
			}
			argID++
		}
	}
	if req.MataPelajaranTambahan != nil {
		val := strings.TrimSpace(*req.MataPelajaranTambahan)
		updates = append(updates, fmt.Sprintf("mata_pelajaran_tambahan = $%d", argID))
		if val == "" {
			args = append(args, nil)
		} else {
			args = append(args, val)
		}
		argID++
	}
	if req.PengalamanMengajar != nil {
		updates = append(updates, fmt.Sprintf("pengalaman_mengajar = $%d", argID))
		if *req.PengalamanMengajar < 0 {
			return nil, nil, fmt.Errorf("pengalaman_mengajar cannot be negative")
		}
		args = append(args, *req.PengalamanMengajar)
		argID++
	}
	if req.TingkatAjar != nil {
		val := strings.TrimSpace(*req.TingkatAjar)
		updates = append(updates, fmt.Sprintf("tingkat_ajar = $%d", argID))
		if val == "" {
			args = append(args, nil)
		} else {
			args = append(args, val)
		}
		argID++
	}
	if req.RombelAktif != nil {
		val := strings.TrimSpace(*req.RombelAktif)
		updates = append(updates, fmt.Sprintf("rombel_aktif = $%d", argID))
		if val == "" {
			args = append(args, nil)
		} else {
			args = append(args, val)
		}
		argID++
	}
	if req.IsWaliKelas != nil {
		updates = append(updates, fmt.Sprintf("is_wali_kelas = $%d", argID))
		args = append(args, *req.IsWaliKelas)
		argID++
	}
	if req.NoWhatsapp != nil {
		val := strings.TrimSpace(*req.NoWhatsapp)
		updates = append(updates, fmt.Sprintf("no_whatsapp = $%d", argID))
		if val == "" {
			args = append(args, nil)
		} else {
			args = append(args, val)
		}
		argID++
	}
	if req.BioSingkat != nil {
		val := strings.TrimSpace(*req.BioSingkat)
		if len(val) > 160 {
			return nil, nil, fmt.Errorf("bio_singkat maksimal 160 karakter")
		}
		updates = append(updates, fmt.Sprintf("bio_singkat = $%d", argID))
		if val == "" {
			args = append(args, nil)
		} else {
			args = append(args, val)
		}
		argID++
	}
	if req.KelasTingkat != nil {
		val := strings.TrimSpace(*req.KelasTingkat)
		if requiresApproval(currentUser.Peran, "kelas_tingkat") {
			if val == "" {
				pendingChanges["kelas_tingkat"] = nil
			} else {
				pendingChanges["kelas_tingkat"] = val
			}
		} else {
			updates = append(updates, fmt.Sprintf("kelas_tingkat = $%d", argID))
			if val == "" {
				args = append(args, nil)
			} else {
				args = append(args, val)
			}
			argID++
		}
	}
	if req.Institusi != nil {
		val := strings.TrimSpace(*req.Institusi)
		if requiresApproval(currentUser.Peran, "institusi") {
			if val == "" {
				pendingChanges["institusi"] = nil
			} else {
				pendingChanges["institusi"] = val
			}
		} else {
			updates = append(updates, fmt.Sprintf("institusi = $%d", argID))
			if val == "" {
				args = append(args, nil)
			} else {
				args = append(args, val)
			}
			argID++
		}
	}
	if req.TanggalLahir != nil {
		val := strings.TrimSpace(*req.TanggalLahir)
		updates = append(updates, fmt.Sprintf("tanggal_lahir = $%d", argID))
		if val == "" {
			args = append(args, nil)
		} else {
			parsed, pErr := time.Parse("2006-01-02", val)
			if pErr != nil {
				return nil, nil, fmt.Errorf("invalid tanggal_lahir format, expected YYYY-MM-DD")
			}
			args = append(args, parsed)
		}
		argID++
	}
	if req.Bahasa != nil {
		updates = append(updates, fmt.Sprintf("bahasa = $%d", argID))
		val := strings.TrimSpace(*req.Bahasa)
		if val == "" {
			args = append(args, nil)
		} else {
			args = append(args, val)
		}
		argID++
	}
	if req.NotifEmail != nil {
		updates = append(updates, fmt.Sprintf("notif_email = $%d", argID))
		args = append(args, *req.NotifEmail)
		argID++
	}
	if req.NotifInApp != nil {
		updates = append(updates, fmt.Sprintf("notif_inapp = $%d", argID))
		args = append(args, *req.NotifInApp)
		argID++
	}

	if len(updates) == 0 && len(pendingChanges) == 0 {
		return nil, nil, fmt.Errorf("no fields to update")
	}

	if len(updates) > 0 {
		query := fmt.Sprintf("UPDATE users SET %s WHERE id = $%d", strings.Join(updates, ", "), argID)
		args = append(args, userID)
		if _, err := s.db.Exec(query, args...); err != nil {
			return nil, nil, fmt.Errorf("error updating profile: %w", err)
		}
	}

	if len(pendingChanges) > 0 {
		raw, err := json.Marshal(pendingChanges)
		if err != nil {
			return nil, nil, fmt.Errorf("error encoding pending changes: %w", err)
		}
		if err := s.createApprovalRequest(userID, "profile_change", raw); err != nil {
			return nil, nil, fmt.Errorf("error creating profile change request: %w", err)
		}
	}

	updated, err := s.GetUserByID(userID)
	if err != nil {
		return nil, nil, err
	}

	pendingFields := []string{}
	for k := range pendingChanges {
		pendingFields = append(pendingFields, k)
	}

	return updated, pendingFields, nil
}

// ChangePassword mengganti password pengguna.
func (s *AuthService) ChangePassword(userID, currentPassword, newPassword string) error {
	if currentPassword == "" || newPassword == "" {
		return fmt.Errorf("current_password and new_password are required")
	}
	if len(newPassword) < 6 {
		return fmt.Errorf("new_password must be at least 6 characters")
	}

	var hashed string
	if err := s.db.QueryRow("SELECT password FROM users WHERE id = $1", userID).Scan(&hashed); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("user not found")
		}
		return fmt.Errorf("error fetching user password: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hashed), []byte(currentPassword)); err != nil {
		return fmt.Errorf("invalid current password")
	}

	newHashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("error hashing password: %w", err)
	}

	if _, err := s.db.Exec("UPDATE users SET password = $1 WHERE id = $2", string(newHashed), userID); err != nil {
		return fmt.Errorf("error updating password: %w", err)
	}

	return nil
}

func (s *AuthService) VerifyPassword(userID, password string) error {
	if strings.TrimSpace(password) == "" {
		return fmt.Errorf("password is required")
	}

	var hashed string
	if err := s.db.QueryRow("SELECT password FROM users WHERE id = $1", userID).Scan(&hashed); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("user not found")
		}
		return fmt.Errorf("error fetching user password: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hashed), []byte(password)); err != nil {
		return fmt.Errorf("invalid password")
	}

	return nil
}

// ListProfileChangeRequests returns profile change requests by status.
func (s *AuthService) ListProfileChangeRequests(status string) ([]models.ProfileChangeRequest, error) {
	if status == "" || status == "pending" {
		if err := s.ensurePendingTeacherVerificationRequests(); err != nil {
			log.Printf("WARNING: failed to backfill teacher verification requests: %v", err)
		}
	}

	hasRequestType, err := s.hasRequestTypeColumn()
	if err != nil {
		return nil, fmt.Errorf("error checking request_type column: %w", err)
	}

	query := ""
	if hasRequestType {
		query = `
			SELECT pcr.id, pcr.user_id, pcr.request_type, u.nama_lengkap, u.email, u.peran::text, pcr.requested_changes, pcr.status,
			       pcr.reason, pcr.reviewer_id, reviewer.nama_lengkap, pcr.created_at, pcr.reviewed_at
			FROM profile_change_requests pcr
			JOIN users u ON u.id = pcr.user_id
			LEFT JOIN users reviewer ON reviewer.id = pcr.reviewer_id
		`
	} else {
		query = `
			SELECT pcr.id, pcr.user_id, u.nama_lengkap, u.email, u.peran::text, pcr.requested_changes, pcr.status,
			       pcr.reason, pcr.reviewer_id, reviewer.nama_lengkap, pcr.created_at, pcr.reviewed_at
			FROM profile_change_requests pcr
			JOIN users u ON u.id = pcr.user_id
			LEFT JOIN users reviewer ON reviewer.id = pcr.reviewer_id
		`
	}
	args := []interface{}{}
	if status != "" {
		query += " WHERE status = $1"
		args = append(args, status)
	}
	query += " ORDER BY created_at DESC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("error querying profile change requests: %w", err)
	}
	defer rows.Close()

	var results []models.ProfileChangeRequest
	for rows.Next() {
		var r models.ProfileChangeRequest
		var userName sql.NullString
		var userEmail sql.NullString
		var userRole sql.NullString
		var reason sql.NullString
		var reviewerID sql.NullString
		var reviewerName sql.NullString
		var reviewedAt sql.NullTime
		if hasRequestType {
			if err := rows.Scan(
				&r.ID,
				&r.UserID,
				&r.RequestType,
				&userName,
				&userEmail,
				&userRole,
				&r.RequestedChanges,
				&r.Status,
				&reason,
				&reviewerID,
				&reviewerName,
				&r.CreatedAt,
				&reviewedAt,
			); err != nil {
				return nil, fmt.Errorf("error scanning request: %w", err)
			}
		} else {
			if err := rows.Scan(
				&r.ID,
				&r.UserID,
				&userName,
				&userEmail,
				&userRole,
				&r.RequestedChanges,
				&r.Status,
				&reason,
				&reviewerID,
				&reviewerName,
				&r.CreatedAt,
				&reviewedAt,
			); err != nil {
				return nil, fmt.Errorf("error scanning request: %w", err)
			}
		}
		r.RequestType = inferRequestType(r.RequestType, r.RequestedChanges)
		if userName.Valid {
			r.UserName = &userName.String
		}
		if userEmail.Valid {
			r.UserEmail = &userEmail.String
		}
		if userRole.Valid {
			r.UserRole = &userRole.String
		}
		if reason.Valid {
			r.Reason = &reason.String
		}
		if reviewerID.Valid {
			r.ReviewerID = &reviewerID.String
		}
		if reviewerName.Valid {
			r.ReviewerName = &reviewerName.String
		}
		if reviewedAt.Valid {
			r.ReviewedAt = &reviewedAt.Time
		}
		results = append(results, r)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating requests: %w", err)
	}

	if results == nil {
		results = []models.ProfileChangeRequest{}
	}

	return results, nil
}

// ListProfileChangeRequestsByUser returns profile change requests for a specific user.
func (s *AuthService) ListProfileChangeRequestsByUser(userID, status string) ([]models.ProfileChangeRequest, error) {
	hasRequestType, err := s.hasRequestTypeColumn()
	if err != nil {
		return nil, fmt.Errorf("error checking request_type column: %w", err)
	}

	query := ""
	if hasRequestType {
		query = `
			SELECT pcr.id, pcr.user_id, pcr.request_type, u.nama_lengkap, u.email, u.peran::text, pcr.requested_changes, pcr.status,
			       pcr.reason, pcr.reviewer_id, reviewer.nama_lengkap, pcr.created_at, pcr.reviewed_at
			FROM profile_change_requests pcr
			JOIN users u ON u.id = pcr.user_id
			LEFT JOIN users reviewer ON reviewer.id = pcr.reviewer_id
			WHERE pcr.user_id = $1
		`
	} else {
		query = `
			SELECT pcr.id, pcr.user_id, u.nama_lengkap, u.email, u.peran::text, pcr.requested_changes, pcr.status,
			       pcr.reason, pcr.reviewer_id, reviewer.nama_lengkap, pcr.created_at, pcr.reviewed_at
			FROM profile_change_requests pcr
			JOIN users u ON u.id = pcr.user_id
			LEFT JOIN users reviewer ON reviewer.id = pcr.reviewer_id
			WHERE pcr.user_id = $1
		`
	}

	args := []interface{}{userID}
	if status != "" {
		query += " AND pcr.status = $2"
		args = append(args, status)
	}
	query += " ORDER BY pcr.created_at DESC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("error querying profile change requests by user: %w", err)
	}
	defer rows.Close()

	var results []models.ProfileChangeRequest
	for rows.Next() {
		var r models.ProfileChangeRequest
		var userName sql.NullString
		var userEmail sql.NullString
		var userRole sql.NullString
		var reason sql.NullString
		var reviewerID sql.NullString
		var reviewerName sql.NullString
		var reviewedAt sql.NullTime
		if hasRequestType {
			if err := rows.Scan(
				&r.ID,
				&r.UserID,
				&r.RequestType,
				&userName,
				&userEmail,
				&userRole,
				&r.RequestedChanges,
				&r.Status,
				&reason,
				&reviewerID,
				&reviewerName,
				&r.CreatedAt,
				&reviewedAt,
			); err != nil {
				return nil, fmt.Errorf("error scanning request: %w", err)
			}
		} else {
			if err := rows.Scan(
				&r.ID,
				&r.UserID,
				&userName,
				&userEmail,
				&userRole,
				&r.RequestedChanges,
				&r.Status,
				&reason,
				&reviewerID,
				&reviewerName,
				&r.CreatedAt,
				&reviewedAt,
			); err != nil {
				return nil, fmt.Errorf("error scanning request: %w", err)
			}
		}

		r.RequestType = inferRequestType(r.RequestType, r.RequestedChanges)
		if userName.Valid {
			r.UserName = &userName.String
		}
		if userEmail.Valid {
			r.UserEmail = &userEmail.String
		}
		if userRole.Valid {
			r.UserRole = &userRole.String
		}
		if reason.Valid {
			r.Reason = &reason.String
		}
		if reviewerID.Valid {
			r.ReviewerID = &reviewerID.String
		}
		if reviewerName.Valid {
			r.ReviewerName = &reviewerName.String
		}
		if reviewedAt.Valid {
			r.ReviewedAt = &reviewedAt.Time
		}
		results = append(results, r)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating requests: %w", err)
	}

	if results == nil {
		results = []models.ProfileChangeRequest{}
	}

	return results, nil
}

// ReviewProfileChangeRequest approves or rejects a request.
func (s *AuthService) ReviewProfileChangeRequest(requestID, reviewerID, action, reason string) error {
	var userID string
	var requestedChanges []byte
	var status string
	var requestType string

	hasRequestType, err := s.hasRequestTypeColumn()
	if err != nil {
		return fmt.Errorf("error checking request_type column: %w", err)
	}

	if hasRequestType {
		err = s.db.QueryRow(
			`SELECT user_id, request_type, requested_changes, status FROM profile_change_requests WHERE id = $1`,
			requestID,
		).Scan(&userID, &requestType, &requestedChanges, &status)
	} else {
		err = s.db.QueryRow(
			`SELECT user_id, requested_changes, status FROM profile_change_requests WHERE id = $1`,
			requestID,
		).Scan(&userID, &requestedChanges, &status)
		requestType = inferRequestType("", requestedChanges)
	}
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("request not found")
		}
		return fmt.Errorf("error fetching request: %w", err)
	}

	if status != "pending" {
		return fmt.Errorf("request already reviewed")
	}

	if action == "reject" {
		if requestType == "teacher_verification" {
			if _, err := s.db.Exec(`UPDATE users SET is_teacher_verified = FALSE WHERE id = $1`, userID); err != nil {
				return fmt.Errorf("error updating teacher verification status: %w", err)
			}
		}
		_, err := s.db.Exec(
			`UPDATE profile_change_requests SET status = 'rejected', reason = $1, reviewer_id = $2, reviewed_at = $3 WHERE id = $4`,
			reason, reviewerID, time.Now(), requestID,
		)
		if err != nil {
			return fmt.Errorf("error rejecting request: %w", err)
		}
		return nil
	}

	if action != "approve" {
		return fmt.Errorf("invalid action")
	}

	if requestType == "teacher_verification" {
		if _, err := s.db.Exec(`UPDATE users SET is_teacher_verified = TRUE WHERE id = $1`, userID); err != nil {
			return fmt.Errorf("error updating teacher verification status: %w", err)
		}
	} else {
		var changes map[string]interface{}
		if err := json.Unmarshal(requestedChanges, &changes); err != nil {
			return fmt.Errorf("invalid requested changes")
		}

		updates := []string{}
		args := []interface{}{}
		argID := 1
		for field, value := range changes {
			updates = append(updates, fmt.Sprintf("%s = $%d", field, argID))
			args = append(args, value)
			argID++
		}

		if len(updates) > 0 {
			query := fmt.Sprintf("UPDATE users SET %s WHERE id = $%d", strings.Join(updates, ", "), argID)
			args = append(args, userID)
			if _, err := s.db.Exec(query, args...); err != nil {
				return fmt.Errorf("error applying changes: %w", err)
			}
		}
	}

	if _, err := s.db.Exec(
		`UPDATE profile_change_requests SET status = 'approved', reason = $1, reviewer_id = $2, reviewed_at = $3 WHERE id = $4`,
		reason, reviewerID, time.Now(), requestID,
	); err != nil {
		return fmt.Errorf("error approving request: %w", err)
	}

	return nil
}

func (s *AuthService) GetAdminDashboardSummary() (*models.AdminDashboardSummary, error) {
	summary := &models.AdminDashboardSummary{}
	if err := s.db.QueryRow(`
		SELECT
		  COUNT(*) FILTER (WHERE peran = 'student') AS total_students,
		  COUNT(*) FILTER (WHERE peran = 'teacher') AS total_teachers
		FROM users
	`).Scan(&summary.TotalStudents, &summary.TotalTeachers); err != nil {
		return nil, fmt.Errorf("error loading users summary: %w", err)
	}

	if err := s.db.QueryRow(`SELECT COUNT(*) FROM classes WHERE is_archived = FALSE`).Scan(&summary.TotalClassesActive); err != nil {
		return nil, fmt.Errorf("error loading classes summary: %w", err)
	}
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM materials`).Scan(&summary.TotalMaterials); err != nil {
		return nil, fmt.Errorf("error loading materials summary: %w", err)
	}
	if err := s.db.QueryRow(`
		SELECT COUNT(*)
		FROM essay_submissions
		WHERE DATE(submitted_at AT TIME ZONE 'Asia/Jakarta') = DATE(NOW() AT TIME ZONE 'Asia/Jakarta')
	`).Scan(&summary.SubmissionsToday); err != nil {
		return nil, fmt.Errorf("error loading submissions summary: %w", err)
	}
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM profile_change_requests WHERE status = 'pending'`).Scan(&summary.PendingProfileRequest); err != nil {
		return nil, fmt.Errorf("error loading pending profile requests summary: %w", err)
	}
	return summary, nil
}

func (s *AuthService) GetAdminAPIStatistics(days int) (*models.AdminAPIStatisticsResponse, error) {
	if days <= 0 {
		days = 7
	}
	if days > 30 {
		days = 30
	}

	resp := &models.AdminAPIStatisticsResponse{
		DailyUsage:       []models.APIUsageDailyPoint{},
		FeatureBreakdown: []models.APIUsageFeatureBreakdown{},
		StatusBreakdown:  []models.APIUsageStatusBreakdown{},
		RecentLogs:       []models.APIUsageRecentLog{},
	}

	dailyLimit := int64(0)
	if value := strings.TrimSpace(os.Getenv("GEMINI_DAILY_TOKEN_LIMIT")); value != "" {
		if parsed, parseErr := strconv.ParseInt(value, 10, 64); parseErr == nil && parsed > 0 {
			dailyLimit = parsed
		}
	}
	parseEnvInt := func(key string, fallback int64) int64 {
		value := strings.TrimSpace(os.Getenv(key))
		if value == "" {
			return fallback
		}
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || parsed <= 0 {
			return fallback
		}
		return parsed
	}
	resp.Summary.RPMLimit = parseEnvInt("GEMINI_LIMIT_RPM", 5)
	resp.Summary.TPMLimit = parseEnvInt("GEMINI_LIMIT_TPM", 250000)
	resp.Summary.RPDLimit = parseEnvInt("GEMINI_LIMIT_RPD", 20)

	if err := s.db.QueryRow(`
		SELECT
			COALESCE(COUNT(*), 0) AS requests_today,
			COALESCE(SUM(prompt_tokens), 0) AS today_prompt_tokens,
			COALESCE(SUM(candidates_tokens), 0) AS today_output_tokens,
			COALESCE(SUM(total_tokens), 0) AS today_total_tokens
		FROM ai_api_usage_logs
		WHERE DATE(created_at AT TIME ZONE 'Asia/Jakarta') = DATE(NOW() AT TIME ZONE 'Asia/Jakarta')
	`).Scan(&resp.Summary.RequestsToday, &resp.Summary.TodayPromptToken, &resp.Summary.TodayOutputToken, &resp.Summary.TodayTotalTokens); err != nil {
		return nil, fmt.Errorf("error loading AI api today summary: %w", err)
	}
	resp.Summary.RPDUsed = resp.Summary.RequestsToday

	if err := s.db.QueryRow(`
		SELECT COALESCE(COUNT(*), 0)
		FROM ai_api_usage_logs
		WHERE created_at >= NOW() - INTERVAL '1 minute'
	`).Scan(&resp.Summary.RPMUsed); err != nil {
		return nil, fmt.Errorf("error loading AI api rpm usage: %w", err)
	}
	if err := s.db.QueryRow(`
		SELECT COALESCE(SUM(total_tokens), 0)
		FROM ai_api_usage_logs
		WHERE created_at >= NOW() - INTERVAL '1 minute'
	`).Scan(&resp.Summary.TPMUsed); err != nil {
		return nil, fmt.Errorf("error loading AI api tpm usage: %w", err)
	}

	if err := s.db.QueryRow(`
		SELECT
			COALESCE(COUNT(*), 0) AS requests_30d,
			COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) AS success_30d,
			COALESCE(AVG(response_time_ms), 0) AS avg_response_ms_30d
		FROM ai_api_usage_logs
		WHERE created_at >= NOW() - INTERVAL '30 days'
	`).Scan(&resp.Summary.Requests30Days, &resp.Summary.SuccessRate30D, &resp.Summary.AvgResponseMs30D); err != nil {
		return nil, fmt.Errorf("error loading AI api 30d summary: %w", err)
	}
	if resp.Summary.Requests30Days > 0 {
		resp.Summary.SuccessRate30D = (resp.Summary.SuccessRate30D / float64(resp.Summary.Requests30Days)) * 100
		resp.Summary.ErrorRate30D = 100 - resp.Summary.SuccessRate30D
	} else {
		resp.Summary.SuccessRate30D = 0
		resp.Summary.ErrorRate30D = 0
	}
	resp.Summary.DailyTokenLimit = dailyLimit
	if dailyLimit > 0 {
		remaining := dailyLimit - resp.Summary.TodayTotalTokens
		if remaining < 0 {
			remaining = 0
		}
		resp.Summary.TokensRemaining = remaining
	}

	rowsDaily, err := s.db.Query(`
		WITH days AS (
			SELECT generate_series(
				DATE(NOW() AT TIME ZONE 'Asia/Jakarta') - ($1::int - 1),
				DATE(NOW() AT TIME ZONE 'Asia/Jakarta'),
				INTERVAL '1 day'
			) AS day
		)
		SELECT
			TO_CHAR(days.day, 'YYYY-MM-DD') AS date,
			COALESCE(COUNT(logs.id), 0) AS requests,
			COALESCE(SUM(logs.prompt_tokens), 0) AS prompt_tokens,
			COALESCE(SUM(logs.candidates_tokens), 0) AS candidates_tokens,
			COALESCE(SUM(logs.total_tokens), 0) AS total_tokens
		FROM days
		LEFT JOIN ai_api_usage_logs logs
		  ON DATE(logs.created_at AT TIME ZONE 'Asia/Jakarta') = days.day
		GROUP BY days.day
		ORDER BY days.day ASC
	`, days)
	if err != nil {
		return nil, fmt.Errorf("error loading AI api daily usage: %w", err)
	}
	defer rowsDaily.Close()
	for rowsDaily.Next() {
		var item models.APIUsageDailyPoint
		if err := rowsDaily.Scan(&item.Date, &item.Requests, &item.PromptTokens, &item.CandidatesTokens, &item.TotalTokens); err != nil {
			return nil, fmt.Errorf("error scanning AI api daily usage row: %w", err)
		}
		resp.DailyUsage = append(resp.DailyUsage, item)
	}
	if err := rowsDaily.Err(); err != nil {
		return nil, fmt.Errorf("error iterating AI api daily usage rows: %w", err)
	}

	rowsFeature, err := s.db.Query(`
		SELECT
			feature,
			COUNT(*) AS requests,
			SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_requests,
			COALESCE(SUM(total_tokens), 0) AS total_tokens,
			COALESCE(AVG(response_time_ms), 0) AS avg_response_ms
		FROM ai_api_usage_logs
		WHERE created_at >= NOW() - INTERVAL '30 days'
		GROUP BY feature
		ORDER BY requests DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("error loading AI api feature breakdown: %w", err)
	}
	defer rowsFeature.Close()
	for rowsFeature.Next() {
		var item models.APIUsageFeatureBreakdown
		if err := rowsFeature.Scan(&item.Feature, &item.Requests, &item.SuccessRequests, &item.TotalTokens, &item.AvgResponseMs); err != nil {
			return nil, fmt.Errorf("error scanning AI api feature breakdown row: %w", err)
		}
		resp.FeatureBreakdown = append(resp.FeatureBreakdown, item)
	}
	if err := rowsFeature.Err(); err != nil {
		return nil, fmt.Errorf("error iterating AI api feature breakdown rows: %w", err)
	}

	rowsStatus, err := s.db.Query(`
		SELECT status, COUNT(*) AS requests
		FROM ai_api_usage_logs
		WHERE created_at >= NOW() - INTERVAL '30 days'
		GROUP BY status
		ORDER BY requests DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("error loading AI api status breakdown: %w", err)
	}
	defer rowsStatus.Close()
	for rowsStatus.Next() {
		var item models.APIUsageStatusBreakdown
		if err := rowsStatus.Scan(&item.Status, &item.Requests); err != nil {
			return nil, fmt.Errorf("error scanning AI api status breakdown row: %w", err)
		}
		resp.StatusBreakdown = append(resp.StatusBreakdown, item)
	}
	if err := rowsStatus.Err(); err != nil {
		return nil, fmt.Errorf("error iterating AI api status breakdown rows: %w", err)
	}

	rowsRecent, err := s.db.Query(`
		SELECT feature, model_name, status, error_type, error_message, prompt_tokens, candidates_tokens, total_tokens, response_time_ms, created_at
		FROM ai_api_usage_logs
		ORDER BY created_at DESC
		LIMIT 20
	`)
	if err != nil {
		return nil, fmt.Errorf("error loading AI api recent logs: %w", err)
	}
	defer rowsRecent.Close()
	for rowsRecent.Next() {
		var item models.APIUsageRecentLog
		var errorType sql.NullString
		var errorMessage sql.NullString
		if err := rowsRecent.Scan(
			&item.Feature,
			&item.ModelName,
			&item.Status,
			&errorType,
			&errorMessage,
			&item.PromptTokens,
			&item.CandidatesTokens,
			&item.TotalTokens,
			&item.ResponseTimeMs,
			&item.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning AI api recent log row: %w", err)
		}
		if errorType.Valid {
			item.ErrorType = &errorType.String
		}
		if errorMessage.Valid {
			item.ErrorMessage = &errorMessage.String
		}
		resp.RecentLogs = append(resp.RecentLogs, item)
	}
	if err := rowsRecent.Err(); err != nil {
		return nil, fmt.Errorf("error iterating AI api recent logs rows: %w", err)
	}

	return resp, nil
}

func (s *AuthService) GetAdminAPIHealth() (*models.AdminAPIHealthResponse, error) {
	resp := &models.AdminAPIHealthResponse{
		TopErrorTypes: []models.APIErrorTypeCount{},
	}

	if err := s.db.QueryRow(`
		SELECT COALESCE(
			PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms),
			0
		)
		FROM ai_api_usage_logs
		WHERE created_at >= NOW() - INTERVAL '24 hours'
	`).Scan(&resp.LatencyP95Ms); err != nil {
		return nil, fmt.Errorf("error loading AI api p95 latency: %w", err)
	}

	var (
		total24h   int64
		success24h int64
	)
	if err := s.db.QueryRow(`
		SELECT
			COALESCE(COUNT(*), 0) AS total,
			COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) AS success
		FROM ai_api_usage_logs
		WHERE created_at >= NOW() - INTERVAL '24 hours'
	`).Scan(&total24h, &success24h); err != nil {
		return nil, fmt.Errorf("error loading AI api 24h success rate: %w", err)
	}
	if total24h > 0 {
		resp.ErrorRate24H = (1 - (float64(success24h) / float64(total24h))) * 100
	}

	rows, err := s.db.Query(`
		SELECT COALESCE(NULLIF(error_type, ''), 'unknown') AS error_type, COUNT(*) AS count
		FROM ai_api_usage_logs
		WHERE created_at >= NOW() - INTERVAL '24 hours'
		  AND status <> 'success'
		GROUP BY COALESCE(NULLIF(error_type, ''), 'unknown')
		ORDER BY count DESC
		LIMIT 5
	`)
	if err != nil {
		return nil, fmt.Errorf("error loading AI api top errors: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var item models.APIErrorTypeCount
		if scanErr := rows.Scan(&item.ErrorType, &item.Count); scanErr != nil {
			return nil, fmt.Errorf("error scanning AI api top error row: %w", scanErr)
		}
		resp.TopErrorTypes = append(resp.TopErrorTypes, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating AI api top error rows: %w", err)
	}

	return resp, nil
}

func (s *AuthService) ListUsersForAdmin(role, query, sort string) ([]models.AdminUserItem, error) {
	baseQuery := `
		SELECT id, nama_lengkap, email, peran::text, is_teacher_verified, username, nomor_identitas, foto_profil_url,
		       kelas_tingkat, mata_pelajaran, institusi, last_login_at, created_at
		FROM users
	`

	clauses := []string{}
	args := []interface{}{}
	argID := 1
	if role != "" {
		clauses = append(clauses, fmt.Sprintf("peran = $%d", argID))
		args = append(args, role)
		argID++
	}
	q := strings.TrimSpace(query)
	if q != "" {
		clauses = append(clauses, fmt.Sprintf("(LOWER(nama_lengkap) LIKE $%d OR LOWER(email) LIKE $%d OR LOWER(COALESCE(username,'')) LIKE $%d)", argID, argID, argID))
		args = append(args, "%"+strings.ToLower(q)+"%")
		argID++
	}
	if len(clauses) > 0 {
		baseQuery += " WHERE " + strings.Join(clauses, " AND ")
	}
	switch sort {
	case "name_asc":
		baseQuery += " ORDER BY nama_lengkap ASC"
	case "oldest":
		baseQuery += " ORDER BY created_at ASC"
	case "last_login":
		baseQuery += " ORDER BY last_login_at DESC NULLS LAST"
	default:
		baseQuery += " ORDER BY created_at DESC"
	}

	rows, err := s.db.Query(baseQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("error querying admin users: %w", err)
	}
	defer rows.Close()

	items := []models.AdminUserItem{}
	for rows.Next() {
		var item models.AdminUserItem
		var username sql.NullString
		var nomorIdentitas sql.NullString
		var fotoProfilURL sql.NullString
		var kelasTingkat sql.NullString
		var mataPelajaran sql.NullString
		var institusi sql.NullString
		var lastLoginAt sql.NullTime
		if err := rows.Scan(
			&item.ID,
			&item.NamaLengkap,
			&item.Email,
			&item.Peran,
			&item.IsTeacherVerified,
			&username,
			&nomorIdentitas,
			&fotoProfilURL,
			&kelasTingkat,
			&mataPelajaran,
			&institusi,
			&lastLoginAt,
			&item.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning admin user item: %w", err)
		}
		if username.Valid {
			item.Username = &username.String
		}
		if nomorIdentitas.Valid {
			item.NomorIdentitas = &nomorIdentitas.String
		}
		if fotoProfilURL.Valid {
			item.FotoProfilURL = &fotoProfilURL.String
		}
		if kelasTingkat.Valid {
			item.KelasTingkat = &kelasTingkat.String
		}
		if mataPelajaran.Valid {
			item.MataPelajaran = &mataPelajaran.String
		}
		if institusi.Valid {
			item.Institusi = &institusi.String
		}
		if lastLoginAt.Valid {
			item.LastLoginAt = &lastLoginAt.Time
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating admin users: %w", err)
	}
	return items, nil
}

func (s *AuthService) GetAdminUserDetail(userID string) (*models.AdminUserDetail, error) {
	user, err := s.GetUserByID(userID)
	if err != nil {
		return nil, err
	}

	detail := &models.AdminUserDetail{User: user}

	if user.Peran == "student" {
		if err := s.db.QueryRow(`
			SELECT COUNT(*)
			FROM essay_submissions es
			WHERE es.siswa_id = $1
		`, userID).Scan(&detail.TotalSubmissions); err != nil {
			return nil, fmt.Errorf("error loading student submissions count: %w", err)
		}

		var avg sql.NullFloat64
		if err := s.db.QueryRow(`
			SELECT AVG(COALESCE(tr.revised_score, ar.skor_ai))
			FROM essay_submissions es
			LEFT JOIN teacher_reviews tr ON tr.submission_id = es.id
			LEFT JOIN ai_results ar ON ar.submission_id = es.id
			WHERE es.siswa_id = $1
		`, userID).Scan(&avg); err != nil {
			return nil, fmt.Errorf("error loading student avg score: %w", err)
		}
		if avg.Valid {
			detail.AverageScore = &avg.Float64
		}

		if err := s.db.QueryRow(`
			SELECT COUNT(*)
			FROM essay_submissions es
			JOIN teacher_reviews tr ON tr.submission_id = es.id
			WHERE es.siswa_id = $1
		`, userID).Scan(&detail.ReviewedSubmissions); err != nil {
			return nil, fmt.Errorf("error loading reviewed submissions count: %w", err)
		}

		if err := s.db.QueryRow(`
			SELECT COUNT(*)
			FROM class_members
			WHERE user_id = $1 AND status = 'approved'
		`, userID).Scan(&detail.ClassesCount); err != nil {
			return nil, fmt.Errorf("error loading student classes count: %w", err)
		}
		return detail, nil
	}

	if user.Peran == "teacher" {
		if err := s.db.QueryRow(`SELECT COUNT(*) FROM classes WHERE teacher_id = $1 AND is_archived = FALSE`, userID).Scan(&detail.ClassesCount); err != nil {
			return nil, fmt.Errorf("error loading teacher classes count: %w", err)
		}
		if err := s.db.QueryRow(`
			SELECT COUNT(*)
			FROM materials m
			JOIN classes c ON c.id = m.class_id
			WHERE c.teacher_id = $1
		`, userID).Scan(&detail.TotalSubmissions); err != nil {
			return nil, fmt.Errorf("error loading teacher materials count: %w", err)
		}
	}
	return detail, nil
}

func (s *AuthService) AdminResetPassword(userID, newPassword string) error {
	if len(strings.TrimSpace(newPassword)) < 6 {
		return fmt.Errorf("new_password must be at least 6 characters")
	}
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("error hashing password: %w", err)
	}
	result, err := s.db.Exec("UPDATE users SET password = $1 WHERE id = $2", string(hashedPassword), userID)
	if err != nil {
		return fmt.Errorf("error updating password: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

func (s *AuthService) IsTeacherVerified(userID string) (bool, error) {
	var role string
	var isVerified bool
	if err := s.db.QueryRow("SELECT peran::text, is_teacher_verified FROM users WHERE id = $1", userID).Scan(&role, &isVerified); err != nil {
		if err == sql.ErrNoRows {
			return false, fmt.Errorf("user not found")
		}
		return false, fmt.Errorf("error checking teacher verification: %w", err)
	}
	if role != "teacher" {
		return true, nil
	}
	return isVerified, nil
}

func (s *AuthService) SetTeacherVerification(userID string, verified bool, reviewerID string) error {
	var role string
	err := s.db.QueryRow("SELECT peran::text FROM users WHERE id = $1", userID).Scan(&role)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("user not found")
		}
		return fmt.Errorf("error fetching user role: %w", err)
	}
	if role != "teacher" {
		return fmt.Errorf("only teacher can be verified")
	}
	result, err := s.db.Exec("UPDATE users SET is_teacher_verified = $1 WHERE id = $2", verified, userID)
	if err != nil {
		return fmt.Errorf("error updating teacher verification: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("user not found")
	}

	if verified {
		hasRequestType, err := s.hasRequestTypeColumn()
		if err != nil {
			return fmt.Errorf("error checking request_type column: %w", err)
		}
		if reviewerID != "" {
			if hasRequestType {
				_, _ = s.db.Exec(
					`UPDATE profile_change_requests
					 SET status = 'approved', reason = COALESCE(reason, 'Approved from users panel'),
					     reviewer_id = $1, reviewed_at = $2
					 WHERE user_id = $3 AND request_type = 'teacher_verification' AND status = 'pending'`,
					reviewerID, time.Now(), userID,
				)
			} else {
				_, _ = s.db.Exec(
					`UPDATE profile_change_requests
					 SET status = 'approved', reason = COALESCE(reason, 'Approved from users panel'),
					     reviewer_id = $1, reviewed_at = $2
					 WHERE user_id = $3 AND status = 'pending' AND requested_changes ? 'is_teacher_verified'`,
					reviewerID, time.Now(), userID,
				)
			}
		} else {
			if hasRequestType {
				_, _ = s.db.Exec(
					`UPDATE profile_change_requests
					 SET status = 'approved', reason = COALESCE(reason, 'Approved from users panel'),
					     reviewed_at = $1
					 WHERE user_id = $2 AND request_type = 'teacher_verification' AND status = 'pending'`,
					time.Now(), userID,
				)
			} else {
				_, _ = s.db.Exec(
					`UPDATE profile_change_requests
					 SET status = 'approved', reason = COALESCE(reason, 'Approved from users panel'),
					     reviewed_at = $1
					 WHERE user_id = $2 AND status = 'pending' AND requested_changes ? 'is_teacher_verified'`,
					time.Now(), userID,
				)
			}
		}
	}
	return nil
}

func (s *AuthService) hasRequestTypeColumn() (bool, error) {
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_name = 'profile_change_requests' AND column_name = 'request_type'
		)
	`).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func inferRequestType(current string, requestedChanges []byte) string {
	if strings.TrimSpace(current) != "" {
		return current
	}
	var changes map[string]interface{}
	if err := json.Unmarshal(requestedChanges, &changes); err == nil {
		if raw, ok := changes["is_teacher_verified"]; ok {
			if b, ok := raw.(bool); ok && b {
				return "teacher_verification"
			}
		}
	}
	return "profile_change"
}

func (s *AuthService) createApprovalRequest(userID, requestType string, payload []byte) error {
	hasRequestType, err := s.hasRequestTypeColumn()
	if err != nil {
		return err
	}
	now := time.Now()
	if hasRequestType {
		_, err = s.db.Exec(
			`INSERT INTO profile_change_requests (user_id, request_type, requested_changes, status, created_at)
			 VALUES ($1, $2, $3, 'pending', $4)`,
			userID, requestType, payload, now,
		)
		return err
	}
	_, err = s.db.Exec(
		`INSERT INTO profile_change_requests (user_id, requested_changes, status, created_at)
		 VALUES ($1, $2, 'pending', $3)`,
		userID, payload, now,
	)
	return err
}

func (s *AuthService) ensurePendingTeacherVerificationRequests() error {
	hasRequestType, err := s.hasRequestTypeColumn()
	if err != nil {
		return err
	}

	if hasRequestType {
		_, err = s.db.Exec(`
			INSERT INTO profile_change_requests (user_id, request_type, requested_changes, status, created_at)
			SELECT u.id, 'teacher_verification', '{"is_teacher_verified": true}'::jsonb, 'pending', NOW()
			FROM users u
			WHERE u.peran = 'teacher'
			  AND u.is_teacher_verified = FALSE
			  AND NOT EXISTS (
				SELECT 1
				FROM profile_change_requests p
				WHERE p.user_id = u.id
				  AND p.status = 'pending'
				  AND p.request_type = 'teacher_verification'
			  )
		`)
		return err
	}

	_, err = s.db.Exec(`
		INSERT INTO profile_change_requests (user_id, requested_changes, status, created_at)
		SELECT u.id, '{"is_teacher_verified": true}'::jsonb, 'pending', NOW()
		FROM users u
		WHERE u.peran = 'teacher'
		  AND u.is_teacher_verified = FALSE
		  AND NOT EXISTS (
			SELECT 1
			FROM profile_change_requests p
			WHERE p.user_id = u.id
			  AND p.status = 'pending'
			  AND p.requested_changes ? 'is_teacher_verified'
		  )
	`)
	return err
}

func (s *AuthService) AdminUpdateUser(userID string, req *models.AdminUpdateUserRequest) (*models.User, error) {
	updates := []string{}
	args := []interface{}{}
	argID := 1

	if req.NamaLengkap != nil {
		val := strings.TrimSpace(*req.NamaLengkap)
		if val == "" {
			return nil, fmt.Errorf("nama_lengkap cannot be empty")
		}
		updates = append(updates, fmt.Sprintf("nama_lengkap = $%d", argID))
		args = append(args, val)
		argID++
	}
	if req.Email != nil {
		val := strings.TrimSpace(*req.Email)
		if val == "" {
			return nil, fmt.Errorf("email cannot be empty")
		}
		var count int
		if err := s.db.QueryRow("SELECT COUNT(*) FROM users WHERE email = $1 AND id <> $2", val, userID).Scan(&count); err != nil {
			return nil, fmt.Errorf("error checking email uniqueness: %w", err)
		}
		if count > 0 {
			return nil, fmt.Errorf("email already exists")
		}
		updates = append(updates, fmt.Sprintf("email = $%d", argID))
		args = append(args, val)
		argID++
	}
	if req.Peran != nil {
		val := strings.TrimSpace(*req.Peran)
		if val != "student" && val != "teacher" && val != "superadmin" {
			return nil, fmt.Errorf("invalid role")
		}
		updates = append(updates, fmt.Sprintf("peran = $%d::user_role", argID))
		args = append(args, val)
		argID++
	}
	if req.Username != nil {
		val := strings.TrimSpace(*req.Username)
		if val != "" {
			var count int
			if err := s.db.QueryRow("SELECT COUNT(*) FROM users WHERE username = $1 AND id <> $2", val, userID).Scan(&count); err != nil {
				return nil, fmt.Errorf("error checking username uniqueness: %w", err)
			}
			if count > 0 {
				return nil, fmt.Errorf("username already exists")
			}
		}
		updates = append(updates, fmt.Sprintf("username = $%d", argID))
		if val == "" {
			args = append(args, nil)
		} else {
			args = append(args, val)
		}
		argID++
	}

	setNullableText := func(field string, val *string) {
		if val == nil {
			return
		}
		trimmed := strings.TrimSpace(*val)
		updates = append(updates, fmt.Sprintf("%s = $%d", field, argID))
		if trimmed == "" {
			args = append(args, nil)
		} else {
			args = append(args, trimmed)
		}
		argID++
	}

	setNullableText("nomor_identitas", req.NomorIdentitas)
	setNullableText("foto_profil_url", req.FotoProfilURL)
	setNullableText("mata_pelajaran", req.MataPelajaran)
	setNullableText("kelas_tingkat", req.KelasTingkat)
	setNullableText("institusi", req.Institusi)
	setNullableText("bio_singkat", req.BioSingkat)
	setNullableText("no_whatsapp", req.NoWhatsapp)

	if req.TanggalLahir != nil {
		val := strings.TrimSpace(*req.TanggalLahir)
		updates = append(updates, fmt.Sprintf("tanggal_lahir = $%d", argID))
		if val == "" {
			args = append(args, nil)
		} else {
			parsed, pErr := time.Parse("2006-01-02", val)
			if pErr != nil {
				return nil, fmt.Errorf("invalid tanggal_lahir format, expected YYYY-MM-DD")
			}
			args = append(args, parsed)
		}
		argID++
	}

	if req.IsTeacherVerified != nil {
		updates = append(updates, fmt.Sprintf("is_teacher_verified = $%d", argID))
		args = append(args, *req.IsTeacherVerified)
		argID++
	}

	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	query := fmt.Sprintf("UPDATE users SET %s WHERE id = $%d", strings.Join(updates, ", "), argID)
	args = append(args, userID)
	result, err := s.db.Exec(query, args...)
	if err != nil {
		return nil, fmt.Errorf("error updating user: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, fmt.Errorf("user not found")
	}

	return s.GetUserByID(userID)
}

func (s *AuthService) AdminDeleteUser(userID string) error {
	result, err := s.db.Exec("DELETE FROM users WHERE id = $1", userID)
	if err != nil {
		return fmt.Errorf("error deleting user: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

func (s *AuthService) GetPublicTeacherProfile(teacherID string) (*models.PublicTeacherProfile, error) {
	query := `
		SELECT id, nama_lengkap, foto_profil_url, mata_pelajaran, mata_pelajaran_tambahan,
		       pengalaman_mengajar, tingkat_ajar, rombel_aktif, is_wali_kelas, institusi, bio_singkat
		FROM users
		WHERE id = $1 AND peran = 'teacher'
	`

	profile := &models.PublicTeacherProfile{}
	var fotoProfilURL sql.NullString
	var mataPelajaran sql.NullString
	var mataPelajaranTambahan sql.NullString
	var pengalamanMengajar sql.NullInt64
	var tingkatAjar sql.NullString
	var rombelAktif sql.NullString
	var isWaliKelas sql.NullBool
	var institusi sql.NullString
	var bioSingkat sql.NullString

	if err := s.db.QueryRow(query, teacherID).Scan(
		&profile.ID,
		&profile.NamaLengkap,
		&fotoProfilURL,
		&mataPelajaran,
		&mataPelajaranTambahan,
		&pengalamanMengajar,
		&tingkatAjar,
		&rombelAktif,
		&isWaliKelas,
		&institusi,
		&bioSingkat,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("teacher not found")
		}
		return nil, fmt.Errorf("error querying teacher profile: %w", err)
	}

	if fotoProfilURL.Valid {
		profile.FotoProfilURL = &fotoProfilURL.String
	}
	if mataPelajaran.Valid {
		profile.MataPelajaran = &mataPelajaran.String
	}
	if mataPelajaranTambahan.Valid {
		profile.MataPelajaranTambahan = &mataPelajaranTambahan.String
	}
	if pengalamanMengajar.Valid {
		v := int(pengalamanMengajar.Int64)
		profile.PengalamanMengajar = &v
	}
	if tingkatAjar.Valid {
		profile.TingkatAjar = &tingkatAjar.String
	}
	if rombelAktif.Valid {
		profile.RombelAktif = &rombelAktif.String
	}
	if isWaliKelas.Valid {
		profile.IsWaliKelas = &isWaliKelas.Bool
	}
	if institusi.Valid {
		profile.Institusi = &institusi.String
	}
	if bioSingkat.Valid {
		profile.BioSingkat = &bioSingkat.String
	}

	return profile, nil
}

func requiresApproval(role, field string) bool {
	if role == "superadmin" {
		return false
	}
	switch field {
	case "nomor_identitas", "foto_profil_url", "institusi":
		return true
	case "mata_pelajaran":
		return role == "teacher"
	case "kelas_tingkat":
		return role == "student"
	default:
		return false
	}
}
