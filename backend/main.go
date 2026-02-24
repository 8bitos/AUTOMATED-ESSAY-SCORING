package main

import (
	"api-backend/internal/database" // Mengimpor package untuk koneksi database.
	"api-backend/internal/routes"   // Mengimpor package untuk pengaturan rute API.
	"api-backend/internal/services" // Mengimpor package untuk inisialisasi layanan (business logic).
	"fmt"      // Mengimpor package fmt untuk fungsi format I/O.
	"log"      // Mengimpor package log untuk logging.
	"net/http" // Mengimpor package net/http untuk fungsionalitas server HTTP.
	"os"       // Mengimpor package os untuk berinteraksi dengan sistem operasi (misalnya, variabel lingkungan).
	"time"     // Mengimpor package time untuk fungsi terkait waktu.

	"github.com/golang-migrate/migrate/v4"         // Mengimpor package migrate untuk migrasi database.
	_ "github.com/golang-migrate/migrate/v4/database/postgres" // Driver PostgreSQL untuk migrate (import blank, karena hanya side effect yang dibutuhkan).
	_ "github.com/golang-migrate/migrate/v4/source/file"       // Sumber file untuk migrate (membaca migrasi dari file).
	"github.com/gorilla/handlers"                 // Mengimpor package handlers dari Gorilla Toolkit untuk middleware, seperti CORS.
	"github.com/gorilla/mux"                      // Mengimpor router Mux dari Gorilla Toolkit.
	"github.com/joho/godotenv"                    // Mengimpor godotenv untuk memuat variabel lingkungan dari file .env.
)

// getEnv adalah fungsi helper untuk mendapatkan nilai variabel lingkungan.
// Jika variabel tidak ditemukan, ia akan mengembalikan nilai fallback yang diberikan.
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// runMigrations bertanggung jawab untuk menjalankan migrasi database.
// Ia akan mencoba terhubung ke database dan menjalankan migrasi 'up'.
func runMigrations(databaseURL string, migrationsPath string) {
	const maxRetries = 10     // Jumlah maksimum percobaan koneksi ke database.
	const retryDelay = 5 * time.Second // Jeda waktu antar percobaan.

	var m *migrate.Migrate
	var err error

	// Loop untuk mencoba koneksi ke database hingga berhasil atau mencapai maxRetries.
	for i := 0; i < maxRetries; i++ {
		log.Printf("Attempting to connect to database for migrations (attempt %d/%d)...", i+1, maxRetries)
		// Membuat instance migrasi baru.
		// "file://" + migrationsPath menunjukkan bahwa migrasi berada dalam bentuk file SQL.
		m, err = migrate.New(
			"file://"+migrationsPath, // Sumber migrasi dari file SQL.
			databaseURL,              // URL koneksi database.
		)
		if err == nil {
			break // Koneksi berhasil, keluar dari loop.
		}
		log.Printf("Error connecting to database for migrations: %v. Retrying in %v...", err, retryDelay)
		time.Sleep(retryDelay) // Tunggu sebelum mencoba lagi.
	}

	// Jika masih gagal setelah semua percobaan, log fatal error.
	if err != nil {
		log.Fatalf("Failed to connect to database for migrations after %d attempts: %v", maxRetries, err)
	}

	// Menjalankan semua migrasi 'up' (menerapkan perubahan skema database).
	// migrate.ErrNoChange diabaikan karena berarti tidak ada migrasi baru yang perlu dijalankan.
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatalf("Error running migrations: %v", err)
	}

	log.Println("Database migrations applied successfully!")
}

