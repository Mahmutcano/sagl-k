package handler

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
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
	paysvc "medical-consultation-platform/backend/internal/service/payment"
)

type AdminHandler struct {
	db      *repository.DB
	payment *paysvc.Service
	audit   *audit.Logger
}

func NewAdminHandler(db *repository.DB, payment *paysvc.Service, audit *audit.Logger) *AdminHandler {
	return &AdminHandler{db: db, payment: payment, audit: audit}
}

func (h *AdminHandler) ListApplications(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT a.id::text, a.status_code, a.application_number, a.ecommerce_number, u.first_name || ' ' || u.last_name, a.created_at
		FROM applications a
		JOIN users u ON u.id = a.owner_user_id
		ORDER BY a.created_at DESC LIMIT 100
	`)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM001", "Başvurular listelenemedi.")
		return
	}
	defer rows.Close()
	items := []map[string]interface{}{}
	for rows.Next() {
		var id, patient string
		var status int
		var appNumber, ecommerce *string
		var createdAt interface{}
		if err := rows.Scan(&id, &status, &appNumber, &ecommerce, &patient, &createdAt); err != nil {
			continue
		}
		items = append(items, map[string]interface{}{
			"applicationId": id, "statusCode": status,
			"applicationNumber": appNumber,
			"ecommerceNumber":   ecommerce,
			"patientName":       patient,
			"createdAt":         createdAt,
		})
	}
	response.OK(w, items)
}

func (h *AdminHandler) ApplicationHistory(w http.ResponseWriter, r *http.Request) {
	appID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		var errs validate.Errors
		errs.Add("id", "format", "Başvuru kimliği geçerli bir UUID olmalıdır.")
		validate.Fail(w, errs)
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT old_status_code, new_status_code, note, created_at
		FROM application_status_history WHERE application_id = $1 ORDER BY created_at
	`, appID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM011", "Geçmiş alınamadı.")
		return
	}
	defer rows.Close()
	items := []map[string]interface{}{}
	for rows.Next() {
		var old *int
		var newStatus int
		var note *string
		var createdAt interface{}
		if err := rows.Scan(&old, &newStatus, &note, &createdAt); err != nil {
			continue
		}
		items = append(items, map[string]interface{}{
			"oldStatusCode": old, "newStatusCode": newStatus, "note": note, "createdAt": createdAt,
		})
	}
	response.OK(w, items)
}

func (h *AdminHandler) ListHospitals(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id::text, code, name, target_institution, is_active FROM hospitals ORDER BY name
	`)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM020", "Hastaneler listelenemedi.")
		return
	}
	defer rows.Close()
	items := []map[string]interface{}{}
	for rows.Next() {
		var id, code, name string
		var target int
		var active bool
		if err := rows.Scan(&id, &code, &name, &target, &active); err != nil {
			continue
		}
		items = append(items, map[string]interface{}{
			"id": id, "code": code, "name": name, "targetInstitution": target, "isActive": active,
		})
	}
	response.OK(w, items)
}

func (h *AdminHandler) CreateHospital(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code              string `json:"code"`
		Name              string `json:"name"`
		TargetInstitution int    `json:"targetInstitution"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.HospitalCode(&errs, "code", req.Code)
	validate.HospitalName(&errs, "name", req.Name)
	validate.TargetInstitution(&errs, "targetInstitution", req.TargetInstitution)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	var id uuid.UUID
	err := h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO hospitals (code, name, target_institution) VALUES ($1,$2,$3) RETURNING id
	`, req.Code, req.Name, req.TargetInstitution).Scan(&id)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM022", response.SafeMessage(err, "Hastane oluşturulamadı. Kod benzersiz olmalıdır."))
		return
	}
	response.OK(w, map[string]string{"id": id.String()})
}

func (h *AdminHandler) ListDoctors(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT cp.id::text, cp.full_name, COALESCE(cp.title, ''), cp.profession_code, COALESCE(h.name, ''), cp.is_active
		FROM care_providers cp
		LEFT JOIN hospitals h ON h.id = cp.hospital_id
		ORDER BY cp.full_name
	`)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM030", "Doktorlar listelenemedi.")
		return
	}
	defer rows.Close()
	items := []map[string]interface{}{}
	for rows.Next() {
		var id, name, title, pcode, hospital string
		var active bool
		if err := rows.Scan(&id, &name, &title, &pcode, &hospital, &active); err != nil {
			continue
		}
		items = append(items, map[string]interface{}{
			"id": id, "fullName": name, "title": title, "professionCode": pcode, "hospitalName": hospital, "isActive": active,
		})
	}
	response.OK(w, items)
}

