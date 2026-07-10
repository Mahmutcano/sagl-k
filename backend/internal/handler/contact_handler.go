package handler

import (
	"fmt"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"medical-consultation-platform/backend/internal/pkg/response"
	"medical-consultation-platform/backend/internal/pkg/validate"
	"medical-consultation-platform/backend/internal/repository"
	notifysvc "medical-consultation-platform/backend/internal/service/notification"
)

type ContactHandler struct {
	db     *repository.DB
	notify *notifysvc.Service
	toEmail string
}

func NewContactHandler(db *repository.DB, notify *notifysvc.Service, toEmail string) *ContactHandler {
	return &ContactHandler{db: db, notify: notify, toEmail: toEmail}
}

type contactRequest struct {
	FullName string `json:"fullName"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Subject  string `json:"subject"`
	Message  string `json:"message"`
	Category string `json:"category"`
}

func (h *ContactHandler) Submit(w http.ResponseWriter, r *http.Request) {
	var req contactRequest
	if !validate.DecodeJSON(w, r, &req) {
		return
	}

	req.FullName = validate.FormatPersonName(req.FullName)
	req.Email = strings.TrimSpace(req.Email)
	req.Phone = strings.TrimSpace(req.Phone)
	req.Subject = strings.TrimSpace(req.Subject)
	req.Message = strings.TrimSpace(req.Message)
	req.Category = strings.ToLower(strings.TrimSpace(req.Category))
	if req.Category == "" {
		req.Category = "general"
	}

	var errs validate.Errors
	validate.PersonName(&errs, "fullName", req.FullName, "Ad soyad")
	validate.Email(&errs, "email", req.Email)
	if req.Subject == "" {
		errs.Add("subject", "required", "Konu zorunludur.")
	} else if utf8.RuneCountInString(req.Subject) > 200 {
		errs.Add("subject", "max_length", "Konu en fazla 200 karakter olabilir.")
	}
	if req.Message == "" {
		errs.Add("message", "required", "Mesaj zorunludur.")
	} else if utf8.RuneCountInString(req.Message) < 10 {
		errs.Add("message", "min_length", "Mesaj en az 10 karakter olmalıdır.")
	} else if utf8.RuneCountInString(req.Message) > 4000 {
		errs.Add("message", "max_length", "Mesaj en fazla 4000 karakter olabilir.")
	}
	switch req.Category {
	case "general", "complaint", "suggestion", "support":
	default:
		errs.Add("category", "enum", "Geçersiz kategori.")
	}
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}

	var id uuid.UUID
	err := h.db.Pool.QueryRow(r.Context(), `
		INSERT INTO contact_messages (full_name, email, phone, subject, message, category)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id
	`, req.FullName, req.Email, nullEmpty(req.Phone), req.Subject, req.Message, req.Category).Scan(&id)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "CONTACT01", "Mesaj kaydedilemedi.")
		return
	}

	to := strings.TrimSpace(h.toEmail)
	if to != "" {
		body := fmt.Sprintf(
			"Yeni iletişim formu mesajı\n\nKategori: %s\nAd Soyad: %s\nE-posta: %s\nTelefon: %s\nKonu: %s\n\n%s\n",
			req.Category, req.FullName, req.Email, req.Phone, req.Subject, req.Message,
		)
		_ = h.notify.SendEmail(r.Context(), to, "[İletişim] "+req.Subject, "contact_form", body, nil)
	}

	response.OK(w, map[string]interface{}{
		"id":      id.String(),
		"message": "Mesajınız alındı. En kısa sürede size dönüş yapacağız.",
	})
}

func nullEmpty(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}

func (h *AdminHandler) ListContactMessages(w http.ResponseWriter, r *http.Request) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	search := strings.TrimSpace(r.URL.Query().Get("search"))

	where := []string{}
	args := []interface{}{}
	i := 1
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", i))
		args = append(args, status)
		i++
	}
	if search != "" {
		where = append(where, fmt.Sprintf("(full_name ILIKE $%d OR email ILIKE $%d OR subject ILIKE $%d OR message ILIKE $%d)", i, i, i, i))
		args = append(args, "%"+search+"%")
		i++
	}
	whereSQL := ""
	if len(where) > 0 {
		whereSQL = " WHERE " + strings.Join(where, " AND ")
	}

	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id::text, full_name, email, COALESCE(phone,''), subject, message, category, status, created_at, read_at
		FROM contact_messages`+whereSQL+`
		ORDER BY created_at DESC
		LIMIT 200
	`, args...)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM080", "İletişim mesajları listelenemedi.")
		return
	}
	defer rows.Close()

	items := []map[string]interface{}{}
	for rows.Next() {
		var id, name, email, phone, subject, message, category, st string
		var createdAt time.Time
		var readAt *time.Time
		if err := rows.Scan(&id, &name, &email, &phone, &subject, &message, &category, &st, &createdAt, &readAt); err != nil {
			continue
		}
		items = append(items, map[string]interface{}{
			"id": id, "fullName": name, "email": email, "phone": phone,
			"subject": subject, "message": message, "category": category,
			"status": st, "createdAt": createdAt, "readAt": readAt,
		})
	}
	response.OK(w, items)
}

