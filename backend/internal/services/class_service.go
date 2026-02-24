package services

import (
	"api-backend/internal/models" // Mengimpor definisi model yang diperlukan (Class, CreateClassRequest, dll.).
	"context"                     // Mengimpor package context untuk mengelola batas waktu dan pembatalan operasi DB.
	"database/sql"                // Mengimpor package database/sql untuk interaksi dengan database.
	"encoding/json"
	"fmt" // Mengimpor package fmt untuk format string dan error.
	"strings"
	"time" // Mengimpor package time untuk timestamp.
)

// ClassService menyediakan metode untuk manajemen kelas (CRUD) dan keanggotaan kelas.
// Layanan ini juga berinteraksi dengan MaterialService dan EssayQuestionService
// untuk mengambil data terkait materi dan pertanyaan esai dalam suatu kelas.
type ClassService struct {
	db                   *sql.DB               // Koneksi database.
	materialService      *MaterialService      // Referensi ke MaterialService untuk mengambil materi.
	essayQuestionService *EssayQuestionService // Referensi ke EssayQuestionService untuk mengambil pertanyaan esai.
}

// NewClassService membuat instance baru dari ClassService.
// Menerima koneksi database dan referensi ke layanan materi serta pertanyaan esai.
func NewClassService(db *sql.DB, ms *MaterialService, eqs *EssayQuestionService) *ClassService {
	return &ClassService{db: db, materialService: ms, essayQuestionService: eqs}
}

// CreateClass membuat kelas baru di database.
// Hanya guru yang dapat membuat kelas.
func (s *ClassService) CreateClass(req models.CreateClassRequest, userID string) (*models.Class, error) {
	// Inisialisasi objek Class baru dengan data dari request dan ID guru.
	newClass := &models.Class{
		TeacherID:   userID,
		ClassName:   req.ClassName,
		Description: req.Description,
		ClassCode:   models.GenerateClassCode(), // Menghasilkan kode kelas unik.
		IsArchived:  false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Query INSERT untuk menambahkan kelas baru ke tabel `classes`.
	query := `
		INSERT INTO classes (teacher_id, class_name, deskripsi, class_code, is_archived, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, is_archived, created_at, updated_at
	`
	// Menjalankan query dan memindai ID, CreatedAt, UpdatedAt yang dikembalikan.
	err := s.db.QueryRowContext(context.Background(),
		query,
		newClass.TeacherID,
		newClass.ClassName,
		newClass.Description,
		newClass.ClassCode,
		newClass.IsArchived,
		newClass.CreatedAt,
		newClass.UpdatedAt,
	).Scan(&newClass.ID, &newClass.IsArchived, &newClass.CreatedAt, &newClass.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("error inserting new class: %w", err)
	}

	return newClass, nil
}

// GetClasses mengambil semua kelas yang dibuat oleh guru tertentu.
func (s *ClassService) GetClasses(teacherID string) ([]models.Class, error) {
	query := `
		SELECT c.id, c.teacher_id, u.nama_lengkap, c.class_name, c.deskripsi, c.class_code, c.is_archived, c.created_at, c.updated_at
		FROM classes c
		JOIN users u ON u.id = c.teacher_id
		WHERE c.teacher_id = $1
		ORDER BY created_at DESC
	`
	rows, err := s.db.QueryContext(context.Background(), query, teacherID)
	if err != nil {
		return nil, fmt.Errorf("error querying classes for teacher %s: %w", teacherID, err)
	}
	defer rows.Close() // Pastikan baris ditutup setelah selesai.

	var classes []models.Class
	for rows.Next() {
		var c models.Class
		if err := rows.Scan(
			&c.ID, &c.TeacherID, &c.TeacherName, &c.ClassName, &c.Description, &c.ClassCode, &c.IsArchived, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning class row: %w", err)
		}
		classes = append(classes, c)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}
	// Mengembalikan slice kosong jika tidak ada kelas ditemukan, bukan nil.
	if classes == nil {
		classes = []models.Class{}
	}
	return classes, nil
}

// GetAllClasses mengambil semua kelas yang tersedia.
// Ini adalah endpoint publik yang mungkin digunakan untuk development atau tampilan awal.
func (s *ClassService) GetAllClasses() ([]models.Class, error) {
	query := `
		SELECT c.id, c.teacher_id, u.nama_lengkap, c.class_name, c.deskripsi, c.class_code, c.is_archived, c.created_at, c.updated_at
		FROM classes c
		JOIN users u ON u.id = c.teacher_id
		ORDER BY created_at DESC
	`
	rows, err := s.db.QueryContext(context.Background(), query)
	if err != nil {
		return nil, fmt.Errorf("error querying all classes: %w", err)
	}
	defer rows.Close()

	var classes []models.Class
	for rows.Next() {
		var c models.Class
		if err := rows.Scan(
			&c.ID, &c.TeacherID, &c.TeacherName, &c.ClassName, &c.Description, &c.ClassCode, &c.IsArchived, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning class row: %w", err)
		}
		classes = append(classes, c)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}
	if classes == nil {
		classes = []models.Class{}
	}
	return classes, nil
}

// GetClassByID retrieves a single class by its ID.
func (s *ClassService) GetClassByID(classID string) (*models.Class, error) {
	query := `
		SELECT c.id, c.teacher_id, u.nama_lengkap, c.class_name, c.deskripsi, c.class_code, c.is_archived, c.created_at, c.updated_at
		FROM classes c
		JOIN users u ON u.id = c.teacher_id
		WHERE c.id = $1
	`
	var c models.Class
	err := s.db.QueryRowContext(context.Background(), query, classID).Scan(
		&c.ID, &c.TeacherID, &c.TeacherName, &c.ClassName, &c.Description, &c.ClassCode, &c.IsArchived, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("class not found")
		}
		return nil, fmt.Errorf("error querying class %s: %w", classID, err)
	}
	return &c, nil
}

