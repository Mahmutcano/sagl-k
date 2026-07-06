package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	appcfg "medical-consultation-platform/backend/internal/config"
	"medical-consultation-platform/backend/internal/domain"
	authmw "medical-consultation-platform/backend/internal/middleware"
	"medical-consultation-platform/backend/internal/pkg/response"
	"medical-consultation-platform/backend/internal/pkg/validate"
	"medical-consultation-platform/backend/internal/repository"
	appsvc "medical-consultation-platform/backend/internal/service/application"
	notifysvc "medical-consultation-platform/backend/internal/service/notification"
	paysvc "medical-consultation-platform/backend/internal/service/payment"
)

func parseAppID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	appID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		var errs validate.Errors
		errs.Add("id", "format", "Başvuru kimliği geçerli bir UUID olmalıdır.")
		validate.Fail(w, errs)
		return uuid.Nil, false
	}
	return appID, true
}

type ApplicationHandler struct {
	app     *appsvc.Service
	payment *paysvc.Service
	notify  *notifysvc.Service
	db      *repository.DB
	cfg     appcfg.Config
}

func NewApplicationHandler(app *appsvc.Service, payment *paysvc.Service, notify *notifysvc.Service, db *repository.DB, cfg appcfg.Config) *ApplicationHandler {
	return &ApplicationHandler{app: app, payment: payment, notify: notify, db: db, cfg: cfg}
}

func (h *ApplicationHandler) ListProfessions(w http.ResponseWriter, r *http.Request) {
	target, _ := strconv.Atoi(r.URL.Query().Get("targetInstitution"))
	if target == 0 {
		target = 1
	}
	var errs validate.Errors
	validate.TargetInstitution(&errs, "targetInstitution", target)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT code, name FROM professions WHERE target_institution = $1 AND is_active = true ORDER BY name
	`, target)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "APP001", "Branş listesi alınamadı.")
		return
	}
	defer rows.Close()
	var list []map[string]string
	for rows.Next() {
		var code, name string
		if err := rows.Scan(&code, &name); err != nil {
			continue
		}
		list = append(list, map[string]string{"code": code, "name": name})
	}
	if list == nil {
		list = []map[string]string{}
	}
	response.OK(w, list)
}

func (h *ApplicationHandler) ListCareProviders(w http.ResponseWriter, r *http.Request) {
	target, _ := strconv.Atoi(r.URL.Query().Get("targetInstitution"))
	code := r.URL.Query().Get("professionCode")
	if target == 0 {
		target = 1
	}
	var errs validate.Errors
	validate.TargetInstitution(&errs, "targetInstitution", target)
	if code != "" {
		validate.ProfessionCode(&errs, "professionCode", code)
	}
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id::text, full_name, COALESCE(title,''), profession_code
		FROM care_providers
		WHERE target_institution = $1 AND is_active = true AND user_id IS NOT NULL
		  AND ($2 = '' OR profession_code = $2)
		ORDER BY full_name
	`, target, code)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "APP002", "Doktor listesi alınamadı.")
		return
	}
	defer rows.Close()
	var list []map[string]string
	for rows.Next() {
		var id, name, title, pcode string
		if err := rows.Scan(&id, &name, &title, &pcode); err != nil {
			continue
		}
		list = append(list, map[string]string{
			"careProviderId": id, "fullName": name, "title": title, "professionCode": pcode,
		})
	}
	if list == nil {
		list = []map[string]string{}
	}
	response.OK(w, list)
}

