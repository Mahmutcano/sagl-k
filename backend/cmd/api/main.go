package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	appcfg "medical-consultation-platform/backend/internal/config"
	"medical-consultation-platform/backend/internal/handler"
	jwtmgr "medical-consultation-platform/backend/internal/pkg/jwt"
	"medical-consultation-platform/backend/internal/repository"
	appsvc "medical-consultation-platform/backend/internal/service/application"
	authsvc "medical-consultation-platform/backend/internal/service/auth"
	"medical-consultation-platform/backend/internal/service/erciyes"
	notifysvc "medical-consultation-platform/backend/internal/service/notification"
	invoicesvc "medical-consultation-platform/backend/internal/service/invoice"
	paysvc "medical-consultation-platform/backend/internal/service/payment"
	"medical-consultation-platform/backend/internal/pkg/audit"
)

func main() {
	_ = godotenv.Load()
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
	app := appsvc.NewService(db, erciyesSvc)
	payStore := paysvc.NewStore(db)
	param := paysvc.NewParamProvider(cfg.Param)
	requireCard := strings.EqualFold(cfg.Param.Mode, "live") || strings.EqualFold(cfg.Param.Mode, "test")
	payment := paysvc.NewService(param, payStore, requireCard)
	invoiceSvc := invoicesvc.NewService(cfg.BizimHesap)

	auditLog := audit.NewLogger(db.Pool)

	router := handler.NewRouter(handler.Deps{
		Cfg:     cfg,
		DB:      db,
		JWT:     jwt,
		Auth:    auth,
		App:     app,
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
		log.Printf("api listening on :%s", cfg.APIPort)
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
