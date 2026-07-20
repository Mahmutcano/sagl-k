package notification

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"strings"

	"github.com/google/uuid"
	"medical-consultation-platform/backend/internal/config"
	"medical-consultation-platform/backend/internal/pkg/validate"
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

func (s *Service) SendSMSDirect(ctx context.Context, phone, templateKey, message string, userID, appID *uuid.UUID) error {
	status := "sent"
	if err := s.sms.Send(ctx, phone, message); err != nil {
		status = "failed"
		_ = s.db.LogNotification(ctx, "sms", phone, templateKey, status, userID, appID, message)
		return err
	}
	_ = s.db.LogNotification(ctx, "sms", phone, templateKey, status, userID, appID, message)
	return nil
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
	s.SendPaymentConfirmationFull(ctx, userID, email, "", "", appNumber, amount, nil)
}

// SendPaymentConfirmationFull notifies the patient by email and optionally SMS.
func (s *Service) SendPaymentConfirmationFull(
	ctx context.Context,
	userID uuid.UUID,
	email, phoneCountry, phoneNational, appNumber string,
	amount float64,
	appID *uuid.UUID,
) {
	body := fmt.Sprintf(
		"Ödemeniz alındı.\n\nBaşvuru no: %s\nTutar: %.2f TRY\n\nBaşvurunuz ilgili hekime iletildi.\n\nSaygılarımızla",
		appNumber, amount,
	)
	if strings.TrimSpace(email) != "" {
		_ = s.SendEmailWithApp(ctx, email, "Ödeme onayı", "payment_confirmed", body, &userID, appID)
	}
	phone := strings.TrimSpace(phoneNational)
	if phone != "" {
		smsTo := strings.TrimPrefix(validate.ToE164(phoneCountry, phone), "+")
		msg := fmt.Sprintf(
			"Odemeniz alindi. Basvuru no: %s. Tutar: %.2f TL. Basvurunuz hekime iletildi.",
			appNumber, amount,
		)
		_ = s.SendSMSDirect(ctx, smsTo, "payment_confirmed", msg, &userID, appID)
	}
}

// NotifyDoctorNewPaidApplication sends SMS/email to the assigned doctor (care_provider flags).
func (s *Service) NotifyDoctorNewPaidApplication(ctx context.Context, appID uuid.UUID, appNumber string, amount float64) {
	var (
		doctorUserID                                              *uuid.UUID
		email, phone, phoneCC, doctorName, patientName, profession string
		smsEnabled, emailEnabled                                  bool
	)
	err := s.db.Pool.QueryRow(ctx, `
		SELECT
			COALESCE(a.doctor_user_id, cp.user_id),
			COALESCE(du.email, ''),
			COALESCE(du.phone_number, ''),
			COALESCE(du.phone_country_code, '+90'),
			COALESCE(NULLIF(TRIM(cp.full_name), ''), NULLIF(TRIM(du.first_name || ' ' || du.last_name), ''), 'Hekim'),
			COALESCE(cp.sms_enabled, true),
			COALESCE(cp.email_enabled, true),
			COALESCE(NULLIF(TRIM(pu.first_name || ' ' || pu.last_name), ''), 'Hasta'),
			COALESCE(a.profession_name, a.profession_code, '')
		FROM applications a
		LEFT JOIN care_providers cp ON cp.id = a.care_provider_id
		LEFT JOIN users du ON du.id = COALESCE(a.doctor_user_id, cp.user_id)
		LEFT JOIN users pu ON pu.id = a.owner_user_id
		WHERE a.id = $1
	`, appID).Scan(
		&doctorUserID, &email, &phone, &phoneCC, &doctorName, &smsEnabled, &emailEnabled, &patientName, &profession,
	)
	if err != nil {
		log.Printf("[notify] doctor lookup failed app=%s: %v", appID, err)
		return
	}
	if doctorUserID == nil {
		log.Printf("[notify] no doctor assigned for app=%s — doctor SMS/email skipped", appID)
		return
	}

	doctorURL := strings.TrimRight(s.cfg.DoctorURL, "/")
	if doctorURL == "" {
		doctorURL = strings.TrimRight(s.cfg.PortalURL, "/")
	}
	appLink := doctorURL + "/doctor/applications/" + appID.String()

	smsBody := fmt.Sprintf(
		"Yeni odemeli basvuru. No: %s. Hasta: %s. Tutar: %.2f TL. Panel: %s",
		appNumber, patientName, amount, appLink,
	)
	emailSubject := "Yeni ödenmiş başvuru — " + appNumber
	emailBody := fmt.Sprintf(
		"Sayın %s,\n\nYeni bir başvuru ödemesi tamamlandı ve size atandı.\n\nBaşvuru no: %s\nHasta: %s\nBranş: %s\nTutar: %.2f TRY\n\nBaşvuruyu incelemek için:\n%s\n\nSaygılarımızla",
		doctorName, appNumber, patientName, profession, amount, appLink,
	)

	if smsEnabled && strings.TrimSpace(phone) != "" {
		smsTo := strings.TrimPrefix(validate.ToE164(phoneCC, phone), "+")
		if err := s.SendSMSDirect(ctx, smsTo, "doctor_new_paid_application", smsBody, doctorUserID, &appID); err != nil {
			log.Printf("[notify] doctor SMS failed app=%s: %v", appID, err)
		}
	}
	if emailEnabled && strings.TrimSpace(email) != "" {
		if err := s.SendEmailWithApp(ctx, email, emailSubject, "doctor_new_paid_application", emailBody, doctorUserID, &appID); err != nil {
			log.Printf("[notify] doctor email failed app=%s: %v", appID, err)
		}
	}
}

func (s *Service) SendEmail(ctx context.Context, to, subject, templateKey, body string, userID *uuid.UUID) error {
	return s.SendEmailWithApp(ctx, to, subject, templateKey, body, userID, nil)
}

func (s *Service) SendEmailWithApp(ctx context.Context, to, subject, templateKey, body string, userID, appID *uuid.UUID) error {
	status := "sent"
	if err := s.em.Send(ctx, to, subject, body); err != nil {
		status = "failed"
		_ = s.db.LogNotification(ctx, "email", to, templateKey, status, userID, appID, body)
		return err
	}
	return s.db.LogNotification(ctx, "email", to, templateKey, status, userID, appID, body)
}

func (s *Service) SendReportReadyEmail(ctx context.Context, userID uuid.UUID, email, appNumber string, appID uuid.UUID) {
	if strings.TrimSpace(email) == "" {
		return
	}
	body := fmt.Sprintf(
		"Başvurunuz sonuçlandırıldı.\n\nBaşvuru no: %s\n\nRaporunuzu hasta panelinden görüntüleyebilirsiniz.\n\nSaygılarımızla",
		appNumber,
	)
	_ = s.SendEmailWithApp(ctx, email, "Raporunuz hazır", "report_ready", body, &userID, &appID)
}

func (s *Service) SendReportUpdatedEmail(ctx context.Context, userID uuid.UUID, email, appNumber string) {
	if strings.TrimSpace(email) == "" {
		return
	}
	body := fmt.Sprintf(
		"Başvurunuza ait rapor güncellendi.\n\nBaşvuru no: %s\n\nGüncel raporu hasta panelinden görüntüleyebilirsiniz.\n\nSaygılarımızla",
		appNumber,
	)
	_ = s.SendEmail(ctx, email, "Raporunuz güncellendi", "report_updated", body, &userID)
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
