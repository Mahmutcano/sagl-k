package invoice

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

type CreateRequest struct {
	PaymentID         string
	ApplicationID     string
	ApplicationNumber string
	Amount            float64
	Currency          string
	CustomerName      string
	CustomerEmail     string
	CustomerPhone     string
	TransactionID     string
	Description       string
}

type CreateResult struct {
	InvoiceID     string
	InvoiceNumber string
	Status        string
}

type Service struct {
	cfg    appcfg.BizimHesapConfig
	client *http.Client
}

func NewService(cfg appcfg.BizimHesapConfig) *Service {
	return &Service{
		cfg:    cfg,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (s *Service) Create(ctx context.Context, req CreateRequest) (*CreateResult, error) {
	if s.cfg.Mode == "test" {
		num := req.ApplicationNumber
		if num == "" {
			num = req.ApplicationID[:8]
		}
		return &CreateResult{
			InvoiceID:     "bh-inv-test-" + req.PaymentID,
			InvoiceNumber: "BH-TEST-" + num,
			Status:        "issued",
		}, nil
	}
	return s.createLive(ctx, req)
}

func (s *Service) createLive(ctx context.Context, req CreateRequest) (*CreateResult, error) {
	if strings.TrimSpace(s.cfg.APIKey) == "" || strings.TrimSpace(s.cfg.FirmID) == "" {
		return nil, errors.New("bizimhesap canlı mod için BIZIMHESAP_API_KEY ve BIZIMHESAP_FIRM_ID zorunludur")
	}
	apiURL := strings.TrimRight(s.cfg.APIURL, "/") + "/invoices"
	payload := map[string]interface{}{
		"firmId":        s.cfg.FirmID,
		"orderId":       req.ApplicationID,
		"paymentRef":    req.TransactionID,
		"amount":        req.Amount,
		"currency":      req.Currency,
		"customerName":  req.CustomerName,
		"customerEmail": req.CustomerEmail,
		"customerPhone": req.CustomerPhone,
		"description":   req.Description,
	}
	bodyBytes, _ := json.Marshal(payload)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+s.cfg.APIKey)
	resp, err := s.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("bizimhesap fatura API: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("bizimhesap fatura API HTTP %d: %s", resp.StatusCode, string(body))
	}
	var res struct {
		InvoiceID     string `json:"invoiceId"`
		InvoiceNumber string `json:"invoiceNumber"`
		Status        string `json:"status"`
		Message       string `json:"message"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, fmt.Errorf("bizimhesap fatura yanıtı okunamadı")
	}
	if res.InvoiceID == "" {
		return nil, fmt.Errorf("bizimhesap fatura oluşturulamadı: %s", res.Message)
	}
	return &CreateResult{
		InvoiceID:     res.InvoiceID,
		InvoiceNumber: res.InvoiceNumber,
		Status:        res.Status,
	}, nil
}
