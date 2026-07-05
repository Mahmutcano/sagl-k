package middleware

import (
	"context"
	"net/http"
	"strings"

	jwtmgr "medical-consultation-platform/backend/internal/pkg/jwt"
	"medical-consultation-platform/backend/internal/pkg/response"
)

type ctxKey string

const UserClaimsKey ctxKey = "claims"

func Auth(jwt *jwtmgr.Manager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				response.Fail(w, http.StatusUnauthorized, "AUTH001", "Oturum gerekli. Lütfen giriş yapın.")
				return
			}
			claims, err := jwt.Parse(strings.TrimPrefix(header, "Bearer "))
			if err != nil {
				response.Fail(w, http.StatusUnauthorized, "AUTH002", "Oturum geçersiz veya süresi dolmuş.")
				return
			}
			ctx := context.WithValue(r.Context(), UserClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := map[string]struct{}{}
	for _, role := range roles {
		allowed[role] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := r.Context().Value(UserClaimsKey).(*jwtmgr.Claims)
			if !ok {
				response.Fail(w, http.StatusForbidden, "AUTH003", "Bu işlem için yetkiniz yok.")
				return
			}
			if _, ok := allowed[claims.Role]; !ok {
				response.Fail(w, http.StatusForbidden, "AUTH004", "Bu işlem için yetkiniz yok.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func ClaimsFromContext(ctx context.Context) *jwtmgr.Claims {
	claims, _ := ctx.Value(UserClaimsKey).(*jwtmgr.Claims)
	return claims
}