func (h *AdminHandler) CreateDoctor(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FullName           string   `json:"fullName"`
		Title              string   `json:"title"`
		ProfessionCode     string   `json:"professionCode"` // backward compatibility
		ProfessionCodes    []string `json:"professionCodes"`
		TargetInstitution  int      `json:"targetInstitution"`
		HospitalID         string   `json:"hospitalId"`
		NationalIdentifier string   `json:"nationalIdentifier"`
		Email              string   `json:"email"`
		PhoneNumber        string   `json:"phoneNumber"`
		Password           string   `json:"password"`
		ConsultationFee    float64  `json:"consultationFee"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.PersonName(&errs, "fullName", req.FullName, "Doktor adı")
	validate.TargetInstitution(&errs, "targetInstitution", req.TargetInstitution)
	validate.NationalID(&errs, "nationalIdentifier", req.NationalIdentifier)
	validate.Email(&errs, "email", req.Email)
	validate.PhoneTR(&errs, "phoneNumber", req.PhoneNumber)
	validate.Password(&errs, "password", req.Password)
	if req.HospitalID != "" {
		validate.UUID(&errs, "hospitalId", req.HospitalID, "Hastane kimliği")
	}
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	req.PhoneNumber = validate.NormalizePhoneTR(req.PhoneNumber)

	var hospitalID *uuid.UUID
	if req.HospitalID != "" {
		parsed, _ := uuid.Parse(req.HospitalID)
		hospitalID = &parsed
	}

	hash, err := password.Hash(req.Password)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM033", "Şifre işlenemedi.")
		return
	}

	parts := strings.Fields(req.FullName)
	firstName := parts[0]
	lastName := parts[0]
	if len(parts) > 1 {
		lastName = strings.Join(parts[1:], " ")
	}

	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM034", "İşlem başlatılamadı.")
		return
	}
	defer tx.Rollback(r.Context())

	var userID uuid.UUID
	err = tx.QueryRow(r.Context(), `
		INSERT INTO users (email, phone_number, password_hash, first_name, last_name, national_identifier, role, is_active)
		VALUES ($1,$2,$3,$4,$5,$6,'doctor',true)
		RETURNING id
	`, req.Email, req.PhoneNumber, hash, firstName, lastName, req.NationalIdentifier).Scan(&userID)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM032", response.SafeMessage(err, "Doktor hesabı oluşturulamadı. E-posta veya TC benzersiz olmalıdır."))
		return
	}

	// Determine primary profession code
	primaryProfCode := req.ProfessionCode
	if len(req.ProfessionCodes) > 0 {
		primaryProfCode = req.ProfessionCodes[0]
	} else if primaryProfCode != "" {
		req.ProfessionCodes = []string{primaryProfCode}
	}

	fee := req.ConsultationFee
	if fee <= 0 {
		fee = 1000.00
	}

	var id uuid.UUID
	err = tx.QueryRow(r.Context(), `
		INSERT INTO care_providers (user_id, full_name, title, profession_code, target_institution, hospital_id, identity_number, consultation_fee, is_active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING id
	`, userID, req.FullName, req.Title, primaryProfCode, req.TargetInstitution, hospitalID, req.NationalIdentifier, fee).Scan(&id)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM035", response.SafeMessage(err, "Doktor kaydı oluşturulamadı."))
		return
	}

	// Link multiple professions
	for _, code := range req.ProfessionCodes {
		var profID uuid.UUID
		err = tx.QueryRow(r.Context(), `SELECT id FROM professions WHERE code = $1 LIMIT 1`, code).Scan(&profID)
		if err == nil {
			_, _ = tx.Exec(r.Context(), `
				INSERT INTO care_provider_professions (care_provider_id, profession_id)
				VALUES ($1, $2) ON CONFLICT DO NOTHING
			`, id, profID)
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM036", "Kayıt tamamlanamadı.")
		return
	}
	response.OK(w, map[string]string{"id": id.String(), "userId": userID.String()})
}

func (h *AdminHandler) GetDoctor(w http.ResponseWriter, r *http.Request) {
	docID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM037", "Geçersiz doktor ID.")
		return
	}

	var cp struct {
		ID                uuid.UUID
		UserID            *uuid.UUID
		HospitalID        *uuid.UUID
		FullName          string
		Title             *string
		ProfessionCode    string
		TargetInstitution int
		IsActive          bool
		ConsultationFee   float64
		IdentityNumber    *string
		Email             string
		PhoneNumber       string
	}

	err = h.db.Pool.QueryRow(r.Context(), `
		SELECT cp.id, cp.user_id, cp.hospital_id, cp.full_name, cp.title, cp.profession_code,
		       cp.target_institution, cp.is_active, cp.consultation_fee, cp.identity_number,
		       u.email, u.phone_number
		FROM care_providers cp
		JOIN users u ON u.id = cp.user_id
		WHERE cp.id = $1
	`, docID).Scan(
		&cp.ID, &cp.UserID, &cp.HospitalID, &cp.FullName, &cp.Title, &cp.ProfessionCode,
		&cp.TargetInstitution, &cp.IsActive, &cp.ConsultationFee, &cp.IdentityNumber,
		&cp.Email, &cp.PhoneNumber,
	)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "ADM038", "Doktor bulunamadı.")
		return
	}

	// Fetch linked professions
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT p.code FROM care_provider_professions cpp
		JOIN professions p ON p.id = cpp.profession_id
		WHERE cpp.care_provider_id = $1
	`, docID)
	professionCodes := []string{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var code string
			if err := rows.Scan(&code); err == nil {
				professionCodes = append(professionCodes, code)
			}
		}
	}
	if len(professionCodes) == 0 && cp.ProfessionCode != "" {
		professionCodes = append(professionCodes, cp.ProfessionCode)
	}

	var hospitalIDStr string
	if cp.HospitalID != nil {
		hospitalIDStr = cp.HospitalID.String()
	}

	var titleStr string
	if cp.Title != nil {
		titleStr = *cp.Title
	}

	var identityStr string
	if cp.IdentityNumber != nil {
		identityStr = *cp.IdentityNumber
	}

	response.OK(w, map[string]interface{}{
		"id":                 cp.ID.String(),
		"userId":             cp.UserID.String(),
		"fullName":           cp.FullName,
		"title":              titleStr,
		"professionCode":     cp.ProfessionCode,
		"professionCodes":    professionCodes,
		"targetInstitution":  cp.TargetInstitution,
		"hospitalId":         hospitalIDStr,
		"nationalIdentifier": identityStr,
		"email":              cp.Email,
		"phoneNumber":        cp.PhoneNumber,
		"consultationFee":    cp.ConsultationFee,
		"isActive":           cp.IsActive,
	})
}

