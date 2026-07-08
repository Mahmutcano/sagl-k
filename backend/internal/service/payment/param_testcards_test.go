package payment

import "testing"

func TestParamTestCheckoutSuccess(t *testing.T) {
	res, err := paramTestCheckout(CheckoutRequest{
		CardHolder:  "TEST KULLANICI",
		CardNumber:  "4546 7112 3456 7894",
		ExpiryMonth: 12,
		ExpiryYear:  26,
		CVV:         "000",
		IdempotencyKey: "app-1",
		ApplicationID:  "app-1",
	})
	if err != nil {
		t.Fatalf("expected success: %v", err)
	}
	if res.Status != "paid" {
		t.Fatalf("expected paid, got %s", res.Status)
	}
	if res.TransactionID == "" {
		t.Fatal("expected transaction id")
	}
}

func TestParamTestCheckoutCVVError(t *testing.T) {
	_, err := paramTestCheckout(CheckoutRequest{
		CardHolder:  "TEST KULLANICI",
		CardNumber:  "4546711234567894",
		ExpiryMonth: 12,
		ExpiryYear:  26,
		CVV:         "510",
	})
	if err == nil {
		t.Fatal("expected CVV error")
	}
}

func TestParamTestCheckoutInvalidCard(t *testing.T) {
	_, err := paramTestCheckout(CheckoutRequest{
		CardHolder:  "TEST KULLANICI",
		CardNumber:  "4111111111111111",
		ExpiryMonth: 12,
		ExpiryYear:  26,
		CVV:         "000",
	})
	if err == nil {
		t.Fatal("expected invalid card error")
	}
}
