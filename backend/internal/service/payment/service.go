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
	param           Provider
	bizimHesap      Provider
	defaultProvider string
	store           *Store
	requireCard     bool
}

func NewService(param, bizimHesap Provider, store *Store, defaultProvider string, requireCard bool) *Service {
	return &Service{
		param:           param,
		bizimHesap:      bizimHesap,
		store:           store,
		defaultProvider: NormalizeProvider(defaultProvider),
		requireCard:     requireCard,
	}
}

func (s *Service) RequireCard() bool { return s.requireCard }

func (s *Service) Store() *Store { return s.store }

func (s *Service) Checkout(ctx context.Context, providerName string, req CheckoutRequest) (*CheckoutResult, error) {
	p := s.resolve(providerName)
	return p.Checkout(ctx, req)
}

func (s *Service) Refund(ctx context.Context, providerName, transactionID string, amount float64, reason string) (string, error) {
	return s.resolve(providerName).Refund(ctx, transactionID, amount, reason)
}

func (s *Service) resolve(name string) Provider {
	switch NormalizeProvider(name) {
	case "bizim_hesap":
		return s.bizimHesap
	case "param":
		return s.param
	default:
		if s.defaultProvider == "bizim_hesap" {
			return s.bizimHesap
		}
		return s.param
	}
}

func NormalizeProviderInput(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	if name == "" {
		return "param"
	}
	return NormalizeProvider(name)
}
