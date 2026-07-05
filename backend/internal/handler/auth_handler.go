package handler

import (
	"net/http"
	"strings"

	"medical-consultation-platform/backend/internal/pkg/response"
	"medical-consultation-platform/backend/internal/pkg/validate"
	authsvc "medical-consultation-platform/backend/internal/service/auth"
)

type AuthHandler struct {
	svc *authsvc.Service
}

func NewAuthHandler(svc *authsvc.Service) *AuthHandler {
	return &AuthHandler{svc: svc}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req authsvc.LoginRequest
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.NationalID(&errs, "nationalIdentifier", req.NationalIdentifier)
	if strings.TrimSpace(req.Password) == "" {
		errs.Add("password", "required", "Şifre zorunludur.")
	} else if len(req.Password) > validate.MaxPasswordLength {
		errs.Add("password", "max_length", "Şifre çok uzun.")
	}
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	res, err := h.svc.Login(r.Context(), req)
	if err != nil {
		// Uniform message prevents user enumeration.
		response.Fail(w, http.StatusUnauthorized, "AUTH011", "Kimlik numarası veya şifre hatalı.")
		return
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
	validate.PersonName(&errs, "firstName", req.FirstName, "Ad")
	validate.PersonName(&errs, "lastName", req.LastName, "Soyad")
	validate.NationalID(&errs, "nationalIdentifier", req.NationalIdentifier)
	validate.PhoneTR(&errs, "phoneNumber", req.PhoneNumber)
	validate.Email(&errs, "email", req.Email)
	validate.Password(&errs, "password", req.Password)
	validate.DateOfBirth(&errs, "dateOfBirth", req.DateOfBirth)
	validate.Gender(&errs, "gender", req.Gender)
	if req.Nationality == "" {
		req.Nationality = "TR"
	}
	if len(req.Nationality) < 2 || len(req.Nationality) > 3 {
		errs.Add("nationality", "format", "Uyruk kodu 2–3 karakter olmalıdır (ör. TR).")
	}
	req.PhoneNumber = validate.NormalizePhoneTR(req.PhoneNumber)
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
	if err := h.svc.InitiateRegister(r.Context(), req); err != nil {
		response.Fail(w, http.StatusBadRequest, "AUTH021", response.SafeMessage(err, "Kayıt başlatılamadı. Bilgilerinizi kontrol edin."))
		return
	}
	response.OK(w, map[string]bool{"sent": true})
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
	body.Code = strings.TrimSpace(body.Code)
	body.RegisterInitRequest.PhoneNumber = validate.NormalizePhoneTR(body.RegisterInitRequest.PhoneNumber)
	res, err := h.svc.CompleteRegister(r.Context(), body.RegisterInitRequest.PhoneNumber, body.Code, body.RegisterInitRequest)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "AUTH031", response.SafeMessage(err, "Kayıt tamamlanamadı. Kod geçersiz veya süresi dolmuş olabilir."))
		return
	}
	response.OK(w, res)
}

func (h *AuthHandler) InitiateForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PhoneNumber string `json:"phoneNumber"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.PhoneTR(&errs, "phoneNumber", req.PhoneNumber)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	req.PhoneNumber = validate.NormalizePhoneTR(req.PhoneNumber)
	// Always succeed to prevent phone enumeration.
	_ = h.svc.InitiateForgotPassword(r.Context(), req.PhoneNumber)
	response.OK(w, map[string]bool{"sent": true})
}

func (h *AuthHandler) CompleteForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PhoneNumber string `json:"phoneNumber"`
		Code        string `json:"code"`
		Password    string `json:"password"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.PhoneTR(&errs, "phoneNumber", req.PhoneNumber)
	validate.OTP(&errs, "code", req.Code)
	validate.Password(&errs, "password", req.Password)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	req.PhoneNumber = validate.NormalizePhoneTR(req.PhoneNumber)
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