func (h *ApplicationHandler) StartApplication(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	var req appsvc.StartApplicationRequest
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.TargetInstitution(&errs, "targetInstitution", req.TargetInstitution)
	validate.ProfessionCode(&errs, "professionCode", req.ProfessionCode)
	if req.ProfessionName == "" {
		errs.Add("professionName", "required", "Bölüm adı zorunludur.")
	}
	if req.CareProviderID != "" {
		validate.UUID(&errs, "careProviderId", req.CareProviderID, "Doktor kimliği")
	}
	validate.SurveyData(&errs, "surveyData.data", req.SurveyData.Data)
	validate.ApplicationSurveyAnswers(&errs, req.SurveyData.Data)
	if req.IsForRelative {
		if req.RepresentedPerson == nil {
			errs.Add("representedPerson", "required", "Yakın adına başvuru için temsil edilen kişi bilgileri zorunludur.")
		} else {
			fn, _ := req.RepresentedPerson["firstName"].(string)
			ln, _ := req.RepresentedPerson["lastName"].(string)
			nid, _ := req.RepresentedPerson["nationalIdentifier"].(string)
			bd, _ := req.RepresentedPerson["birthDate"].(string)
			if bd == "" {
				bd, _ = req.RepresentedPerson["dateOfBirth"].(string)
			}
			validate.PersonName(&errs, "representedPerson.firstName", fn, "Yakının adı")
			validate.PersonName(&errs, "representedPerson.lastName", ln, "Yakının soyadı")
			validate.NationalID(&errs, "representedPerson.nationalIdentifier", nid)
			if bd != "" {
				validate.BirthDate(&errs, "representedPerson.birthDate", bd, -1, "")
			} else {
				errs.Add("representedPerson.birthDate", "required", "Yakının doğum tarihi zorunludur.")
			}
			switch g := req.RepresentedPerson["gender"].(type) {
			case float64:
				validate.Gender(&errs, "representedPerson.gender", int(g))
			case int:
				validate.Gender(&errs, "representedPerson.gender", g)
			default:
				errs.Add("representedPerson.gender", "required", "Yakının cinsiyeti zorunludur.")
			}
			if claims != nil && nid != "" {
				var ownerNID *string
				_ = h.db.Pool.QueryRow(r.Context(), `SELECT national_identifier FROM users WHERE id = $1`, claims.UserID).Scan(&ownerNID)
				if ownerNID != nil && *ownerNID == nid {
					errs.Add("representedPerson.nationalIdentifier", "conflict", "Yakının TC Kimlik No başvuranın kimlik numarası ile aynı olamaz.")
				}
			}
		}
	}
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	id, err := h.app.Start(r.Context(), claims.UserID, req)
	if err != nil {
		code, msg, status := mapErciyesStartError(err)
		if code == "ERC099" || status == http.StatusBadRequest {
			response.Fail(w, http.StatusBadRequest, "APP011", response.SafeMessage(err, "Başvuru oluşturulamadı."))
			return
		}
		response.Fail(w, status, code, msg)
		return
	}
	response.OK(w, map[string]string{"applicationId": id.String()})
}

func (h *ApplicationHandler) ApplicationDetail(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	var err error
	var statusCode int
	var appNumber, ecommerce, professionCode, professionName *string
	var careProviderID *uuid.UUID
	var isForRelative bool
	var surveyData []byte
	err = h.db.Pool.QueryRow(r.Context(), `
		SELECT a.status_code, a.application_number, a.ecommerce_number, a.profession_code, a.profession_name,
		       a.care_provider_id, a.is_for_relative, COALESCE(s.data, '{}')
		FROM applications a
		LEFT JOIN application_surveys s ON s.application_id = a.id
		WHERE a.id = $1
	`, appID).Scan(&statusCode, &appNumber, &ecommerce, &professionCode, &professionName, &careProviderID, &isForRelative, &surveyData)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "APP021", "Başvuru bulunamadı.")
		return
	}
	payload := map[string]interface{}{
		"applicationId":     appID.String(),
		"applicationNumber": appNumber,
		"statusCode":        statusCode,
		"ecommerceNumber":   ecommerce,
		"professionCode":    professionCode,
		"professionName":    professionName,
		"isForRelative":     isForRelative,
		"surveyData":        json.RawMessage(surveyData),
	}
	if careProviderID != nil {
		payload["careProviderId"] = careProviderID.String()
	}
	if isForRelative {
		var fn, ln string
		var nid *string
		var birth *time.Time
		var gender *int
		err = h.db.Pool.QueryRow(r.Context(), `
			SELECT first_name, last_name, national_identifier, birth_date, gender
			FROM application_represented_persons WHERE application_id = $1
		`, appID).Scan(&fn, &ln, &nid, &birth, &gender)
		if err == nil {
			person := map[string]interface{}{
				"firstName": fn, "lastName": ln, "nationalIdentifier": nid,
			}
			if birth != nil {
				person["birthDate"] = birth.Format("2006-01-02")
			}
			if gender != nil {
				person["gender"] = *gender
			}
			payload["representedPerson"] = person
		}
	}
	response.OK(w, payload)
}