// GetStudentsByClassID retrieves all students who are members of a specific class.
// Mengembalikan slice ClassMember dengan nama dan email siswa yang denormalized.
func (s *ClassService) GetStudentsByClassID(classID string) ([]models.ClassMember, error) {
	query := `
		SELECT u.id, cm.id, cm.class_id, cm.user_id, u.nama_lengkap, u.email, u.username, u.foto_profil_url,
		       u.nomor_identitas, u.kelas_tingkat, u.institusi, u.tanggal_lahir, u.last_login_at,
		       cm.status, cm.requested_at, cm.approved_at, cm.joined_at
		FROM users u
		JOIN class_members cm ON u.id = cm.user_id
		WHERE cm.class_id = $1 AND cm.status = 'approved'
		ORDER BY u.nama_lengkap ASC
	`
	rows, err := s.db.QueryContext(context.Background(), query, classID)
	if err != nil {
		return nil, fmt.Errorf("error querying students for class %s: %w", classID, err)
	}
	defer rows.Close()

	var members []models.ClassMember
	for rows.Next() {
		var cm models.ClassMember
		var username sql.NullString
		var fotoProfilURL sql.NullString
		var nomorIdentitas sql.NullString
		var kelasTingkat sql.NullString
		var institusi sql.NullString
		var tanggalLahir sql.NullTime
		var lastLoginAt sql.NullTime

		if err := rows.Scan(
			&cm.ID, &cm.MemberID, &cm.ClassID, &cm.UserID, &cm.StudentName, &cm.StudentEmail,
			&username, &fotoProfilURL, &nomorIdentitas, &kelasTingkat, &institusi, &tanggalLahir, &lastLoginAt,
			&cm.Status, &cm.RequestedAt, &cm.ApprovedAt, &cm.JoinedAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning class member row: %w", err)
		}
		if username.Valid {
			cm.StudentUsername = &username.String
		}
		if fotoProfilURL.Valid {
			cm.FotoProfilURL = &fotoProfilURL.String
		}
		if nomorIdentitas.Valid {
			cm.NomorIdentitas = &nomorIdentitas.String
		}
		if kelasTingkat.Valid {
			cm.KelasTingkat = &kelasTingkat.String
		}
		if institusi.Valid {
			cm.Institusi = &institusi.String
		}
		if tanggalLahir.Valid {
			cm.TanggalLahir = &tanggalLahir.Time
		}
		if lastLoginAt.Valid {
			cm.LastLoginAt = &lastLoginAt.Time
		}
		members = append(members, cm)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}
	for i := range members {
		if err := s.applyPendingStudentProfile(&members[i]); err != nil {
			return nil, fmt.Errorf("error loading pending profile for student %s: %w", members[i].ID, err)
		}
	}
	if members == nil {
		members = []models.ClassMember{}
	}
	return members, nil
}

