package routes

import (
	"api-backend/internal/services"
	"api-backend/internal/utils" // Mengimpor package utilitas, kemungkinan untuk validasi JWT.
	"context"                    // Mengimpor package context untuk meneruskan nilai antar handler.
	"encoding/json"              // Mengimpor package encoding/json untuk encoding/decoding JSON.
	"log"                        // Mengimpor package log untuk logging.
	"net/http"                   // Mengimpor package net/http untuk fungsionalitas HTTP.
)

// Middleware helpers for JSON responses
// respondWithError adalah fungsi helper untuk mengirim respons error dalam format JSON.
func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, map[string]string{"message": message})
}

// TeacherWriteAccessMiddleware memblokir aksi create/update/delete untuk guru yang belum diverifikasi admin.
func TeacherWriteAccessMiddleware(authService *services.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			userRole, _ := r.Context().Value("userRole").(string)
			if userRole == "superadmin" {
				next.ServeHTTP(w, r)
				return
			}

			if userRole != "teacher" {
				next.ServeHTTP(w, r)
				return
			}

			userID, _ := r.Context().Value("userID").(string)
			if userID == "" {
				respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
				return
			}

			verified, err := authService.IsTeacherVerified(userID)
			if err != nil {
				if err.Error() == "user not found" {
					respondWithError(w, http.StatusUnauthorized, "User not found")
					return
				}
				respondWithError(w, http.StatusInternalServerError, "Failed to validate teacher verification")
				return
			}

			if !verified {
				respondWithError(w, http.StatusForbidden, "Akun guru belum terverifikasi. Akses saat ini hanya lihat data.")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// respondWithJSON adalah fungsi helper generik untuk mengirim respons dalam format JSON.
func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, _ := json.Marshal(payload)               // Mengubah payload menjadi JSON byte array.
	w.Header().Set("Content-Type", "application/json") // Mengatur header Content-Type.
	w.WriteHeader(code)                                // Mengatur status kode HTTP.
	w.Write(response)                                  // Menulis respons JSON ke client.
}

// AuthMiddleware memvalidasi token JWT dari cookie permintaan.
// Jika token valid, informasi pengguna (ID dan peran) disimpan dalam context permintaan
// untuk digunakan oleh handler downstream (handler setelah middleware ini).
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Mengambil cookie dengan nama "auth_token".
		cookie, err := r.Cookie("auth_token")
		if err != nil {
			// Jika cookie tidak ditemukan (http.ErrNoCookie), berarti tidak ada token otorisasi.
			if err == http.ErrNoCookie {
				respondWithError(w, http.StatusUnauthorized, "No authorization token provided")
				return
			}
			// Jika ada error lain saat membaca cookie, kemungkinan cookie tidak valid.
			respondWithError(w, http.StatusBadRequest, "Invalid cookie")
			return
		}

		tokenString := cookie.Value // Mengambil nilai token dari cookie.
		// Memvalidasi token JWT menggunakan fungsi dari package utils.
		claims, err := utils.ValidateJWT(tokenString)
		if err != nil {
			// Jika validasi token gagal (token tidak valid atau kadaluarsa).
			respondWithError(w, http.StatusUnauthorized, "Invalid or expired token")
			return
		}

		// Menyimpan ID pengguna dan peran pengguna ke dalam context permintaan.
		// Ini memungkinkan handler yang akan dipanggil selanjutnya untuk mengakses informasi ini.
		ctx := context.WithValue(r.Context(), "userID", claims.UserID)
		ctx = context.WithValue(ctx, "userRole", claims.UserRole)

		// Meneruskan permintaan ke handler berikutnya dalam rantai middleware/handler,
		// dengan context permintaan yang sudah diperbarui.
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// TeacherOnlyMiddleware memeriksa apakah pengguna memiliki peran 'teacher' atau 'superadmin'.
// Middleware ini harus selalu diurutkan SETELAH AuthMiddleware,
// karena ia bergantung pada informasi peran pengguna yang sudah ada di context.
func TeacherOnlyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Mengambil peran pengguna dari context permintaan.
		userRole, ok := r.Context().Value("userRole").(string)
		if !ok {
			// Jika peran pengguna tidak ditemukan di context (misalnya, AuthMiddleware tidak dijalankan).
			respondWithError(w, http.StatusForbidden, "User role not found in context")
			return
		}

		// Memeriksa apakah peran pengguna adalah 'teacher' atau 'superadmin'.
		if userRole != "teacher" && userRole != "superadmin" {
			// Jika bukan, akses ditolak.
			respondWithError(w, http.StatusForbidden, "Access denied: Teacher role required")
			return
		}

		// Jika peran sesuai, teruskan permintaan ke handler berikutnya.
		next.ServeHTTP(w, r)
	})
}

// SuperadminOnlyMiddleware memastikan pengguna berperan superadmin.
func SuperadminOnlyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userRole, ok := r.Context().Value("userRole").(string)
		if !ok {
			respondWithError(w, http.StatusForbidden, "User role not found in context")
			return
		}
		if userRole != "superadmin" {
			respondWithError(w, http.StatusForbidden, "Access denied: Superadmin role required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// PanicRecoveryMiddleware adalah middleware yang memulihkan dari 'panic' (kesalahan runtime).
// Jika terjadi panic selama pemrosesan permintaan, middleware ini akan menangkapnya,
// mencatatnya ke log, dan mengembalikan respons error 500 kepada client,
// mencegah server crash total.
func PanicRecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// defer func() akan dieksekusi setelah fungsi utama PanicRecoveryMiddleware selesai.
		defer func() {
			if err := recover(); err != nil { // recover() mencoba untuk mendapatkan nilai panic.
				log.Printf("PANIC RECOVERED: %v", err) // Log panic yang dipulihkan.
				respondWithError(w, http.StatusInternalServerError, "An internal server error occurred")
			}
		}()
		// Meneruskan permintaan ke handler berikutnya.
		next.ServeHTTP(w, r)
	})
}