// main adalah fungsi utama yang akan dieksekusi saat aplikasi dimulai.
func main() {
	// Memuat variabel lingkungan dari file .env yang ada di root direktori backend.
	// Jika file tidak ditemukan, aplikasi akan menggunakan variabel lingkungan dari OS.
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, reading environment variables from OS")
	}

	// Mendapatkan detail koneksi database dari variabel lingkungan atau menggunakan nilai default.
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5433") // Port default untuk PostgreSQL di docker-compose.
	dbUser := getEnv("DB_USER", "user")
	dbPassword := getEnv("DB_PASSWORD", "password")
	dbName := getEnv("DB_NAME", "essay_scoring")

	// Membentuk URL koneksi database untuk digunakan oleh `golang-migrate`.
	databaseURL := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		dbUser, dbPassword, dbHost, dbPort, dbName)

	// Mendefinisikan jalur ke file migrasi.
	// Path ini relatif terhadap lokasi file main.go.
	// Jika file migrasi berada di SAGE-Skripsi/backend/db/migration, maka path-nya "./db/migration".
	migrationsPath := "./db/migration"

	// Menjalankan migrasi database yang telah disiapkan.
	runMigrations(databaseURL, migrationsPath)

	// Mendapatkan asal (origin) frontend dari variabel lingkungan untuk konfigurasi CORS.
	frontendOrigin := getEnv("FRONTEND_ORIGIN", "http://localhost:3000")

	// Menghubungkan ke database PostgreSQL menggunakan package database internal.
	// Fungsi database.Connect akan mengembalikan objek *sql.DB.
	db, err := database.Connect(dbHost, dbPort, dbUser, dbPassword, dbName)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close() // Pastikan koneksi database ditutup saat fungsi main selesai dieksekusi.

	// Menginisialisasi layanan (services) yang akan digunakan oleh handler.
	// Layanan ini berisi logika bisnis inti aplikasi dan berinteraksi dengan database melalui objek 'db'.
	materialService := services.NewMaterialService(db)
	essayQuestionService := services.NewEssayQuestionService(db)

	// Membuat router baru menggunakan mux (Gorilla Mux).
	router := mux.NewRouter()
	router.StrictSlash(true) // Mengaktifkan strict slash (misalnya, /path/ akan dialihkan ke /path).

	// Mengatur FileServer untuk melayani file statis dari direktori 'uploads'.
	// Ini memungkinkan akses ke file yang diunggah oleh pengguna (misalnya, esai, materi).
	// http.StripPrefix digunakan untuk menghapus awalan /uploads/ dari URL sebelum mencari file.
	fs := http.FileServer(http.Dir("./uploads/"))
	router.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", fs))

	// Mengatur semua rute API aplikasi menggunakan fungsi SetupRoutes dari package internal/routes.
	// Router, objek database, dan layanan-layanan disuntikkan ke SetupRoutes.
	routes.SetupRoutes(router, db, materialService, essayQuestionService)

	// Mengkonfigurasi middleware CORS (Cross-Origin Resource Sharing).
	// Ini penting untuk keamanan browser, memungkinkan frontend yang berjalan di domain berbeda
	// untuk membuat permintaan ke backend ini.
	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{frontendOrigin}), // Hanya izinkan permintaan dari origin frontend yang ditentukan.
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}), // Metode HTTP yang diizinkan.
		handlers.AllowedHeaders([]string{"X-Requested-with", "Content-Type", "Authorization"}), // Header permintaan yang diizinkan.
		handlers.AllowCredentials(), // Mengizinkan pengiriman kredensial (seperti cookies atau header otorisasi).
	)

	// Menerapkan middleware CORS ke router utama.
	var finalHandler http.Handler = corsHandler(router)

	// Menerapkan Panic Recovery Middleware.
	// Middleware ini menangani "panic" (kesalahan runtime tak terduga) yang mungkin terjadi
	// selama pemrosesan permintaan HTTP. Tujuannya adalah untuk mencegah server crash total
	// dan mengembalikan respons error yang lebih anggun.
	// Asumsi: routes.PanicRecoveryMiddleware ada dan berfungsi dengan baik dalam proyek ini.
	finalHandler = routes.PanicRecoveryMiddleware(finalHandler)

	// Mencetak pesan log bahwa server akan dimulai dan di port mana.
	log.Println("Server starting on port 8080...")
	// Memulai server HTTP. log.Fatal akan menghentikan program jika ada error
	// saat memulai server (misalnya, port sudah digunakan).
	log.Fatal(http.ListenAndServe(":8080", finalHandler))
}
