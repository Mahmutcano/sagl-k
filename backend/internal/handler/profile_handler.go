package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	authmw "medical-consultation-platform/backend/internal/middleware"
	"medical-consultation-platform/backend/internal/pkg/audit"
	"medical-consultation-platform/backend/internal/pkg/password"
	"medical-consultation-platform/backend/internal/pkg/response"
	"medical-consultation-platform/backend/internal/pkg/validate"
	"medical-consultation-platform/backend/internal/repository"
	notifysvc "medical-consultation-platform/backend/internal/service/notification"
)

type ProfileHandler struct {
	db     *repository.DB
	notify *notifysvc.Service
	audit  *audit.Logger
}

func NewProfileHandler(db *repository.DB, notify *notifysvc.Service, audit *audit.Logger) *ProfileHandler {
	return &ProfileHandler{db: db, notify: notify, audit: audit}
}

type ProfileResponse struct {
	ID                 string  `json:"id"`
	FirstName          string  `json:"firstName"`
	LastName           string  `json:"lastName"`
	Email              string  `json:"email"`
	PhoneNumber        string  `json:"phoneNumber"`
	NationalIdentifier string  `json:"nationalIdentifier"`
	DateOfBirth        *string `json:"dateOfBirth"`
	Gender             *int    `json:"gender"`
	Role               string  `json:"role"`
}

func (h *ProfileHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	if claims == nil {
		response.Fail(w, http.StatusUnauthorized, "AUTH001", "Oturum gerekli.")
		return
	}

	var p ProfileResponse
	var dob *time.Time
	var gender *int
	var nationalID *string
	var email *string
	var phone *string

	err := h.db.Pool.QueryRow(r.Context(), `
		SELECT id::text, first_name, last_name, email, phone_number, national_identifier, date_of_birth, gender, role::text
		FROM users WHERE id = $1 AND is_active = true
	`, claims.UserID).Scan(
		&p.ID, &p.FirstName, &p.LastName, &email, &phone, &nationalID, &dob, &gender, &p.Role,
	)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "PROF001", "Kullanıcı profili bulunamadı.")
		return
	}

	if email != nil {
		p.Email = *email
	}
	if phone != nil {
		p.PhoneNumber = *phone
	}
	if nationalID != nil {
		p.NationalIdentifier = *nationalID
	}
	if dob != nil && !dob.IsZero() {
		dobStr := dob.Format("2006-01-02")
		p.DateOfBirth = &dobStr
	}
	if gender != nil && *gender > 0 {
		p.Gender = gender
	}

	response.OK(w, p)
}

type ProfileUpdateRequest struct {
	FirstName          string  `json:"firstName"`
	LastName           string  `json:"lastName"`
	Email              string  `json:"email"`
	NationalIdentifier string  `json:"nationalIdentifier"`
	PhoneNumber        string  `json:"phoneNumber"`
	DateOfBirth        *string `json:"dateOfBirth"`
	Gender             *int    `json:"gender"`
	OldPassword        string  `json:"oldPassword"`
	NewPassword        string  `json:"newPassword"`
}

