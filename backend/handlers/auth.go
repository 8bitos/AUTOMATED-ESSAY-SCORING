package handlers
import (
	"encoding/json" // Mengimpor package json untuk encoding dan decoding data JSON.
	"net/http"      // Mengimpor package net/http untuk fungsionalitas server HTTP.
	"api-backend/models" // Mengimpor package models lokal kita.
)
// RegisterHandler menangani logika untuk registrasi pengguna baru.
func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	// Membuat variabel 'user' dari tipe models.User untuk menyimpan data yang masuk.
	var user models.User
	// Mendekode body permintaan JSON ke dalam struct 'user'.
	// Jika ada error saat decoding, kirim respons error Bad Request.
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	// ----
	// Di sini, Anda akan menambahkan logika untuk:
	// 1. Validasi input (misalnya, email valid, password cukup kuat).
	// 2. Hash password sebelum menyimpannya ke database.
	// 3. Menyimpan pengguna baru ke database.
	// 4. Menangani error (misalnya, jika username atau email sudah ada).
	// ----
	// Untuk saat ini, kita hanya akan mengirim kembali data user yang diterima
	// sebagai konfirmasi, dengan status Created (201).
	// Mengatur header Content-Type ke application/json.
	w.Header().Set("Content-Type", "application/json")
	// Mengatur status kode HTTP ke 201 Created.
	w.WriteHeader(http.StatusCreated)
	// Meng-encode struct user kembali ke JSON dan mengirimkannya sebagai respons.
	json.NewEncoder(w).Encode(user)
}
