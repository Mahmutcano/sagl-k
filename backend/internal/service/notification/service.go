package notification

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"strings"

	"github.com/google/uuid"
	"medical-consultation-platform/backend/internal/config"
	"medical-consultation-platform/backend/internal/repository"
)

type SMSProvider interface {
	Send(ctx context.Context, phone, message string) error
}

type EmailProvider interface {
	Send(ctx context.Context, to, subject, body string) error
}

type Service struct {
	cfg config.Config
	db  *repository.DB
	sms SMSProvider
	em  EmailProvider
}

func NewService(cfg config.Config, db *repository.DB, sms SMSProvider, em EmailProvider) *Service {
	return &Service{cfg: cfg, db: db, sms: sms, em: em}
}

func (s *Service) SendSMS(ctx context.Context, phone, templateKey, message string, userID, appID *uuid.UUID) (string, error) {
	code := fmt.Sprintf("%06d", rand.Intn(900000)+100000)
	full := fmt.Sprintf("%s Kodunuz: %s", message, code)
	status := "sent"
	if err := s.sms.Send(ctx, phone, full); err != nil {
		status = "failed"
		_ = s.db.LogNotification(ctx, "sms", phone, templateKey, status, userID, appID, full)
		return "", err
	}
	_ = s.db.LogNotification(ctx, "sms", phone, templateKey, status, userID, appID, full)
	return code, nil
}

func (s *Service) SendWelcomeEmail(ctx context.Context, userID uuid.UUID, email, firstName string) {
	if strings.TrimSpace(email) == "" {
		return
	}
	name := strings.TrimSpace(firstName)
	if name == "" {
		name = "Değerli hasta"
	}
	body := fmt.Sprintf("Merhaba %s,\n\nHesabınız başarıyla oluşturuldu. Sağlık danışmanlık platformumuza hoş geldiniz.\n\nSaygılarımızla", name)
	_ = s.SendEmail(ctx, email, "Hoş geldiniz", "welcome", body, &userID)
}

func (s *Service) SendPaymentConfirmation(ctx context.Context, userID uuid.UUID, email, appNumber string, amount float64) {
	if strings.TrimSpace(email) == "" {
		return
	}
	body := fmt.Sprintf(
		"Ödemeniz alındı.\n\nBaşvuru no: %s\nTutar: %.2f TRY\n\nBaşvurunuz işleme alınacaktır.\n\nSaygılarımızla",
		appNumber, amount,
	)
	_ = s.SendEmail(ctx, email, "Ödeme onayı", "payment_confirmed", body, &userID)
}

func (s *Service) SendReportReadyEmail(ctx context.Context, userID uuid.UUID, email, appNumber string, appID uuid.UUID) {
	if strings.TrimSpace(email) == "" {
		return
	}
	body := fmt.Sprintf(
		"Başvurunuz sonuçlandırıldı.\n\nBaşvuru no: %s\n\nRaporunuzu hasta panelinden görüntüleyebilirsiniz.\n\nSaygılarımızla",
		appNumber,
	)
	_ = s.SendEmail(ctx, email, "Raporunuz hazır", "report_ready", body, &userID)
}

func (s *Service) SendEmail(ctx context.Context, to, subject, templateKey, body string, userID *uuid.UUID) error {
	status := "sent"
	if err := s.em.Send(ctx, to, subject, body); err != nil {
		status = "failed"
		_ = s.db.LogNotification(ctx, "email", to, templateKey, status, userID, nil, body)
		return err
	}
	return s.db.LogNotification(ctx, "email", to, templateKey, status, userID, nil, body)
}

// Mock providers for development
type MockSMS struct{}

func (MockSMS) Send(ctx context.Context, phone, message string) error {
	log.Printf("[SMS MOCK] to=%s msg=%s", phone, message)
	return nil
}

type MockEmail struct{}

func (MockEmail) Send(ctx context.Context, to, subject, body string) error {
	log.Printf("[EMAIL MOCK] to=%s subject=%s", to, subject)
	return nil
}
