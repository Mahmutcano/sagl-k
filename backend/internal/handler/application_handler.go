package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
	invoicesvc "medical-consultation-platform/backend/internal/service/invoice"
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
	invoice *invoicesvc.Service
	notify  *notifysvc.Service
	db      *repository.DB
	cfg     appcfg.Config
}

func NewApplicationHandler(app *appsvc.Service, payment *paysvc.Service, invoice *invoicesvc.Service, notify *notifysvc.Service, db *repository.DB, cfg appcfg.Config) *ApplicationHandler {
	return &ApplicationHandler{app: app, payment: payment, invoice: invoice, notify: notify, db: db, cfg: cfg}
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
		SELECT cp.id::text, cp.full_name, COALESCE(cp.title,''), cp.profession_code, cp.consultation_fee
		FROM care_providers cp
		WHERE cp.target_institution = $1 AND cp.is_active = true AND cp.user_id IS NOT NULL
		  AND ($2 = '' OR cp.profession_code = $2 OR EXISTS (
		      SELECT 1 FROM care_provider_professions cpp
		      JOIN professions p ON p.id = cpp.profession_id
		      WHERE cpp.care_provider_id = cp.id AND p.code = $2
		  ))
		ORDER BY cp.full_name
	`, target, code)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "APP002", "Doktor listesi alınamadı.")
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id, name, title, pcode string
		var fee float64
		if err := rows.Scan(&id, &name, &title, &pcode, &fee); err != nil {
			continue
		}
		list = append(list, map[string]interface{}{
			"careProviderId": id, "fullName": name, "title": title, "professionCode": pcode, "consultationFee": fee,
		})
	}
	if list == nil {
		list = []map[string]interface{}{}
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
		response.Fail(w, http.StatusBadRequest, "APP011", response.SafeMessage(err, "Başvuru oluşturulamadı."))
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
	var ownerFirst, ownerLast string
	err = h.db.Pool.QueryRow(r.Context(), `
		SELECT a.status_code, a.application_number, a.ecommerce_number, a.profession_code, a.profession_name,
		       a.care_provider_id, a.is_for_relative, COALESCE(s.data, '{}'),
		       u.first_name, u.last_name
		FROM applications a
		JOIN users u ON u.id = a.owner_user_id
		LEFT JOIN application_surveys s ON s.application_id = a.id
		WHERE a.id = $1
	`, appID).Scan(&statusCode, &appNumber, &ecommerce, &professionCode, &professionName, &careProviderID, &isForRelative, &surveyData, &ownerFirst, &ownerLast)
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
		"patientName":       strings.TrimSpace(ownerFirst + " " + ownerLast),
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

func paymentResultPayload(result *paysvc.CheckoutResult, receipt map[string]interface{}) map[string]interface{} {
	if result == nil {
		out := map[string]interface{}{"status": "paid"}
		if receipt != nil {
			out["receipt"] = sanitizePatientReceipt(receipt)
		}
		return out
	}
	out := map[string]interface{}{
		"status": result.Status,
	}
	if result.RedirectURL != nil {
		out["redirectUrl"] = *result.RedirectURL
	}
	if result.RedirectHTML != nil {
		out["redirectHtml"] = *result.RedirectHTML
	}
	if receipt != nil {
		out["receipt"] = sanitizePatientReceipt(receipt)
	}
	return out
}

func isInternalPatientReference(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return true
	}
	if strings.HasPrefix(strings.ToLower(value), "param-test-") {
		return true
	}
	if strings.HasPrefix(strings.ToLower(value), "bh-inv-test-") {
		return true
	}
	if _, err := uuid.Parse(value); err == nil {
		return true
	}
	return false
}

func patientInvoiceStatusLabel(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "issued":
		return "Fatura düzenlendi"
	case "paid":
		return "Ödeme onaylandı"
	default:
		return "Başarılı"
	}
}

// sanitizePatientReceipt removes internal IDs from the patient-facing payment receipt.
func sanitizePatientReceipt(receipt map[string]interface{}) map[string]interface{} {
	out := map[string]interface{}{}

	copyString := func(key string) {
		if v, ok := receipt[key].(string); ok && strings.TrimSpace(v) != "" {
			out[key] = strings.TrimSpace(v)
		}
	}

	if v, ok := receipt["amount"].(float64); ok {
		out["amount"] = v
	}
	copyString("currency")
	copyString("description")
	copyString("providerLabel")
	copyString("invoiceProviderLabel")
	copyString("paidAt")
	copyString("applicationNumber")
	copyString("professionName")
	copyString("doctorName")
	copyString("maskedCard")
	copyString("cardBrand")

	if v, ok := receipt["ecommerceNumber"].(string); ok && !isInternalPatientReference(v) {
		out["ecommerceNumber"] = v
		out["authReference"] = v
	} else if v, ok := receipt["transactionId"].(string); ok && !isInternalPatientReference(v) {
		out["authReference"] = v
	}

	if v, ok := receipt["invoiceNumber"].(string); ok && !isInternalPatientReference(v) {
		out["invoiceNumber"] = v
	}
	if v, ok := receipt["invoiceStatus"].(string); ok && v != "" {
		out["invoiceStatusLabel"] = patientInvoiceStatusLabel(v)
	}
	if v, ok := receipt["invoice_error"].(string); ok && strings.TrimSpace(v) != "" {
		out["invoiceError"] = v
	} else if v, ok := receipt["invoiceError"].(string); ok && strings.TrimSpace(v) != "" {
		out["invoiceError"] = v
	}

	return out
}

func (h *ApplicationHandler) buildPaymentReceipt(
	ctx context.Context,
	paymentID, appID uuid.UUID,
) map[string]interface{} {
	var (
		amount                float64
		currency              string
		provider              string
		transactionID         string
		paidAt                *time.Time
		metaBytes             []byte
		appNumber             *string
		professionName        *string
		ecommerceNumber       *string
		doctorName            *string
		doctorTitle           *string
	)
	err := h.db.Pool.QueryRow(ctx, `
		SELECT p.amount, p.currency, p.provider::text, COALESCE(p.provider_transaction_id, ''),
		       p.paid_at, COALESCE(p.metadata, '{}'),
		       a.application_number, a.profession_name, a.ecommerce_number,
		       cp.full_name, cp.title
		FROM payments p
		JOIN applications a ON a.id = p.application_id
		LEFT JOIN care_providers cp ON cp.id = a.care_provider_id
		WHERE p.id = $1 AND p.application_id = $2
	`, paymentID, appID).Scan(
		&amount, &currency, &provider, &transactionID, &paidAt, &metaBytes,
		&appNumber, &professionName, &ecommerceNumber, &doctorName, &doctorTitle,
	)
	if err != nil {
		return map[string]interface{}{
			"status": "paid",
		}
	}

	var meta map[string]interface{}
	_ = json.Unmarshal(metaBytes, &meta)

	receipt := map[string]interface{}{
		"amount":          amount,
		"currency":        currency,
		"provider":        provider,
		"transactionId":   transactionID,
		"paymentId":       paymentID.String(),
		"applicationId":   appID.String(),
		"description":     "Tıbbi danışmanlık başvuru ücreti",
		"providerLabel":   "Param",
		"invoiceProviderLabel": "Bizim Hesap",
	}
	if paidAt != nil {
		receipt["paidAt"] = paidAt.Format(time.RFC3339)
	}
	if appNumber != nil && *appNumber != "" {
		receipt["applicationNumber"] = *appNumber
	}
	if professionName != nil && *professionName != "" {
		receipt["professionName"] = *professionName
	}
	if ecommerceNumber != nil && *ecommerceNumber != "" {
		receipt["ecommerceNumber"] = *ecommerceNumber
	}
	if doctorName != nil && *doctorName != "" {
		name := *doctorName
		if doctorTitle != nil && *doctorTitle != "" {
			name = *doctorTitle + " " + name
		}
		receipt["doctorName"] = name
	}
	if v, ok := meta["masked_card"].(string); ok && v != "" {
		receipt["maskedCard"] = v
	}
	if v, ok := meta["card_brand"].(string); ok && v != "" {
		receipt["cardBrand"] = v
	}
	if v, ok := meta["invoice_id"].(string); ok && v != "" {
		receipt["invoiceId"] = v
	}
	if v, ok := meta["invoice_number"].(string); ok && v != "" {
		receipt["invoiceNumber"] = v
	}
	if v, ok := meta["invoice_provider"].(string); ok && v != "" {
		receipt["invoiceProvider"] = v
	}
	if v, ok := meta["invoice_status"].(string); ok && v != "" {
		receipt["invoiceStatus"] = v
	}
	if v, ok := meta["invoice_error"].(string); ok && v != "" {
		receipt["invoiceError"] = v
	}
	return receipt
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

type doctorQueueRequest struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	Search   string `json:"search"`
	SortBy   string `json:"sortBy"`
	SortDir  string `json:"sortDir"`
	Category string `json:"category"`
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
	var req doctorQueueRequest
	if !validate.DecodeJSON(w, r, &req) {
		return
	}
	var errs validate.Errors
	req.Page, req.PageSize = validate.Paging(&errs, req.Page, req.PageSize)
	if errs.Has() {
		validate.Fail(w, errs)
		return
	}

	search := strings.TrimSpace(req.Search)
	category := strings.ToLower(strings.TrimSpace(req.Category))
	if category == "" {
		category = "all"
	}
	sortBy := strings.ToLower(strings.TrimSpace(req.SortBy))
	if sortBy == "" {
		sortBy = "created_at"
	}
	sortDir := strings.ToUpper(strings.TrimSpace(req.SortDir))
	if sortDir != "ASC" {
		sortDir = "DESC"
	}

	sortColumn := "a.created_at"
	switch sortBy {
	case "patient_name", "patientname":
		sortColumn = "patient_name"
	case "status_code", "status":
		sortColumn = "a.status_code"
	case "application_number", "applicationnumber":
		sortColumn = "a.application_number"
	case "created_at", "createdat", "date":
		sortColumn = "a.created_at"
	}

	draftExists := `
		EXISTS (
			SELECT 1 FROM application_temporal_reports t
			WHERE t.application_id = a.id
			  AND t.data IS NOT NULL
			  AND t.data::text NOT IN ('{}', 'null', '""')
			  AND length(trim(t.data::text)) > 2
		)`

	var categoryClause string
	switch category {
	case "concluded":
		categoryClause = "AND a.status_code = 6"
	case "draft":
		categoryClause = "AND a.status_code != 6 AND " + draftExists
	case "pending_report", "pending":
		categoryClause = "AND a.status_code NOT IN (0, 3, 6, 7, 9) AND NOT " + draftExists
	default:
		categoryClause = ""
	}

	offset := req.Page * req.PageSize
	query := fmt.Sprintf(`
		SELECT a.id::text, a.status_code, a.application_number, a.ecommerce_number, a.profession_name, a.created_at,
		       CASE
		         WHEN a.is_for_relative AND rp.id IS NOT NULL THEN trim(rp.first_name || ' ' || rp.last_name)
		         ELSE trim(u.first_name || ' ' || u.last_name)
		       END AS patient_name,
		       %s AS has_draft
		FROM applications a
		JOIN users u ON u.id = a.owner_user_id
		LEFT JOIN application_represented_persons rp ON rp.application_id = a.id
		WHERE a.doctor_user_id = $1 AND a.status_code != 0
		  %s
		  AND ($2 = '' OR (
		    CASE
		      WHEN a.is_for_relative AND rp.id IS NOT NULL THEN trim(rp.first_name || ' ' || rp.last_name)
		      ELSE trim(u.first_name || ' ' || u.last_name)
		    END ILIKE '%%' || $2 || '%%'
		    OR COALESCE(a.application_number, '') ILIKE '%%' || $2 || '%%'
		    OR COALESCE(a.ecommerce_number, '') ILIKE '%%' || $2 || '%%'
		  ))
		ORDER BY %s %s NULLS LAST
		LIMIT $3 OFFSET $4
	`, draftExists, categoryClause, sortColumn, sortDir)

	rows, err := h.db.Pool.Query(r.Context(), query, claims.UserID, search, req.PageSize, offset)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "APP060", "Başvurular listelenemedi.")
		return
	}
	defer rows.Close()
	items := h.scanDoctorQueueRows(rows)
	response.OK(w, map[string]interface{}{
		"items":    items,
		"page":     req.Page,
		"pageSize": req.PageSize,
		"search":   search,
		"sortBy":   sortBy,
		"sortDir":  strings.ToLower(sortDir),
		"category": category,
	})
}

func (h *ApplicationHandler) scanDoctorQueueRows(rows interface {
	Next() bool
	Scan(dest ...interface{}) error
}) []map[string]interface{} {
	items := []map[string]interface{}{}
	for rows.Next() {
		var id, patientName string
		var status int
		var appNumber, ecommerce, profession *string
		var createdAt interface{}
		var hasDraft bool
		if err := rows.Scan(&id, &status, &appNumber, &ecommerce, &profession, &createdAt, &patientName, &hasDraft); err != nil {
			continue
		}
		items = append(items, map[string]interface{}{
			"applicationId":     id,
			"statusCode":        status,
			"applicationNumber": appNumber,
			"ecommerceNumber":   ecommerce,
			"professionName":    profession,
			"createdAt":         createdAt,
			"patientName":       patientName,
			"hasDraft":          hasDraft,
		})
	}
	return items
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

func (h *ApplicationHandler) UpdateFinalReport(w http.ResponseWriter, r *http.Request) {
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
	if err := h.app.UpdateFinalReport(r.Context(), appID, claims.UserID, req.ReportJSON); err != nil {
		response.Fail(w, http.StatusBadRequest, "APP103", response.SafeMessage(err, "Rapor güncellenemedi."))
		return
	}
	response.OK(w, map[string]bool{"updated": true})
}

func (h *ApplicationHandler) PreviewDoctorReport(w http.ResponseWriter, r *http.Request) {
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
	if req.ReportJSON == "" {
		var errs validate.Errors
		errs.Add("reportJson", "required", "Rapor içeriği zorunludur.")
		validate.Fail(w, errs)
		return
	}
	if !json.Valid([]byte(req.ReportJSON)) {
		response.Fail(w, http.StatusBadRequest, "APP104", "Rapor geçerli JSON olmalıdır.")
		return
	}

	data, err := h.app.LoadPreview(r.Context(), appID)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "APP021", "Başvuru bulunamadı.")
		return
	}

	var authorName string
	_ = h.db.Pool.QueryRow(r.Context(), `
		SELECT first_name || ' ' || last_name FROM users WHERE id = $1
	`, claims.UserID).Scan(&authorName)

	report := appsvc.ParseDoctorReportFields(json.RawMessage(req.ReportJSON))
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(appsvc.RenderDoctorReportHTML(data, report, authorName)))
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

func (h *ApplicationHandler) GetFinalReportHTML(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	var reportJSON []byte
	var authorID uuid.UUID
	err := h.db.Pool.QueryRow(r.Context(), `
		SELECT report_json, author_user_id FROM application_final_reports WHERE application_id = $1
	`, appID).Scan(&reportJSON, &authorID)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "APP131", "Rapor henüz hazır değil.")
		return
	}

	data, err := h.app.LoadPreview(r.Context(), appID)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "APP021", "Başvuru bulunamadı.")
		return
	}

	var authorName string
	_ = h.db.Pool.QueryRow(r.Context(), `
		SELECT first_name || ' ' || last_name FROM users WHERE id = $1
	`, authorID).Scan(&authorName)

	report := appsvc.ParseDoctorReportFields(json.RawMessage(reportJSON))
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(appsvc.RenderDoctorReportHTML(data, report, authorName)))
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
		receipt := h.buildPaymentReceipt(r.Context(), existing.ID, appID)
		response.OK(w, paymentResultPayload(&paysvc.CheckoutResult{
			TransactionID: existing.ProviderTransactionID,
			OrderID:       appID.String(),
			Status:        "paid",
			PaymentID:     existing.ID.String(),
		}, receipt))
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
	provider := "param"
	if req.Provider != "" && strings.ToLower(strings.TrimSpace(req.Provider)) != "param" {
		var errs validate.Errors
		errs.Add("provider", "invalid", "Ödeme yalnızca Param ile yapılır.")
		validate.Fail(w, errs)
		return
	}

	var amount float64
	err := h.db.Pool.QueryRow(r.Context(), `
		SELECT COALESCE(cp.consultation_fee, 1000.00)
		FROM applications a
		LEFT JOIN care_providers cp ON cp.id = a.care_provider_id
		WHERE a.id = $1
	`, appID).Scan(&amount)
	if err != nil || amount <= 0 {
		amount = h.cfg.PaymentAmount
	}

	var errs validate.Errors
	validate.PaymentAmount(&errs, "amount", amount)
	requireCard := isLivePaymentProvider(h.cfg, provider) || isTestPaymentProvider(h.cfg) || h.payment.RequireCard()
	if requireCard {
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
	err = h.db.Pool.QueryRow(r.Context(), `
		SELECT status_code, application_number FROM applications WHERE id = $1
	`, appID).Scan(&statusCode, &appNumber)
	if err != nil {
		response.Fail(w, http.StatusNotFound, "APP001", "Başvuru bulunamadı.")
		return
	}
	if statusCode != domain.StatusPaymentPending {
		if statusCode == domain.StatusPaymentCompleted {
			if existing, err := h.payment.Store().FindPaidByApplication(r.Context(), appID); err == nil && existing != nil {
				receipt := h.buildPaymentReceipt(r.Context(), existing.ID, appID)
				response.OK(w, paymentResultPayload(&paysvc.CheckoutResult{
					TransactionID: existing.ProviderTransactionID,
					OrderID:       appID.String(),
					Status:        "paid",
					PaymentID:     existing.ID.String(),
				}, receipt))
				return
			}
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

	cardBrand := "Unknown"
	maskedCard := ""
	cleanCard := strings.ReplaceAll(req.CardNumber, " ", "")
	if len(cleanCard) >= 6 {
		if strings.HasPrefix(cleanCard, "4") {
			cardBrand = "Visa"
		} else if strings.HasPrefix(cleanCard, "5") {
			cardBrand = "Mastercard"
		} else if strings.HasPrefix(cleanCard, "9") || strings.HasPrefix(cleanCard, "6") {
			cardBrand = "Troy"
		}
		if len(cleanCard) >= 16 {
			maskedCard = cleanCard[0:6] + "******" + cleanCard[len(cleanCard)-4:]
		} else {
			maskedCard = cleanCard[0:6] + "******"
		}
	}

	meta := map[string]interface{}{
		"provider":    provider,
		"card_brand":  cardBrand,
		"masked_card": maskedCard,
		"card_holder": req.CardHolder,
	}

	dbProvider := paysvc.ProviderDBValue(paysvc.NormalizeProvider(provider))
	paymentID, err := h.payment.Store().CreatePending(r.Context(), paysvc.PaymentRecord{
		ApplicationID:  appID,
		UserID:         claims.UserID,
		Provider:       dbProvider,
		Amount:         amount,
		Currency:       "TRY",
		IdempotencyKey: appID.String(),
	}, meta)
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
		paidMeta := map[string]interface{}{
			"orderId": result.OrderID,
		}
		displayNo := appID.String()
		if appNumber != nil && *appNumber != "" {
			displayNo = *appNumber
		}
		if h.invoice != nil {
			inv, invErr := h.invoice.Create(r.Context(), invoicesvc.CreateRequest{
				PaymentID:         paymentID.String(),
				ApplicationID:     appID.String(),
				ApplicationNumber: displayNo,
				Amount:            amount,
				Currency:          "TRY",
				CustomerName:      strings.TrimSpace(firstName + " " + lastName),
				CustomerEmail:     email,
				CustomerPhone:     phone,
				TransactionID:     result.TransactionID,
				Description:       "Tıbbi danışmanlık başvuru ücreti",
			})
			if invErr == nil && inv != nil {
				paidMeta["invoice_id"] = inv.InvoiceID
				paidMeta["invoice_number"] = inv.InvoiceNumber
				paidMeta["invoice_provider"] = "bizim_hesap"
				paidMeta["invoice_status"] = inv.Status
			} else if invErr != nil {
				paidMeta["invoice_error"] = invErr.Error()
			}
		}
		_ = h.payment.Store().MarkPaid(r.Context(), paymentID, result.TransactionID, paidMeta)
		_ = h.app.UpdatePaymentCompleted(r.Context(), appID, claims.UserID)
		h.notify.SendPaymentConfirmation(r.Context(), claims.UserID, email, displayNo, amount)
	}

	result.PaymentID = paymentID.String()
	receipt := h.buildPaymentReceipt(r.Context(), paymentID, appID)
	response.OK(w, paymentResultPayload(result, receipt))
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

func (h *ApplicationHandler) MarkReportViewed(w http.ResponseWriter, r *http.Request) {
	appID, ok := parseAppID(w, r)
	if !ok {
		return
	}
	if !authmw.RequireApplicationAccess(w, r, h.db, appID) {
		return
	}
	// Only mark if not already marked
	_, err := h.db.Pool.Exec(r.Context(), `
		UPDATE applications SET report_viewed_at = now() WHERE id = $1 AND report_viewed_at IS NULL
	`, appID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "APP140", "Rapor görüntüleme kaydedilemedi.")
		return
	}
	response.OK(w, map[string]bool{"viewed": true})
}
