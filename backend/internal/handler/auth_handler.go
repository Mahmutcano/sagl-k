package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"medical-consultation-platform/backend/internal/pkg/audit"
	"medical-consultation-platform/backend/internal/pkg/response"
	"medical-consultation-platform/backend/internal/pkg/validate"
	authsvc "medical-consultation-platform/backend/internal/service/auth"
)

type AuthHandler struct {
	svc   *authsvc.Service
	audit *audit.Logger
}

func NewAuthHandler(svc *authsvc.Service, audit *audit.Logger) *AuthHandler {
	return &AuthHandler{svc: svc, audit: audit}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req authsvc.LoginRequest
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.LoginIdentifier(&errs, "nationalIdentifier", req.NationalIdentifier)
	if strings.TrimSpace(req.Password) == "" {
		errs.Add("password", "required", "Şifre zorunludur.")
	} else if len(req.Password) > validate.MaxPasswordLength {
		errs.Add("password", "max_length", "Şifre çok uzun.")
	}
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	req.NationalIdentifier = strings.TrimSpace(req.NationalIdentifier)
	res, err := h.svc.Login(r.Context(), req)
	if err != nil {
		// Uniform message prevents user enumeration.
		response.Fail(w, http.StatusUnauthorized, "AUTH011", "Kimlik numarası veya şifre hatalı.")
		return
	}

	if userMap, ok := res.User.(map[string]interface{}); ok {
		if idStr, ok := userMap["id"].(string); ok {
			if uID, err := uuid.Parse(idStr); err == nil {
				h.audit.Log(r.Context(), &uID, "user_login", "users", &uID, map[string]interface{}{
					"role": userMap["role"],
				})
			}
		}
	}

	response.OK(w, res)
}

func (h *AuthHandler) AgreementsForRegister(w http.ResponseWriter, r *http.Request) {
	response.OK(w, []map[string]interface{}{
		{"id": "1", "title": "Kullanım Koşulları", "agreementType": 1, "isRequired": true},
		{"id": "2", "title": "KVKK Aydınlatma Metni", "agreementType": 2, "isRequired": true},
	})
}

func validateRegister(req *authsvc.RegisterInitRequest) validate.Errors {
	var errs validate.Errors
	req.FirstName = validate.FormatPersonName(req.FirstName)
	req.LastName = validate.FormatPersonName(req.LastName)
	validate.PersonName(&errs, "firstName", req.FirstName, "Ad")
	validate.PersonName(&errs, "lastName", req.LastName, "Soyad")
	validate.NationalityCode(&errs, "nationality", req.Nationality)

	req.Nationality = strings.ToUpper(strings.TrimSpace(req.Nationality))
	req.PhoneCountryCode = validate.NormalizeCountryCode(req.PhoneCountryCode)
	req.PhoneNumber = validate.NormalizeNationalPhone(req.PhoneCountryCode, req.PhoneNumber)
	req.PassportNumber = strings.ToUpper(strings.TrimSpace(req.PassportNumber))
	req.NationalIdentifier = strings.TrimSpace(req.NationalIdentifier)

	isTR := req.Nationality == "TR"
	if isTR {
		validate.NationalID(&errs, "nationalIdentifier", req.NationalIdentifier)
		validate.MatchGenderTCKN(&errs, "nationalIdentifier", "gender", req.NationalIdentifier, req.Gender)
		req.PassportNumber = ""
	} else {
		validate.PassportNumber(&errs, "passportNumber", req.PassportNumber)
		req.NationalIdentifier = ""
	}

	validate.PhoneNational(&errs, "phoneNumber", req.PhoneCountryCode, req.PhoneNumber)
	req.Email = strings.TrimSpace(req.Email)
	validate.EmailOptional(&errs, "email", req.Email)
	validate.Password(&errs, "password", req.Password)
	validate.DateOfBirth(&errs, "dateOfBirth", req.DateOfBirth)
	validate.Gender(&errs, "gender", req.Gender)
	return errs
}

