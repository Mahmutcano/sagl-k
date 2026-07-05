package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"medical-consultation-platform/backend/internal/pkg/response"
)

// SecurityHeaders applies baseline HTTP security headers.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Cache-Control", "no-store")
		// API responses are JSON; CSP is still useful for misconfigured clients.
		w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
		next.ServeHTTP(w, r)
	})
}

// MaxBody limits request body size for all methods that carry a body.
func MaxBody(maxBytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil && r.Method != http.MethodGet && r.Method != http.MethodHead {
				r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			}
			next.ServeHTTP(w, r)
		})
	}
}

type visitor struct {
	count    int
	resetAt  time.Time
	blocked  time.Time
}

// RateLimiter is a simple in-memory IP rate limiter (per-process).
// Suitable for single-instance deployments; use Redis for multi-instance.
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	limit    int
	window   time.Duration
	blockFor time.Duration
}

func NewRateLimiter(limit int, window, blockFor time.Duration) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		limit:    limit,
		window:   window,
		blockFor: blockFor,
	}
	go rl.cleanup()
	return rl
}

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, v := range rl.visitors {
			if now.After(v.resetAt) && now.After(v.blocked) {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		now := time.Now()

		rl.mu.Lock()
		v, ok := rl.visitors[ip]
		if !ok || now.After(v.resetAt) {
			v = &visitor{count: 0, resetAt: now.Add(rl.window)}
			rl.visitors[ip] = v
		}
		if !v.blocked.IsZero() && now.Before(v.blocked) {
			rl.mu.Unlock()
			response.Fail(w, http.StatusTooManyRequests, "SEC001", "Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyin.")
			return
		}
		v.count++
		if v.count > rl.limit {
			v.blocked = now.Add(rl.blockFor)
			rl.mu.Unlock()
			response.Fail(w, http.StatusTooManyRequests, "SEC001", "Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyin.")
			return
		}
		rl.mu.Unlock()
		next.ServeHTTP(w, r)
	})
}

// AuthRateLimiter applies a stricter limit for authentication endpoints.
func AuthRateLimiter(limit int, window, blockFor time.Duration) func(http.Handler) http.Handler {
	rl := NewRateLimiter(limit, window, blockFor)
	return rl.Middleware
}
