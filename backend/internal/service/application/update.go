package application

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"medical-consultation-platform/backend/internal/domain"
)

type UpdateApplicationRequest struct {
	ProfessionCode    string                 `json:"professionCode"`
	ProfessionName    string                 `json:"professionName"`
	CareProviderID    string                 `json:"careProviderId"`
	SurveyData        SurveyPayload          `json:"surveyData"`
	RepresentedPerson map[string]interface{} `json:"representedPerson,omitempty"`
}

var ErrNotEditable = errors.New("başvuru bu aşamada düzenlenemez")
var ErrNotCancellable = errors.New("ödenmiş başvuru iptal edilemez")

func PatientEditableStatus(code int) bool {
	return code == domain.StatusPaymentPending
}

func (s *Service) Update(ctx context.Context, appID, ownerID uuid.UUID, req UpdateApplicationRequest) error {
	var statusCode int
	var isForRelative bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT status_code, is_for_relative FROM applications WHERE id = $1 AND owner_user_id = $2
	`, appID, ownerID).Scan(&statusCode, &isForRelative)
	if err != nil {
		return errors.New("başvuru bulunamadı")
	}
	if !PatientEditableStatus(statusCode) {
		return ErrNotEditable
	}

	if err := s.checkDuplicateApplication(ctx, ownerID, req.CareProviderID, req.ProfessionCode, &appID); err != nil {
		return err
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var careProviderID *uuid.UUID
	var doctorUserID *uuid.UUID
	if req.CareProviderID != "" {
		cpID, err := uuid.Parse(req.CareProviderID)
		if err != nil {
			return fmt.Errorf("geçersiz doktor seçimi")
		}
		var linkedUserID *uuid.UUID
		err = tx.QueryRow(ctx, `
			SELECT user_id FROM care_providers WHERE id = $1 AND is_active = true
		`, cpID).Scan(&linkedUserID)
		if err != nil {
			return fmt.Errorf("seçilen doktor bulunamadı")
		}
		if linkedUserID == nil {
			return fmt.Errorf("seçilen doktor henüz sisteme bağlı değil")
		}
		careProviderID = &cpID
		doctorUserID = linkedUserID
	}

	_, err = tx.Exec(ctx, `
		UPDATE applications SET
			profession_code = $2,
			profession_name = $3,
			care_provider_id = $4,
			doctor_user_id = $5,
			updated_at = now()
		WHERE id = $1
	`, appID, req.ProfessionCode, req.ProfessionName, careProviderID, doctorUserID)
	if err != nil {
		return err
	}

	var surveyJSON json.RawMessage
	if req.SurveyData.Data.String() != "" {
		surveyJSON = json.RawMessage(req.SurveyData.Data.String())
	} else {
		surveyJSON = json.RawMessage("{}")
	}
	_, err = tx.Exec(ctx, `
		UPDATE application_surveys SET data = $2::jsonb, updated_at = now() WHERE application_id = $1
	`, appID, surveyJSON)
	if err != nil {
		return err
	}

	if isForRelative && req.RepresentedPerson != nil {
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
			UPDATE application_represented_persons SET
				first_name = $2, last_name = $3, national_identifier = $4, birth_date = $5, gender = $6
			WHERE application_id = $1
		`, appID, fn, ln, nid, birthDate, gender)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (s *Service) DeleteUnpaid(ctx context.Context, appID, ownerID uuid.UUID) error {
	var statusCode int
	var appNumber *string
	err := s.db.Pool.QueryRow(ctx, `
		SELECT status_code, application_number FROM applications WHERE id = $1 AND owner_user_id = $2
	`, appID, ownerID).Scan(&statusCode, &appNumber)
	if err != nil {
		return errors.New("başvuru bulunamadı")
	}
	if statusCode != domain.StatusPaymentPending {
		return ErrNotCancellable
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if appNumber != nil && *appNumber != "" {
		_, _ = tx.Exec(ctx, `
			INSERT INTO recycled_application_numbers (number) VALUES ($1)
			ON CONFLICT (number) DO NOTHING
		`, *appNumber)
	}

	_, err = tx.Exec(ctx, `DELETE FROM applications WHERE id = $1`, appID)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