func (s *ClassService) applyPendingStudentProfile(member *models.ClassMember) error {
	var raw []byte
	err := s.db.QueryRowContext(
		context.Background(),
		`SELECT requested_changes
		 FROM profile_change_requests
		 WHERE user_id = $1 AND status = 'pending'
		 ORDER BY created_at DESC
		 LIMIT 1`,
		member.ID,
	).Scan(&raw)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil
		}
		return err
	}

	var changes map[string]interface{}
	if err := json.Unmarshal(raw, &changes); err != nil {
		return nil
	}

	if member.FotoProfilURL == nil {
		if v, ok := toString(changes["foto_profil_url"]); ok {
			member.FotoProfilURL = &v
		}
	}
	if member.NomorIdentitas == nil {
		if v, ok := toString(changes["nomor_identitas"]); ok {
			member.NomorIdentitas = &v
		}
	}
	if member.KelasTingkat == nil {
		if v, ok := toString(changes["kelas_tingkat"]); ok {
			member.KelasTingkat = &v
		}
	}
	if member.Institusi == nil {
		if v, ok := toString(changes["institusi"]); ok {
			member.Institusi = &v
		}
	}
	if member.TanggalLahir == nil {
		if v, ok := toString(changes["tanggal_lahir"]); ok {
			if parsed, pErr := parseDate(v); pErr == nil {
				member.TanggalLahir = &parsed
			}
		}
	}

	return nil
}

func toString(v interface{}) (string, bool) {
	s, ok := v.(string)
	if !ok {
		return "", false
	}
	s = strings.TrimSpace(s)
	if s == "" {
		return "", false
	}
	return s, true
}

func parseDate(value string) (time.Time, error) {
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed, nil
	}
	return time.Parse("2006-01-02", value)
}

// RemoveStudentFromClass menghapus seorang siswa dari sebuah kelas.
func (s *ClassService) RemoveStudentFromClass(classID, studentID string) error {
	_, err := s.db.ExecContext(context.Background(), "DELETE FROM class_members WHERE class_id = $1 AND user_id = $2", classID, studentID)
	if err != nil {
		return fmt.Errorf("error deleting class member: %w", err)
	}
	return nil
}

// UpdateClass memperbarui metadata kelas milik guru.
func (s *ClassService) UpdateClass(classID, teacherID string, req *models.UpdateClassRequest) (*models.Class, error) {
	if err := s.ensureTeacherOwnsClass(classID, teacherID); err != nil {
		return nil, err
	}
	updates := []string{}
	args := []interface{}{}
	argID := 1

	if req.ClassName != nil {
		updates = append(updates, fmt.Sprintf("class_name = $%d", argID))
		args = append(args, strings.TrimSpace(*req.ClassName))
		argID++
	}
	if req.Description != nil {
		updates = append(updates, fmt.Sprintf("deskripsi = $%d", argID))
		args = append(args, *req.Description)
		argID++
	}
	if req.IsArchived != nil {
		updates = append(updates, fmt.Sprintf("is_archived = $%d", argID))
		args = append(args, *req.IsArchived)
		argID++
	}
	updates = append(updates, fmt.Sprintf("updated_at = $%d", argID))
	args = append(args, time.Now())
	argID++
	args = append(args, classID, teacherID)

	query := fmt.Sprintf(`
		UPDATE classes
		SET %s
		WHERE id = $%d AND teacher_id = $%d
		RETURNING id, teacher_id, class_name, deskripsi, class_code, is_archived, created_at, updated_at
	`, strings.Join(updates, ", "), argID, argID+1)

	var c models.Class
	if err := s.db.QueryRowContext(context.Background(), query, args...).Scan(
		&c.ID, &c.TeacherID, &c.ClassName, &c.Description, &c.ClassCode, &c.IsArchived, &c.CreatedAt, &c.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("class not found or unauthorized")
		}
		return nil, fmt.Errorf("error updating class: %w", err)
	}
	return &c, nil
}

