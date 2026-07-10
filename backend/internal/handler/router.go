package handler

import (
	"context"
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
	chatsvc "medical-consultation-platform/backend/internal/service/chat"
	"medical-consultation-platform/backend/internal/service/erciyes"
	notifysvc "medical-consultation-platform/backend/internal/service/notification"
	invoicesvc "medical-consultation-platform/backend/internal/service/invoice"
	paysvc "medical-consultation-platform/backend/internal/service/payment"
	"medical-consultation-platform/backend/internal/pkg/audit"
)

type Deps struct {
	Cfg     appcfg.Config
	DB      *repository.DB
	JWT     *jwtmgr.Manager
	Auth    *authsvc.Service
	App     *appsvc.Service
	Chat    *chatsvc.Service
	Notify  *notifysvc.Service
	Payment *paysvc.Service
	Invoice *invoicesvc.Service
	Erciyes *erciyes.Service
	Audit   *audit.Logger
}

func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Logger, middleware.Recoverer)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := audit.GetIP(r)
			ctx := context.WithValue(r.Context(), "ip_address", ip)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	})
	r.Use(authmw.SecurityHeaders)
	r.Use(authmw.MaxBody(validate.MaxBodyBytes))
	r.Use(authmw.NewRateLimiter(120, time.Minute, 2*time.Minute).Middleware)
	r.Use(authmw.AuditLog(d.DB))

	origins := []string{
		d.Cfg.PortalURL,
		d.Cfg.DoctorURL,
		d.Cfg.AdminURL,
		"http://localhost:3000",
		"http://127.0.0.1:3000",
	}
	origins = append(origins, d.Cfg.CORSOrigins...)
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

	authH := NewAuthHandler(d.Auth, d.Audit)
	appH := NewApplicationHandler(d.App, d.Payment, d.Invoice, d.Notify, d.DB, d.Cfg)
	adminH := NewAdminHandler(d.DB, d.Payment, d.Audit, d.Notify)
	erciyesH := NewErciyesHandler(d.Erciyes, d.DB)
	profileH := NewProfileHandler(d.DB, d.Notify, d.Audit, d.Cfg.OTPTTL)
	adminUserH := NewAdminUserHandler(d.DB, d.Audit)
	chatH := NewChatHandler(d.Chat, d.DB, d.JWT)
	contactH := NewContactHandler(d.DB, d.Notify, d.Cfg.ContactInboxEmail)

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
		api.Get("/public/applications/{id}/verify", appH.VerifyApplicationPublicly)
		api.With(authLimit).Post("/public/contact", contactH.Submit)

		api.Route("/applications", func(ar chi.Router) {
			ar.Use(authmw.Auth(d.JWT))

			// Sabit path'ler {id} rotalarından önce.
			ar.Post("/", appH.StartApplication)
			ar.Post("/mine", appH.PagingPatient)
			ar.With(authmw.RequireRole("nurse", "admin", "developer")).Post("/queue/nurse", appH.PagingNurse)
			ar.With(authmw.RequireRole("doctor", "admin", "developer")).Post("/queue/doctor", appH.PagingDoctor)
			ar.With(authmw.RequireRole("doctor", "admin", "developer")).Get("/queue/doctor/stats", appH.DoctorQueueStats)

			ar.Get("/{id}/preview", appH.PreviewApplication)
			ar.Get("/{id}", appH.ApplicationDetail)
			ar.Patch("/{id}", appH.UpdateApplication)
			ar.Delete("/{id}", appH.DeleteApplication)
			ar.Post("/{id}/payment", appH.UpdatePayment)
			ar.Get("/{id}/report/html", appH.GetFinalReportHTML)
			ar.Get("/{id}/report", appH.GetFinalReport)
			ar.Post("/{id}/report/viewed", appH.MarkReportViewed)
			ar.Get("/{id}/attachments", appH.ListAttachments)
			ar.Post("/{id}/attachments", appH.UploadAttachment)
			ar.Get("/{id}/attachments/{attachmentId}", appH.DownloadAttachment)
			ar.Delete("/{id}/attachments/{attachmentId}", appH.DeleteAttachment)

			ar.With(authmw.RequireRole("nurse", "doctor", "admin", "developer")).Post("/{id}/notes", appH.AddNote)
			ar.With(authmw.RequireRole("nurse", "doctor", "admin", "developer")).Get("/{id}/notes", appH.NoteHistory)

			ar.Get("/{id}/messages", chatH.ListMessages)
			ar.Post("/{id}/messages", chatH.SendMessage)

			ar.With(authmw.RequireRole("nurse", "admin", "developer")).Post("/{id}/assess", appH.AssessApplication)
			ar.With(authmw.RequireRole("nurse", "admin", "developer")).Post("/{id}/send-to-doctor", appH.CompleteNurseAssessment)

			ar.With(authmw.RequireRole("doctor", "admin", "developer")).Put("/{id}/report/draft", appH.SaveTemporalReport)
			ar.With(authmw.RequireRole("doctor", "admin", "developer")).Get("/{id}/report/draft", appH.GetTemporalReport)
			ar.With(authmw.RequireRole("doctor", "admin", "developer")).Post("/{id}/report/preview", appH.PreviewDoctorReport)
			ar.With(authmw.RequireRole("doctor", "admin", "developer")).Put("/{id}/report", appH.UpdateFinalReport)
			ar.With(authmw.RequireRole("doctor", "admin", "developer")).Post("/{id}/conclude", appH.ConcludeApplication)
		})

		api.Route("/integrations/erciyes", func(er chi.Router) {
			er.With(authmw.Auth(d.JWT)).Get("/pacs-url", erciyesH.PACSLink)
			er.With(authmw.Auth(d.JWT), authmw.RequireRole("admin", "developer")).Get("/health", erciyesH.Health)
		})

		api.Route("/profile", func(pr chi.Router) {
			pr.Use(authmw.Auth(d.JWT))
			pr.Get("/", profileH.GetProfile)
			pr.Put("/", profileH.UpdateProfile)
			pr.Post("/verify", profileH.VerifyProfilePhone)
		})

		api.Route("/admin", func(ar chi.Router) {
			ar.Use(authmw.Auth(d.JWT), authmw.RequireRole("admin", "developer"))
			ar.Get("/applications", adminH.ListApplications)
			ar.Put("/applications/{id}", adminH.UpdateApplicationByAdmin)
			ar.Get("/applications/{id}/history", adminH.ApplicationHistory)
			ar.Post("/applications/{id}/cancel", adminH.CancelApplication)
			ar.Post("/applications/{id}/assign-doctor", adminH.AssignDoctor)
			ar.Get("/hospitals", adminH.ListHospitals)
			ar.Post("/hospitals", adminH.CreateHospital)
			ar.Put("/hospitals/{id}", adminH.UpdateHospital)
			ar.Get("/professions", adminH.ListProfessionsAdmin)
			ar.Post("/professions", adminH.CreateProfession)
			ar.Put("/professions/{id}", adminH.UpdateProfession)
			ar.Get("/doctors", adminH.ListDoctors)
			ar.Get("/doctors/{id}", adminH.GetDoctor)
			ar.Post("/doctors", adminH.CreateDoctor)
			ar.Put("/doctors/{id}", adminH.UpdateDoctor)
			ar.Get("/payments", adminH.ListPayments)
			ar.Get("/payments/export", adminH.ExportPaymentsCSV)
			ar.Get("/payments/{id}/invoice", adminH.GetPaymentInvoice)
			ar.Post("/refunds", adminH.CreateRefund)
			ar.Get("/notifications", adminH.ListNotifications)
			ar.Get("/notifications/{id}", adminH.GetNotificationDetail)
			ar.Get("/sms-otp-logs", adminH.ListSMSOTPLogs)
			ar.Get("/contact-messages", adminH.ListContactMessages)
			ar.Patch("/contact-messages/{id}", adminH.UpdateContactMessage)
			ar.Get("/accounting/settings", adminH.GetAccountingSettings)
			ar.Put("/accounting/settings", adminH.UpdateAccountingSettings)
			ar.Get("/accounting/report", adminH.ListAccountingReport)
			ar.Get("/integrations/erciyes/health", erciyesH.Health)
			ar.Get("/users", adminUserH.ListUsers)
			ar.Get("/users/{id}", adminUserH.GetUser)
			ar.Put("/users/{id}", adminUserH.UpdateUser)
			ar.Patch("/users/{id}/active", adminUserH.ToggleActive)
			ar.Get("/audit-logs", adminH.ListAuditLogs)
			ar.Get("/titles", adminH.ListTitles)
			ar.Post("/titles", adminH.CreateTitle)
			ar.Put("/titles/{id}", adminH.UpdateTitle)
			ar.Delete("/titles/{id}", adminH.DeleteTitle)
		})
	})

	r.Get("/api/v1/ws/chat", chatH.WebSocket)

	return r
}
