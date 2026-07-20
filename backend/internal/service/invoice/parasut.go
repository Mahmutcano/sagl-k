package invoice

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	appcfg "medical-consultation-platform/backend/internal/config"
)

// ParasutProvider issues e-invoices via Paraşüt (mock/test returns deterministic IDs).
type ParasutProvider struct {
	cfg appcfg.ParasutConfig
}

func NewParasutProvider(cfg appcfg.ParasutConfig) *ParasutProvider {
	return &ParasutProvider{cfg: cfg}
}

func (p *ParasutProvider) Name() string { return "parasut" }

func (p *ParasutProvider) Create(ctx context.Context, req CreateRequest) (*CreateResult, error) {
	_ = ctx
	mode := strings.ToLower(strings.TrimSpace(p.cfg.Mode))
	if mode == "" || mode == "mock" || mode == "test" {
		num := req.ApplicationNumber
		if num == "" {
			num = shortID(req.ApplicationID)
		}
		id := "ps-inv-" + shortID(req.PaymentID)
		if req.PaymentID == "" {
			id = "ps-inv-" + shortID(req.OrderID)
		}
		return &CreateResult{
			InvoiceID:     id,
			InvoiceNumber: "PS-" + strings.ToUpper(num),
			Status:        "issued",
			PDFURL:        "",
			Raw:           map[string]interface{}{"mode": mode, "mock": true},
		}, nil
	}

	if strings.TrimSpace(p.cfg.ClientID) == "" || strings.TrimSpace(p.cfg.CompanyID) == "" {
		return nil, errors.New("Paraşüt canlı mod için PARASUT_CLIENT_ID ve PARASUT_COMPANY_ID zorunludur")
	}
	// Live Paraşüt OAuth + sales invoice API is environment-specific.
	// Until credentials and product mappings are confirmed, fail loudly in live mode
	// rather than silently writing a fake invoice.
	return nil, fmt.Errorf("paraşüt canlı fatura API bağlantısı henüz yapılandırılmadı (company=%s)", p.cfg.CompanyID)
}

func shortID(s string) string {
	s = strings.ReplaceAll(s, "-", "")
	if len(s) > 8 {
		return s[:8]
	}
	if s == "" {
		return fmt.Sprintf("%d", time.Now().Unix()%100000000)
	}
	return s
}

// Service wraps an Invoice Provider (kept for handler compatibility).
type Service struct {
	provider Provider
}

func NewService(cfg appcfg.ParasutConfig) *Service {
	return &Service{provider: NewParasutProvider(cfg)}
}

func NewServiceWithProvider(p Provider) *Service {
	return &Service{provider: p}
}

func (s *Service) Create(ctx context.Context, req CreateRequest) (*CreateResult, error) {
	if s == nil || s.provider == nil {
		return nil, errors.New("fatura servisi yapılandırılmamış")
	}
	return s.provider.Create(ctx, req)
}

func (s *Service) ProviderName() string {
	if s == nil || s.provider == nil {
		return "parasut"
	}
	return s.provider.Name()
}
