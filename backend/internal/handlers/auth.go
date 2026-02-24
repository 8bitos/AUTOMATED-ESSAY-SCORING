package handlers

import (
	"api-backend/internal/models"
	"api-backend/internal/services"
	"api-backend/internal/utils" // Import utils for JWT
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time" // Import time for cookie expiration

	"github.com/gorilla/mux"
)

// AuthHandlers holds dependencies for authentication handlers.
type AuthHandlers struct {
	AuthService    *services.AuthService
	SettingService *services.SystemSettingService
	AuditService   *services.AdminAuditService
}

// NewAuthHandlers creates a new instance of AuthHandlers.
func NewAuthHandlers(authService *services.AuthService, settingService *services.SystemSettingService, auditService *services.AdminAuditService) *AuthHandlers {
	return &AuthHandlers{AuthService: authService, SettingService: settingService, AuditService: auditService}
}

// respondWithJSON is a helper to write JSON responses.
func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, _ := json.Marshal(payload)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

// respondWithError is a helper to write JSON error responses.
func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, map[string]string{"message": message})
}

// LoginHandler handles user login, sets an HttpOnly cookie, and returns user data.
func (h *AuthHandlers) LoginHandler(w http.ResponseWriter, r *http.Request) {
	var req models.UserLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Authenticate user using the identifier (email or username)
	user, err := h.AuthService.AuthenticateUser(req.Identifier, req.Password)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	// Generate JWT token
	tokenString, err := utils.GenerateJWT(user)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	// Set JWT as an HttpOnly cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "auth_token",
		Value:    tokenString,
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
		Path:     "/",
		SameSite: http.SameSiteLaxMode, // Explicitly set SameSite for better browser compatibility
		// Secure:   true, // Should be enabled in production (HTTPS)
	})

	// Return user data in the response body as expected by the frontend context
	respondWithJSON(w, http.StatusOK, user)
}

// RegisterHandler handles new user registration requests.
func (h *AuthHandlers) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var req models.UserRegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Basic validation
	if req.NamaLengkap == "" || req.Username == "" || req.Email == "" || req.Password == "" || req.Peran == "" {
		respondWithError(w, http.StatusBadRequest, "All required fields must be provided")
		return
	}
	if req.Peran != "student" && req.Peran != "teacher" {
		respondWithError(w, http.StatusBadRequest, "Invalid role specified. Must be 'student' or 'teacher'.")
		return
	}

	// Register user
	registeredUser, err := h.AuthService.RegisterUser(req)
	if err != nil {
		// More specific error for existing user
		if err.Error() == "email or username already exists" {
			respondWithError(w, http.StatusConflict, err.Error())
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to register user")
		return
	}

	// Return the newly created user (without password)
	respondWithJSON(w, http.StatusCreated, registeredUser)
}

// MeHandler returns the currently authenticated user based on the session cookie.
func (h *AuthHandlers) MeHandler(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("auth_token")
	if err != nil {
		if err == http.ErrNoCookie {
			respondWithError(w, http.StatusUnauthorized, "No authorization token provided")
			return
		}
		respondWithError(w, http.StatusBadRequest, "Invalid cookie")
		return
	}

	tokenString := cookie.Value
	claims, err := utils.ValidateJWT(tokenString)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid or expired token")
		return
	}

	user, err := h.AuthService.GetUserByID(claims.UserID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	respondWithJSON(w, http.StatusOK, user)
}

// LogoutHandler clears the authentication cookie.
func (h *AuthHandlers) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	// Set the cookie with an expiration date in the past to delete it.
	http.SetCookie(w, &http.Cookie{
		Name:     "auth_token",
		Value:    "",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Path:     "/",
		SameSite: http.SameSiteLaxMode, // Match the login cookie policy
	})

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Successfully logged out"})
}

// ProfileHandler returns the authenticated user's profile.
func (h *AuthHandlers) ProfileHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	user, err := h.AuthService.GetUserByID(userID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	respondWithJSON(w, http.StatusOK, user)
}

// UpdateProfileHandler updates the authenticated user's profile.
func (h *AuthHandlers) UpdateProfileHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	var req models.UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	updated, pendingFields, err := h.AuthService.UpdateProfile(userID, &req)
	if err != nil {
		if err.Error() == "email already exists" || err.Error() == "username already exists" {
			respondWithError(w, http.StatusConflict, err.Error())
			return
		}
		if err.Error() == "no fields to update" {
			respondWithError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to update profile")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"user":           updated,
		"pending_fields": pendingFields,
		"message":        "Profile updated",
	})
}