// DeleteClass menghapus kelas milik guru.
func (s *ClassService) DeleteClass(classID, teacherID string) error {
	result, err := s.db.ExecContext(context.Background(), "DELETE FROM classes WHERE id = $1 AND teacher_id = $2", classID, teacherID)
	if err != nil {
		return fmt.Errorf("error deleting class: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("class not found or unauthorized")
	}
	return nil
}

// JoinClass menambahkan seorang siswa ke sebuah kelas menggunakan kode kelas.
func (s *ClassService) JoinClass(classCode, studentID string) error {
	var classID string
	// 1. Temukan ID Kelas berdasarkan Kode Kelas.
	err := s.db.QueryRowContext(context.Background(), "SELECT id FROM classes WHERE class_code = $1", classCode).Scan(&classID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("class not found") // Kelas tidak ditemukan.
		}
		return fmt.Errorf("error finding class by code: %w", err)
	}

	// 2. Periksa Keanggotaan yang Sudah Ada.
	var existingMemberID, existingStatus string
	err = s.db.QueryRowContext(context.Background(), "SELECT id, status FROM class_members WHERE class_id = $1 AND user_id = $2", classID, studentID).Scan(&existingMemberID, &existingStatus)
	if err == nil {
		switch strings.ToLower(existingStatus) {
		case "approved":
			return fmt.Errorf("student is already a member of this class")
		case "pending":
			return fmt.Errorf("join request already pending")
		default:
			_, uErr := s.db.ExecContext(
				context.Background(),
				"UPDATE class_members SET status = 'pending', requested_at = $1, approved_at = NULL, joined_at = $1 WHERE id = $2",
				time.Now(),
				existingMemberID,
			)
			if uErr != nil {
				return fmt.Errorf("error updating join request status: %w", uErr)
			}
			return nil
		}
	}
	// Jika error bukan sql.ErrNoRows, berarti ada masalah lain saat memeriksa.
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("error checking existing membership: %w", err)
	}

	// 3. Masukkan Keanggotaan Baru.
	query := `
		INSERT INTO class_members (class_id, user_id, status, requested_at, joined_at)
		VALUES ($1, $2, 'pending', $3, $3)
	`
	_, err = s.db.ExecContext(context.Background(), query, classID, studentID, time.Now())
	if err != nil {
		return fmt.Errorf("error inserting new class member: %w", err)
	}

	return nil
}

// GetStudentClasses retrieves all classes a student is a member of,
// along with their materials and essay questions.
// Ini adalah operasi yang kompleks karena menggabungkan data dari beberapa layanan.
func (s *ClassService) GetStudentClasses(studentID string) ([]models.Class, error) {
	query := `
		SELECT
			c.id, c.teacher_id, u.nama_lengkap, c.class_name, c.deskripsi, c.class_code, c.is_archived, c.created_at, c.updated_at
		FROM classes c
		JOIN users u ON u.id = c.teacher_id
		JOIN class_members cm ON c.id = cm.class_id
		WHERE cm.user_id = $1 AND cm.status = 'approved' AND c.is_archived = FALSE
		ORDER BY c.created_at DESC
	`
	rows, err := s.db.QueryContext(context.Background(), query, studentID)
	if err != nil {
		return nil, fmt.Errorf("error querying classes for student %s: %w", studentID, err)
	}
	defer rows.Close()

	var classes []models.Class
	for rows.Next() {
		var c models.Class
		if err := rows.Scan(
			&c.ID, &c.TeacherID, &c.TeacherName, &c.ClassName, &c.Description, &c.ClassCode, &c.IsArchived, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning class row for student classes: %w", err)
		}

		// Ambil materi untuk kelas saat ini menggunakan MaterialService.
		materials, err := s.materialService.GetMaterialsForStudentByClassID(c.ID, studentID)
		if err != nil {
			// Log error, tetapi jangan gagalkan seluruh permintaan; kembalikan slice materi kosong.
			fmt.Printf("WARNING: Failed to fetch materials for class %s (student %s): %v\n", c.ID, studentID, err)
			materials = []models.Material{}
		}

		// Ambil pertanyaan esai untuk setiap materi menggunakan EssayQuestionService.
		for i := range materials {
			questions, err := s.essayQuestionService.GetEssayQuestionsByMaterialIDForStudent(materials[i].ID, studentID)
			if err != nil {
				fmt.Printf("WARNING: Failed to fetch essay questions for material %s: %v\n", materials[i].ID, err)
				questions = []models.EssayQuestion{}
			}
			materials[i].EssayQuestions = questions
		}
		c.Materials = materials // Tetapkan materi ke kelas.
		classes = append(classes, c)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}
	if classes == nil {
		classes = []models.Class{}
	}
	return classes, nil
}

