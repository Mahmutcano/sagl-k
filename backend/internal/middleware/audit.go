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

type statusCapture struct {
	http.ResponseWriter
	status int
}

func (s *statusCapture) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func AuditLog(db *repository.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip GET/OPTIONS noise
			if r.Method == http.MethodGet || r.Method == http.MethodOptions || r.Method == http.MethodHead {
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

			sw := &statusCapture{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(sw, r)

			var userID *uuid.UUID
			var role, userName string
			claims := ClaimsFromContext(r.Context())
			if claims != nil {
				uid := claims.UserID
				userID = &uid
				role = claims.Role
				// Skip pure admin operator noise — patient/doctor activity is the focus.
				if role == "admin" || role == "developer" {
					return
				}
				_ = db.Pool.QueryRow(r.Context(), `
					SELECT COALESCE(first_name,'') || ' ' || COALESCE(last_name,''), role::text
					FROM users WHERE id = $1
				`, uid).Scan(&userName, &role)
			}

			payload := map[string]interface{}{
				"method":     r.Method,
				"endpoint":   r.URL.Path,
				"statusCode": sw.status,
				"query":      r.URL.RawQuery,
			}
			if userName != "" {
				payload["userName"] = strings.TrimSpace(userName)
			}
			if role != "" {
				payload["userRole"] = role
			}
			if sw.status >= 400 {
				payload["error"] = true
			}

			if len(bodyBytes) > 0 {
				var body map[string]interface{}
				if json.Unmarshal(bodyBytes, &body) == nil && body != nil {
					for _, k := range []string{"password", "passwordConfirm", "token", "code", "cvc", "card_number", "oldPassword", "newPassword"} {
						if _, ok := body[k]; ok {
							body[k] = "[REDACTED]"
						}
					}
					payload["body"] = body
				}
			}

			action := r.Method + " " + r.URL.Path
			payloadJSON, _ := json.Marshal(payload)

			_, _ = db.Pool.Exec(r.Context(), `
				INSERT INTO audit_logs (user_id, action, entity_type, payload, ip_address)
				VALUES ($1, $2, 'http_request', $3, $4::inet)
			`, userID, action, payloadJSON, strings.TrimSpace(ip))
		})
	}
}