// ChangePasswordHandler updates the authenticated user's password.
func (h *AuthHandlers) ChangePasswordHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	var req models.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.AuthService.ChangePassword(userID, req.CurrentPassword, req.NewPassword); err != nil {
		if err.Error() == "invalid current password" {
			respondWithError(w, http.StatusUnauthorized, err.Error())
			return
		}
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Password updated successfully"})
}

// ListProfileChangeRequestsHandler lists profile change requests for superadmin.
func (h *AuthHandlers) ListProfileChangeRequestsHandler(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	requests, err := h.AuthService.ListProfileChangeRequests(status)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load profile change requests")
		return
	}
	respondWithJSON(w, http.StatusOK, requests)
}

// MyProfileChangeRequestsHandler lists profile change requests for current authenticated user.
func (h *AuthHandlers) MyProfileChangeRequestsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	status := r.URL.Query().Get("status")
	requests, err := h.AuthService.ListProfileChangeRequestsByUser(userID, status)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load profile change requests")
		return
	}
	respondWithJSON(w, http.StatusOK, requests)
}

// ReviewProfileChangeRequestHandler approves or rejects a profile change request.
func (h *AuthHandlers) ReviewProfileChangeRequestHandler(w http.ResponseWriter, r *http.Request) {
	reviewerID, ok := r.Context().Value("userID").(string)
	if !ok || reviewerID == "" {
		respondWithError(w, http.StatusUnauthorized, "User ID not found in context")
		return
	}

	vars := mux.Vars(r)
	requestID, ok := vars["requestId"]
	if !ok || requestID == "" {
		respondWithError(w, http.StatusBadRequest, "Request ID is missing")
		return
	}

	var payload struct {
		Action string `json:"action"`
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.AuthService.ReviewProfileChangeRequest(requestID, reviewerID, payload.Action, payload.Reason); err != nil {
		if err.Error() == "request not found" {
			respondWithError(w, http.StatusNotFound, err.Error())
			return
		}
		if err.Error() == "request already reviewed" || err.Error() == "invalid action" {
			respondWithError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to review request")
		return
	}

	_ = h.AuditService.LogAction(reviewerID, "review_profile_request", "profile_change_request", &requestID, map[string]interface{}{
		"action": payload.Action,
		"reason": payload.Reason,
	})

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Request processed"})
}

func (h *AuthHandlers) AdminDashboardSummaryHandler(w http.ResponseWriter, r *http.Request) {
	summary, err := h.AuthService.GetAdminDashboardSummary()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load dashboard summary")
		return
	}
	respondWithJSON(w, http.StatusOK, summary)
}

func (h *AuthHandlers) AdminAPIStatisticsHandler(w http.ResponseWriter, r *http.Request) {
	days := 7
	if raw := r.URL.Query().Get("days"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			days = parsed
		}
	}
	stats, err := h.AuthService.GetAdminAPIStatistics(days)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load API statistics")
		return
	}
	respondWithJSON(w, http.StatusOK, stats)
}

func (h *AuthHandlers) AdminGetGradingModeHandler(w http.ResponseWriter, r *http.Request) {
	if h.SettingService == nil {
		respondWithError(w, http.StatusInternalServerError, "Settings service is unavailable")
		return
	}
	mode, err := h.SettingService.GetGradingMode()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load grading mode")
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"mode": mode})
}