// GetStudentPendingClasses retrieves all classes with pending join request by student.
func (s *ClassService) GetStudentPendingClasses(studentID string) ([]models.PendingClassJoin, error) {
	query := `
		SELECT
			c.id, c.class_name, c.class_code, c.teacher_id, u.nama_lengkap, cm.status, cm.requested_at
		FROM class_members cm
		JOIN classes c ON c.id = cm.class_id
		JOIN users u ON u.id = c.teacher_id
		WHERE cm.user_id = $1 AND cm.status = 'pending' AND c.is_archived = FALSE
		ORDER BY cm.requested_at DESC
	`
	rows, err := s.db.QueryContext(context.Background(), query, studentID)
	if err != nil {
		return nil, fmt.Errorf("error querying pending classes for student %s: %w", studentID, err)
	}
	defer rows.Close()

	items := []models.PendingClassJoin{}
	for rows.Next() {
		var item models.PendingClassJoin
		if err := rows.Scan(
			&item.ClassID, &item.ClassName, &item.ClassCode, &item.TeacherID, &item.TeacherName, &item.Status, &item.RequestedAt,
		); err != nil {
			return nil, fmt.Errorf("error scanning pending class row: %w", err)
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during pending class rows iteration: %w", err)
	}

	return items, nil
}

// GetStudentClassDetails retrieves a single class with its materials and essay questions for a student,
// ensuring the student is a member of that class.
func (s *ClassService) GetStudentClassDetails(classID, studentID string) (*models.Class, error) {
	// 1. Periksa Keanggotaan Siswa.
	var memberID string
	err := s.db.QueryRowContext(context.Background(),
		"SELECT id FROM class_members WHERE class_id = $1 AND user_id = $2 AND status = 'approved'",
		classID, studentID).Scan(&memberID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("class not found or student not a member")
		}
		return nil, fmt.Errorf("error checking student membership for class %s: %w", classID, err)
	}

	// 2. Ambil Detail Kelas.
	query := `
		SELECT
			c.id, c.teacher_id, u.nama_lengkap, c.class_name, c.deskripsi, c.class_code, c.is_archived, c.created_at, c.updated_at
		FROM classes c
		JOIN users u ON u.id = c.teacher_id
		WHERE c.id = $1 AND c.is_archived = FALSE
	`
	var cls models.Class
	err = s.db.QueryRowContext(context.Background(), query, classID).Scan(
		&cls.ID, &cls.TeacherID, &cls.TeacherName, &cls.ClassName, &cls.Description, &cls.ClassCode, &cls.IsArchived, &cls.CreatedAt, &cls.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("class not found or student not a member")
		}
		return nil, fmt.Errorf("error querying class %s: %w", classID, err)
	}

	// 3. Ambil Materi untuk kelas menggunakan MaterialService.
	materials, err := s.materialService.GetMaterialsForStudentByClassID(cls.ID, studentID)
	if err != nil {
		fmt.Printf("WARNING: Failed to fetch materials for class %s (student %s): %v\n", cls.ID, studentID, err)
		materials = []models.Material{}
	}

	// 4. Ambil pertanyaan esai untuk setiap materi menggunakan EssayQuestionService.
	for i := range materials {
		questions, err := s.essayQuestionService.GetEssayQuestionsByMaterialIDForStudent(materials[i].ID, studentID)
		if err != nil {
			fmt.Printf("WARNING: Failed to fetch essay questions for material %s: %v\n", materials[i].ID, err)
			questions = []models.EssayQuestion{}
		}
		materials[i].EssayQuestions = questions
	}
	cls.Materials = materials // Tetapkan materi ke objek kelas.

	return &cls, nil
}

func (s *ClassService) ensureTeacherOwnsClass(classID, teacherID string) error {
	var id string
	err := s.db.QueryRowContext(context.Background(), "SELECT id FROM classes WHERE id = $1 AND teacher_id = $2", classID, teacherID).Scan(&id)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("class not found or unauthorized")
		}
		return fmt.Errorf("error validating class ownership: %w", err)
	}
	return nil
}

