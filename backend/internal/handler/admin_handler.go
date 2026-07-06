package handler

import (
	"encoding/json"
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
		SELECT cp.id::text, cp.full_name, cp.profession_code, h.name
		FROM care_providers cp
		LEFT JOIN hospitals h ON h.id = cp.hospital_id
		WHERE cp.is_active = true ORDER BY cp.full_name
	`)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM030", "Doktorlar listelenemedi.")
		return
	}
	defer rows.Close()
	items := []map[string]interface{}{}
	for rows.Next() {
		var id, name, pcode string
		var hospital *string
		if err := rows.Scan(&id, &name, &pcode, &hospital); err != nil {
			continue
		}
		items = append(items, map[string]interface{}{
			"id": id, "fullName": name, "professionCode": pcode, "hospitalName": hospital,
		})
	}
	response.OK(w, items)
}

func (h *AdminHandler) CreateDoctor(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FullName           string `json:"fullName"`
		ProfessionCode     string `json:"professionCode"`
		TargetInstitution  int    `json:"targetInstitution"`
		HospitalID         string `json:"hospitalId"`
		NationalIdentifier string `json:"nationalIdentifier"`
		Email              string `json:"email"`
		PhoneNumber        string `json:"phoneNumber"`
		Password           string `json:"password"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.PersonName(&errs, "fullName", req.FullName, "Doktor adı")
	validate.ProfessionCode(&errs, "professionCode", req.ProfessionCode)
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

	var id uuid.UUID
	err = tx.QueryRow(r.Context(), `
		INSERT INTO care_providers (user_id, full_name, profession_code, target_institution, hospital_id, identity_number)
		VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
	`, userID, req.FullName, req.ProfessionCode, req.TargetInstitution, hospitalID, req.NationalIdentifier).Scan(&id)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM035", response.SafeMessage(err, "Doktor kaydı oluşturulamadı."))
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM036", "Kayıt tamamlanamadı.")
		return
	}
	response.OK(w, map[string]string{"id": id.String(), "userId": userID.String()})
}

func (h *AdminHandler) ListPayments(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id::text, application_id::text, provider::text, amount, currency, status::text, created_at
		FROM payments ORDER BY created_at DESC LIMIT 100
	`)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM040", "Ödemeler listelenemedi.")
		return
	}
	defer rows.Close()
	items := []map[string]interface{}{}
	for rows.Next() {
		var id, appID, provider, currency, status string
		var amount float64
		var createdAt interface{}
		if err := rows.Scan(&id, &appID, &provider, &amount, &currency, &status, &createdAt); err != nil {
			continue
		}
		items = append(items, map[string]interface{}{
			"id": id, "applicationId": appID, "provider": provider,
			"amount": amount, "currency": currency, "status": status, "createdAt": createdAt,
		})
	}
	response.OK(w, items)
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