func (h *AdminHandler) UpdateDoctor(w http.ResponseWriter, r *http.Request) {
	docID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM037", "Geçersiz doktor ID.")
		return
	}

	var req struct {
		FullName           string   `json:"fullName"`
		Title              string   `json:"title"`
		ProfessionCodes    []string `json:"professionCodes"`
		HospitalID         string   `json:"hospitalId"`
		NationalIdentifier string   `json:"nationalIdentifier"`
		Email              string   `json:"email"`
		PhoneNumber        string   `json:"phoneNumber"`
		Password           string   `json:"password"`
		ConsultationFee    float64  `json:"consultationFee"`
		IsActive           bool     `json:"isActive"`
	}

	if !validate.DecodeJSON(w, r, &req) {
		return
	}

	var errs validate.Errors
	validate.PersonName(&errs, "fullName", req.FullName, "Doktor adı")
	validate.NationalID(&errs, "nationalIdentifier", req.NationalIdentifier)
	validate.Email(&errs, "email", req.Email)
	validate.PhoneTR(&errs, "phoneNumber", req.PhoneNumber)
	if req.Password != "" {
		validate.Password(&errs, "password", req.Password)
	}
	if req.HospitalID != "" {
		validate.UUID(&errs, "hospitalId", req.HospitalID, "Hastane kimliği")
	}
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	req.PhoneNumber = validate.NormalizePhoneTR(req.PhoneNumber)

	var hospitalID *uuid.UUID
	if req.HospitalID != "" {
		parsed, _ := uuid.Parse(req.HospitalID)
		hospitalID = &parsed
	}

	// Fetch doctor to get user_id
	var userID uuid.UUID
	err = h.db.Pool.QueryRow(r.Context(), `SELECT user_id FROM care_providers WHERE id = $1`, docID).Scan(&userID)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "ADM038", "Doktor bulunamadı.")
		return
	}

	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM034", "İşlem başlatılamadı.")
		return
	}
	defer tx.Rollback(r.Context())

	// Unique check for email, phone, TC
	var exists bool
	_ = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND id <> $2)`, req.Email, userID).Scan(&exists)
	if exists {
		response.Fail(w, http.StatusBadRequest, "ADM032", "Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor.")
		return
	}
	_ = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM users WHERE phone_number = $1 AND id <> $2)`, req.PhoneNumber, userID).Scan(&exists)
	if exists {
		response.Fail(w, http.StatusBadRequest, "ADM032", "Bu telefon numarası başka bir kullanıcı tarafından kullanılıyor.")
		return
	}
	_ = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM users WHERE national_identifier = $1 AND id <> $2)`, req.NationalIdentifier, userID).Scan(&exists)
	if exists {
		response.Fail(w, http.StatusBadRequest, "ADM032", "Bu T.C. Kimlik numarası başka bir kullanıcı tarafından kullanılıyor.")
		return
	}

	parts := strings.Fields(req.FullName)
	firstName := parts[0]
	lastName := parts[0]
	if len(parts) > 1 {
		lastName = strings.Join(parts[1:], " ")
	}

	if req.Password != "" {
		hash, err := password.Hash(req.Password)
		if err != nil {
			response.Fail(w, http.StatusInternalServerError, "ADM033", "Şifre işlenemedi.")
			return
		}
		_, err = tx.Exec(r.Context(), `
			UPDATE users SET email = $1, phone_number = $2, password_hash = $3, first_name = $4, last_name = $5,
			                 national_identifier = $6, is_active = $7, updated_at = now()
			WHERE id = $8
		`, req.Email, req.PhoneNumber, hash, firstName, lastName, req.NationalIdentifier, req.IsActive, userID)
	} else {
		_, err = tx.Exec(r.Context(), `
			UPDATE users SET email = $1, phone_number = $2, first_name = $3, last_name = $4,
			                 national_identifier = $5, is_active = $6, updated_at = now()
			WHERE id = $7
		`, req.Email, req.PhoneNumber, firstName, lastName, req.NationalIdentifier, req.IsActive, userID)
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM039", "Kullanıcı tablosu güncellenemedi.")
		return
	}

	primaryProfCode := ""
	if len(req.ProfessionCodes) > 0 {
		primaryProfCode = req.ProfessionCodes[0]
	}

	fee := req.ConsultationFee
	if fee <= 0 {
		fee = 1000.00
	}

	_, err = tx.Exec(r.Context(), `
		UPDATE care_providers
		SET full_name = $1, title = $2, profession_code = $3, hospital_id = $4,
		    identity_number = $5, consultation_fee = $6, is_active = $7, updated_at = now()
		WHERE id = $8
	`, req.FullName, req.Title, primaryProfCode, hospitalID, req.NationalIdentifier, fee, req.IsActive, docID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM040", "Doktor tablosu güncellenemedi.")
		return
	}

	// Update professions many-to-many
	_, _ = tx.Exec(r.Context(), `DELETE FROM care_provider_professions WHERE care_provider_id = $1`, docID)
	for _, code := range req.ProfessionCodes {
		var profID uuid.UUID
		err = tx.QueryRow(r.Context(), `SELECT id FROM professions WHERE code = $1 LIMIT 1`, code).Scan(&profID)
		if err == nil {
			_, _ = tx.Exec(r.Context(), `
				INSERT INTO care_provider_professions (care_provider_id, profession_id)
				VALUES ($1, $2) ON CONFLICT DO NOTHING
			`, docID, profID)
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM036", "Kayıt güncellenemedi.")
		return
	}
	response.OK(w, map[string]string{"message": "Doktor bilgileri başarıyla güncellendi."})
}

func (h *AdminHandler) ListProfessionsAdmin(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT p.id::text, p.code, p.name, p.target_institution, p.hospital_id::text, p.is_active, COALESCE(h.name, '')
		FROM professions p
		LEFT JOIN hospitals h ON h.id = p.hospital_id
		ORDER BY p.name
	`)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM080", "Bölümler listelenemedi.")
		return
	}
	defer rows.Close()

	items := []map[string]interface{}{}
	for rows.Next() {
		var id, code, name, hospitalName string
		var target int
		var hospitalID *string
		var active bool
		if err := rows.Scan(&id, &code, &name, &target, &hospitalID, &active, &hospitalName); err != nil {
			continue
		}
		items = append(items, map[string]interface{}{
			"id": id, "code": code, "name": name, "targetInstitution": target,
			"hospitalId": hospitalID, "hospitalName": hospitalName, "isActive": active,
		})
	}
	response.OK(w, items)
}