// InviteStudent menambahkan siswa ke kelas sebagai approved (langsung aktif).
func (s *ClassService) InviteStudent(classID, teacherID, identifier, studentID string) error {
	if err := s.ensureTeacherOwnsClass(classID, teacherID); err != nil {
		return err
	}

	var role string
	var err error
	if strings.TrimSpace(studentID) != "" {
		err = s.db.QueryRowContext(
			context.Background(),
			"SELECT peran FROM users WHERE id = $1",
			studentID,
		).Scan(&role)
	} else {
		err = s.db.QueryRowContext(
			context.Background(),
			"SELECT id, peran FROM users WHERE email = $1 OR username = $1",
			identifier,
		).Scan(&studentID, &role)
	}
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("student not found")
		}
		return fmt.Errorf("error finding student: %w", err)
	}
	if strings.ToLower(role) != "student" {
		return fmt.Errorf("target user is not a student")
	}

	var memberID, status string
	err = s.db.QueryRowContext(context.Background(), "SELECT id, status FROM class_members WHERE class_id = $1 AND user_id = $2", classID, studentID).Scan(&memberID, &status)
	now := time.Now()
	if err == nil {
		if strings.ToLower(status) == "approved" {
			return fmt.Errorf("student is already a member of this class")
		}
		_, err = s.db.ExecContext(
			context.Background(),
			"UPDATE class_members SET status = 'approved', approved_at = $1, requested_at = COALESCE(requested_at, $1), joined_at = $1 WHERE id = $2",
			now,
			memberID,
		)
		if err != nil {
			return fmt.Errorf("error approving invited student: %w", err)
		}
		return nil
	}
	if err != sql.ErrNoRows {
		return fmt.Errorf("error checking existing membership: %w", err)
	}

	_, err = s.db.ExecContext(
		context.Background(),
		"INSERT INTO class_members (class_id, user_id, status, requested_at, approved_at, joined_at) VALUES ($1, $2, 'approved', $3, $3, $3)",
		classID,
		studentID,
		now,
	)
	if err != nil {
		return fmt.Errorf("error inviting student: %w", err)
	}
	return nil
}

// GetInvitableStudents daftar siswa yang bisa diundang ke kelas.
func (s *ClassService) GetInvitableStudents(classID, teacherID string) ([]models.StudentOption, error) {
	if err := s.ensureTeacherOwnsClass(classID, teacherID); err != nil {
		return nil, err
	}

	query := `
		SELECT u.id, u.nama_lengkap, u.email
		FROM users u
		LEFT JOIN class_members cm
			ON cm.user_id = u.id
			AND cm.class_id = $1
			AND cm.status IN ('approved', 'pending')
		WHERE u.peran = 'student' AND cm.id IS NULL
		ORDER BY u.nama_lengkap ASC
	`
	rows, err := s.db.QueryContext(context.Background(), query, classID)
	if err != nil {
		return nil, fmt.Errorf("error querying invitable students: %w", err)
	}
	defer rows.Close()

	result := []models.StudentOption{}
	for rows.Next() {
		var item models.StudentOption
		if err := rows.Scan(&item.ID, &item.Name, &item.Email); err != nil {
			return nil, fmt.Errorf("error scanning invitable student: %w", err)
		}
		result = append(result, item)
	}
	return result, nil
}

// GetPendingJoinRequests mengambil daftar permintaan join yang menunggu ACC guru.
func (s *ClassService) GetPendingJoinRequests(classID, teacherID string) ([]models.ClassMember, error) {
	if err := s.ensureTeacherOwnsClass(classID, teacherID); err != nil {
		return nil, err
	}

	query := `
		SELECT u.id, cm.id, cm.class_id, cm.user_id, u.nama_lengkap, u.email, cm.status, cm.requested_at, cm.approved_at, cm.joined_at
		FROM class_members cm
		JOIN users u ON u.id = cm.user_id
		WHERE cm.class_id = $1 AND cm.status = 'pending'
		ORDER BY cm.requested_at ASC
	`
	rows, err := s.db.QueryContext(context.Background(), query, classID)
	if err != nil {
		return nil, fmt.Errorf("error querying pending join requests: %w", err)
	}
	defer rows.Close()

	requests := []models.ClassMember{}
	for rows.Next() {
		var cm models.ClassMember
		if err := rows.Scan(&cm.ID, &cm.MemberID, &cm.ClassID, &cm.UserID, &cm.StudentName, &cm.StudentEmail, &cm.Status, &cm.RequestedAt, &cm.ApprovedAt, &cm.JoinedAt); err != nil {
			return nil, fmt.Errorf("error scanning pending request row: %w", err)
		}
		requests = append(requests, cm)
	}
	return requests, nil
}

