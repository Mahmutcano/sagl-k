package payment

import (
	"errors"
	"fmt"
	"strings"
)

// Param sandbox test cards — https://dev.param.com.tr/tr/test-kartlari
var paramTestSuccessCards = []struct {
	number string
	month  int
	year   int // 2-digit YY
	cvv    string
	label  string
}{
	{number: "4546711234567894", month: 12, year: 26, cvv: "000", label: "Ziraat VISA"},
	{number: "5571135571135575", month: 12, year: 26, cvv: "000", label: "Akbank Mastercard"},
	{number: "4531444531442283", month: 12, year: 26, cvv: "001", label: "Halkbank VISA"},
	{number: "4508034508034509", month: 12, year: 26, cvv: "000", label: "İş Bankası VISA"},
	{number: "5400611072814659", month: 8, year: 28, cvv: "000", label: "Yapı Kredi Mastercard"},
}

// Param sandbox CVV error simulation (only for cards with CVV 000 or 001).
var paramTestCVVErrors = map[string]string{
	"120": "Geçersiz işlem (Param test CVV 120)",
	"340": "Fraud şüphesi (Param test CVV 340)",
	"510": "Limit yetersiz (Param test CVV 510)",
}

func normalizeCardDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func paramTestCheckout(req CheckoutRequest) (*CheckoutResult, error) {
	card := normalizeCardDigits(req.CardNumber)
	cvv := strings.TrimSpace(req.CVV)

	if card == "" {
		return nil, errors.New("test modunda geçerli bir Param test kartı girilmelidir")
	}
	if req.CardHolder == "" {
		return nil, errors.New("kart üzerindeki isim zorunludur")
	}
	if req.ExpiryMonth < 1 || req.ExpiryMonth > 12 {
		return nil, errors.New("geçersiz son kullanma ayı")
	}

	if msg, ok := paramTestCVVErrors[cvv]; ok {
		return nil, errors.New(msg)
	}

	matched := false
	for _, tc := range paramTestSuccessCards {
		if card == tc.number && req.ExpiryMonth == tc.month && req.ExpiryYear%100 == tc.year && cvv == tc.cvv {
			matched = true
			break
		}
	}
	if !matched {
		return nil, fmt.Errorf(
			"geçersiz Param test kartı — örnek: %s, SKT 12/26, CVV 000",
			paramTestSuccessCards[0].number,
		)
	}

	return &CheckoutResult{
		TransactionID: "param-test-" + req.IdempotencyKey,
		OrderID:       req.ApplicationID,
		Status:        "paid",
	}, nil
}

func DefaultParamTestCard() (number string, month, year int, cvv, holder string) {
	tc := paramTestSuccessCards[0]
	return tc.number, tc.month, tc.year, tc.cvv, "TEST KULLANICI"
}
