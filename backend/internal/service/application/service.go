package application

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"medical-consultation-platform/backend/internal/domain"
	"medical-consultation-platform/backend/internal/repository"
)

type Service struct {
	db *repository.DB
}

func NewService(db *repository.DB) *Service {
	return &Service{db: db}
}

type StartApplicationRequest struct {
	TargetInstitution int                    `json:"targetInstitution"`
	ProfessionCode    string                 `json:"professionCode"`
	ProfessionName    string                 `json:"professionName"`
	CareProviderID    string                 `json:"careProviderId"`
	SurveyData        SurveyPayload          `json:"surveyData"`
	IsForRelative     bool                   `json:"isForRelative"`
	RepresentedPerson map[string]interface{} `json:"representedPerson,omitempty"`
}

type SurveyPayload struct {
	SurveyName string `json:"surveyName"`
	// Data holds patient intake answers as a JSON object string.
	// Accepts either a JSON string or a raw object from clients.
	Data       flexJSONString `json:"data"`
	// ReportJSON başvuru raporu içeriği (JSON). Base64 PDF kabul edilmez.
	ReportJSON string `json:"reportJson"`
}

// flexJSONString unmarshals both `"{\"a\":1}"` and `{"a":1}` into a JSON text string.
type flexJSONString string

func (s flexJSONString) String() string { return string(s) }

func (s *flexJSONString) UnmarshalJSON(b []byte) error {
	if len(b) == 0 || string(b) == "null" {
		*s = ""
		return nil
	}
	if b[0] == '"' {
		var str string
		if err := json.Unmarshal(b, &str); err != nil {
			return err
		}
		*s = flexJSONString(str)
		return nil
	}
	// Raw object/array — keep canonical JSON text
	if !json.Valid(b) {
		return fmt.Errorf("invalid survey data json")
	}
	*s = flexJSONString(b)
	return nil
}

func (s *Service) Start(ctx context.Context, ownerID uuid.UUID, req StartApplicationRequest) (uuid.UUID, error) {
	if err := s.checkDuplicateApplication(ctx, ownerID, req.CareProviderID, req.ProfessionCode, nil); err != nil {
		return uuid.Nil, err
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx)

	var careProviderID *uuid.UUID
	var doctorUserID *uuid.UUID
	if req.CareProviderID != "" {
		cpID, err := uuid.Parse(req.CareProviderID)
		if err != nil {
			return uuid.Nil, fmt.Errorf("geçersiz doktor seçimi")
		}
		var linkedUserID *uuid.UUID
		err = tx.QueryRow(ctx, `
			SELECT user_id FROM care_providers WHERE id = $1 AND is_active = true
		`, cpID).Scan(&linkedUserID)
		if err != nil {
			return uuid.Nil, fmt.Errorf("seçilen doktor bulunamadı")
		}
		if linkedUserID == nil {
			return uuid.Nil, fmt.Errorf("seçilen doktor henüz sisteme bağlı değil")
		}
		careProviderID = &cpID
		doctorUserID = linkedUserID
	}

	var appNumber string
	appNumber, err = s.allocateApplicationNumber(ctx, tx)
	if err != nil {
		return uuid.Nil, err
	}

	var appID uuid.UUID
	ecommerce := fmt.Sprintf("MC-%d", time.Now().UnixNano()%1000000000)
	err = tx.QueryRow(ctx, `
		INSERT INTO applications (
			owner_user_id, target_institution, status_code, application_number,
			ecommerce_number, profession_code, profession_name, care_provider_id,
			doctor_user_id, is_for_relative
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id
	`, ownerID, req.TargetInstitution, domain.StatusPaymentPending, appNumber,
		ecommerce, req.ProfessionCode, req.ProfessionName, careProviderID,
		doctorUserID, req.IsForRelative).Scan(&appID)
	if err != nil {
		return uuid.Nil, err
	}

	var surveyJSON json.RawMessage
	if req.SurveyData.Data.String() != "" {
		surveyJSON = json.RawMessage(req.SurveyData.Data.String())
	} else {
		surveyJSON = json.RawMessage("{}")
	}
	var reportJSON *json.RawMessage
	if req.SurveyData.ReportJSON != "" {
		raw := json.RawMessage(req.SurveyData.ReportJSON)
		reportJSON = &raw
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO application_surveys (application_id, survey_name, data, report_json)
		VALUES ($1,$2,$3,$4)
	`, appID, req.SurveyData.SurveyName, surveyJSON, reportJSON)
	if err != nil {
		return uuid.Nil, err
	}

	if req.IsForRelative && req.RepresentedPerson != nil {
		fn, _ := req.RepresentedPerson["firstName"].(string)
		ln, _ := req.RepresentedPerson["lastName"].(string)
		nid, _ := req.RepresentedPerson["nationalIdentifier"].(string)
		bd := representedString(req.RepresentedPerson, "birthDate", "dateOfBirth")
		gender := representedGender(req.RepresentedPerson)
		var birthDate *time.Time
		if bd != "" {
			if t, perr := time.Parse("2006-01-02", bd); perr == nil {
				birthDate = &t
			}
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO application_represented_persons (application_id, first_name, last_name, national_identifier, birth_date, gender)
			VALUES ($1,$2,$3,$4,$5,$6)
		`, appID, fn, ln, nid, birthDate, gender)
		if err != nil {
			return uuid.Nil, err
		}
	}

	_, _ = tx.Exec(ctx, `
		INSERT INTO application_status_history (application_id, old_status_code, new_status_code, actor_user_id)
		VALUES ($1, NULL, $2, $3)
	`, appID, domain.StatusPaymentPending, ownerID)

	return appID, tx.Commit(ctx)
}

