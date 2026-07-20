package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	appcfg "medical-consultation-platform/backend/internal/config"
	"medical-consultation-platform/backend/internal/handler"
	jwtmgr "medical-consultation-platform/backend/internal/pkg/jwt"
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

func main() {
	// .env dosyası shell'deki mock değerlerin üzerine yazılsın (godotenv.Load override etmez).
	_ = godotenv.Overload()
	_ = godotenv.Overload("../.env")
	cfg := appcfg.Load()

	if err := notifysvc.ValidateProviderConfig(cfg); err != nil {
		log.Printf("[config] provider warning: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	db, err := repository.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()

	jwt := jwtmgr.NewManager(cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)
	sms, em := notifysvc.NewProviders(cfg)
	notify := notifysvc.NewService(cfg, db, sms, em)
	auth := authsvc.NewService(cfg, db, jwt, notify)
	erciyesSvc := erciyes.NewService(cfg)
	app := appsvc.NewService(db)
	chat := chatsvc.NewService(db)
	payStore := paysvc.NewStore(db)
	paytr := paysvc.NewPayTRProvider(cfg.PayTR)
	payment := paysvc.NewService(paytr, payStore, cfg.PayTR)
	invoiceSvc := invoicesvc.NewService(cfg.Parasut)

	auditLog := audit.NewLogger(db.Pool)

	router := handler.NewRouter(handler.Deps{
		Cfg:     cfg,
		DB:      db,
		JWT:     jwt,
		Auth:    auth,
		App:     app,
		Chat:    chat,
		Notify:  notify,
		Payment: payment,
		Invoice: invoiceSvc,
		Erciyes: erciyesSvc,
		Audit:   auditLog,
	})

	srv := &http.Server{
		Addr:         ":" + cfg.APIPort,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("api listening on :%s (paytr mode=%s)", cfg.APIPort, cfg.PayTR.Mode)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
