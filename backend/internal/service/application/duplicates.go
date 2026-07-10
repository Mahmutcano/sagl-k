package application

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"medical-consultation-platform/backend/internal/domain"
)

var ErrDuplicateApplication = errors.New("duplicate application")

type DuplicateConflict struct {
	ExistingApplicationID uuid.UUID
	Reason                string // payment_pending | awaiting_doctor
	Message               string
}

func (e *DuplicateConflict) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return "Bu doktora zaten devam eden bir başvurunuz var."
}

func (e *DuplicateConflict) Unwrap() error { return ErrDuplicateApplication }

var awaitingDoctorStatuses = []int{
	domain.StatusPaymentCompleted,
	domain.StatusApproved,
	domain.StatusInProgress,
	domain.StatusInfoRequired,
	domain.StatusDoctorApprovalPending,
	domain.StatusMedicalSecretary,
}

func (s *Service) checkDuplicateApplication(
	ctx context.Context,
	ownerID uuid.UUID,
	careProviderID string,
	professionCode string,
	excludeAppID *uuid.UUID,
) error {
	if careProviderID == "" {
		return nil
	}
	cpID, err := uuid.Parse(careProviderID)
	if err != nil {
		return nil
	}

	var doctorUserID *uuid.UUID
	err = s.db.Pool.QueryRow(ctx, `
		SELECT user_id FROM care_providers WHERE id = $1 AND is_active = true
	`, cpID).Scan(&doctorUserID)
	if err != nil || doctorUserID == nil {
		return nil
	}

	// Ödeme bekleyen: aynı bölüm + aynı doktor
	var pendingID uuid.UUID
	pendingQuery := `
		SELECT id FROM applications
		WHERE owner_user_id = $1
		  AND status_code = $2
		  AND profession_code = $3
		  AND care_provider_id = $4
	`
	args := []interface{}{ownerID, domain.StatusPaymentPending, professionCode, cpID}
	if excludeAppID != nil {
		pendingQuery += ` AND id <> $5`
		args = append(args, *excludeAppID)
	}
	pendingQuery += ` ORDER BY created_at DESC LIMIT 1`

	err = s.db.Pool.QueryRow(ctx, pendingQuery, args...).Scan(&pendingID)
	if err == nil {
		return &DuplicateConflict{
			ExistingApplicationID: pendingID,
			Reason:                "payment_pending",
			Message:               "Bu bölüm ve doktor için ödeme bekleyen bir başvurunuz var. Mevcut başvurunuza yönlendiriliyorsunuz.",
		}
	}

	// Doktor henüz yanıtlamadı: aynı doktora aktif başvuru
	statusList := fmt.Sprintf("%d", awaitingDoctorStatuses[0])
	for i := 1; i < len(awaitingDoctorStatuses); i++ {
		statusList += fmt.Sprintf(",%d", awaitingDoctorStatuses[i])
	}
	activeQuery := fmt.Sprintf(`
		SELECT id FROM applications
		WHERE owner_user_id = $1
		  AND doctor_user_id = $2
		  AND status_code IN (%s)
	`, statusList)
	activeArgs := []interface{}{ownerID, *doctorUserID}
	if excludeAppID != nil {
		activeQuery += ` AND id <> $3`
		activeArgs = append(activeArgs, *excludeAppID)
	}
	activeQuery += ` ORDER BY created_at DESC LIMIT 1`

	var activeID uuid.UUID
	err = s.db.Pool.QueryRow(ctx, activeQuery, activeArgs...).Scan(&activeID)
	if err == nil {
		return &DuplicateConflict{
			ExistingApplicationID: activeID,
			Reason:                "awaiting_doctor",
			Message:               "Seçtiğiniz doktora henüz sonuçlanmamış bir başvurunuz bulunuyor. Yeni başvuru oluşturamazsınız.",
		}
	}

	return nil
}
