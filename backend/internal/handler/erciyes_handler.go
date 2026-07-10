package handler

import (
	"net/http"

	"github.com/google/uuid"
	"medical-consultation-platform/backend/internal/pkg/response"
	"medical-consultation-platform/backend/internal/pkg/validate"
	"medical-consultation-platform/backend/internal/repository"
	"medical-consultation-platform/backend/internal/service/erciyes"
)

type ErciyesHandler struct {
	svc *erciyes.Service
	db  *repository.DB
}

func NewErciyesHandler(svc *erciyes.Service, db *repository.DB) *ErciyesHandler {
	return &ErciyesHandler{svc: svc, db: db}
}

// PACSLink GET ?applicationId= | ?studyUid=&patientId=&accession=
func (h *ErciyesHandler) PACSLink(w http.ResponseWriter, r *http.Request) {
	appIDStr := r.URL.Query().Get("applicationId")
	params := map[string]string{
		"studyUid":  r.URL.Query().Get("studyUid"),
		"patientId": r.URL.Query().Get("patientId"),
		"accession": r.URL.Query().Get("accession"),
		"mrn":       r.URL.Query().Get("mrn"),
	}

	if appIDStr != "" {
		var errs validate.Errors
		validate.UUID(&errs, "applicationId", appIDStr, "Başvuru kimliği")
		if errs.Has() {
			validate.Fail(w, errs)
			return
		}
		appID, _ := uuid.Parse(appIDStr)
		var ownerNID, repNID *string
		var isRelative bool
		err := h.db.Pool.QueryRow(r.Context(), `
			SELECT u.national_identifier, rp.national_identifier, a.is_for_relative
			FROM applications a
			JOIN users u ON u.id = a.owner_user_id
			LEFT JOIN application_represented_persons rp ON rp.application_id = a.id
			WHERE a.id = $1
		`, appID).Scan(&ownerNID, &repNID, &isRelative)
		if err != nil {
			response.Fail(w, http.StatusNotFound, "ERC011", "Başvuru bulunamadı.")
			return
		}
		nid := ownerNID
		if isRelative && repNID != nil && *repNID != "" {
			nid = repNID
		}
		if nid == nil || *nid == "" {
			var errs validate.Errors
			errs.Add("applicationId", "invalid", "Başvuru için hasta kimlik numarası bulunamadı.")
			validate.Fail(w, errs)
			return
		}
		params["patientId"] = *nid
		params["accession"] = appIDStr
	}

	hasAny := false
	for _, v := range params {
		if v != "" {
			hasAny = true
			break
		}
	}
	if !hasAny {
		var errs validate.Errors
		errs.Add("applicationId", "required", "PACS görüntüleme için applicationId veya studyUid/patientId/accession gerekir.")
		validate.Fail(w, errs)
		return
	}

	link, err := h.svc.PACSURL(params)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "ERC010", response.SafeMessage(err, "PACS bağlantısı oluşturulamadı."))
		return
	}
	response.OK(w, link)
}

// Health reports Erciyes integration status (admin).
func (h *ErciyesHandler) Health(w http.ResponseWriter, r *http.Request) {
	err := h.svc.Health()
	payload := map[string]interface{}{
		"mode":              h.svc.Mode(),
		"targetInstitution": h.svc.TargetInstitution(),
		"healthy":           err == nil,
	}
	if err != nil {
		payload["error"] = "Erciyes servisine bağlanılamadı."
		response.OK(w, payload)
		return
	}
	response.OK(w, payload)
}
