package invoice

import (
	"context"
)

type CreateRequest struct {
	OrderID           string
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
	PDFURL        string
	Raw           map[string]interface{}
}

// Provider abstracts e-invoice backends (Paraşüt, etc.).
type Provider interface {
	Name() string
	Create(ctx context.Context, req CreateRequest) (*CreateResult, error)
}
