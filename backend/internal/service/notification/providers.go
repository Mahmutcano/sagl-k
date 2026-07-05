package notification

import (
	"fmt"
	"log"
	"strings"

	appcfg "medical-consultation-platform/backend/internal/config"
)

func NewProviders(cfg appcfg.Config) (SMSProvider, EmailProvider) {
	sms := newSMSProvider(cfg.SMS)
	em := newEmailProvider(cfg.Email)
	return sms, em
}

func newSMSProvider(cfg appcfg.SMSConfig) SMSProvider {
	switch strings.ToLower(strings.TrimSpace(cfg.Provider)) {
	case "", "mock":
		log.Println("[notification] SMS provider: mock")
		return MockSMS{}
	case "netgsm":
		p, err := NewNetgsmSMS(cfg.Username, cfg.Password, cfg.Header)
		if err != nil {
			log.Printf("[notification] netgsm init failed, falling back to mock: %v", err)
			return MockSMS{}
		}
		log.Println("[notification] SMS provider: netgsm")
		return p
	default:
		log.Printf("[notification] unknown SMS_PROVIDER=%q, using mock", cfg.Provider)
		return MockSMS{}
	}
}

func newEmailProvider(cfg appcfg.EmailConfig) EmailProvider {
	switch strings.ToLower(strings.TrimSpace(cfg.Provider)) {
	case "", "mock":
		log.Println("[notification] Email provider: mock")
		return MockEmail{}
	case "smtp":
		p, err := NewSMTPEmail(cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.From)
		if err != nil {
			log.Printf("[notification] smtp init failed, falling back to mock: %v", err)
			return MockEmail{}
		}
		log.Println("[notification] Email provider: smtp")
		return p
	default:
		log.Printf("[notification] unknown EMAIL_PROVIDER=%q, using mock", cfg.Provider)
		return MockEmail{}
	}
}

// ValidateProviderConfig returns an error if live providers are misconfigured.
func ValidateProviderConfig(cfg appcfg.Config) error {
	if strings.EqualFold(cfg.SMS.Provider, "netgsm") {
		if _, err := NewNetgsmSMS(cfg.SMS.Username, cfg.SMS.Password, cfg.SMS.Header); err != nil {
			return fmt.Errorf("sms: %w", err)
		}
	}
	if strings.EqualFold(cfg.Email.Provider, "smtp") {
		if _, err := NewSMTPEmail(cfg.Email.Host, cfg.Email.Port, cfg.Email.User, cfg.Email.Password, cfg.Email.From); err != nil {
			return fmt.Errorf("email: %w", err)
		}
	}
	return nil
}
