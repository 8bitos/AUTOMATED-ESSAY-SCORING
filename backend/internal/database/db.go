package database

import (
	"database/sql" // Mengimpor package database/sql untuk berinteraksi dengan database SQL.
	"fmt"          // Mengimpor package fmt untuk fungsi format I/O.
	_ "github.com/lib/pq" // Mengimpor driver PostgreSQL secara blank (_) karena kita hanya membutuhkan side effect-nya (registrasi driver).
	"log"          // Mengimpor package log untuk logging.
)

// Connect establishes a connection to the PostgreSQL database.
// Fungsi ini menerima detail koneksi database (host, port, user, password, dbname)
// dan mengembalikan objek *sql.DB yang merepresentasikan koneksi ke database,
// atau error jika koneksi gagal.
func Connect(host, port, user, password, dbname string) (*sql.DB, error) {
	// Membentuk string koneksi (DSN - Data Source Name) menggunakan detail yang diberikan.
	// sslmode=disable berarti koneksi tidak akan menggunakan enkripsi SSL.
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)

	// Membuka koneksi ke database menggunakan driver "postgres".
	// sql.Open tidak benar-benar membuka koneksi, melainkan menginisialisasi objek DB.
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		// Jika ada error saat menginisialisasi objek DB, kembalikan error.
		return nil, fmt.Errorf("error opening database: %w", err)
	}

	// Mencoba untuk "ping" database untuk memverifikasi bahwa koneksi fisik dapat dibuat.
	// Ini adalah cara untuk memeriksa apakah database benar-benar hidup dan dapat dijangkau.
	err = db.Ping()
	if err != nil {
		// Jika ping gagal, tutup objek DB yang sudah dibuka dan kembalikan error.
		db.Close() // Pastikan koneksi ditutup untuk menghindari kebocoran sumber daya.
		return nil, fmt.Errorf("error connecting to the database: %w", err)
	}

	// Jika semua langkah berhasil, log pesan sukses dan kembalikan objek DB.
	log.Println("Successfully connected to the database!")
	return db, nil
}