func (h *AdminHandler) UpdateContactMessage(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ADM081", "Geçersiz mesaj ID.")
		return
	}
	var req struct {
		Status    string `json:"status"`
		AdminNote string `json:"adminNote"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	req.Status = strings.ToLower(strings.TrimSpace(req.Status))
	switch req.Status {
	case "new", "read", "closed":
	default:
		response.Fail(w, http.StatusBadRequest, "ADM082", "Geçersiz durum.")
		return
	}

	_, err = h.db.Pool.Exec(r.Context(), `
		UPDATE contact_messages
		SET status = $2,
		    admin_note = NULLIF($3, ''),
		    read_at = CASE WHEN $2 IN ('read','closed') THEN COALESCE(read_at, now()) ELSE read_at END,
		    closed_at = CASE WHEN $2 = 'closed' THEN now() ELSE closed_at END
		WHERE id = $1
	`, id, req.Status, strings.TrimSpace(req.AdminNote))
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM083", "Mesaj güncellenemedi.")
		return
	}
	response.OK(w, map[string]bool{"success": true})
}

func (h *AdminHandler) ListSMSOTPLogs(w http.ResponseWriter, r *http.Request) {
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	purpose := strings.TrimSpace(r.URL.Query().Get("purpose"))

	where := []string{}
	args := []interface{}{}
	i := 1
	if purpose != "" {
		where = append(where, fmt.Sprintf("purpose = $%d", i))
		args = append(args, purpose)
		i++
	}
	if search != "" {
		where = append(where, fmt.Sprintf(`(
			first_name ILIKE $%d OR last_name ILIKE $%d OR email ILIKE $%d
			OR phone_number ILIKE $%d OR phone_e164 ILIKE $%d OR otp_code ILIKE $%d
		)`, i, i, i, i, i, i))
		args = append(args, "%"+search+"%")
		i++
	}
	whereSQL := ""
	if len(where) > 0 {
		whereSQL = " WHERE " + strings.Join(where, " AND ")
	}

	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id::text, purpose, phone_e164, COALESCE(phone_country_code,''), COALESCE(phone_number,''),
		       otp_code, COALESCE(first_name,''), COALESCE(last_name,''), COALESCE(email,''),
		       status, COALESCE(error_message,''), created_at
		FROM sms_otp_logs`+whereSQL+`
		ORDER BY created_at DESC
		LIMIT 200
	`, args...)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "ADM084", "SMS kod logları listelenemedi.")
		return
	}
	defer rows.Close()

	items := []map[string]interface{}{}
	for rows.Next() {
		var id, purpose, e164, cc, phone, code, first, last, email, status, errMsg string
		var createdAt time.Time
		if err := rows.Scan(&id, &purpose, &e164, &cc, &phone, &code, &first, &last, &email, &status, &errMsg, &createdAt); err != nil {
			continue
		}
		items = append(items, map[string]interface{}{
			"id": id, "purpose": purpose, "phoneE164": e164, "phoneCountryCode": cc,
			"phoneNumber": phone, "otpCode": code, "firstName": first, "lastName": last,
			"email": email, "status": status, "errorMessage": errMsg, "createdAt": createdAt,
		})
	}
	response.OK(w, items)
}
