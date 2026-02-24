package routes

import (
	"api-backend/internal/handlers" // Mengimpor package handlers untuk menangani permintaan HTTP.
	"api-backend/internal/services" // Mengimpor package services untuk logika bisnis.
	"database/sql"                  // Mengimpor package database/sql untuk interaksi dengan database.
	"encoding/json"                 // Mengimpor package encoding/json untuk encoding/decoding JSON.
	"github.com/gorilla/mux"        // Mengimpor router Mux dari Gorilla Toolkit.
	"log"                           // Mengimpor package log untuk logging.
	"net/http"                      // Mengimpor package net/http untuk fungsionalitas HTTP.
)

// respondWithJSONForPing adalah fungsi helper untuk mengirim respons JSON.
// Digunakan khususnya untuk endpoint ping sederhana.
func respondWithJSONForPing(w http.ResponseWriter, code int, payload interface{}) {
	response, _ := json.Marshal(payload)               // Mengubah payload (biasanya map) menjadi JSON byte array.
	w.Header().Set("Content-Type", "application/json") // Mengatur header Content-Type ke application/json.
	w.WriteHeader(code)                                // Mengatur status kode HTTP.
	w.Write(response)                                  // Menulis respons JSON ke client.
}

// PingHandler adalah handler sederhana untuk menguji ketersediaan API.
// Mengembalikan pesan "pong" jika API responsif.
func PingHandler(w http.ResponseWriter, r *http.Request) {
	respondWithJSONForPing(w, http.StatusOK, map[string]string{"message": "pong"})
}