func paymentResultPayload(result *paysvc.CheckoutResult) map[string]interface{} {
	if result == nil {
		return map[string]interface{}{"status": "paid"}
	}
	out := map[string]interface{}{
		"transactionId": result.TransactionID,
		"orderId":       result.OrderID,
		"status":        result.Status,
		"paymentId":     result.PaymentID,
	}
	if result.RedirectURL != nil {
		out["redirectUrl"] = *result.RedirectURL
	}
	if result.RedirectHTML != nil {
		out["redirectHtml"] = *result.RedirectHTML
	}
	return out
}

func (h *ApplicationHandler) UpdateApplication(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	claims := authmw.ClaimsFromContext(r.Context())
	if claims == nil {
		response.Fail(w, http.StatusUnauthorized, "AUTH002", "Oturum geçersiz.")
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}

	var req appsvc.UpdateApplicationRequest
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	if req.ProfessionCode == "" {
		errs.Add("professionCode", "required", "Bölüm seçimi zorunludur.")
	}
	if req.ProfessionName == "" {
		errs.Add("professionName", "required", "Bölüm adı zorunludur.")
	}
	if req.CareProviderID != "" {
		validate.UUID(&errs, "careProviderId", req.CareProviderID, "Doktor kimliği")
	}
	validate.SurveyData(&errs, "surveyData.data", req.SurveyData.Data)
	validate.ApplicationSurveyAnswers(&errs, req.SurveyData.Data)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}

	if err := h.app.Update(r.Context(), appID, claims.UserID, req); err != nil {
		if errors.Is(err, appsvc.ErrNotEditable) {
			response.Fail(w, http.StatusConflict, "APP033", err.Error())
			return
		}
		response.Fail(w, http.StatusBadRequest, "APP032", response.SafeMessage(err, "Başvuru güncellenemedi."))
		return
	}
	response.OK(w, map[string]bool{"updated": true})
}

func (h *ApplicationHandler) DeleteApplication(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	claims := authmw.ClaimsFromContext(r.Context())
	if claims == nil {
		response.Fail(w, http.StatusUnauthorized, "AUTH002", "Oturum geçersiz.")
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	if err := h.app.DeleteUnpaid(r.Context(), appID, claims.UserID); err != nil {
		if errors.Is(err, appsvc.ErrNotCancellable) {
			response.Fail(w, http.StatusConflict, "APP034", "Ödenmiş başvuru iptal edilemez.")
			return
		}
		response.Fail(w, http.StatusNotFound, "APP021", "Başvuru bulunamadı.")
		return
	}
	response.OK(w, map[string]bool{"deleted": true})
}

func (h *ApplicationHandler) PreviewApplication(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	data, err := h.app.LoadPreview(r.Context(), appID)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "APP021", "Başvuru bulunamadı.")
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(appsvc.RenderPreviewHTML(data)))
}

func (h *ApplicationHandler) VerifyApplicationPublicly(w http.ResponseWriter, r *http.Request) {
	appID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "APP901", "Geçersiz başvuru ID.")
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		response.Fail(w, http.StatusBadRequest, "APP902", "Doğrulama kodu eksik.")
		return
	}

	expectedCode := appsvc.GenerateVerificationCode(appID)
	if code != expectedCode {
		response.Fail(w, http.StatusForbidden, "APP903", "Geçersiz doğrulama kodu.")
		return
	}

	data, err := h.app.LoadPreview(r.Context(), appID)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "APP904", "Başvuru bulunamadı.")
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(appsvc.RenderPreviewHTML(data)))
}