func (h *AdminHandler) CreateProfession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code              string `json:"code"`
		Name              string `json:"name"`
		TargetInstitution int    `json:"targetInstitution"`
		HospitalID        string `json:"hospitalId"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.ProfessionCode(&errs, "code", req.Code)
	if req.Name == "" {
		errs.Add("name", "required", "Bölüm adı zorunludur.")
	}
	validate.TargetInstitution(&errs, "targetInstitution", req.TargetInstitution)
	if req.HospitalID != "" {
		validate.UUID(&errs, "hospitalId", req.HospitalID, "Hastane kimliği")
	}
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}

	var hospitalID *uuid.UUID
	if req.HospitalID != "" {
		parsed, _ := uuid.Parse(req.HospitalID)
		hospitalID = &parsed
	}

	var id uuid.UUID
	err := h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO professions (code, name, target_institution, hospital_id, is_active)
		VALUES ($1, $2, $3, $4, true) RETURNING id
	`, req.Code, req.Name, req.TargetInstitution, hospitalID).Scan(&id)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM082", response.SafeMessage(err, "Bölüm oluşturulamadı. Kod benzersiz olmalıdır."))
		return
	}
	response.OK(w, map[string]string{"id": id.String()})
}

func (h *AdminHandler) GetPaymentInvoice(w http.ResponseWriter, r *http.Request) {
	paymentID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM042", "Geçersiz ödeme ID.")
		return
	}

	var p struct {
		ID                    uuid.UUID
		Amount                float64
		Currency              string
		Status                string
		Provider              string
		ProviderTransactionID *string
		PaidAt                *time.Time
		CreatedAt             time.Time
		ApplicationID         uuid.UUID
		PatientName           string
		PatientNationalID     *string
		PatientEmail          string
		PatientPhone          string
		HospitalName          *string
		ProfessionName        *string
		DoctorName            *string
		DoctorTitle           *string
		EcommerceNumber       *string
	}

	err = h.db.Pool.QueryRow(r.Context(), `
		SELECT p.id, p.amount, p.currency, p.status::text, p.provider::text, p.provider_transaction_id,
		       p.paid_at, p.created_at, p.application_id,
		       u.first_name || ' ' || u.last_name, u.national_identifier, u.email, u.phone_number,
		       h.name, a.profession_name, cp.full_name, cp.title, a.ecommerce_number
		FROM payments p
		JOIN applications a ON a.id = p.application_id
		JOIN users u ON u.id = p.user_id
		LEFT JOIN hospitals h ON h.id = a.hospital_id
		LEFT JOIN care_providers cp ON cp.id = a.care_provider_id
		WHERE p.id = $1
	`, paymentID).Scan(
		&p.ID, &p.Amount, &p.Currency, &p.Status, &p.Provider, &p.ProviderTransactionID,
		&p.PaidAt, &p.CreatedAt, &p.ApplicationID,
		&p.PatientName, &p.PatientNationalID, &p.PatientEmail, &p.PatientPhone,
		&p.HospitalName, &p.ProfessionName, &p.DoctorName, &p.DoctorTitle, &p.EcommerceNumber,
	)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "ADM043", "Ödeme kaydı bulunamadı.")
		return
	}

	var paidAtStr string
	if p.PaidAt != nil {
		paidAtStr = p.PaidAt.Format("2006-01-02 15:04:05")
	}

	var transactionID string
	if p.ProviderTransactionID != nil {
		transactionID = *p.ProviderTransactionID
	}

	var patientNationalIDStr string
	if p.PatientNationalID != nil {
		patientNationalIDStr = *p.PatientNationalID
	}

	var hospitalNameStr string
	if p.HospitalName != nil {
		hospitalNameStr = *p.HospitalName
	}

	var professionNameStr string
	if p.ProfessionName != nil {
		professionNameStr = *p.ProfessionName
	}

	var doctorNameStr string
	if p.DoctorName != nil {
		docName := *p.DoctorName
		if p.DoctorTitle != nil && *p.DoctorTitle != "" {
			docName = *p.DoctorTitle + " " + docName
		}
		doctorNameStr = docName
	}

	var econum string
	if p.EcommerceNumber != nil {
		econum = *p.EcommerceNumber
	}

	response.OK(w, map[string]interface{}{
		"id":                    p.ID.String(),
		"amount":                p.Amount,
		"currency":              p.Currency,
		"status":                p.Status,
		"provider":              p.Provider,
		"providerTransactionId": transactionID,
		"paidAt":                paidAtStr,
		"createdAt":             p.CreatedAt.Format("2006-01-02 15:04:05"),
		"applicationId":         p.ApplicationID.String(),
		"patientName":           p.PatientName,
		"patientNationalId":     patientNationalIDStr,
		"patientEmail":          p.PatientEmail,
		"patientPhone":          p.PatientPhone,
		"hospitalName":          hospitalNameStr,
		"professionName":        professionNameStr,
		"doctorName":            doctorNameStr,
		"ecommerceNumber":       econum,
	})
}

