package handler

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	appcfg "medical-consultation-platform/backend/internal/config"
	authmw "medical-consultation-platform/backend/internal/middleware"
	jwtmgr "medical-consultation-platform/backend/internal/pkg/jwt"
	"medical-consultation-platform/backend/internal/pkg/validate"
	"medical-consultation-platform/backend/internal/repository"
	appsvc "medical-consultation-platform/backend/internal/service/application"
	authsvc "medical-consultation-platform/backend/internal/service/auth"
	"medical-consultation-platform/backend/internal/service/erciyes"
	notifysvc "medical-consultation-platform/backend/internal/service/notification"
	paysvc "medical-consultation-platform/backend/internal/service/payment"
)

type Deps struct {
	Cfg     appcfg.Config
	DB      *repository.DB
	JWT     *jwtmgr.Manager
	Auth    *authsvc.Service
	App     *appsvc.Service
	Notify  *notifysvc.Service
	Payment *paysvc.Service
	Erciyes *erciyes.Service
}

func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Logger, middleware.Recoverer)
	r.Use(authmw.SecurityHeaders)
	r.Use(authmw.MaxBody(validate.MaxBodyBytes))
	r.Use(authmw.NewRateLimiter(120, time.Minute, 2*time.Minute).Middleware)

	origins := []string{
		d.Cfg.PortalURL,
		d.Cfg.DoctorURL,
		d.Cfg.AdminURL,
		"http://localhost:3000",
	}
	seen := make(map[string]struct{}, len(origins))
	unique := make([]string, 0, len(origins))
	for _, o := range origins {
		if o == "" {
			continue
		}
		if _, ok := seen[o]; ok {
			continue
		}
		seen[o] = struct{}{}
		unique = append(unique, o)
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   unique,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	authH := NewAuthHandler(d.Auth)
	appH := NewApplicationHandler(d.App, d.Payment, d.Notify, d.DB, d.Cfg)
	adminH := NewAdminHandler(d.DB, d.Payment)
	erciyesH := NewErciyesHandler(d.Erciyes, d.DB)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	authLimit := authmw.AuthRateLimiter(20, time.Minute, 5*time.Minute)

	// Bağımsız API yüzeyi — harici sistem path uyumluluğu yok.
	r.Route("/api/v1", func(api chi.Router) {
		api.Route("/auth", func(ar chi.Router) {
			ar.Use(authLimit)
			ar.Post("/login", authH.Login)
			ar.Get("/agreements", authH.AgreementsForRegister)
			ar.Post("/register/initiate", authH.InitiateRegister)
			ar.Post("/register/complete", authH.CompleteRegister)
			ar.Post("/password/forgot/initiate", authH.InitiateForgotPassword)
			ar.Post("/password/forgot/complete", authH.CompleteForgotPassword)
			ar.Post("/refresh", authH.Refresh)
			ar.Post("/tfa/verify", authH.VerifyTFA)
		})

		api.Get("/professions", appH.ListProfessions)
		api.Get("/care-providers", appH.ListCareProviders)

		api.Route("/applications", func(ar chi.Router) {
			ar.Use(authmw.Auth(d.JWT))

			// Sabit path'ler {id} rotalarından önce.
			ar.Post("/", appH.StartApplication)
			ar.Post("/mine", appH.PagingPatient)
			ar.With(authmw.RequireRole("nurse", "admin", "developer")).Post("/queue/nurse", appH.PagingNurse)
			ar.With(authmw.RequireRole("doctor", "admin", "developer")).Post("/queue/doctor", appH.PagingDoctor)

			ar.Get("/{id}", appH.ApplicationDetail)
			ar.Patch("/{id}", appH.UpdateApplication)
			ar.Post("/{id}/payment", appH.UpdatePayment)
			ar.Get("/{id}/report", appH.GetFinalReport)

			ar.With(authmw.RequireRole("nurse", "doctor", "admin", "developer")).Post("/{id}/notes", appH.AddNote)
			ar.With(authmw.RequireRole("nurse", "doctor", "admin", "developer")).Get("/{id}/notes", appH.NoteHistory)

			ar.With(authmw.RequireRole("nurse", "admin", "developer")).Post("/{id}/assess", appH.AssessApplication)
			ar.With(authmw.RequireRole("nurse", "admin", "developer")).Post("/{id}/send-to-doctor", appH.CompleteNurseAssessment)

			ar.With(authmw.RequireRole("doctor", "admin", "developer")).Put("/{id}/report/draft", appH.SaveTemporalReport)
			ar.With(authmw.RequireRole("doctor", "admin", "developer")).Get("/{id}/report/draft", appH.GetTemporalReport)
			ar.With(authmw.RequireRole("doctor", "admin", "developer")).Post("/{id}/conclude", appH.ConcludeApplication)
		})

		api.Route("/integrations/erciyes", func(er chi.Router) {
			er.With(authmw.Auth(d.JWT)).Post("/inpatient-status", erciyesH.CheckInpatient)
			er.With(authmw.Auth(d.JWT)).Get("/pacs-url", erciyesH.PACSLink)
			er.With(authmw.Auth(d.JWT), authmw.RequireRole("admin", "developer")).Get("/health", erciyesH.Health)
		})

		api.Route("/admin", func(ar chi.Router) {
			ar.Use(authmw.Auth(d.JWT), authmw.RequireRole("admin", "developer"))
			ar.Get("/applications", adminH.ListApplications)
			ar.Get("/applications/{id}/history", adminH.ApplicationHistory)
			ar.Get("/hospitals", adminH.ListHospitals)
			ar.Post("/hospitals", adminH.CreateHospital)
			ar.Get("/doctors", adminH.ListDoctors)
			ar.Post("/doctors", adminH.CreateDoctor)
			ar.Get("/payments", adminH.ListPayments)
			ar.Post("/refunds", adminH.CreateRefund)
			ar.Get("/notifications", adminH.ListNotifications)
			ar.Get("/integrations/erciyes/health", erciyesH.Health)
		})
	})

	return r
}