func (s *Service) SaveTemporalReport(ctx context.Context, appID uuid.UUID, authorID uuid.UUID, data string) error {
	raw := json.RawMessage(data)
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO application_temporal_reports (application_id, data, author_user_id)
		VALUES ($1,$2,$3)
	`, appID, raw, authorID)
	return err
}

func (s *Service) GetLastTemporalReport(ctx context.Context, appID uuid.UUID) (string, error) {
	var data []byte
	err := s.db.Pool.QueryRow(ctx, `
		SELECT data FROM application_temporal_reports
		WHERE application_id = $1 ORDER BY updated_at DESC LIMIT 1
	`, appID).Scan(&data)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (s *Service) UpdateFinalReport(ctx context.Context, appID uuid.UUID, authorID uuid.UUID, reportJSON string) error {
	raw := json.RawMessage(reportJSON)
	if !json.Valid(raw) {
		return errors.New("rapor geçerli JSON olmalıdır")
	}
	var statusCode int
	err := s.db.Pool.QueryRow(ctx, `SELECT status_code FROM applications WHERE id = $1`, appID).Scan(&statusCode)
	if err != nil {
		return err
	}
	if statusCode != domain.StatusConcluded {
		return errors.New("yalnızca sonuçlandırılmış başvuruların raporu güncellenebilir")
	}
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE application_final_reports
		SET report_json = $2, author_user_id = $3
		WHERE application_id = $1
	`, appID, raw, authorID)
	return err
}

func (s *Service) Conclude(ctx context.Context, appID uuid.UUID, authorID uuid.UUID, reportJSON string) error {
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	raw := json.RawMessage(reportJSON)
	if !json.Valid(raw) {
		return errors.New("rapor geçerli JSON olmalıdır")
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO application_final_reports (application_id, report_json, author_user_id)
		VALUES ($1,$2,$3)
		ON CONFLICT (application_id) DO UPDATE SET report_json = EXCLUDED.report_json, author_user_id = EXCLUDED.author_user_id
	`, appID, raw, authorID)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE applications SET status_code = $2, updated_at = now() WHERE id = $1`, appID, domain.StatusConcluded)
	if err != nil {
		return err
	}
	_, _ = tx.Exec(ctx, `
		INSERT INTO application_status_history (application_id, new_status_code, actor_user_id)
		VALUES ($1,$2,$3)
	`, appID, domain.StatusConcluded, authorID)
	return tx.Commit(ctx)
}

func (s *Service) UpdatePaymentCompleted(ctx context.Context, appID, actorID uuid.UUID) error {
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	res, err := tx.Exec(ctx, `
		UPDATE applications SET status_code = $2, updated_at = now() WHERE id = $1 AND status_code = $3
	`, appID, domain.StatusPaymentCompleted, domain.StatusPaymentPending)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return nil
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO application_status_history (application_id, old_status_code, new_status_code, actor_user_id, note)
		VALUES ($1, $2, $3, $4, 'Ödeme tamamlandı')
	`, appID, domain.StatusPaymentPending, domain.StatusPaymentCompleted, actorID)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) Assess(ctx context.Context, appID uuid.UUID, approved bool, reason string) error {
	status := domain.StatusApproved
	if !approved {
		status = domain.StatusRejected
	}
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE applications SET status_code = $2, doctor_rejection_reason = $3, doctor_rejected_at = CASE WHEN $4 THEN now() ELSE NULL END, updated_at = now()
		WHERE id = $1
	`, appID, status, nullIfEmpty(reason), !approved)
	return err
}

func (s *Service) SendToDoctor(ctx context.Context, appID uuid.UUID) error {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE applications SET status_code = $2, updated_at = now() WHERE id = $1
	`, appID, domain.StatusDoctorApprovalPending)
	return err
}

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func representedString(m map[string]interface{}, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k].(string); ok && v != "" {
			return v
		}
	}
	return ""
}

func representedGender(m map[string]interface{}) *int {
	switch v := m["gender"].(type) {
	case float64:
		g := int(v)
		return &g
	case int:
		return &v
	case json.Number:
		if n, err := v.Int64(); err == nil {
			g := int(n)
			return &g
		}
	}
	return nil
}
