package main

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	appcfg "medical-consultation-platform/backend/internal/config"
	"medical-consultation-platform/backend/internal/repository"
	notifysvc "medical-consultation-platform/backend/internal/service/notification"
)

// One-shot: sends a test email through the app notification stack (logs to notification_logs).
// Usage: go run ./cmd/mailtest [to@email.com]
func main() {
	_ = godotenv.Overload()
	_ = godotenv.Overload("../.env")
	// Ensure live MailerSend even if parent shell still has EMAIL_PROVIDER=mock
	_ = os.Setenv("EMAIL_PROVIDER", "mailersend")
	if os.Getenv("MAILERSEND_FROM_EMAIL") == "" || strings.Contains(os.Getenv("MAILERSEND_FROM_EMAIL"), "example.com") {
		_ = os.Setenv("MAILERSEND_FROM_EMAIL", "noreply@test-69oxl5ek682l785k.mlsender.net")
	}

	cfg := appcfg.Load()
	to := "ozgancan9@gmail.com"
	if len(os.Args) > 1 && os.Args[1] != "" {
		to = os.Args[1]
	}

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	db, err := repository.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()

	_, em := notifysvc.NewProviders(cfg)
	notify := notifysvc.NewService(cfg, db, notifysvc.MockSMS{}, em)

	body := "Bu bir test e-postasıdır.\n\nUygulama bildirim servisi (MailerSend) üzerinden gönderildi.\nAdmin E-posta Raporu'nda görünmelidir."
	if err := notify.SendEmail(ctx, to, "Test — Tıbbi Danışmanlık", "mail_test", body, nil); err != nil {
		log.Fatalf("send failed: %v", err)
	}
	log.Printf("ok: sent to %s (template=mail_test) — check admin notifications", to)
}
