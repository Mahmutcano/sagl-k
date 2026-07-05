package response

import (
	"encoding/json"
	"net/http"
	"strings"
)

type Envelope struct {
	HasError        bool        `json:"hasError"`
	ResponseCode    string      `json:"responseCode"`
	ResponseMessage string      `json:"responseMessage"`
	Result          interface{} `json:"result,omitempty"`
	Details         interface{} `json:"details,omitempty"`
}

func OK(w http.ResponseWriter, result interface{}) {
	write(w, http.StatusOK, Envelope{
		HasError:        false,
		ResponseCode:    "SUCCESS",
		ResponseMessage: "OK",
		Result:          result,
	})
}

func Fail(w http.ResponseWriter, status int, code, message string) {
	write(w, status, Envelope{
		HasError:        true,
		ResponseCode:    code,
		ResponseMessage: message,
	})
}

// FailWithDetails returns an error envelope with structured details (e.g. field errors).
func FailWithDetails(w http.ResponseWriter, status int, code, message string, details interface{}) {
	write(w, status, Envelope{
		HasError:        true,
		ResponseCode:    code,
		ResponseMessage: message,
		Details:         details,
	})
}

// SafeMessage maps internal errors to client-safe messages (no stack traces / SQL leaks).
func SafeMessage(err error, fallback string) string {
	if err == nil {
		return fallback
	}
	msg := err.Error()
	// Never expose low-level driver / SQL details to clients.
	unsafe := []string{"pq:", "SQLSTATE", "violates", "duplicate key", "connection refused", "ERROR:"}
	for _, p := range unsafe {
		if strings.Contains(msg, p) {
			return fallback
		}
	}
	return msg
}

func write(w http.ResponseWriter, status int, body Envelope) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