// SetupRoutes mengkonfigurasi semua rute aplikasi.
// Fungsi ini menerima objek router Mux, koneksi database, dan berbagai layanan (services)
// yang dibutuhkan oleh handler.
func SetupRoutes(router *mux.Router, db *sql.DB, materialService *services.MaterialService, essayQuestionService *services.EssayQuestionService) {
	// --- Inisialisasi Layanan (Services) ---
	// Layanan berisi logika bisnis dan berinteraksi dengan repository/database.
	authService := services.NewAuthService(db)

	// Inisialisasi AI Service. Log fatal jika gagal.
	aiService, err := services.NewAIService(db)
	if err != nil {
		log.Printf("WARNING: AI service unavailable: %v", err)
		aiService = nil
	}

	// ClassService memerlukan materialService dan essayQuestionService.
	systemSettingService := services.NewSystemSettingService(db)
	adminAuditService := services.NewAdminAuditService(db)
	classService := services.NewClassService(db, materialService, essayQuestionService)
	essaySubmissionService := services.NewEssaySubmissionService(db, aiService, essayQuestionService, systemSettingService)
	aiResultService := services.NewAIResultService(db)
	teacherReviewService := services.NewTeacherReviewService(db)
	moduleService := services.NewModuleService(db)
	classTeachingModuleService := services.NewClassTeachingModuleService(db)
	questionBankService := services.NewQuestionBankService(db)

	// --- Inisialisasi Handler ---
	// Handler menerima permintaan HTTP dan memanggil metode dari layanan.
	authHandlers := handlers.NewAuthHandlers(authService, systemSettingService, adminAuditService)
	gradeEssayHandlers := handlers.NewGradeEssayHandlers(aiService)
	classHandlers := handlers.NewClassHandlers(classService)
	materialHandlers := handlers.NewMaterialHandlers(materialService)
	essayQuestionHandlers := handlers.NewEssayQuestionHandlers(essayQuestionService, materialService, classTeachingModuleService, aiService)
	essaySubmissionHandlers := handlers.NewEssaySubmissionHandlers(essaySubmissionService, aiResultService)
	aiResultHandlers := handlers.NewAIResultHandlers(aiResultService)
	teacherReviewHandlers := handlers.NewTeacherReviewHandlers(teacherReviewService)
	devHandler := handlers.NewDevHandler(db) // Handler untuk pengembangan/debugging.
	moduleHandlers := handlers.NewModuleHandlers(moduleService)
	classTeachingModuleHandlers := handlers.NewClassTeachingModuleHandlers(classTeachingModuleService)
	questionBankHandlers := handlers.NewQuestionBankHandlers(questionBankService, materialService)
	uploadHandler := handlers.NewUploadHandler()
	adminOpsHandlers := handlers.NewAdminOpsHandlers(db, authService, essaySubmissionService, aiService, systemSettingService, adminAuditService, questionBankService)

	// --- Rute Publik (Tanpa Awalan /api) ---
	// Rute-rute ini dapat diakses langsung tanpa awalan API.
	router.HandleFunc("/", handlers.HelloHandler).Methods("GET")    // Contoh rute "Hello World".
	router.HandleFunc("/test", handlers.TestHandler).Methods("GET") // Rute pengujian.

	// FileServer untuk melayani file yang diunggah.
	fs := http.FileServer(http.Dir("./uploads/"))
	router.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", fs))

	// Membuat subrouter untuk semua endpoint API dengan awalan "/api".
	api := router.PathPrefix("/api").Subrouter()

	// --- Rute API Publik (Tidak Memerlukan Otentikasi) ---
	// Rute-rute ini dapat diakses oleh siapa saja.
	api.HandleFunc("/login", authHandlers.LoginHandler).Methods("POST")
	api.HandleFunc("/register", authHandlers.RegisterHandler).Methods("POST")
	api.HandleFunc("/logout", authHandlers.LogoutHandler).Methods("POST")
	api.HandleFunc("/grade-essay", gradeEssayHandlers.GradeEssayHandler).Methods("POST") // Untuk menilai esai secara publik (tanpa login).
	api.HandleFunc("/classes-public", classHandlers.GetAllClassesHandler).Methods("GET") // Untuk mendapatkan daftar kelas secara publik.

	// Rute pengembangan/debugging.
	api.HandleFunc("/dev/tables", devHandler.GetTables).Methods("GET")

	// --- Rute Terlindungi (Memerlukan Otentikasi Pengguna) ---
	// Semua rute di bawah protectedRouter akan melewati AuthMiddleware.
	protectedRouter := api.PathPrefix("/").Subrouter()
	protectedRouter.Use(AuthMiddleware) // Menerapkan middleware otentikasi.

	// Rute khusus siswa atau pengguna terotentikasi.
	protectedRouter.HandleFunc("/student/join-class", classHandlers.JoinClassHandler).Methods("POST")
	protectedRouter.HandleFunc("/student/my-classes", classHandlers.GetStudentClassesHandler).Methods("GET")
	protectedRouter.HandleFunc("/student/pending-classes", classHandlers.GetStudentPendingClassesHandler).Methods("GET")
	protectedRouter.HandleFunc("/student/classes/{classId}", classHandlers.GetStudentClassByIDHandler).Methods("GET")
	protectedRouter.HandleFunc("/ping", PingHandler).Methods("GET")          // Ping untuk pengguna terotentikasi.
	protectedRouter.HandleFunc("/me", authHandlers.MeHandler).Methods("GET") // Mendapatkan informasi pengguna saat ini.
	protectedRouter.HandleFunc("/profile", authHandlers.ProfileHandler).Methods("GET")
	protectedRouter.HandleFunc("/profile", authHandlers.UpdateProfileHandler).Methods("PATCH")
	protectedRouter.HandleFunc("/profile/password", authHandlers.ChangePasswordHandler).Methods("POST")
	protectedRouter.HandleFunc("/profile-change-requests", authHandlers.MyProfileChangeRequestsHandler).Methods("GET")
	protectedRouter.HandleFunc("/announcements/active", adminOpsHandlers.ListActiveAnnouncementsHandler).Methods("GET")
	protectedRouter.HandleFunc("/settings/notifications", adminOpsHandlers.NotificationConfigHandler).Methods("GET")
	protectedRouter.HandleFunc("/teachers/{teacherId}/public", authHandlers.PublicTeacherProfileHandler).Methods("GET")
	protectedRouter.HandleFunc("/impersonation/status", adminOpsHandlers.ImpersonationStatusHandler).Methods("GET")
	protectedRouter.HandleFunc("/impersonation/stop", adminOpsHandlers.StopImpersonationHandler).Methods("POST")
	protectedRouter.HandleFunc("/upload", uploadHandler.UploadFileHandler).Methods("POST")                                        // Untuk mengunggah file.
	protectedRouter.HandleFunc("/essay-questions/{questionId}", essayQuestionHandlers.GetEssayQuestionByIDHandler).Methods("GET") // Mendapatkan pertanyaan esai berdasarkan ID.

	// Rute untuk submission esai.
	protectedRouter.HandleFunc("/submissions", essaySubmissionHandlers.CreateEssaySubmissionHandler).Methods("POST")
	protectedRouter.HandleFunc("/submissions/{submissionId}", essaySubmissionHandlers.GetEssaySubmissionByIDHandler).Methods("GET")
	protectedRouter.HandleFunc("/submissions/{submissionId}", essaySubmissionHandlers.UpdateEssaySubmissionHandler).Methods("PUT")
	protectedRouter.HandleFunc("/submissions/{submissionId}", essaySubmissionHandlers.DeleteEssaySubmissionHandler).Methods("DELETE")
	protectedRouter.HandleFunc("/students/{studentId}/submissions", essaySubmissionHandlers.GetEssaySubmissionsByStudentIDHandler).Methods("GET")

	// Rute terkait hasil penilaian AI.
	protectedRouter.HandleFunc("/ai-results", aiResultHandlers.CreateAIResultHandler).Methods("POST")
	protectedRouter.HandleFunc("/ai-results/{resultId}", aiResultHandlers.GetAIResultByIDHandler).Methods("GET")
	protectedRouter.HandleFunc("/submissions/{submissionId}/ai-result", aiResultHandlers.GetAIResultBySubmissionIDHandler).Methods("GET")
	protectedRouter.HandleFunc("/ai-results/{resultId}", aiResultHandlers.UpdateAIResultHandler).Methods("PUT")
	protectedRouter.HandleFunc("/ai-results/{resultId}", aiResultHandlers.DeleteAIResultHandler).Methods("DELETE")

	// Rute terkait review dari guru.
	protectedRouter.HandleFunc("/teacher-reviews", teacherReviewHandlers.CreateTeacherReviewHandler).Methods("POST")
	protectedRouter.HandleFunc("/teacher-reviews/{reviewId}", teacherReviewHandlers.UpdateTeacherReviewHandler).Methods("PUT")
	protectedRouter.HandleFunc("/teacher-reviews/submission/{submissionId}", teacherReviewHandlers.GetTeacherReviewBySubmissionIDHandler).Methods("GET")

	// --- Rute Khusus Guru (Memerlukan Otentikasi dan Peran Guru) ---
	// Semua rute di bawah teacherRouter akan melewati TeacherOnlyMiddleware (setelah AuthMiddleware).
	teacherRouter := protectedRouter.PathPrefix("/").Subrouter()
	teacherRouter.Use(TeacherOnlyMiddleware) // Menerapkan middleware khusus guru.
	teacherRouter.Use(TeacherWriteAccessMiddleware(authService))

	// Rute terkait review dari guru - khusus guru.
	teacherRouter.HandleFunc("/teacher-reviews", teacherReviewHandlers.CreateTeacherReviewHandler).Methods("POST")
	teacherRouter.HandleFunc("/teacher-reviews/{reviewId}", teacherReviewHandlers.UpdateTeacherReviewHandler).Methods("PUT")

	teacherRouter.HandleFunc("/classes", classHandlers.GetClassesHandler).Methods("GET") // Mendapatkan daftar kelas yang diajar guru.
	teacherRouter.HandleFunc("/dashboard-summary", classHandlers.GetTeacherDashboardSummaryHandler).Methods("GET")
	teacherRouter.HandleFunc("/classes", classHandlers.CreateClassHandler).Methods("POST")           // Membuat kelas baru.
	teacherRouter.HandleFunc("/classes/{classId}", classHandlers.GetClassByIDHandler).Methods("GET") // Mendapatkan detail kelas berdasarkan ID.
	teacherRouter.HandleFunc("/classes/{classId}", classHandlers.UpdateClassHandler).Methods("PUT")
	teacherRouter.HandleFunc("/classes/{classId}", classHandlers.DeleteClassHandler).Methods("DELETE")
	teacherRouter.HandleFunc("/classes/{classId}/students", classHandlers.GetStudentsByClassIDHandler).Methods("GET")                  // Mendapatkan siswa dalam kelas.
	teacherRouter.HandleFunc("/classes/{classId}/students/{studentId}", classHandlers.RemoveStudentFromClassHandler).Methods("DELETE") // Menghapus siswa dari kelas.
	teacherRouter.HandleFunc("/classes/{classId}/invite-student", classHandlers.InviteStudentHandler).Methods("POST")
	teacherRouter.HandleFunc("/classes/{classId}/invitable-students", classHandlers.GetInvitableStudentsHandler).Methods("GET")
	teacherRouter.HandleFunc("/classes/{classId}/join-requests", classHandlers.GetPendingJoinRequestsHandler).Methods("GET")
	teacherRouter.HandleFunc("/classes/{classId}/join-requests/{memberId}/review", classHandlers.ReviewJoinRequestHandler).Methods("POST")
	teacherRouter.HandleFunc("/classes/{classId}/teaching-modules", classTeachingModuleHandlers.GetClassTeachingModulesByClassIDHandler).Methods("GET")
	teacherRouter.HandleFunc("/classes/{classId}/teaching-modules", classTeachingModuleHandlers.CreateClassTeachingModuleHandler).Methods("POST")
	teacherRouter.HandleFunc("/teaching-modules/{moduleId}", classTeachingModuleHandlers.DeleteClassTeachingModuleHandler).Methods("DELETE")

	// Rute terkait materi khusus guru.
	teacherRouter.HandleFunc("/materials", materialHandlers.CreateMaterialHandler).Methods("POST")                         // Membuat materi baru (sederhana).
	teacherRouter.HandleFunc("/materials/{materialId}", materialHandlers.GetMaterialByIDHandler).Methods("GET")            // Mendapatkan detail materi.
	teacherRouter.HandleFunc("/classes/{classId}/materials", materialHandlers.GetMaterialsByClassIDHandler).Methods("GET") // Mendapatkan materi berdasarkan kelas.
	teacherRouter.HandleFunc("/materials/{materialId}", materialHandlers.UpdateMaterialHandler).Methods("PUT")             // Memperbarui materi.
	teacherRouter.HandleFunc("/materials/{materialId}", materialHandlers.DeleteMaterialHandler).Methods("DELETE")          // Menghapus materi.

	// Rute terkait pertanyaan esai khusus guru.
	teacherRouter.HandleFunc("/essay-questions", essayQuestionHandlers.CreateEssayQuestionHandler).Methods("POST")                                 // Membuat pertanyaan esai baru.
	teacherRouter.HandleFunc("/materials/{materialId}/essay-questions", essayQuestionHandlers.GetEssayQuestionsByMaterialIDHandler).Methods("GET") // Mendapatkan pertanyaan esai berdasarkan materi.
	teacherRouter.HandleFunc("/materials/{materialId}/essay-questions/auto-generate", essayQuestionHandlers.AutoGenerateEssayQuestionHandler).Methods("POST")
	teacherRouter.HandleFunc("/essay-questions/{questionId}", essayQuestionHandlers.DeleteEssayQuestionHandler).Methods("DELETE") // Menghapus pertanyaan esai.
	teacherRouter.HandleFunc("/essay-questions/{questionId}", essayQuestionHandlers.UpdateEssayQuestionHandler).Methods("PUT")    // Memperbarui pertanyaan esai.
	teacherRouter.HandleFunc("/question-bank", questionBankHandlers.CreateQuestionBankEntryHandler).Methods("POST")
	teacherRouter.HandleFunc("/question-bank", questionBankHandlers.ListQuestionBankEntriesHandler).Methods("GET")
	teacherRouter.HandleFunc("/question-bank/{entryId}", questionBankHandlers.UpdateQuestionBankEntryHandler).Methods("PUT")
	teacherRouter.HandleFunc("/question-bank/{entryId}", questionBankHandlers.DeleteQuestionBankEntryHandler).Methods("DELETE")

	// Rute terkait modul khusus guru.
	teacherRouter.HandleFunc("/modules", moduleHandlers.CreateModuleHandler).Methods("POST")                                 // Membuat modul baru.
	teacherRouter.HandleFunc("/materials/{materialId}/modules", moduleHandlers.GetModulesByMaterialIDHandler).Methods("GET") // Mendapatkan modul berdasarkan materi.

	// Rute terkait submission esai khusus guru.
	teacherRouter.HandleFunc("/essay-questions/{questionId}/submissions", essaySubmissionHandlers.GetEssaySubmissionsByQuestionIDHandler).Methods("GET") // Mendapatkan submission esai berdasarkan pertanyaan.

	// --- Rute Khusus Superadmin ---
	adminRouter := protectedRouter.PathPrefix("/admin").Subrouter()
	adminRouter.Use(SuperadminOnlyMiddleware)
	adminRouter.HandleFunc("/dashboard-summary", authHandlers.AdminDashboardSummaryHandler).Methods("GET")
	adminRouter.HandleFunc("/api-statistics", authHandlers.AdminAPIStatisticsHandler).Methods("GET")
	adminRouter.HandleFunc("/api-statistics/health", adminOpsHandlers.AdminAPIHealthHandler).Methods("GET")
	adminRouter.HandleFunc("/ai-config/gemini-key", adminOpsHandlers.AdminGetGeminiKeyMaskedHandler).Methods("GET")
	adminRouter.HandleFunc("/ai-config/gemini-key/reveal", adminOpsHandlers.AdminRevealGeminiKeyHandler).Methods("POST")
	adminRouter.HandleFunc("/ai-config/gemini-key", adminOpsHandlers.AdminUpdateGeminiKeyHandler).Methods("PUT")
	adminRouter.HandleFunc("/settings", adminOpsHandlers.AdminListSettingsHandler).Methods("GET")
	adminRouter.HandleFunc("/settings/{key}", adminOpsHandlers.AdminUpdateSettingHandler).Methods("PUT")
	adminRouter.HandleFunc("/grading-queue/summary", adminOpsHandlers.AdminQueueSummaryHandler).Methods("GET")
	adminRouter.HandleFunc("/grading-queue/jobs", adminOpsHandlers.AdminQueueJobsHandler).Methods("GET")
	adminRouter.HandleFunc("/grading-queue/retry", adminOpsHandlers.AdminQueueRetryHandler).Methods("POST")
	adminRouter.HandleFunc("/settings/grading-mode", authHandlers.AdminGetGradingModeHandler).Methods("GET")
	adminRouter.HandleFunc("/settings/grading-mode", authHandlers.AdminSetGradingModeHandler).Methods("PUT")
	adminRouter.HandleFunc("/users", authHandlers.AdminListUsersHandler).Methods("GET")
	adminRouter.HandleFunc("/users/{userId}", authHandlers.AdminUserDetailHandler).Methods("GET")
	adminRouter.HandleFunc("/users/{userId}", authHandlers.AdminUpdateUserHandler).Methods("PUT")
	adminRouter.HandleFunc("/users/{userId}", authHandlers.AdminDeleteUserHandler).Methods("DELETE")
	adminRouter.HandleFunc("/users/{userId}/reset-password", authHandlers.AdminResetUserPasswordHandler).Methods("POST")
	adminRouter.HandleFunc("/users/{userId}/verify-teacher", authHandlers.AdminVerifyTeacherHandler).Methods("POST")
	adminRouter.HandleFunc("/profile-requests", authHandlers.ListProfileChangeRequestsHandler).Methods("GET")
	adminRouter.HandleFunc("/profile-requests/{requestId}/review", authHandlers.ReviewProfileChangeRequestHandler).Methods("POST")
	adminRouter.HandleFunc("/audit-logs", adminOpsHandlers.AdminAuditLogsHandler).Methods("GET")
	adminRouter.HandleFunc("/monitoring/submissions", adminOpsHandlers.AdminMonitoringSubmissionsHandler).Methods("GET")
	adminRouter.HandleFunc("/monitoring/grades", adminOpsHandlers.AdminMonitoringGradesHandler).Methods("GET")
	adminRouter.HandleFunc("/monitoring/question-bank", adminOpsHandlers.AdminMonitoringQuestionBankHandler).Methods("GET")
	adminRouter.HandleFunc("/monitoring/classes", adminOpsHandlers.AdminMonitoringClassesHandler).Methods("GET")
	adminRouter.HandleFunc("/monitoring/materials", adminOpsHandlers.AdminMonitoringMaterialsHandler).Methods("GET")
	adminRouter.HandleFunc("/monitoring/interactions", adminOpsHandlers.AdminMonitoringInteractionsHandler).Methods("GET")
	adminRouter.HandleFunc("/monitoring/users-activity", adminOpsHandlers.AdminMonitoringUsersActivityHandler).Methods("GET")
	adminRouter.HandleFunc("/override/grades/{submissionId}", adminOpsHandlers.AdminOverrideUpdateGradeHandler).Methods("PUT")
	adminRouter.HandleFunc("/override/grades/{submissionId}", adminOpsHandlers.AdminOverrideDeleteGradeHandler).Methods("DELETE")
	adminRouter.HandleFunc("/override/question-bank/{entryId}", adminOpsHandlers.AdminOverrideUpdateQuestionBankHandler).Methods("PUT")
	adminRouter.HandleFunc("/override/question-bank/{entryId}", adminOpsHandlers.AdminOverrideDeleteQuestionBankHandler).Methods("DELETE")
	adminRouter.HandleFunc("/override/classes/{classId}", adminOpsHandlers.AdminOverrideDeleteClassHandler).Methods("DELETE")
	adminRouter.HandleFunc("/override/materials/{materialId}", adminOpsHandlers.AdminOverrideDeleteMaterialHandler).Methods("DELETE")
	adminRouter.HandleFunc("/impersonation/start", adminOpsHandlers.AdminStartImpersonationHandler).Methods("POST")
	adminRouter.HandleFunc("/feature-flags", adminOpsHandlers.AdminListFeatureFlagsHandler).Methods("GET")
	adminRouter.HandleFunc("/feature-flags/{key}", adminOpsHandlers.AdminUpdateFeatureFlagHandler).Methods("PUT")
	adminRouter.HandleFunc("/anomaly-alerts", adminOpsHandlers.AdminAnomalyAlertsHandler).Methods("GET")
	adminRouter.HandleFunc("/reports/build", adminOpsHandlers.AdminBuildReportHandler).Methods("POST")
	adminRouter.HandleFunc("/announcements", adminOpsHandlers.AdminListAnnouncementsHandler).Methods("GET")
	adminRouter.HandleFunc("/announcements", adminOpsHandlers.AdminCreateAnnouncementHandler).Methods("POST")
	adminRouter.HandleFunc("/announcements/{announcementId}", adminOpsHandlers.AdminUpdateAnnouncementHandler).Methods("PUT")
	adminRouter.HandleFunc("/announcements/{announcementId}", adminOpsHandlers.AdminDeleteAnnouncementHandler).Methods("DELETE")
}
