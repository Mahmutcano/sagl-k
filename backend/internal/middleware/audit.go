package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"medical-consultation-platform/backend/internal/repository"
)

func AuditLog(db *repository.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip GET requests to avoid log bloat
			if r.Method == http.MethodGet {
				next.ServeHTTP(w, r)
				return
			}

			var bodyBytes []byte
			if r.Body != nil {
				bodyBytes, _ = io.ReadAll(r.Body)
				r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			}

			ip := r.RemoteAddr
			for _, h := range []string{"X-Forwarded-For", "X-Real-IP"} {
				if v := r.Header.Get(h); v != "" {
					ip = strings.Split(v, ",")[0]
					break
				}
			}

			next.ServeHTTP(w, r)

			var userID *uuid.UUID
			claims := ClaimsFromContext(r.Context())
			if claims != nil {
				uid := claims.UserID
				userID = &uid
			}

			var payload map[string]interface{}
			if len(bodyBytes) > 0 {
				_ = json.Unmarshal(bodyBytes, &payload)
				if payload != nil {
					// Sanitize credentials
					for _, k := range []string{"password", "passwordConfirm", "token", "code", "cvc", "card_number"} {
						if _, ok := payload[k]; ok {
							payload[k] = "[REDACTED]"
						}
					}
				}
			}

			action := r.Method + " " + r.URL.Path
			payloadJSON, _ := json.Marshal(payload)

			_, _ = db.Pool.Exec(r.Context(), `
				INSERT INTO audit_logs (user_id, action, entity_type, payload, ip_address)
				VALUES ($1, $2, 'http_request', $3, $4::inet)
			`, userID, action, payloadJSON, ip)
		})
	}
}
