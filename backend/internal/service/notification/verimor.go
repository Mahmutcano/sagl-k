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

type VerimorSMS struct {
	username   string
	password   string
	sourceAddr string
	apiURL     string
	client     *http.Client
}

func NewVerimorSMS(cfg appcfg.SMSConfig) (*VerimorSMS, error) {
	if strings.TrimSpace(cfg.Username) == "" || strings.TrimSpace(cfg.Password) == "" {
		return nil, errors.New("VERIMOR_USERNAME ve VERIMOR_PASSWORD zorunludur")
	}
	apiURL := strings.TrimSpace(cfg.VerimorURL)
	if apiURL == "" {
		apiURL = "https://sms.verimor.com.tr/v2/send.json"
	}
	source := strings.TrimSpace(cfg.Header)
	if source == "" {
		return nil, errors.New("VERIMOR_SOURCE_ADDR (veya SMS_HEADER) zorunludur")
	}
	return &VerimorSMS{
		username:   cfg.Username,
		password:   cfg.Password,
		sourceAddr: source,
		apiURL:     apiURL,
		client:     &http.Client{Timeout: 20 * time.Second},
	}, nil
}

func (v *VerimorSMS) Send(ctx context.Context, phone, message string) error {
	phone = strings.TrimSpace(phone)
	phone = strings.TrimPrefix(phone, "+")
	if phone == "" {
		return errors.New("telefon numarası boş")
	}
	payload := map[string]interface{}{
		"username":    v.username,
		"password":    v.password,
		"source_addr": v.sourceAddr,
		"messages": []map[string]string{
			{"msg": message, "dest": phone},
		},
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.apiURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := v.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	respBody, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("verimor HTTP %d: %s", res.StatusCode, strings.TrimSpace(string(respBody)))
	}
	return nil
}
