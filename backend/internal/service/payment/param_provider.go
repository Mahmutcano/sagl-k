package payment

import (
	"context"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	appcfg "medical-consultation-platform/backend/internal/config"
)

type paramProvider struct {
	cfg    appcfg.ParamConfig
	client *http.Client
}

func NewParamProvider(cfg appcfg.ParamConfig) Provider {
	return &paramProvider{
		cfg:    cfg,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *paramProvider) Name() string { return "param" }

func (p *paramProvider) Checkout(ctx context.Context, req CheckoutRequest) (*CheckoutResult, error) {
	if err := p.validateLiveCredentials(); err != nil && p.cfg.Mode != "test" {
		return nil, err
	}
	if p.cfg.Mode == "test" {
		return &CheckoutResult{
			TransactionID: "param-test-" + req.IdempotencyKey,
			OrderID:       req.ApplicationID,
			Status:        "paid",
		}, nil
	}
	return p.chargeLive(ctx, req)
}

func (p *paramProvider) Refund(ctx context.Context, transactionID string, amount float64, reason string) (string, error) {
	if p.cfg.Mode == "test" {
		return "param-refund-" + transactionID, nil
	}
	if err := p.validateLiveCredentials(); err != nil {
		return "", err
	}
	apiURL := strings.TrimRight(p.cfg.APIURL, "/") + "/refund"
	payload := map[string]interface{}{
		"clientCode":    p.cfg.ClientCode,
		"guid":          p.cfg.GUID,
		"transactionId": transactionID,
		"amount":        amount,
		"reason":        reason,
	}
	hash := p.signRefund(transactionID, amount)
	payload["hash"] = hash
	body, err := p.postJSON(ctx, apiURL, payload)
	if err != nil {
		return "", err
	}
	var res struct {
		RefundID string `json:"refundId"`
		Status   string `json:"status"`
		Message  string `json:"message"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return "", fmt.Errorf("param iade yanıtı okunamadı")
	}
	if res.RefundID == "" {
		return "", fmt.Errorf("param iade başarısız: %s", res.Message)
	}
	return res.RefundID, nil
}

func (p *paramProvider) validateLiveCredentials() error {
	if strings.TrimSpace(p.cfg.ClientCode) == "" ||
		strings.TrimSpace(p.cfg.ClientUsername) == "" ||
		strings.TrimSpace(p.cfg.ClientPassword) == "" ||
		strings.TrimSpace(p.cfg.GUID) == "" {
		return errors.New("param canlı mod için PARAM_CLIENT_CODE, PARAM_CLIENT_USERNAME, PARAM_CLIENT_PASSWORD ve PARAM_GUID zorunludur")
	}
	if strings.TrimSpace(p.cfg.APIURL) == "" {
		return errors.New("param canlı mod için PARAM_API_URL zorunludur")
	}
	return nil
}

func (p *paramProvider) chargeLive(ctx context.Context, req CheckoutRequest) (*CheckoutResult, error) {
	apiURL := strings.TrimRight(p.cfg.APIURL, "/") + "/charge"
	orderID := req.ApplicationID
	amountStr := fmt.Sprintf("%.2f", req.Amount)
	hash := p.signCharge(orderID, amountStr)

	payload := map[string]interface{}{
		"clientCode":     p.cfg.ClientCode,
		"clientUsername": p.cfg.ClientUsername,
		"clientPassword": p.cfg.ClientPassword,
		"guid":           p.cfg.GUID,
		"orderId":        orderID,
		"amount":         req.Amount,
		"currency":       req.Currency,
		"cardHolder":     req.CardHolder,
		"cardNumber":     req.CardNumber,
		"expiryMonth":    req.ExpiryMonth,
		"expiryYear":     req.ExpiryYear,
		"cvv":            req.CVV,
		"customerName":   req.CustomerName,
		"customerEmail":  req.CustomerEmail,
		"customerPhone":  req.CustomerPhone,
		"successUrl":     req.SuccessURL,
		"failUrl":        req.FailURL,
		"hash":           hash,
	}

	body, err := p.postJSON(ctx, apiURL, payload)
	if err != nil {
		return nil, err
	}
	var res struct {
		TransactionID string  `json:"transactionId"`
		OrderID       string  `json:"orderId"`
		Status        string  `json:"status"`
		RedirectURL   *string `json:"redirectUrl"`
		Message       string  `json:"message"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, fmt.Errorf("param ödeme yanıtı okunamadı")
	}
	if res.Status == "" {
		return nil, fmt.Errorf("param ödeme başarısız: %s", res.Message)
	}
	return &CheckoutResult{
		TransactionID: res.TransactionID,
		OrderID:       res.OrderID,
		Status:        res.Status,
		RedirectURL:   res.RedirectURL,
	}, nil
}

func (p *paramProvider) signCharge(orderID, amount string) string {
	raw := p.cfg.ClientCode + p.cfg.GUID + orderID + amount + p.cfg.ClientPassword
	return sha512Hex(raw)
}

func (p *paramProvider) signRefund(transactionID string, amount float64) string {
	raw := p.cfg.ClientCode + p.cfg.GUID + transactionID + fmt.Sprintf("%.2f", amount) + p.cfg.ClientPassword
	return sha512Hex(raw)
}

func (p *paramProvider) postJSON(ctx context.Context, url string, payload map[string]interface{}) ([]byte, error) {
	b, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(string(b)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("param API: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("param API HTTP %d: %s", resp.StatusCode, string(body))
	}
	return body, nil
}

func sha512Hex(s string) string {
	sum := sha512.Sum512([]byte(s))
	return hex.EncodeToString(sum[:])
}
