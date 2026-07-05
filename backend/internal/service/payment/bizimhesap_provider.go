package payment

import (
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

type bizimHesapProvider struct {
	cfg    appcfg.BizimHesapConfig
	client *http.Client
}

func NewBizimHesapProvider(cfg appcfg.BizimHesapConfig) Provider {
	return &bizimHesapProvider{
		cfg:    cfg,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (b *bizimHesapProvider) Name() string { return "bizim_hesap" }

func (b *bizimHesapProvider) Checkout(ctx context.Context, req CheckoutRequest) (*CheckoutResult, error) {
	if b.cfg.Mode == "test" {
		return &CheckoutResult{
			TransactionID: "bh-test-" + req.IdempotencyKey,
			OrderID:       req.ApplicationID,
			Status:        "paid",
		}, nil
	}
	if err := b.validateLive(); err != nil {
		return nil, err
	}
	apiURL := strings.TrimRight(b.cfg.APIURL, "/") + "/payments/charge"
	payload := map[string]interface{}{
		"firmId":        b.cfg.FirmID,
		"orderId":       req.ApplicationID,
		"amount":        req.Amount,
		"currency":      req.Currency,
		"customerName":  req.CustomerName,
		"customerEmail": req.CustomerEmail,
		"customerPhone": req.CustomerPhone,
		"cardHolder":    req.CardHolder,
		"cardNumber":    req.CardNumber,
		"expiryMonth":   req.ExpiryMonth,
		"expiryYear":    req.ExpiryYear,
		"cvv":           req.CVV,
	}
	body, err := b.post(ctx, apiURL, payload)
	if err != nil {
		return nil, err
	}
	var res struct {
		TransactionID string  `json:"transactionId"`
		Status        string  `json:"status"`
		RedirectURL   *string `json:"redirectUrl"`
		Message       string  `json:"message"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, fmt.Errorf("bizimhesap yanıtı okunamadı")
	}
	if res.Status == "" {
		return nil, fmt.Errorf("bizimhesap ödeme başarısız: %s", res.Message)
	}
	return &CheckoutResult{
		TransactionID: res.TransactionID,
		OrderID:       req.ApplicationID,
		Status:        res.Status,
		RedirectURL:   res.RedirectURL,
	}, nil
}

func (b *bizimHesapProvider) Refund(ctx context.Context, transactionID string, amount float64, reason string) (string, error) {
	if b.cfg.Mode == "test" {
		return "bh-refund-" + transactionID, nil
	}
	if err := b.validateLive(); err != nil {
		return "", err
	}
	apiURL := strings.TrimRight(b.cfg.APIURL, "/") + "/payments/refund"
	payload := map[string]interface{}{
		"firmId":        b.cfg.FirmID,
		"transactionId": transactionID,
		"amount":        amount,
		"reason":        reason,
	}
	body, err := b.post(ctx, apiURL, payload)
	if err != nil {
		return "", err
	}
	var res struct {
		RefundID string `json:"refundId"`
		Message  string `json:"message"`
	}
	if err := json.Unmarshal(body, &res); err != nil || res.RefundID == "" {
		return "", fmt.Errorf("bizimhesap iade başarısız: %s", res.Message)
	}
	return res.RefundID, nil
}

func (b *bizimHesapProvider) validateLive() error {
	if strings.TrimSpace(b.cfg.APIKey) == "" || strings.TrimSpace(b.cfg.FirmID) == "" {
		return errors.New("bizimhesap canlı mod için BIZIMHESAP_API_KEY ve BIZIMHESAP_FIRM_ID zorunludur")
	}
	if strings.TrimSpace(b.cfg.APIURL) == "" {
		return errors.New("bizimhesap canlı mod için BIZIMHESAP_API_URL zorunludur")
	}
	return nil
}

func (b *bizimHesapProvider) post(ctx context.Context, url string, payload map[string]interface{}) ([]byte, error) {
	bodyBytes, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+b.cfg.APIKey)
	resp, err := b.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("bizimhesap API: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("bizimhesap API HTTP %d: %s", resp.StatusCode, string(body))
	}
	return body, nil
}
