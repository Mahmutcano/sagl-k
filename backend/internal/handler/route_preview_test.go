package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestChiPreviewRouteOrder(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("detail"))
	})
	r.Get("/{id}/preview", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("preview"))
	})

	req := httptest.NewRequest(http.MethodGet, "/abc/preview", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK || rec.Body.String() != "preview" {
		t.Fatalf("got %d %q, want 200 preview", rec.Code, rec.Body.String())
	}
}