func (h *AdminHandler) GetNotificationDetail(w http.ResponseWriter, r *http.Request) {
	notifID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM063", "Geçersiz bildirim ID.")
		return
	}

	var n struct {
		ID               uuid.UUID
		Channel          string
		Recipient        string
		Subject          *string
		BodyPreview      *string
		TemplateKey      *string
		Status           string
		ProviderResponse []byte
		CreatedAt        time.Time
		SentAt           *time.Time
	}

	err = h.db.Pool.QueryRow(r.Context(), `
		SELECT id, channel::text, recipient, subject, body_preview, template_key, status::text, provider_response, created_at, sent_at
		FROM notification_logs
		WHERE id = $1
	`, notifID).Scan(
		&n.ID, &n.Channel, &n.Recipient, &n.Subject, &n.BodyPreview, &n.TemplateKey, &n.Status, &n.ProviderResponse, &n.CreatedAt, &n.SentAt,
	)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "ADM064", "Bildirim kaydı bulunamadı.")
		return
	}

	var subjectStr string
	if n.Subject != nil {
		subjectStr = *n.Subject
	}

	var bodyStr string
	if n.BodyPreview != nil {
		bodyStr = *n.BodyPreview
	}

	var templateStr string
	if n.TemplateKey != nil {
		templateStr = *n.TemplateKey
	}

	var sentAtStr string
	if n.SentAt != nil {
		sentAtStr = n.SentAt.Format("2006-01-02 15:04:05")
	}

	response.OK(w, map[string]interface{}{
		"id":               n.ID.String(),
		"channel":          n.Channel,
		"recipient":        n.Recipient,
		"subject":          subjectStr,
		"body":             bodyStr,
		"templateKey":      templateStr,
		"status":           n.Status,
		"providerResponse": json.RawMessage(n.ProviderResponse),
		"createdAt":        n.CreatedAt.Format("2006-01-02 15:04:05"),
		"sentAt":           sentAtStr,
	})
}