func (h *ProfileHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	if claims == nil {
		response.Fail(w, http.StatusUnauthorized, "AUTH001", "Oturum gerekli.")
		return
	}

	var req ProfileUpdateRequest
	if !validate.DecodeJSON(w, r, &req) {
		return
	}

	// Validate inputs
	var errs validate.Errors
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Email = strings.TrimSpace(req.Email)
	req.NationalIdentifier = strings.TrimSpace(req.NationalIdentifier)
	req.PhoneNumber = strings.TrimSpace(req.PhoneNumber)

	if req.FirstName == "" {
		errs.Add("firstName", "required", "Ad alanı zorunludur.")
	}
	if req.LastName == "" {
		errs.Add("lastName", "required", "Soyad alanı zorunludur.")
	}
	validate.Email(&errs, "email", req.Email)
	validate.NationalID(&errs, "nationalIdentifier", req.NationalIdentifier)

	if req.Gender != nil && *req.Gender != 1 && *req.Gender != 2 {
		errs.Add("gender", "invalid", "Geçersiz cinsiyet seçimi.")
	}

	if errs.Has() {
		validate.Fail(w, errs)
		return
	}

	var currentHash, currentPhone, currentEmail, currentTC string
	err := h.db.Pool.QueryRow(r.Context(), `
		SELECT password_hash, phone_number, email, national_identifier FROM users WHERE id = $1
	`, claims.UserID).Scan(&currentHash, &currentPhone, &currentEmail, &currentTC)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "PROF002", "Kullanıcı bulunamadı.")
		return
	}

	// Password update checks
	var updatedHash string = currentHash
	if req.NewPassword != "" {
		if req.OldPassword == "" {
			errs.Add("oldPassword", "required", "Şifrenizi değiştirmek için mevcut şifrenizi giriniz.")
			validate.Fail(w, errs)
			return
		}
		if !password.Compare(currentHash, req.OldPassword) {
			errs.Add("oldPassword", "invalid", "Mevcut şifreniz hatalı.")
			validate.Fail(w, errs)
			return
		}
		validate.Password(&errs, "newPassword", req.NewPassword)
		if errs.Has() {
			validate.Fail(w, errs)
			return
		}
		hash, err := password.Hash(req.NewPassword)
		if err != nil {
			response.Fail(w, http.StatusInternalServerError, "PROF003", "Şifre güncellenirken hata oluştu.")
			return
		}
		updatedHash = hash
	}

	// Unique check for email and TC
	if req.Email != currentEmail {
		var exists bool
		_ = h.db.Pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND id <> $2)`, req.Email, claims.UserID).Scan(&exists)
		if exists {
			errs.Add("email", "unique", "Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor.")
			validate.Fail(w, errs)
			return
		}
	}
	if req.NationalIdentifier != currentTC {
		var exists bool
		_ = h.db.Pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM users WHERE national_identifier = $1 AND id <> $2)`, req.NationalIdentifier, claims.UserID).Scan(&exists)
		if exists {
			errs.Add("nationalIdentifier", "unique", "Bu T.C. Kimlik numarası başka bir kullanıcı tarafından kullanılıyor.")
			validate.Fail(w, errs)
			return
		}
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

	// Execute general profile update (except phone number)
	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE users
		SET first_name = $1, last_name = $2, email = $3, national_identifier = $4,
			date_of_birth = $5, gender = $6, password_hash = $7, updated_at = now()
		WHERE id = $8
	`, req.FirstName, req.LastName, req.Email, req.NationalIdentifier, dob, req.Gender, updatedHash, claims.UserID)

	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "PROF004", "Profil güncellenemedi.")
		return
	}

	h.audit.Log(r.Context(), &claims.UserID, "update_profile", "users", &claims.UserID, map[string]interface{}{
		"email": req.Email, "tc": req.NationalIdentifier, "name": req.FirstName + " " + req.LastName,
	})

	// If phone number is changed, trigger SMS OTP verification
	if req.PhoneNumber != "" && req.PhoneNumber != currentPhone {
		var exists bool
		_ = h.db.Pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM users WHERE phone_number = $1 AND id <> $2)`, req.PhoneNumber, claims.UserID).Scan(&exists)
		if exists {
			errs.Add("phoneNumber", "unique", "Bu telefon numarası başka bir kullanıcı tarafından kullanılıyor.")
			validate.Fail(w, errs)
			return
		}

		code, err := h.notify.SendSMS(r.Context(), req.PhoneNumber, "change_phone_otp", "Telefon güncelleme doğrulama", &claims.UserID, nil)
		if err != nil {
			response.Fail(w, http.StatusInternalServerError, "PROF005", "Doğrulama SMS'i gönderilemedi. Profilin geri kalanı güncellendi.")
			return
		}

		// Insert verification token
		_, err = h.db.Pool.Exec(r.Context(), `
			INSERT INTO verification_tokens (user_id, phone_number, token, purpose, expires_at)
			VALUES ($1, $2, $3, 'change_phone', now() + INTERVAL '10 minutes')
		`, claims.UserID, req.PhoneNumber, code)

		if err != nil {
			response.Fail(w, http.StatusInternalServerError, "PROF006", "Doğrulama kodu kaydedilemedi.")
			return
		}

		response.OK(w, map[string]interface{}{
			"requiresPhoneVerify": true,
			"message":             "Profil güncellendi. Telefon numaranızın doğrulanması için yeni numaranıza SMS gönderildi.",
		})
		return
	}

	response.OK(w, map[string]interface{}{
		"requiresPhoneVerify": false,
		"message":             "Profil bilgileriniz başarıyla güncellendi.",
	})
}

func (h *ProfileHandler) VerifyProfilePhone(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	if claims == nil {
		response.Fail(w, http.StatusUnauthorized, "AUTH001", "Oturum gerekli.")
		return
	}

	var req struct {
		Code string `json:"code"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}

	req.Code = strings.TrimSpace(req.Code)
	if req.Code == "" {
		response.Fail(w, http.StatusBadRequest, "PROF007", "Doğrulama kodu boş olamaz.")
		return
	}

	var tokenID uuid.UUID
	var newPhone string
	err := h.db.Pool.QueryRow(r.Context(), `
		SELECT id, phone_number FROM verification_tokens
		WHERE user_id = $1 AND token = $2 AND purpose = 'change_phone'
		  AND expires_at > now() AND used_at IS NULL
		ORDER BY created_at DESC LIMIT 1
	`, claims.UserID, req.Code).Scan(&tokenID, &newPhone)

	if err != nil {
		response.Fail(w, http.StatusForbidden, "PROF008", "Geçersiz veya süresi dolmuş doğrulama kodu.")
		return
	}

	// Update user phone number
	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE users SET phone_number = $1, is_phone_verified = true, updated_at = now()
		WHERE id = $2
	`, newPhone, claims.UserID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "PROF009", "Telefon numarası güncellenemedi.")
		return
	}

	// Mark token as used
	_, _ = h.db.Pool.Exec(r.Context(), `
		UPDATE verification_tokens SET used_at = now() WHERE id = $1
	`, tokenID)

	h.audit.Log(r.Context(), &claims.UserID, "change_phone", "users", &claims.UserID, map[string]interface{}{
		"phone": newPhone,
	})

	response.OK(w, map[string]interface{}{
		"message": "Telefon numaranız başarıyla güncellendi.",
	})
}
