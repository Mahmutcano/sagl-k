package middleware

import (
	"context"
	"errors"
	"net/http"

	"github.com/google/uuid"
	"medical-consultation-platform/backend/internal/pkg/response"
	"medical-consultation-platform/backend/internal/repository"
)

var ErrForbidden = errors.New("forbidden")

// CanAccessApplication checks whether the caller may read/mutate the application.
func CanAccessApplication(ctx context.Context, db *repository.DB, appID uuid.UUID) error {
	claims := ClaimsFromContext(ctx)
	if claims == nil {
		return ErrForbidden
	}

	switch claims.Role {
	case "admin", "developer":
		return nil
	case "doctor":
		var doctorID *uuid.UUID
		var statusCode int
		err := db.Pool.QueryRow(ctx, `
			SELECT doctor_user_id, status_code FROM applications WHERE id = $1
		`, appID).Scan(&doctorID, &statusCode)
		if err != nil || doctorID == nil || *doctorID != claims.UserID || statusCode == 0 {
			return ErrForbidden
		}
		return nil
	case "nurse":
		return nil
	}

	var ownerID uuid.UUID
	err := db.Pool.QueryRow(ctx, `SELECT owner_user_id FROM applications WHERE id = $1`, appID).Scan(&ownerID)
	if err != nil {
		return ErrForbidden
	}
	if ownerID != claims.UserID {
		return ErrForbidden
	}
	return nil
}

// RequireApplicationAccess is a helper for handlers: returns false and writes 403/404 if denied.
func RequireApplicationAccess(w http.ResponseWriter, r *http.Request, db *repository.DB, appID uuid.UUID) bool {
	if err := CanAccessApplication(r.Context(), db, appID); err != nil {
		response.Fail(w, http.StatusNotFound, "APP000", "Başvuru bulunamadı.")
		return false
	}
	return true
}