func (h *AdminHandler) ListPayments(w http.ResponseWriter, r *http.Request) {
	var errs validate.Errors
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	page, pageSize = validate.Paging(&errs, page, pageSize)

	var totalCount int
	_ = h.db.Pool.QueryRow(r.Context(), "SELECT COUNT(*) FROM payments").Scan(&totalCount)

	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT p.id::text, p.application_id::text, p.provider::text, p.amount, p.currency,
		       p.status::text, p.metadata, p.created_at,
		       COALESCE(u.first_name || ' ' || u.last_name, '') AS patient_name
		FROM payments p
		LEFT JOIN users u ON u.id = p.user_id
		ORDER BY p.created_at DESC LIMIT $1 OFFSET $2
	`, pageSize, page*pageSize)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM040", "Ödemeler listelenemedi.")
		return
	}
	defer rows.Close()
	items := []map[string]interface{}{}
	for rows.Next() {
		var id, appID, provider, currency, status, patientName string
		var amount float64
		var metadata json.RawMessage
		var createdAt interface{}
		if err := rows.Scan(&id, &appID, &provider, &amount, &currency, &status, &metadata, &createdAt, &patientName); err != nil {
			continue
		}
		item := map[string]interface{}{
			"id": id, "applicationId": appID, "provider": provider,
			"amount": amount, "currency": currency, "status": status, "createdAt": createdAt,
			"patientName": patientName,
		}
		// Extract card metadata if available
		var meta map[string]interface{}
		if json.Unmarshal(metadata, &meta) == nil {
			if v, ok := meta["card_brand"]; ok {
				item["cardBrand"] = v
			}
			if v, ok := meta["masked_card"]; ok {
				item["maskedCard"] = v
			}
		}
		items = append(items, item)
	}
	response.OK(w, map[string]interface{}{
		"items":      items,
		"totalCount": totalCount,
		"page":       page,
		"pageSize":   pageSize,
	})
}

func (h *AdminHandler) ExportPaymentsCSV(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT p.id::text, p.application_id::text, p.provider::text, p.amount, p.currency,
		       p.status::text, p.created_at,
		       COALESCE(u.first_name || ' ' || u.last_name, '') AS patient_name
		FROM payments p
		LEFT JOIN users u ON u.id = p.user_id
		ORDER BY p.created_at DESC
	`)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM041", "CSV oluşturulamadı.")
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=odemeler.csv")
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"ID", "Başvuru ID", "Sağlayıcı", "Tutar", "Döviz", "Durum", "Tarih", "Hasta"})
	for rows.Next() {
		var id, appID, provider, currency, status, patientName string
		var amount float64
		var createdAt time.Time
		if err := rows.Scan(&id, &appID, &provider, &amount, &currency, &status, &createdAt, &patientName); err != nil {
			continue
		}
		_ = cw.Write([]string{id, appID, provider, fmt.Sprintf("%.2f", amount), currency, status, createdAt.Format("2006-01-02 15:04"), patientName})
	}
	cw.Flush()
}

func (h *AdminHandler) CancelApplication(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	appID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM050", "Geçersiz başvuru ID.")
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}

	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE applications SET status = 'cancelled', status_code = 7, updated_at = now() WHERE id = $1
	`, appID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM051", "Başvuru iptal edilemedi.")
		return
	}
	_, _ = h.db.Pool.Exec(r.Context(), `
		INSERT INTO application_status_history (application_id, old_status_code, new_status_code, note, actor_user_id)
		SELECT $1, status_code, 7, $2, $3 FROM applications WHERE id = $1
	`, appID, req.Reason, claims.UserID)

	h.audit.Log(r.Context(), &claims.UserID, "admin_cancel_application", "applications", &appID, map[string]interface{}{
		"reason": req.Reason,
	})

	response.OK(w, map[string]string{"message": "Başvuru iptal edildi."})
}

func (h *AdminHandler) AssignDoctor(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	appID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM060", "Geçersiz başvuru ID.")
		return
	}
	var req struct {
		CareProviderID string `json:"careProviderId"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.UUID(&errs, "careProviderId", req.CareProviderID, "Doktor")
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	cpID, _ := uuid.Parse(req.CareProviderID)

	// Fetch doctor's user_id from care_providers
	var doctorUserID uuid.UUID
	err = h.db.Pool.QueryRow(r.Context(), `SELECT user_id FROM care_providers WHERE id = $1 AND is_active = true`, cpID).Scan(&doctorUserID)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "ADM061", "Doktor bulunamadı veya aktif değil.")
		return
	}

	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE applications SET care_provider_id = $1, doctor_user_id = $2, updated_at = now() WHERE id = $3
	`, cpID, doctorUserID, appID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM062", "Doktor ataması yapılamadı.")
		return
	}

	h.audit.Log(r.Context(), &claims.UserID, "admin_assign_doctor", "applications", &appID, map[string]interface{}{
		"careProviderId": req.CareProviderID,
	})

	response.OK(w, map[string]string{"message": "Doktor başarıyla atandı."})
}

func (h *AdminHandler) CreateRefund(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PaymentID string  `json:"paymentId"`
		Amount    float64 `json:"amount"`
		Reason    string  `json:"reason"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.UUID(&errs, "paymentId", req.PaymentID, "Ödeme kimliği")
	validate.RefundAmount(&errs, "amount", req.Amount)
	validate.RefundReason(&errs, "reason", req.Reason)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	paymentID, _ := uuid.Parse(req.PaymentID)
	var paymentRec struct {
		ApplicationID         uuid.UUID
		Provider              string
		ProviderTransactionID string
		PaymentAmount         float64
		Status                string
	}
	err := h.db.Pool.QueryRow(r.Context(), `
		SELECT application_id, provider::text, COALESCE(provider_transaction_id,''), amount, status::text
		FROM payments WHERE id = $1
	`, paymentID).Scan(&paymentRec.ApplicationID, &paymentRec.Provider, &paymentRec.ProviderTransactionID,
		&paymentRec.PaymentAmount, &paymentRec.Status)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM051", "Ödeme kaydı bulunamadı.")
		return
	}
	if paymentRec.Status != "paid" {
		response.Fail(w, http.StatusConflict, "ADM053", "Yalnızca tamamlanmış ödemeler iade edilebilir.")
		return
	}
	if paymentRec.ProviderTransactionID == "" {
		response.Fail(w, http.StatusConflict, "ADM054", "Ödeme sağlayıcı işlem kimliği bulunamadı.")
		return
	}
	if req.Amount > paymentRec.PaymentAmount {
		var errs validate.Errors
		errs.Add("amount", "range", "İade tutarı ödeme tutarını aşamaz.")
		validate.Fail(w, errs)
		return
	}

	var refundID uuid.UUID
	err = h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO refunds (payment_id, application_id, amount, reason, status)
		VALUES ($1, $2, $3, $4, 'pending')
		RETURNING id
	`, paymentID, paymentRec.ApplicationID, req.Amount, req.Reason).Scan(&refundID)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM052", response.SafeMessage(err, "İade oluşturulamadı."))
		return
	}

	providerRefundID, err := h.payment.Refund(r.Context(), paymentRec.Provider, paymentRec.ProviderTransactionID, req.Amount, req.Reason)
	if err != nil {
		_ = h.payment.Store().MarkRefundFailed(r.Context(), refundID, err.Error())
		response.Fail(w, http.StatusBadGateway, "ADM055", response.SafeMessage(err, "Ödeme sağlayıcısı iade işlemini reddetti."))
		return
	}
	if err := h.payment.Store().CompleteRefund(r.Context(), refundID, providerRefundID, paymentID); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM056", "İade kaydı güncellenemedi.")
		return
	}
	response.OK(w, map[string]string{
		"applicationId": paymentRec.ApplicationID.String(),
		"refundId":      refundID.String(),
		"status":        "refunded",
	})
}

func (h *AdminHandler) ListNotifications(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id::text, channel::text, recipient, template_key, status::text, created_at
		FROM notification_logs ORDER BY created_at DESC LIMIT 100
	`)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM060", "Bildirimler listelenemedi.")
		return
	}
	defer rows.Close()
	items := []map[string]interface{}{}
	for rows.Next() {
		var id, channel, recipient, template, status string
		var createdAt interface{}
		if err := rows.Scan(&id, &channel, &recipient, &template, &status, &createdAt); err != nil {
			continue
		}
		items = append(items, map[string]interface{}{
			"id": id, "channel": channel, "recipient": recipient,
			"templateKey": template, "status": status, "createdAt": createdAt,
		})
	}
	response.OK(w, items)
}