func (h *ApplicationHandler) AssessApplication(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	var req struct {
		IsApproved bool   `json:"isApproved"`
		Reason     string `json:"reason"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.RejectionReason(&errs, "reason", req.Reason, req.IsApproved)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	if err := h.app.Assess(r.Context(), appID, req.IsApproved, req.Reason); err != nil {
		response.Fail(w, http.StatusBadRequest, "APP042", response.SafeMessage(err, "Değerlendirme kaydedilemedi."))
		return
	}
	response.OK(w, map[string]bool{"assessed": true})
}

type pagingRequest struct {
	Page     int `json:"page"`
	PageSize int `json:"pageSize"`
}

func (h *ApplicationHandler) PagingPatient(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	var req pagingRequest
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	req.Page, req.PageSize = validate.Paging(&errs, req.Page, req.PageSize)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	offset := req.Page * req.PageSize
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id::text, status_code, application_number, ecommerce_number, profession_name, created_at
		FROM applications WHERE owner_user_id = $1
		ORDER BY created_at DESC LIMIT $2 OFFSET $3
	`, claims.UserID, req.PageSize, offset)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "APP050", "Başvurular listelenemedi.")
		return
	}
	defer rows.Close()
	items := h.scanPagingRows(rows)
	response.OK(w, map[string]interface{}{"items": items, "page": req.Page, "pageSize": req.PageSize})
}

func (h *ApplicationHandler) PagingNurse(w http.ResponseWriter, r *http.Request) {
	h.pagingByStatus(w, r, []int{1, 4, 5, 11})
}

func (h *ApplicationHandler) PagingDoctor(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	var req pagingRequest
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	req.Page, req.PageSize = validate.Paging(&errs, req.Page, req.PageSize)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	offset := req.Page * req.PageSize
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id::text, status_code, application_number, ecommerce_number, profession_name, created_at
		FROM applications WHERE doctor_user_id = $1
		ORDER BY created_at DESC LIMIT $2 OFFSET $3
	`, claims.UserID, req.PageSize, offset)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "APP060", "Başvurular listelenemedi.")
		return
	}
	defer rows.Close()
	items := h.scanPagingRows(rows)
	response.OK(w, map[string]interface{}{"items": items, "page": req.Page, "pageSize": req.PageSize})
}

func (h *ApplicationHandler) pagingByStatus(w http.ResponseWriter, r *http.Request, statuses []int) {
	var req pagingRequest
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	req.Page, req.PageSize = validate.Paging(&errs, req.Page, req.PageSize)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	offset := req.Page * req.PageSize
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT id::text, status_code, application_number, ecommerce_number, profession_name, created_at
		FROM applications WHERE status_code = ANY($1)
		ORDER BY created_at DESC LIMIT $2 OFFSET $3
	`, statuses, req.PageSize, offset)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "APP061", "Başvurular listelenemedi.")
		return
	}
	defer rows.Close()
	items := h.scanPagingRows(rows)
	response.OK(w, map[string]interface{}{"items": items, "page": req.Page, "pageSize": req.PageSize})
}

func (h *ApplicationHandler) scanPagingRows(rows interface {
	Next() bool
	Scan(dest ...interface{}) error
}) []map[string]interface{} {
	items := []map[string]interface{}{}
	for rows.Next() {
		var id string
		var status int
		var appNumber, ecommerce, profession *string
		var createdAt interface{}
		if err := rows.Scan(&id, &status, &appNumber, &ecommerce, &profession, &createdAt); err != nil {
			continue
		}
		items = append(items, map[string]interface{}{
			"applicationId": id, "statusCode": status,
			"applicationNumber": appNumber,
			"ecommerceNumber":   ecommerce,
			"professionName":    profession,
			"createdAt":         createdAt,
		})
	}
	return items
}

func (h *ApplicationHandler) CompleteNurseAssessment(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	if err := h.app.SendToDoctor(r.Context(), appID); err != nil {
		response.Fail(w, http.StatusBadRequest, "APP071", response.SafeMessage(err, "İşlem tamamlanamadı."))
		return
	}
	response.OK(w, map[string]bool{"sent": true})
}

