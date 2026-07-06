package audit

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Logger struct {
	pool *pgxpool.Pool
}

func NewLogger(pool *pgxpool.Pool) *Logger {
	return &Logger{pool: pool}
}

// Log writes an action to audit_logs database table and prunes logs older than 7 days
func (l *Logger) Log(ctx context.Context, userID *uuid.UUID, action string, entityType string, entityID *uuid.UUID, payload interface{}) {
	var payloadJSON []byte
	if payload != nil {
		var err error
		payloadJSON, err = json.Marshal(payload)
		if err != nil {
			log.Printf("audit_log: failed to marshal payload: %v", err)
		}
	}

	ipAddress := ""
	if val := ctx.Value("ip_address"); val != nil {
		if ipStr, ok := val.(string); ok {
			ipAddress = ipStr
		}
	}

	var ip net.IP
	if ipAddress != "" {
		ip = net.ParseIP(ipAddress)
	}

	_, err := l.pool.Exec(ctx, `
		INSERT INTO audit_logs (user_id, action, entity_type, entity_id, payload, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, userID, action, entityType, entityID, payloadJSON, ip)
	if err != nil {
		log.Printf("audit_log: failed to insert log: %v", err)
	}

	// Prune logs older than 7 days
	_, err = l.pool.Exec(ctx, `
		DELETE FROM audit_logs WHERE created_at < now() - INTERVAL '7 days'
	`)
	if err != nil {
		log.Printf("audit_log: failed to prune logs: %v", err)
	}
}

// GetIP extracts the client IP address from request
func GetIP(r *http.Request) string {
	ip := r.Header.Get("X-Forwarded-For")
	if ip != "" {
		parts := strings.Split(ip, ",")
		return strings.TrimSpace(parts[0])
	}
	ip = r.Header.Get("X-Real-IP")
	if ip != "" {
		return ip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}