// ReviewJoinRequest approve/reject request join siswa.
func (s *ClassService) ReviewJoinRequest(classID, memberID, teacherID, action string) error {
	if err := s.ensureTeacherOwnsClass(classID, teacherID); err != nil {
		return err
	}
	action = strings.ToLower(strings.TrimSpace(action))
	if action != "approve" && action != "reject" {
		return fmt.Errorf("invalid action")
	}

	var existingID string
	err := s.db.QueryRowContext(
		context.Background(),
		"SELECT id FROM class_members WHERE id = $1 AND class_id = $2 AND status = 'pending'",
		memberID,
		classID,
	).Scan(&existingID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("join request not found")
		}
		return fmt.Errorf("error finding join request: %w", err)
	}

	now := time.Now()
	if action == "approve" {
		_, err = s.db.ExecContext(context.Background(), "UPDATE class_members SET status = 'approved', approved_at = $1, joined_at = COALESCE(joined_at, $1) WHERE id = $2", now, memberID)
	} else {
		_, err = s.db.ExecContext(context.Background(), "UPDATE class_members SET status = 'rejected', approved_at = NULL WHERE id = $1", memberID)
	}
	if err != nil {
		return fmt.Errorf("error reviewing join request: %w", err)
	}
	return nil
}

// GetTeacherDashboardSummary mengambil ringkasan dashboard guru dalam satu query group.
func (s *ClassService) GetTeacherDashboardSummary(teacherID string) (*models.TeacherDashboardSummary, error) {
	summary := &models.TeacherDashboardSummary{}

	aggregateQuery := `
		SELECT
			(SELECT COUNT(*) FROM classes c WHERE c.teacher_id = $1 AND c.is_archived = FALSE) AS total_classes,
			(SELECT COUNT(DISTINCT cm.user_id)
			 FROM class_members cm
			 JOIN classes c ON c.id = cm.class_id
			 WHERE c.teacher_id = $1 AND c.is_archived = FALSE AND cm.status = 'approved') AS total_students,
			(SELECT COUNT(*)
			 FROM materials m
			 JOIN classes c ON c.id = m.class_id
			 WHERE c.teacher_id = $1 AND c.is_archived = FALSE) AS total_materials,
			(SELECT COUNT(*)
			 FROM materials m
			 JOIN classes c ON c.id = m.class_id
			 WHERE c.teacher_id = $1 AND c.is_archived = FALSE AND m.created_at >= NOW() - INTERVAL '7 days') AS materials_this_week,
			(SELECT COUNT(*)
			 FROM class_members cm
			 JOIN classes c ON c.id = cm.class_id
			 WHERE c.teacher_id = $1 AND c.is_archived = FALSE AND cm.status = 'pending') AS pending_join_count
	`

	if err := s.db.QueryRowContext(context.Background(), aggregateQuery, teacherID).Scan(
		&summary.TotalClasses,
		&summary.TotalStudents,
		&summary.TotalMaterials,
		&summary.MaterialsThisWeek,
		&summary.PendingJoinCount,
	); err != nil {
		return nil, fmt.Errorf("error loading teacher dashboard aggregates: %w", err)
	}

	if err := s.db.QueryRowContext(
		context.Background(),
		`SELECT id, class_name, created_at
		 FROM classes
		 WHERE teacher_id = $1 AND is_archived = FALSE
		 ORDER BY created_at DESC
		 LIMIT 1`,
		teacherID,
	).Scan(&summary.LatestClassID, &summary.LatestClassName, &summary.LatestClassAt); err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("error loading latest class: %w", err)
	}

	if err := s.db.QueryRowContext(
		context.Background(),
		`SELECT m.id, m.judul, m.created_at
		 FROM materials m
		 JOIN classes c ON c.id = m.class_id
		 WHERE c.teacher_id = $1 AND c.is_archived = FALSE
		 ORDER BY m.created_at DESC
		 LIMIT 1`,
		teacherID,
	).Scan(&summary.LatestMaterialID, &summary.LatestMaterialName, &summary.LatestMaterialAt); err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("error loading latest material: %w", err)
	}

	return summary, nil
}