func (h *ApplicationHandler) SaveTemporalReport(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	var req struct {
		Data string `json:"data"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.SurveyData(&errs, "data", req.Data)
	if req.Data == "" {
		errs.Add("data", "required", "Rapor taslağı zorunludur.")
	}
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	if err := h.app.SaveTemporalReport(r.Context(), appID, claims.UserID, req.Data); err != nil {
		response.Fail(w, http.StatusBadRequest, "APP082", response.SafeMessage(err, "Taslak kaydedilemedi."))
		return
	}
	response.OK(w, map[string]bool{"saved": true})
}

func (h *ApplicationHandler) GetTemporalReport(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	data, err := h.app.GetLastTemporalReport(r.Context(), appID)
	if err != nil {
		response.OK(w, map[string]string{"data": "{}"})
		return
	}
	response.OK(w, map[string]string{"data": data})
}

func (h *ApplicationHandler) ConcludeApplication(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	var req struct {
		ReportJSON string `json:"reportJson"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.ReportJSON(&errs, "reportJson", req.ReportJSON)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	if err := h.app.Conclude(r.Context(), appID, claims.UserID, req.ReportJSON); err != nil {
		response.Fail(w, http.StatusBadRequest, "APP102", response.SafeMessage(err, "Başvuru sonuçlandırılamadı."))
		return
	}
	var ownerID uuid.UUID
	var email *string
	var appNumber *string
	_ = h.db.Pool.QueryRow(r.Context(), `
		SELECT a.owner_user_id, u.email, a.application_number
		FROM applications a JOIN users u ON u.id = a.owner_user_id WHERE a.id = $1
	`, appID).Scan(&ownerID, &email, &appNumber)
	if email != nil && *email != "" {
		displayNo := appID.String()
		if appNumber != nil && *appNumber != "" {
			displayNo = *appNumber
		}
		h.notify.SendReportReadyEmail(r.Context(), ownerID, *email, displayNo, appID)
	}
	response.OK(w, map[string]bool{"concluded": true})
}

func (h *ApplicationHandler) GetFinalReport(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	var reportJSON []byte
	var createdAt time.Time
	err := h.db.Pool.QueryRow(r.Context(), `
		SELECT report_json, created_at FROM application_final_reports WHERE application_id = $1
	`, appID).Scan(&reportJSON, &createdAt)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "APP131", "Rapor henüz hazır değil.")
		return
	}
	response.OK(w, map[string]interface{}{
		"reportJson": json.RawMessage(reportJSON),
		"createdAt":  createdAt,
	})
}

