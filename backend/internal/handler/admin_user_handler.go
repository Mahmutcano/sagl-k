package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	authmw "medical-consultation-platform/backend/internal/middleware"
	"medical-consultation-platform/backend/internal/pkg/audit"
	"medical-consultation-platform/backend/internal/pkg/password"
	"medical-consultation-platform/backend/internal/pkg/response"
	"medical-consultation-platform/backend/internal/pkg/validate"
	"medical-consultation-platform/backend/internal/repository"
)

type AdminUserHandler struct {
	db    *repository.DB
	audit *audit.Logger
}

func NewAdminUserHandler(db *repository.DB, audit *audit.Logger) *AdminUserHandler {
	return &AdminUserHandler{db: db, audit: audit}
}

type AdminUserListResponse struct {
	ID                 string    `json:"id"`
	FirstName          string    `json:"firstName"`
	LastName           string    `json:"lastName"`
	Email              string    `json:"email"`
	PhoneNumber        string    `json:"phoneNumber"`
	NationalIdentifier string    `json:"nationalIdentifier"`
	Role               string    `json:"role"`
	IsActive           bool      `json:"isActive"`
	CreatedAt          time.Time `json:"createdAt"`
}

func (h *AdminUserHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	if claims == nil {
		response.Fail(w, http.StatusUnauthorized, "AUTH001", "Oturum gerekli.")
		return
	}

	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id, first_name, last_name, email, phone_number, national_identifier, role, is_active, created_at
		FROM users
		ORDER BY created_at DESC
	`)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM090", "Kullanıcılar listelenemedi.")
		return
	}
	defer rows.Close()

	users := make([]AdminUserListResponse, 0)
	for rows.Next() {
		var u AdminUserListResponse
		var tc *string
		err := rows.Scan(&u.ID, &u.FirstName, &u.LastName, &u.Email, &u.PhoneNumber, &tc, &u.Role, &u.IsActive, &u.CreatedAt)
		if err != nil {
			continue
		}
		if tc != nil {
			u.NationalIdentifier = *tc
		}
		users = append(users, u)
	}

	response.OK(w, users)
}

func (h *AdminUserHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	if claims == nil {
		response.Fail(w, http.StatusUnauthorized, "AUTH001", "Oturum gerekli.")
		return
	}

	targetIDStr := chi.URLParam(r, "id")
	targetID, err := uuid.Parse(targetIDStr)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM091", "Geçersiz kullanıcı ID.")
		return
	}

	var p ProfileResponse
	var dob time.Time
	var gender int

	err = h.db.Pool.QueryRow(r.Context(), `
		SELECT id, first_name, last_name, email, phone_number, national_identifier, date_of_birth, gender, role
		FROM users WHERE id = $1
	`, targetID).Scan(&p.ID, &p.FirstName, &p.LastName, &p.Email, &p.PhoneNumber, &p.NationalIdentifier, &dob, &gender, &p.Role)

	if err != nil {
		response.Fail(w, http.StatusNotFound, "ADM092", "Kullanıcı bulunamadı.")
		return
	}

	if !dob.IsZero() {
		dobStr := dob.Format("2006-01-02")
		p.DateOfBirth = &dobStr
	}
	if gender > 0 {
		p.Gender = &gender
	}

	response.OK(w, p)
}

type AdminUserUpdateRequest struct {
	FirstName          string  `json:"firstName"`
	LastName           string  `json:"lastName"`
	Email              string  `json:"email"`
	NationalIdentifier string  `json:"nationalIdentifier"`
	PhoneNumber        string  `json:"phoneNumber"`
	DateOfBirth        *string `json:"dateOfBirth"`
	Gender             *int    `json:"gender"`
	Role               string  `json:"role"`
	IsActive           bool    `json:"isActive"`
	Password           string  `json:"password"`
}

func (h *AdminUserHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	if claims == nil {
		response.Fail(w, http.StatusUnauthorized, "AUTH001", "Oturum gerekli.")
		return
	}

	targetIDStr := chi.URLParam(r, "id")
	targetID, err := uuid.Parse(targetIDStr)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM093", "Geçersiz kullanıcı ID.")
		return
	}

	var req AdminUserUpdateRequest
	if !validate.DecodeJSON(w, r, &req) {
		return
	}

	var errs validate.Errors
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Email = strings.TrimSpace(req.Email)
	req.NationalIdentifier = strings.TrimSpace(req.NationalIdentifier)
	req.PhoneNumber = strings.TrimSpace(req.PhoneNumber)
	req.Role = strings.TrimSpace(req.Role)

	if req.FirstName == "" {
		errs.Add("firstName", "required", "Ad alanı zorunludur.")
	}
	if req.LastName == "" {
		errs.Add("lastName", "required", "Soyad alanı zorunludur.")
	}
	validate.Email(&errs, "email", req.Email)
	validate.NationalID(&errs, "nationalIdentifier", req.NationalIdentifier)
	if req.PhoneNumber == "" {
		errs.Add("phoneNumber", "required", "Telefon numarası zorunludur.")
	}

	if req.Gender != nil && *req.Gender != 1 && *req.Gender != 2 {
		errs.Add("gender", "invalid", "Geçersiz cinsiyet seçimi.")
	}

	if errs.Has() {
		validate.Fail(w, errs)
		return
	}

	// Unique check for email, phone, TC
	var exists bool
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND id <> $2)`, req.Email, targetID).Scan(&exists)
	if exists {
		errs.Add("email", "unique", "Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor.")
		validate.Fail(w, errs)
		return
	}
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM users WHERE phone_number = $1 AND id <> $2)`, req.PhoneNumber, targetID).Scan(&exists)
	if exists {
		errs.Add("phoneNumber", "unique", "Bu telefon numarası başka bir kullanıcı tarafından kullanılıyor.")
		validate.Fail(w, errs)
		return
	}
	_ = h.db.Pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM users WHERE national_identifier = $1 AND id <> $2)`, req.NationalIdentifier, targetID).Scan(&exists)
	if exists {
		errs.Add("nationalIdentifier", "unique", "Bu T.C. Kimlik numarası başka bir kullanıcı tarafından kullanılıyor.")
		validate.Fail(w, errs)
		return
	}

	// Parse dateOfBirth
	var dob *time.Time
	if req.DateOfBirth != nil && *req.DateOfBirth != "" {
		parsed, err := time.Parse("2006-01-02", *req.DateOfBirth)
		if err != nil {
			errs.Add("dateOfBirth", "invalid", "Geçersiz doğum tarihi formatı (YYYY-MM-DD olmalı).")
			validate.Fail(w, errs)
			return
		}
		dob = &parsed
	}

	// Check if password change is requested
	var hashUpdated bool
	var newHash string
	if req.Password != "" {
		validate.Password(&errs, "password", req.Password)
		if errs.Has() {
			validate.Fail(w, errs)
			return
		}
		hashed, err := password.Hash(req.Password)
		if err != nil {
			response.Fail(w, http.StatusInternalServerError, "ADM094", "Şifre şifrelenemedi.")
			return
		}
		newHash = hashed
		hashUpdated = true
	}

	var updateErr error
	if hashUpdated {
		_, updateErr = h.db.Pool.Exec(r.Context(), `
			UPDATE users
			SET first_name = $1, last_name = $2, email = $3, phone_number = $4,
				national_identifier = $5, date_of_birth = $6, gender = $7,
				role = $8, is_active = $9, password_hash = $10, updated_at = now()
			WHERE id = $11
		`, req.FirstName, req.LastName, req.Email, req.PhoneNumber, req.NationalIdentifier, dob, req.Gender, req.Role, req.IsActive, newHash, targetID)
	} else {
		_, updateErr = h.db.Pool.Exec(r.Context(), `
			UPDATE users
			SET first_name = $1, last_name = $2, email = $3, phone_number = $4,
				national_identifier = $5, date_of_birth = $6, gender = $7,
				role = $8, is_active = $9, updated_at = now()
			WHERE id = $10
		`, req.FirstName, req.LastName, req.Email, req.PhoneNumber, req.NationalIdentifier, dob, req.Gender, req.Role, req.IsActive, targetID)
	}

	if updateErr != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM095", "Kullanıcı güncellenemedi.")
		return
	}

	h.audit.Log(r.Context(), &claims.UserID, "admin_update_user", "users", &targetID, map[string]interface{}{
		"email": req.Email, "tc": req.NationalIdentifier, "phone": req.PhoneNumber, "role": req.Role, "isActive": req.IsActive,
	})

	response.OK(w, map[string]interface{}{
		"message": "Kullanıcı bilgileri admin tarafından başarıyla güncellendi.",
	})
}
