package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	appcfg "medical-consultation-platform/backend/internal/config"
)

type MailerSendEmail struct {
	apiKey   string
	from     string
	fromName string
	client   *http.Client
}

func NewMailerSendEmail(cfg appcfg.EmailConfig) (*MailerSendEmail, error) {
	if strings.TrimSpace(cfg.MailerSendAPIKey) == "" {
		return nil, errors.New("MAILERSEND_API_KEY zorunludur")
	}
	from := strings.TrimSpace(cfg.MailerSendFrom)
	if from == "" {
		from = strings.TrimSpace(cfg.From)
	}
	if from == "" {
		return nil, errors.New("MAILERSEND_FROM_EMAIL zorunludur")
	}
	name := strings.TrimSpace(cfg.MailerSendFromName)
	if name == "" {
		name = "Bildirim"
	}
	return &MailerSendEmail{
		apiKey:   cfg.MailerSendAPIKey,
		from:     from,
		fromName: name,
		client:   &http.Client{Timeout: 30 * time.Second},
	}, nil
}

func (m *MailerSendEmail) Send(ctx context.Context, to, subject, body string) error {
	to = strings.TrimSpace(to)
	if to == "" {
		return errors.New("alıcı e-posta boş")
	}
	payload := map[string]interface{}{
		"from": map[string]string{
			"email": m.from,
			"name":  m.fromName,
		},
		"to": []map[string]string{
			{"email": to},
		},
		"subject": subject,
		"text":    body,
	}
	raw, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.mailersend.com/v1/email", bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+m.apiKey)
	res, err := m.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	respBody, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("mailersend HTTP %d: %s", res.StatusCode, strings.TrimSpace(string(respBody)))
	}
	return nil
}