func (h *ApplicationHandler) UpdatePayment(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}

	if existing, err := h.payment.Store().FindPaidByApplication(r.Context(), appID); err == nil && existing != nil {
		response.OK(w, map[string]interface{}{
			"transactionId": existing.ProviderTransactionID,
			"orderId":       appID.String(),
			"status":        "paid",
			"paymentId":     existing.ID.String(),
		})
		return
	}

	var req struct {
		Provider    string `json:"provider"`
		CardHolder  string `json:"cardHolder"`
		CardNumber  string `json:"cardNumber"`
		ExpiryMonth int    `json:"expiryMonth"`
		ExpiryYear  int    `json:"expiryYear"`
		CVV         string `json:"cvv"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	provider := req.Provider
	if provider == "" {
		provider = r.URL.Query().Get("provider")
	}
	if provider == "" {
		provider = h.cfg.DefaultPaymentProvider
	}

	var errs validate.Errors
	provider = validate.PaymentProvider(&errs, "provider", provider)
	amount := h.cfg.PaymentAmount
	validate.PaymentAmount(&errs, "amount", amount)
	live := isLivePaymentProvider(h.cfg, provider)
	if live || h.payment.RequireCard() {
		validate.CardHolder(&errs, "cardHolder", req.CardHolder)
		validate.CardNumber(&errs, "cardNumber", req.CardNumber)
		validate.CardCVV(&errs, "cvv", req.CVV)
		validate.CardExpiry(&errs, "expiryMonth", req.ExpiryMonth, "expiryYear", req.ExpiryYear)
	}
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}

	var statusCode int
	var appNumber *string
	err := h.db.Pool.QueryRow(r.Context(), `
		SELECT status_code, application_number FROM applications WHERE id = $1
	`, appID).Scan(&statusCode, &appNumber)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "APP001", "Başvuru bulunamadı.")
		return
	}
	if statusCode != domain.StatusPaymentPending {
		if statusCode == domain.StatusPaymentCompleted {
			response.OK(w, map[string]interface{}{
				"orderId": appID.String(),
				"status":  "paid",
			})
			return
		}
		response.Fail(w, http.StatusConflict, "APP110", "Bu başvuru için ödeme beklenmiyor. Başvuru zaten ödenmiş veya farklı bir aşamada olabilir.")
		return
	}

	var firstName, lastName, email, phone string
	err = h.db.Pool.QueryRow(r.Context(), `
		SELECT first_name, last_name, COALESCE(email,''), COALESCE(phone_number,'')
		FROM users WHERE id = $1
	`, claims.UserID).Scan(&firstName, &lastName, &email, &phone)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "APP112", "Kullanıcı bilgileri alınamadı.")
		return
	}

	dbProvider := paysvc.ProviderDBValue(paysvc.NormalizeProvider(provider))
	paymentID, err := h.payment.Store().CreatePending(r.Context(), paysvc.PaymentRecord{
		ApplicationID:  appID,
		UserID:         claims.UserID,
		Provider:       dbProvider,
		Amount:         amount,
		Currency:       "TRY",
		IdempotencyKey: appID.String(),
	}, map[string]interface{}{"provider": provider})
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "APP113", "Ödeme kaydı oluşturulamadı.")
		return
	}

	successURL := strings.TrimRight(h.cfg.PortalURL, "/") + "/patient/applications/" + appID.String() + "?payment=success"
	failURL := strings.TrimRight(h.cfg.PortalURL, "/") + "/patient/applications/" + appID.String() + "?payment=failed"

	result, err := h.payment.Checkout(r.Context(), provider, paysvc.CheckoutRequest{
		ApplicationID:  appID.String(),
		Amount:         amount,
		Currency:       "TRY",
		CustomerName:   strings.TrimSpace(firstName + " " + lastName),
		CustomerEmail:  email,
		CustomerPhone:  phone,
		CardHolder:     req.CardHolder,
		CardNumber:     req.CardNumber,
		ExpiryMonth:    req.ExpiryMonth,
		ExpiryYear:     req.ExpiryYear,
		CVV:            req.CVV,
		IdempotencyKey: appID.String(),
		SuccessURL:     successURL,
		FailURL:        failURL,
	})
	if err != nil {
		_ = h.payment.Store().MarkFailed(r.Context(), paymentID, err.Error())
		response.Fail(w, http.StatusBadRequest, "APP111", response.SafeMessage(err, "Ödeme başlatılamadı."))
		return
	}

	if result.Status == "paid" || result.Status == "success" || result.Status == "completed" {
		_ = h.payment.Store().MarkPaid(r.Context(), paymentID, result.TransactionID, map[string]interface{}{
			"orderId": result.OrderID,
		})
		_ = h.app.UpdatePaymentCompleted(r.Context(), appID, claims.UserID)
		displayNo := appID.String()
		if appNumber != nil && *appNumber != "" {
			displayNo = *appNumber
		}
		h.notify.SendPaymentConfirmation(r.Context(), claims.UserID, email, displayNo, amount)
	}

	result.PaymentID = paymentID.String()
	response.OK(w, paymentResultPayload(result))
}

func (h *ApplicationHandler) AddNote(w http.ResponseWriter, r *http.Request) {
	claims := authmw.ClaimsFromContext(r.Context())
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	var req struct {
		Content string `json:"content"`
	}
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	validate.NoteContent(&errs, "content", req.Content)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	_, err := h.db.Pool.Exec(r.Context(), `
		INSERT INTO application_notes (application_id, author_user_id, content) VALUES ($1,$2,$3)
	`, appID, claims.UserID, req.Content)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "APP122", "Not eklenemedi.")
		return
	}
	response.OK(w, map[string]bool{"added": true})
}

func (h *ApplicationHandler) NoteHistory(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	rows, err := h.db.Pool.Query(r.Context(), `
		SELECT n.content, n.created_at, u.first_name || ' ' || u.last_name
		FROM application_notes n
		JOIN users u ON u.id = n.author_user_id
		WHERE n.application_id = $1 ORDER BY n.created_at
	`, appID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "APP131", "Not geçmişi alınamadı.")
		return
	}
	defer rows.Close()
	notes := []map[string]interface{}{}
	for rows.Next() {
		var content, author string
		var createdAt interface{}
		if err := rows.Scan(&content, &createdAt, &author); err != nil {
			continue
		}
		notes = append(notes, map[string]interface{}{
			"content": content, "createdAt": createdAt, "author": author,
		})
	}
	response.OK(w, notes)
}