func (h *AdminHandler) ListAuditLogs(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT l.id::text, l.action, l.entity_type, l.entity_id::text, l.payload, l.ip_address::text, l.created_at,
		       u.email, u.first_name || ' ' || u.last_name
		FROM audit_logs l
		LEFT JOIN users u ON u.id = l.user_id
		ORDER BY l.created_at DESC LIMIT 300
	`)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM070", "Sistem logları listelenemedi.")
		return
	}
	defer rows.Close()

	items := []map[string]interface{}{}
	for rows.Next() {
		var id, action, entityType, ipAddress, userEmail, userName string
		var entityID *string
		var payload []byte
		var createdAt interface{}

		var ipNull, emailNull, nameNull, entityNull *string
		err := rows.Scan(&id, &action, &entityType, &entityNull, &payload, &ipNull, &createdAt, &emailNull, &nameNull)
		if err != nil {
			continue
		}

		if ipNull != nil {
			ipAddress = *ipNull
		}
		if emailNull != nil {
			userEmail = *emailNull
		}
		if nameNull != nil {
			userName = *nameNull
		}
		if entityNull != nil {
			entityID = entityNull
		}

		var payloadObj interface{}
		if len(payload) > 0 {
			_ = json.Unmarshal(payload, &payloadObj)
		}

		items = append(items, map[string]interface{}{
			"id":         id,
			"action":     action,
			"entityType": entityType,
			"entityId":   entityID,
			"payload":    payloadObj,
			"ipAddress":  ipAddress,
			"createdAt":  createdAt,
			"userEmail":  userEmail,
			"userName":   userName,
		})
	}
	response.OK(w, items)
}

type AdminApplicationUpdateRequest struct {
	StatusCode            int    `json:"statusCode"`
	ProfessionCode        string `json:"professionCode"`
	CareProviderID        string `json:"careProviderId"`
	ChiefComplaint        string `json:"chiefComplaint"`
	MedicalHistory        string `json:"medicalHistory"`
	CurrentMedications    string `json:"currentMedications"`
	PreviousDiagnosis     string `json:"previousDiagnosis"`
	QuestionsForDoctor    string `json:"questionsForDoctor"`
	AdditionalNotes       string `json:"additionalNotes"`
	IsForRelative         bool   `json:"isForRelative"`
	RepFirstName          string `json:"repFirstName"`
	RepLastName           string `json:"repLastName"`
	RepNationalIdentifier string `json:"repNationalIdentifier"`
	RepBirthDate          string `json:"repBirthDate"`
	RepGender             int    `json:"repGender"`
}

func (h *AdminHandler) UpdateApplicationByAdmin(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	if claims == nil {
		response.Fail(w, http.StatusUnauthorized, "AUTH001", "Oturum gerekli.")
		return
	}

	appIDStr := chi.URLParam(r, "id")
	appID, err := uuid.Parse(appIDStr)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM071", "Geçersiz başvuru ID.")
		return
	}

	var req AdminApplicationUpdateRequest
	if !validate.DecodeJSON(w, r, &req) {
		return
	}

	// Validate doctor ID if present
	var providerID *uuid.UUID
	if strings.TrimSpace(req.CareProviderID) != "" {
		pID, err := uuid.Parse(req.CareProviderID)
		if err != nil {
			response.Fail(w, http.StatusBadRequest, "ADM072", "Geçersiz hekim ID.")
			return
		}
		providerID = &pID
	}

	tx, err := h.db.Pool.Begin(r.Context())
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM073", "İşlem başlatılamadı.")
		return
	}
	defer tx.Rollback(r.Context())

	// Fetch old status code for audit
	var oldStatusCode int
	err = tx.QueryRow(r.Context(), `SELECT status_code FROM applications WHERE id = $1`, appID).Scan(&oldStatusCode)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "ADM071", "Başvuru bulunamadı.")
		return
	}

	// Update applications table
	_, err = tx.Exec(r.Context(), `
		UPDATE applications
		SET status_code = $1, profession_code = $2, care_provider_id = $3,
			is_for_relative = $4, updated_at = now()
		WHERE id = $5
	`, req.StatusCode, req.ProfessionCode, providerID, req.IsForRelative, appID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM074", "Başvuru ana bilgileri güncellenemedi.")
		return
	}

	if req.StatusCode != oldStatusCode {
		_, err = tx.Exec(r.Context(), `
			INSERT INTO application_status_history (application_id, old_status_code, new_status_code, note, actor_user_id)
			VALUES ($1, $2, $3, $4, $5)
		`, appID, oldStatusCode, req.StatusCode, "Durum yönetici tarafından güncellendi.", claims.UserID)
		if err != nil {
			response.Fail(w, http.StatusInternalServerError, "ADM078", "Başvuru durum geçmişi kaydedilemedi.")
			return
		}
	}

	// Update or insert application_surveys
	var existsSurvey bool
	_ = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM application_surveys WHERE application_id = $1)`, appID).Scan(&existsSurvey)

	if existsSurvey {
		_, err = tx.Exec(r.Context(), `
			UPDATE application_surveys
			SET chief_complaint = $1, medical_history = $2, current_medications = $3,
				previous_diagnosis = $4, questions_for_doctor = $5, additional_notes = $6
			WHERE application_id = $7
		`, req.ChiefComplaint, req.MedicalHistory, req.CurrentMedications, req.PreviousDiagnosis, req.QuestionsForDoctor, req.AdditionalNotes, appID)
	} else {
		_, err = tx.Exec(r.Context(), `
			INSERT INTO application_surveys (application_id, chief_complaint, medical_history, current_medications, previous_diagnosis, questions_for_doctor, additional_notes)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, appID, req.ChiefComplaint, req.MedicalHistory, req.CurrentMedications, req.PreviousDiagnosis, req.QuestionsForDoctor, req.AdditionalNotes)
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM075", "Başvuru şikayet/tıbbi geçmiş bilgileri güncellenemedi.")
		return
	}

	// Update application_represented_persons if relative is true
	if req.IsForRelative {
		var dob *time.Time
		if strings.TrimSpace(req.RepBirthDate) != "" {
			parsed, err := time.Parse("2006-01-02", req.RepBirthDate)
			if err == nil {
				dob = &parsed
			}
		}

		var existsRep bool
		_ = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM application_represented_persons WHERE application_id = $1)`, appID).Scan(&existsRep)

		if existsRep {
			_, err = tx.Exec(r.Context(), `
				UPDATE application_represented_persons
				SET first_name = $1, last_name = $2, national_identifier = $3, birth_date = $4, gender = $5
				WHERE application_id = $6
			`, req.RepFirstName, req.RepLastName, req.RepNationalIdentifier, dob, req.RepGender, appID)
		} else {
			_, err = tx.Exec(r.Context(), `
				INSERT INTO application_represented_persons (application_id, first_name, last_name, national_identifier, birth_date, gender)
				VALUES ($1, $2, $3, $4, $5, $6)
			`, appID, req.RepFirstName, req.RepLastName, req.RepNationalIdentifier, dob, req.RepGender)
		}
		if err != nil {
			response.Fail(w, http.StatusInternalServerError, "ADM076", "Yakın (temsil edilen) bilgileri güncellenemedi.")
			return
		}
	} else {
		// If not for relative, clean up represent details if any exist
		_, _ = tx.Exec(r.Context(), `DELETE FROM application_represented_persons WHERE application_id = $1`, appID)
	}

	if err := tx.Commit(r.Context()); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM077", "Değişiklikler kaydedilemedi.")
		return
	}

	h.audit.Log(r.Context(), &claims.UserID, "admin_update_application", "applications", &appID, map[string]interface{}{
		"statusCode": req.StatusCode, "profession": req.ProfessionCode, "doctor": req.CareProviderID,
	})

	response.OK(w, map[string]interface{}{
		"message": "Başvuru bilgileri admin tarafından başarıyla güncellendi.",
	})
}