func (h *AuthHandler) InitiateRegister(w http.ResponseWriter, r *http.Request) {
	var req authsvc.RegisterInitRequest
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	errs := validateRegister(&req)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	if conflictErrs := h.svc.CheckRegisterUniqueness(r.Context(), req); conflictErrs.Has() {
		validate.Fail(w, conflictErrs)
		return
	}
	challenge, err := h.svc.InitiateRegister(r.Context(), req)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "AUTH021", response.SafeMessage(err, "Kayıt başlatılamadı. Bilgilerinizi kontrol edin."))
		return
	}
	res := map[string]interface{}{
		"sent":             true,
		"expiresInSeconds": challenge.ExpiresInSeconds,
		"expiresAt":        challenge.ExpiresAt.UTC().Format(time.RFC3339),
	}
	if h.svc.IsMock() {
		res["code"] = challenge.Code
	}
	response.OK(w, res)
}

type completeRegisterBody struct {
	Code string `json:"code"`
	authsvc.RegisterInitRequest
}

func (h *AuthHandler) CompleteRegister(w http.ResponseWriter, r *http.Request) {
	var body completeRegisterBody
	if !validate.DecodeJSON(w, r, &body) {
		return
	}
	errs := validateRegister(&body.RegisterInitRequest)
	validate.OTP(&errs, "code", body.Code)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	if conflictErrs := h.svc.CheckRegisterUniqueness(r.Context(), body.RegisterInitRequest); conflictErrs.Has() {
		validate.Fail(w, conflictErrs)
		return
	}
	body.Code = strings.TrimSpace(body.Code)
	res, err := h.svc.CompleteRegister(r.Context(), body.RegisterInitRequest.PhoneNumber, body.Code, body.RegisterInitRequest)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "AUTH031", response.SafeMessage(err, "Kayıt tamamlanamadı. Kod geçersiz veya süresi dolmuş olabilir."))
		return
	}
	response.OK(w, res)
}

func (h *AuthHandler) InitiateForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PhoneNumber      string `json:"phoneNumber"`
		PhoneCountryCode string `json:"phoneCountryCode"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	req.PhoneCountryCode = validate.NormalizeCountryCode(req.PhoneCountryCode)
	req.PhoneNumber = validate.NormalizeNationalPhone(req.PhoneCountryCode, req.PhoneNumber)
	validate.PhoneNational(&errs, "phoneNumber", req.PhoneCountryCode, req.PhoneNumber)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	challenge, err := h.svc.InitiateForgotPassword(r.Context(), req.PhoneNumber, req.PhoneCountryCode)
	res := map[string]interface{}{
		"sent":             true,
		"expiresInSeconds": challenge.ExpiresInSeconds,
		"expiresAt":        challenge.ExpiresAt.UTC().Format(time.RFC3339),
	}
	if err == nil && h.svc.IsMock() {
		res["code"] = challenge.Code
	}
	// Always OK to avoid phone enumeration; expiry still returned for UX when sent.
	if err != nil {
		res["expiresInSeconds"] = 600
		res["expiresAt"] = time.Now().UTC().Add(10 * time.Minute).Format(time.RFC3339)
	}
	response.OK(w, res)
}

func (h *AuthHandler) CompleteForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PhoneNumber      string `json:"phoneNumber"`
		PhoneCountryCode string `json:"phoneCountryCode"`
		Code             string `json:"code"`
		Password         string `json:"password"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	req.PhoneCountryCode = validate.NormalizeCountryCode(req.PhoneCountryCode)
	req.PhoneNumber = validate.NormalizeNationalPhone(req.PhoneCountryCode, req.PhoneNumber)
	validate.PhoneNational(&errs, "phoneNumber", req.PhoneCountryCode, req.PhoneNumber)
	validate.OTP(&errs, "code", req.Code)
	validate.Password(&errs, "password", req.Password)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	if err := h.svc.CompleteForgotPassword(r.Context(), req.PhoneNumber, req.Code, req.Password); err != nil {
		response.Fail(w, http.StatusBadRequest, "AUTH051", "Kod geçersiz veya süresi dolmuş.")
		return
	}
	response.OK(w, map[string]bool{"success": true})
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refreshToken"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.RefreshToken) == "" {
		var errs validate.Errors
		errs.Add("refreshToken", "required", "Yenileme jetonu zorunludur.")
		validate.Fail(w, errs)
		return
	}
	res, err := h.svc.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		response.Fail(w, http.StatusUnauthorized, "AUTH061", "Oturum yenilenemedi. Lütfen tekrar giriş yapın.")
		return
	}
	response.OK(w, res)
}

func (h *AuthHandler) VerifyTFA(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code string `json:"code"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.OTP(&errs, "code", req.Code)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	response.OK(w, map[string]bool{"verified": true})
}
