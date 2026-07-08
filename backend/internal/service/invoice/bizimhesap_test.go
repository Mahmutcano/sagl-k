package invoice

import (
	"testing"

	appcfg "medical-consultation-platform/backend/internal/config"
)

func TestCreateTestMode(t *testing.T) {
	svc := NewService(appcfg.BizimHesapConfig{Mode: "test"})
	res, err := svc.Create(t.Context(), CreateRequest{
		PaymentID:         "pay-1",
		ApplicationID:     "app-1",
		ApplicationNumber: "BSV-000099",
		Amount:            1500,
		Currency:          "TRY",
		CustomerName:      "Test Hasta",
		CustomerEmail:     "test@example.com",
		TransactionID:     "param-test-1",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.InvoiceID != "bh-inv-test-pay-1" {
		t.Fatalf("unexpected invoice id: %s", res.InvoiceID)
	}
	if res.InvoiceNumber != "BH-TEST-BSV-000099" {
		t.Fatalf("unexpected invoice number: %s", res.InvoiceNumber)
	}
	if res.Status != "issued" {
		t.Fatalf("unexpected status: %s", res.Status)
	}
}
