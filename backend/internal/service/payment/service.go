package payment

import (
	"context"
	"strings"
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
}

type CheckoutResult struct {
	TransactionID string
	OrderID       string
	Status        string
	RedirectURL   *string
	RedirectHTML  *string
	PaymentID     string
}

type Provider interface {
	Name() string
	Checkout(ctx context.Context, req CheckoutRequest) (*CheckoutResult, error)
	Refund(ctx context.Context, transactionID string, amount float64, reason string) (string, error)
}

type Service struct {
	param      Provider
	store      *Store
	requireCard bool
}

func NewService(param Provider, store *Store, requireCard bool) *Service {
	return &Service{
		param:       param,
		store:       store,
		requireCard: requireCard,
	}
}

func (s *Service) RequireCard() bool { return s.requireCard }

func (s *Service) Store() *Store { return s.store }

func (s *Service) Checkout(ctx context.Context, _ string, req CheckoutRequest) (*CheckoutResult, error) {
	return s.param.Checkout(ctx, req)
}

func (s *Service) Refund(ctx context.Context, providerName, transactionID string, amount float64, reason string) (string, error) {
	// Refunds always go through Param (payment provider).
	if NormalizeProvider(providerName) == "bizim_hesap" {
		providerName = "param"
	}
	return s.param.Refund(ctx, transactionID, amount, reason)
}

func NormalizeProviderInput(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	if name == "" {
		return "param"
	}
	return NormalizeProvider(name)
}
