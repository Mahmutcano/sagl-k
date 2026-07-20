package payment

import (
	"context"
	"strings"

	appcfg "medical-consultation-platform/backend/internal/config"
)

type CheckoutRequest struct {
	ApplicationID  string
	Amount         float64
	Currency       string
	CustomerName   string
	CustomerEmail  string
	CustomerPhone  string
	CardHolder     string
	CardNumber     string
	ExpiryMonth    int
	ExpiryYear     int
	CVV            string
	IdempotencyKey string
	SuccessURL     string
	FailURL        string
	UserIP         string
}

type CheckoutResult struct {
	TransactionID string
	OrderID       string
	Status        string
	RedirectURL   *string
	RedirectHTML  *string
	PaymentID     string
	Token         string
	IframeURL     string
	MerchantOID   string
	Mock          bool
}

type Service struct {
	paytr       *PayTRProvider
	store       *Store
	requireCard bool
	cfg         appcfg.PayTRConfig
}

func NewService(paytr *PayTRProvider, store *Store, cfg appcfg.PayTRConfig) *Service {
	return &Service{
		paytr:       paytr,
		store:       store,
		requireCard: false,
		cfg:         cfg,
	}
}

func (s *Service) RequireCard() bool { return false }

func (s *Service) Store() *Store { return s.store }

func (s *Service) PayTR() *PayTRProvider { return s.paytr }

func (s *Service) Refund(ctx context.Context, providerName, transactionID string, amount float64, reason string) (string, error) {
	_ = providerName
	return s.paytr.Refund(ctx, transactionID, amount, reason)
}

func NormalizeProviderInput(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	if name == "" {
		return "paytr"
	}
	return NormalizeProvider(name)
}