func (h *AuthHandlers) AdminSetGradingModeHandler(w http.ResponseWriter, r *http.Request) {
	if h.SettingService == nil {
		respondWithError(w, http.StatusInternalServerError, "Settings service is unavailable")
		return
	}
	var payload struct {
		Mode string `json:"mode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if payload.Mode == "" {
		respondWithError(w, http.StatusBadRequest, "Mode is required")
		return
	}
	if err := h.SettingService.SetGradingMode(payload.Mode); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	actorID, _ := r.Context().Value("userID").(string)
	modeValue := strings.ToLower(payload.Mode)
	_ = h.AuditService.LogAction(actorID, "set_grading_mode", "system_setting", nil, map[string]interface{}{
		"key":   "grading_mode",
		"value": modeValue,
	})
	respondWithJSON(w, http.StatusOK, map[string]string{"mode": modeValue})
}

func (h *AuthHandlers) AdminListUsersHandler(w http.ResponseWriter, r *http.Request) {
	role := r.URL.Query().Get("role")
	query := r.URL.Query().Get("q")
	sort := r.URL.Query().Get("sort")

	users, err := h.AuthService.ListUsersForAdmin(role, query, sort)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load users")
		return
	}
	respondWithJSON(w, http.StatusOK, users)
}

func (h *AuthHandlers) AdminUserDetailHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]
	if userID == "" {
		respondWithError(w, http.StatusBadRequest, "User ID is required")
		return
	}

	detail, err := h.AuthService.GetAdminUserDetail(userID)
	if err != nil {
		if err.Error() == "user not found" {
			respondWithError(w, http.StatusNotFound, err.Error())
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to load user detail")
		return
	}

	respondWithJSON(w, http.StatusOK, detail)
}

func (h *AuthHandlers) AdminResetUserPasswordHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]
	if userID == "" {
		respondWithError(w, http.StatusBadRequest, "User ID is required")
		return
	}

	var payload struct {
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.AuthService.AdminResetPassword(userID, payload.NewPassword); err != nil {
		if err.Error() == "user not found" {
			respondWithError(w, http.StatusNotFound, err.Error())
			return
		}
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	actorID, _ := r.Context().Value("userID").(string)
	_ = h.AuditService.LogAction(actorID, "reset_user_password", "user", &userID, nil)

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Password berhasil direset"})
}

func (h *AuthHandlers) AdminVerifyTeacherHandler(w http.ResponseWriter, r *http.Request) {
	reviewerID, _ := r.Context().Value("userID").(string)
	vars := mux.Vars(r)
	userID := vars["userId"]
	if userID == "" {
		respondWithError(w, http.StatusBadRequest, "User ID is required")
		return
	}

	var payload struct {
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	verified := payload.Action != "revoke"
	if payload.Action != "approve" && payload.Action != "revoke" {
		respondWithError(w, http.StatusBadRequest, "Action must be 'approve' or 'revoke'")
		return
	}

	if err := h.AuthService.SetTeacherVerification(userID, verified, reviewerID); err != nil {
		switch err.Error() {
		case "user not found":
			respondWithError(w, http.StatusNotFound, err.Error())
			return
		case "only teacher can be verified":
			respondWithError(w, http.StatusBadRequest, err.Error())
			return
		default:
			respondWithError(w, http.StatusInternalServerError, "Failed to update teacher verification")
			return
		}
	}

	_ = h.AuditService.LogAction(reviewerID, "verify_teacher", "user", &userID, map[string]interface{}{
		"action":   payload.Action,
		"verified": verified,
	})

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Teacher verification updated"})
}

func (h *AuthHandlers) AdminUpdateUserHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]
	if userID == "" {
		respondWithError(w, http.StatusBadRequest, "User ID is required")
		return
	}

	var req models.AdminUpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user, err := h.AuthService.AdminUpdateUser(userID, &req)
	if err != nil {
		switch err.Error() {
		case "user not found":
			respondWithError(w, http.StatusNotFound, err.Error())
			return
		case "email already exists", "username already exists", "invalid role", "nama_lengkap cannot be empty", "email cannot be empty", "no fields to update":
			respondWithError(w, http.StatusBadRequest, err.Error())
			return
		default:
			respondWithError(w, http.StatusInternalServerError, "Failed to update user")
			return
		}
	}

	actorID, _ := r.Context().Value("userID").(string)
	_ = h.AuditService.LogAction(actorID, "update_user", "user", &userID, req)

	respondWithJSON(w, http.StatusOK, user)
}

func (h *AuthHandlers) AdminDeleteUserHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]
	if userID == "" {
		respondWithError(w, http.StatusBadRequest, "User ID is required")
		return
	}

	if err := h.AuthService.AdminDeleteUser(userID); err != nil {
		if err.Error() == "user not found" {
			respondWithError(w, http.StatusNotFound, err.Error())
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to delete user")
		return
	}

	actorID, _ := r.Context().Value("userID").(string)
	_ = h.AuditService.LogAction(actorID, "delete_user", "user", &userID, nil)

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "User deleted"})
}

func (h *AuthHandlers) PublicTeacherProfileHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	teacherID := vars["teacherId"]
	if teacherID == "" {
		respondWithError(w, http.StatusBadRequest, "Teacher ID is required")
		return
	}

	profile, err := h.AuthService.GetPublicTeacherProfile(teacherID)
	if err != nil {
		if err.Error() == "teacher not found" {
			respondWithError(w, http.StatusNotFound, err.Error())
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to load teacher profile")
		return
	}

	respondWithJSON(w, http.StatusOK, profile)
}
